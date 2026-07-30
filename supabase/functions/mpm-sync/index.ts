// Market Price Monitor — robô de busca/validação/alerta.
// Fonte: SerpApi (Google Shopping) — cobre qualquer loja que o Google indexe (Mercado Livre,
// Amazon, Shopee, lojas próprias etc.), não só um marketplace específico. Trocamos da API
// direta do Mercado Livre pra cá porque o ML bloqueia busca de app terceiro por política,
// mesmo autenticado via OAuth.
// Zero IA (decisão de arquitetura): anúncio duvidoso vai pra fila de revisão manual em vez de
// chamada de IA — o score de confiança é 100% determinístico (EAN/SKU/palavras-chave).
// Chamado por um cron do Postgres (pg_cron + pg_net) a cada hora; ele mesmo decide se já é
// hora de rodar de verdade, olhando mpm_settings.search_interval_hours — assim o intervalo é
// ajustável pelo Hub sem precisar reagendar o cron.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MpmProductRow {
  id: string;
  product_id: string;
  min_price: number;
  keywords: string[];
  synonyms: string[];
  monitoring_status: string;
  product: {
    code: string;
    name: string;
    ean: string;
    brand: { label: string } | null;
  } | null;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildQueries(p: MpmProductRow): string[] {
  const queries: string[] = [];
  const brandLabel = p.product?.brand?.label ?? '';
  const name = p.product?.name ?? '';
  if (p.product?.ean) queries.push(p.product.ean);
  if (name) queries.push(name);
  if (brandLabel && name) queries.push(`${brandLabel} ${name}`);
  // Código interno (3-4 dígitos, ex. "6011") nunca vira busca sozinho: nenhum revendedor publica
  // o SKU interno da Cardoso no próprio anúncio (então isso não ajuda a achar concorrente de
  // verdade) e é a origem clássica de falso positivo — buscar só "6011" traz peça de rolamento
  // cujo SKU é "6011-2RS", "0301" traz tinta de modelismo, etc. Cortar aqui na origem é mais
  // eficaz (e mais barato de cota da SerpApi) do que só filtrar depois pontuando o resultado.
  // Palavras-chave/sinônimos ficam como busca própria, sem prefixo de marca — são cadastrados
  // justamente pra capturar como um revendedor costuma anunciar o produto, o que raramente
  // repete a marca fabricante (Cardoso/Playmi/Tópi) no título do anúncio.
  for (const k of (p.keywords ?? []).slice(0, 3)) queries.push(k);
  for (const s of (p.synonyms ?? []).slice(0, 3)) queries.push(s);
  return Array.from(new Set(queries.filter((q) => q.trim().length > 0)));
}

interface MatchResult {
  score: number;
  // true só quando o match veio de EAN ou código — nunca de heurística de nome/marca.
  // Só um match "confirmed" pode virar violação automática (high_confidence); heurística de
  // nome, por melhor que pareça, sempre cai em revisão manual.
  confirmed: boolean;
}

