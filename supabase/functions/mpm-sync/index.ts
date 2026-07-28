// Market Price Monitor — robô de busca/validação/alerta.
// v1: só Mercado Livre (sem Playwright/IA — decisão de arquitetura). O ML bloqueou busca
// anônima, então autenticamos via OAuth (authorization_code + refresh_token). O refresh_token
// do ML é rotativo — muda a cada uso — por isso ele fica guardado em mpm_settings (não dá pra
// usar um secret estático); só client_id/client_secret são secrets fixos.
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
  if (p.product?.code) queries.push(p.product.code);
  if (name) queries.push(name);
  if (brandLabel && name) queries.push(`${brandLabel} ${name}`);
  for (const k of (p.keywords ?? []).slice(0, 3)) queries.push(k);
  for (const s of (p.synonyms ?? []).slice(0, 3)) queries.push(s);
  return Array.from(new Set(queries.filter((q) => q.trim().length > 0)));
}

function scoreMatch(p: MpmProductRow, title: string): number {
  const normTitle = normalize(title);
  const ean = p.product?.ean ? normalize(p.product.ean) : '';
  const code = p.product?.code ? normalize(p.product.code) : '';
  if (ean && normTitle.includes(ean)) return 100;
  if (code && new RegExp(`\\b${code}\\b`).test(normTitle)) return 95;

  const nameTokens = new Set(normalize(p.product?.name ?? '').split(' ').filter((t) => t.length > 2));
  for (const k of [...(p.keywords ?? []), ...(p.synonyms ?? [])]) {
    for (const t of normalize(k).split(' ')) {
      if (t.length > 2) nameTokens.add(t);
    }
  }
  if (nameTokens.size === 0) return 0;
  const titleTokens = new Set(normTitle.split(' '));
  let matched = 0;
  for (const t of nameTokens) if (titleTokens.has(t)) matched++;
  return Math.round((matched / nameTokens.size) * 100);
}

interface MlSearchItem {
  id: string;
  title: string;
  price: number;
  permalink: string;
  thumbnail: string;
  seller?: { nickname?: string; id?: number };
  shipping?: { free_shipping?: boolean };
  installments?: { quantity: number; amount: number } | null;
}

async function getMercadoLivreAccessToken(supabase: SupabaseClient, settings: any): Promise<string> {
  const bufferMs = 5 * 60 * 1000;
  if (
    settings?.ml_access_token &&
    settings?.ml_access_token_expires_at &&
    new Date(settings.ml_access_token_expires_at).getTime() > Date.now() + bufferMs
  ) {
    return settings.ml_access_token;
  }

  const clientId = Deno.env.get('ML_CLIENT_ID');
  const clientSecret = Deno.env.get('ML_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('ML_CLIENT_ID / ML_CLIENT_SECRET não configurados (supabase secrets set).');
  }
  if (!settings?.ml_refresh_token) {
    throw new Error('mpm_settings.ml_refresh_token vazio — falta fazer a autorização inicial do Mercado Livre.');
  }

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: settings.ml_refresh_token,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Falha ao renovar token do Mercado Livre: ${JSON.stringify(data)}`);
  }

  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString();
  await supabase
    .from('mpm_settings')
    .update({
      ml_access_token: data.access_token,
      ml_access_token_expires_at: expiresAt,
      ml_refresh_token: data.refresh_token,
    })
    .eq('id', true);

  return data.access_token as string;
}

async function searchMercadoLivre(query: string, accessToken: string): Promise<MlSearchItem[]> {
  const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=20`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return [];
  const body = await res.json();
  return (body.results ?? []) as MlSearchItem[];
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
  const accessToken = await getMercadoLivreAccessToken(supabase, settings);
  const { data: products } = await supabase
    .from('mpm_products')
    .select('*, product:products(code, name, ean, brand:brands(label))')
    .eq('monitoring_status', 'active');

  let listingsFound = 0;
  let violationsFound = 0;
  const rows = (products ?? []) as MpmProductRow[];

  for (const p of rows) {
    const queries = buildQueries(p);
    const seenExternalIds = new Set<string>();

    for (const query of queries) {
      const items = await searchMercadoLivre(query, accessToken);
      for (const item of items) {
        if (seenExternalIds.has(item.id)) continue;
        seenExternalIds.add(item.id);

        const score = scoreMatch(p, item.title);
        if (score < 50) continue;

        const { data: existing } = await supabase
          .from('mpm_listings')
          .select('*')
          .eq('marketplace', 'mercado_livre')
          .eq('external_id', item.id)
          .maybeSingle();

        const humanReviewed = existing && ['confirmed_match', 'rejected'].includes(existing.match_status);
        const matchStatus = humanReviewed ? existing.match_status : score >= 80 ? 'high_confidence' : 'needs_review';
        const isViolation = ['high_confidence', 'confirmed_match'].includes(matchStatus) && item.price < p.min_price;

        const listingFields = {
          mpm_product_id: p.id,
          marketplace: 'mercado_livre' as const,
          external_id: item.id,
          store_name: item.seller?.nickname ?? (item.seller?.id ? `Vendedor #${item.seller.id}` : 'Desconhecida'),
          title: item.title,
          url: item.permalink,
          image_url: item.thumbnail,
          shipping_price: item.shipping?.free_shipping ? 0 : null,
          installment_info: item.installments ? `${item.installments.quantity}x de R$${item.installments.amount}` : '',
          current_price: item.price,
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

        const diffAmount = p.min_price - item.price;
        const diffPercent = (diffAmount / p.min_price) * 100;
        await supabase.from('mpm_price_history').insert({
          listing_id: upserted.id,
          price: item.price,
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
              .update({ price: item.price, min_price: p.min_price, diff_amount: diffAmount, diff_percent: diffPercent })
              .eq('id', openAlert.id);
          } else {
            let notifiedWebhook = false;
            let notifiedEmail = false;
            const payload = {
              product: p.product?.name,
              marketplace: 'mercado_livre',
              store: listingFields.store_name,
              price: item.price,
              min_price: p.min_price,
              diff_amount: diffAmount,
              diff_percent: diffPercent,
              url: item.permalink,
            };
            if (settings?.alert_webhook_url) {
              notifiedWebhook = await notifyWebhook(settings.alert_webhook_url, payload);
            }
            if (settings?.alert_email) {
              notifiedEmail = await notifyEmail(
                settings.alert_email,
                `Violação de preço: ${p.product?.name}`,
                `${listingFields.store_name} está vendendo "${p.product?.name}" por R$${item.price} (mínimo permitido: R$${p.min_price}). Link: ${item.permalink}`
              );
            }
            await supabase.from('mpm_alerts').insert({
              mpm_product_id: p.id,
              listing_id: upserted.id,
              price: item.price,
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
  }

  await supabase
    .from('mpm_sync_runs')
    .update({
      finished_at: new Date().toISOString(),
      status: 'success',
      products_checked: rows.length,
      listings_found: listingsFound,
      violations_found: violationsFound,
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