function scoreMatch(p: MpmProductRow, title: string): MatchResult {
  const normTitle = normalize(title);
  const ean = p.product?.ean ? normalize(p.product.ean) : '';
  const code = p.product?.code ? normalize(p.product.code) : '';
  const titleTokens = new Set(normTitle.split(' '));
  const brandLabel = p.product?.brand?.label ?? '';
  const brandTokens = normalize(brandLabel).split(' ').filter((t) => t.length > 2);
  const brandFound = brandTokens.length === 0 || brandTokens.some((t) => titleTokens.has(t));

  if (ean && normTitle.includes(ean)) return { score: 100, confirmed: true };

  // Código interno (3-4 dígitos, ex. "6011") não é um identificador globalmente único como o EAN —
  // pode coincidir de graça com o SKU de qualquer outro fabricante (ex.: rolamento Timken
  // "6011-2RS" batendo com o código interno "6011" de um brinquedo, mesmo sendo produtos
  // completamente diferentes). Só confirma automaticamente quando o título também cita a marca
  // (Cardoso/Playmi/Tópi); sem isso, cai no mesmo caminho heurístico de nome abaixo, que exige
  // termos do produto em comum e vai zerar o score pra um título de outro ramo inteiramente.
  if (code && brandFound && new RegExp(`\\b${code}\\b`).test(normTitle)) {
    return { score: 95, confirmed: true };
  }

  const nameTokens = new Set(normalize(p.product?.name ?? '').split(' ').filter((t) => t.length > 2));
  for (const k of [...(p.keywords ?? []), ...(p.synonyms ?? [])]) {
    for (const t of normalize(k).split(' ')) {
      if (t.length > 2) nameTokens.add(t);
    }
  }
  if (nameTokens.size === 0) return { score: 0, confirmed: false };
  let matched = 0;
  for (const t of nameTokens) if (titleTokens.has(t)) matched++;

  // Sem EAN/código pra confirmar, um único termo genérico batendo ("trator", "escolar") não
  // é suficiente pra considerar match — exige pelo menos 2 termos em comum quando há mais de um.
  if (matched < 2 && nameTokens.size > 1) return { score: 0, confirmed: false };

  let score = Math.round((matched / nameTokens.size) * 100);

  // Reforça com a marca: sem EAN/código, um anúncio legítimo de produto Cardoso/Playmi/Tópi
  // quase sempre cita a marca no título. Se não citar, penaliza a pontuação (não zera, porque
  // alguns vendedores omitem a marca) — reduz falso-positivo de nome genérico batendo com
  // produto de outro fabricante.
  if (!brandFound) score = Math.round(score * 0.5);

  return { score, confirmed: false };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const current = next++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

interface ShoppingResultItem {
  title: string;
  price?: string;
  extracted_price?: number;
  source?: string;
  product_link?: string;
  link?: string;
  thumbnail?: string;
  delivery?: string;
}

type Marketplace = 'mercado_livre' | 'amazon' | 'shopee' | 'google_shopping' | 'google_search';

function detectMarketplace(item: ShoppingResultItem): Marketplace {
  const haystack = `${item.source ?? ''} ${item.product_link ?? item.link ?? ''}`.toLowerCase();
  if (haystack.includes('mercadolivre') || haystack.includes('mercadolibre')) return 'mercado_livre';
  if (haystack.includes('amazon')) return 'amazon';
  if (haystack.includes('shopee')) return 'shopee';
  return 'google_shopping';
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchGoogleShopping(query: string, attempt = 0): Promise<ShoppingResultItem[]> {
  const apiKey = Deno.env.get('SERPAPI_KEY');
  if (!apiKey) {
    throw new Error('SERPAPI_KEY não configurada (supabase secrets set).');
  }
  const url = `https://serpapi.com/search?engine=google_shopping&q=${encodeURIComponent(query)}&gl=br&hl=pt&api_key=${apiKey}`;
  const res = await fetch(url);
  const body = await res.json();
  // "Google hasn't returned any results for this query." é a mensagem padrão da SerpApi pra busca
  // que genuinamente não achou nada (comum, ex.: EAN que não está indexado em nenhum anúncio) —
  // isso vem como HTTP 200 + campo "error" no corpo, mas NÃO é uma falha de verdade, é resultado
  // vazio legítimo. Só conta como falha real (cota esgotada, chave inválida, rate limit etc.),
  // que também podem vir como HTTP 200 + "error" — sem essa distinção, ou trata busca vazia
  // como erro (poluindo o alerta de falhas e travando a poda à toa), ou trata cota esgotada como
  // "sucesso, 0 resultados" e a poda de anúncios poderia apagar tudo achando que nada bateu de
  // propósito.
  const noResults = typeof body?.error === 'string' && /hasn.?t returned any results/i.test(body.error);
  if (noResults) {
    return [];
  }
  if (!res.ok || body?.error) {
    // 429 (rate limit) e 5xx costumam ser transitórios — tenta de novo com um pequeno atraso
    // antes de desistir. Erro de cota mensal esgotada ou chave inválida não se resolve com
    // retry, então propaga na hora.
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await sleep(800 * (attempt + 1));
      return searchGoogleShopping(query, attempt + 1);
    }
    throw new Error(`SerpApi falhou pra query "${query}" (HTTP ${res.status}): ${body?.error ?? JSON.stringify(body)}`);
  }
  return (body.shopping_results ?? []) as ShoppingResultItem[];
}

function extractPrice(item: ShoppingResultItem): number | null {
  if (typeof item.extracted_price === 'number') return item.extracted_price;
  if (!item.price) return null;
  const digits = item.price.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

async function notifyWebhook(webhookUrl: string, payload: unknown) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return false;
  }
}

async function notifyEmail(email: string, subject: string, text: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey || !email) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Cardoso Marketing Hub <alertas@cardosotoys.com.br>',
        to: [email],
        subject,
        text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function runSync(supabase: SupabaseClient, runId: string) {
  const { data: settings } = await supabase.from('mpm_settings').select('*').single();
  const { data: products } = await supabase
    .from('mpm_products')
    .select('*, product:products(code, name, ean, brand:brands(label))')
    .eq('monitoring_status', 'active');

  let listingsFound = 0;
  let violationsFound = 0;
  let queriesAttempted = 0;
  let queriesFailed = 0;
  let lastErrorSample = '';
  const rows = (products ?? []) as MpmProductRow[];

  // Processa produtos em paralelo, mas com concorrência baixa — a versão anterior usava 4×3=12
  // buscas simultâneas, o que provavelmente estourava o limite de taxa (ou a cota mensal) da
  // SerpApi e derrubava a maioria das buscas em silêncio (parecia "só sincronizou 1 produto").
  await mapLimit(rows, 2, async (p) => {
   try {
    const queries = buildQueries(p);
    const seenExternalIds = new Set<string>();
    // Ids que passaram no filtro de score nesta rodada — usado no fim pra podar anúncios antigos
    // que não foram reconfirmados (ex.: um "match" errado de uma versão anterior da busca, que a
    // busca de agora, mais restrita, simplesmente não traz mais).
    const reconfirmedExternalIds = new Set<string>();
    let productQueryFailed = false;

    const queryResults = await mapLimit(queries, 2, async (query) => {
      queriesAttempted++;
      try {
        return await searchGoogleShopping(query);
      } catch (err) {
        queriesFailed++;
        productQueryFailed = true;
        if (!lastErrorSample) lastErrorSample = String(err);
        console.error(`Busca falhou pra "${query}" (produto ${p.product?.code}):`, err);
        return [];
      }
    });

    for (const items of queryResults) {
      for (const item of items) {
        const price = extractPrice(item);
        const externalId = item.product_link ?? item.link;
        if (price == null || !externalId) continue;
        if (seenExternalIds.has(externalId)) continue;
        seenExternalIds.add(externalId);

        const { score, confirmed } = scoreMatch(p, item.title);
        // Voltou de 65 pra 50: 65 combinado com a penalidade de marca ausente (score*0.5 no
        // scoreMatch) rejeitava até anúncio legítimo — reseller raramente cita a marca
        // fabricante (Cardoso/Playmi/Tópi) no título, só o nome do produto.
        if (score < 50) continue;
        reconfirmedExternalIds.add(externalId);

        const marketplace = detectMarketplace(item);

        const { data: existing } = await supabase
          .from('mpm_listings')
          .select('*')
          .eq('marketplace', marketplace)
          .eq('external_id', externalId)
          .maybeSingle();

        const humanReviewed = existing && ['confirmed_match', 'rejected'].includes(existing.match_status);
        // Só marca "high_confidence" (o que pode virar violação automática) quando o match foi
        // confirmado por EAN/código — heurística de nome/marca, mesmo com pontuação alta, sempre
        // cai em revisão manual. Reduz drasticamente falso-positivo de produto errado.
        const matchStatus = humanReviewed ? existing.match_status : confirmed && score >= 80 ? 'high_confidence' : 'needs_review';
        const isViolation = ['high_confidence', 'confirmed_match'].includes(matchStatus) && price < p.min_price;

        const listingFields = {
          mpm_product_id: p.id,
          marketplace,
          external_id: externalId,
          store_name: item.source ?? 'Desconhecida',
          title: item.title,
          url: externalId,
          image_url: item.thumbnail ?? '',
          shipping_price: null,
          installment_info: item.delivery ?? '',
          current_price: price,
          match_status: matchStatus,
          match_score: score,
          is_violation: isViolation,
          last_checked_at: new Date().toISOString(),
        };

        const { data: upserted } = await supabase
          .from('mpm_listings')
          .upsert(existing ? { id: existing.id, ...listingFields } : listingFields, {
            onConflict: 'marketplace,external_id',
          })
          .select()
          .single();

        listingsFound++;

        const diffAmount = p.min_price - price;
        const diffPercent = (diffAmount / p.min_price) * 100;
        await supabase.from('mpm_price_history').insert({
          listing_id: upserted.id,
          price,
          min_price_at_check: p.min_price,
          is_violation: isViolation,
          diff_amount: isViolation ? diffAmount : null,
          diff_percent: isViolation ? diffPercent : null,
        });

        if (isViolation) {
          violationsFound++;
          const { data: openAlert } = await supabase
            .from('mpm_alerts')
            .select('*')
            .eq('listing_id', upserted.id)
            .in('status', ['new', 'acknowledged'])
            .maybeSingle();

          if (openAlert) {
            await supabase
              .from('mpm_alerts')
              .update({ price, min_price: p.min_price, diff_amount: diffAmount, diff_percent: diffPercent })
              .eq('id', openAlert.id);
          } else {
            let notifiedWebhook = false;
            let notifiedEmail = false;
            const payload = {
              product: p.product?.name,
              marketplace,
              store: listingFields.store_name,
              price,
              min_price: p.min_price,
              diff_amount: diffAmount,
              diff_percent: diffPercent,
              url: externalId,
            };
            if (settings?.alert_webhook_url) {
              notifiedWebhook = await notifyWebhook(settings.alert_webhook_url, payload);
            }
            if (settings?.alert_email) {
              notifiedEmail = await notifyEmail(
                settings.alert_email,
                `Violação de preço: ${p.product?.name}`,
                `${listingFields.store_name} está vendendo "${p.product?.name}" por R$${price} (mínimo permitido: R$${p.min_price}). Link: ${externalId}`
              );
            }
            await supabase.from('mpm_alerts').insert({
              mpm_product_id: p.id,
              listing_id: upserted.id,
              price,
              min_price: p.min_price,
              diff_amount: diffAmount,
              diff_percent: diffPercent,
              notified_internal: true,
              notified_webhook: notifiedWebhook,
              notified_email: notifiedEmail,
            });
          }
        }
      }
    }

    // Poda anúncios antigos que não foram reconfirmados nesta rodada — sem isso, um "match"
    // errado de uma versão anterior (mais permissiva) da busca fica preso na tela pra sempre,
    // já que o sync só cria/atualiza anúncio, nunca removia um que parou de aparecer. Só poda
    // quando todas as buscas deste produto tiveram sucesso (senão um erro transitório de rede
    // apagaria anúncio válido só porque a busca falhou dessa vez) e nunca mexe em anúncio que
    // um humano já revisou (confirmed_match/rejected ficam de fora, decisão manual é definitiva).
    if (!productQueryFailed) {
      const { data: staleListings } = await supabase
        .from('mpm_listings')
        .select('id, external_id, match_status')
        .eq('mpm_product_id', p.id);
      const idsToDelete = (staleListings ?? [])
        .filter((l) => !reconfirmedExternalIds.has(l.external_id) && !['confirmed_match', 'rejected'].includes(l.match_status))
        .map((l) => l.id);
      if (idsToDelete.length > 0) {
        await supabase.from('mpm_listings').delete().in('id', idsToDelete);
      }
    }
   } catch (err) {
     console.error(`Falha processando produto ${p.product?.code}:`, err);
   }
  });

  await supabase
    .from('mpm_sync_runs')
    .update({
      finished_at: new Date().toISOString(),
      status: 'success',
      products_checked: rows.length,
      listings_found: listingsFound,
      violations_found: violationsFound,
      queries_attempted: queriesAttempted,
      queries_failed: queriesFailed,
      last_error_sample: lastErrorSample,
    })
    .eq('id', runId);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  let bodyForce = false;
  if (req.method === 'POST') {
    bodyForce = (await req.json().catch(() => ({})))?.force === true;
  }
  const force = new URL(req.url).searchParams.get('force') === 'true' || bodyForce;

  const { data: settings } = await supabase.from('mpm_settings').select('*').single();
  const { data: lastRun } = await supabase
    .from('mpm_sync_runs')
    .select('*')
    .eq('status', 'success')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!force && lastRun && settings) {
    const hoursSince = (Date.now() - new Date(lastRun.started_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < settings.search_interval_hours) {
      return new Response(JSON.stringify({ skipped: true, reason: 'not due yet', hoursSince }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const { data: run } = await supabase
    .from('mpm_sync_runs')
    .insert({ status: 'running' })
    .select()
    .single();

  try {
    await runSync(supabase, run.id);
    return new Response(JSON.stringify({ ok: true, run_id: run.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    await supabase
      .from('mpm_sync_runs')
      .update({ finished_at: new Date().toISOString(), status: 'error', error_message: String(err) })
      .eq('id', run.id);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
