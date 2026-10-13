import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { normalizeUrl } from '../../lib/url';
import type { ContentMaterial, ContentTaskBoardRow, Profile } from '../../types/database';
import { addDays, brShort, derive, slug, todayISO } from './shared';
import type { ProductLite } from './useCommercial';

/* Banco de materiais: o que existe de cada produto para o cliente, fora das redes.
 * Cada material aponta para o Drive. Pedido → em produção → aguardando liberação → liberado. */

export const KINDS: { k: ContentMaterial['kind']; label: string }[] = [
  { k: 'foto', label: 'Foto' }, { k: 'video', label: 'Vídeo' }, { k: 'kit', label: 'Kit' }, { k: 'documento', label: 'Documento' },
];
export const MST: Record<ContentMaterial['status'], { label: string; tone: string }> = {
  pedido: { label: 'Pedido', tone: '' }, producao: { label: 'Em produção', tone: '' },
  aguardando: { label: 'Aguardando liberação', tone: 'warn' }, liberado: { label: 'Liberado para cliente', tone: 'ok' },
};
const kindLabel = (k: ContentMaterial['kind']) => KINDS.find((x) => x.k === k)?.label ?? k;

export default function MateriaisView({ materials, products, board, profiles, meId, canRelease, error, onChanged, onOpenTopic }: {
  materials: ContentMaterial[];
  products: ProductLite[];
  board: Map<string, ContentTaskBoardRow>;
  profiles: Profile[];
  meId: string | null;
  canRelease: boolean;
  error: string;
  onChanged: () => Promise<void> | void;
  onOpenTopic: (id: string) => void;
}) {
  const [fk, setFk] = useState<Set<string>>(new Set());
  const [fs, setFs] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkFor, setLinkFor] = useState<{ id: string; url: string } | null>(null);
  const [form, setForm] = useState({ product_id: '', subject: '', kind: 'foto' as ContentMaterial['kind'], name: '', drive_url: '', demanda: false, assignee: '', due: addDays(todayISO(), 7) });
  const prodById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg((c) => (c === m ? '' : c)), 3000); };
  const count = (s: ContentMaterial['status']) => materials.filter((m) => m.status === s).length;

  const groupKey = (m: ContentMaterial) => m.product_id ?? `s:${m.subject || 'Sem produto'}`;
  const rows = materials.filter((m) => {
    if (fk.size && !fk.has(m.kind)) return false;
    if (fs.size && !fs.has(m.status)) return false;
    if (q) {
      const p = m.product_id ? prodById.get(m.product_id) : null;
      if (!`${p?.code ?? ''} ${p?.name ?? ''} ${m.subject} ${m.name}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const groups = [...new Set(rows.map(groupKey))];

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    const { error: e } = await fn();
    setBusy(false);
    if (e) { flash(e.message); return false; }
    flash(ok); await onChanged(); return true;
  };

  const add = async () => {
    if (!form.name.trim()) { flash('Dê um nome ao material.'); return; }
    if (!form.product_id && !form.subject.trim()) { flash('Escolha o produto ou escreva o assunto (ex.: Kit de Natal).'); return; }
    setBusy(true);
    let task_id: string | null = null;
    const p = form.product_id ? prodById.get(form.product_id) : null;
    const alvo = p ? `${p.code} ${p.name}` : form.subject.trim();
    if (form.demanda && !form.drive_url.trim()) {
      const { data, error: e } = await supabase.rpc('content_create_task', {
        p_title: `${kindLabel(form.kind)} para o banco de materiais: ${alvo}`, p_assignee: form.assignee || null,
        p_due: form.due || null, p_notes: `Material: ${form.name.trim()}\nQuando estiver pronto, cole o link do Drive no banco de materiais do Centro de Operações.`,
      });
      if (e) { setBusy(false); flash(e.message); return; }
      task_id = data as string;
    }
    const link = form.drive_url.trim();
    const { error: e } = await supabase.from('content_materials').insert({
      product_id: form.product_id || null, subject: p ? '' : form.subject.trim(), brand: p?.brand ?? 'Cardoso',
      kind: form.kind, name: form.name.trim(), drive_url: link ? normalizeUrl(link) : '',
      status: link ? 'aguardando' : task_id ? 'producao' : 'pedido', task_id,
    });
    setBusy(false);
    if (e) { flash(e.message); return; }
    setForm((f) => ({ ...f, name: '', drive_url: '', demanda: false }));
    flash(link ? 'Cadastrado. Esperando a liberação do gerente.' : task_id ? 'Cadastrado, com a demanda de produção criada.' : 'Cadastrado como pedido.');
    await onChanged();
  };

  const setLink = async (m: ContentMaterial, url: string) => {
    if (!url.trim()) { flash('Cole o link do Drive.'); return; }
    if (await run(() => supabase.from('content_materials').update({ drive_url: normalizeUrl(url.trim()), status: 'aguardando' }).eq('id', m.id), 'Enviado para liberação.')) setLinkFor(null);
  };

  // aviso no WhatsApp: vira um assunto com os canais de clientes das 4 regiões + representantes
  const announce = async (m: ContentMaterial) => {
    const p = m.product_id ? prodById.get(m.product_id) : null;
    const alvo = p ? p.name : m.subject;
    const ref = p ? ` (REF ${p.code})` : '';
    const dia = addDays(todayISO(), 1);
    const { weekday, month_label } = derive(dia);
    const cap = `Material novo na área comercial: ${kindLabel(m.kind).toLowerCase()} de ${alvo}${ref}. Baixe na página do produto: [link da área comercial]`;
    setBusy(true);
    const { data: t, error: e1 } = await supabase.from('social_topics').insert({
      title: `Aviso de material novo: ${alvo}`, brand: 'Cardoso', product: alvo, sku: p?.code ?? '', product_id: p?.id ?? null,
      front: 'Avisos da área comercial', objective: 'Avisar lojistas e representantes que há material novo na área comercial',
      strategy: 'Material novo só vira venda se o lojista souber que ele existe.', cta: 'Baixe na área comercial', media_use: 'Institucional B2B',
      created_by: meId, updated_by: meId,
    }).select('id').single();
    if (e1 || !t) { setBusy(false); flash(e1?.message ?? 'Não deu para criar o aviso.'); return; }
    const tid = (t as { id: string }).id;
    const base = { topic_id: tid, brand: 'Cardoso', network: 'WhatsApp', piece_type: 'WhatsApp', format: '', pauta: `Aviso de material novo: ${alvo}`,
      product: alvo, sku: p?.code ?? '', week_theme: 'Avisos da área comercial', objective: 'Avisar lojistas e representantes que há material novo na área comercial',
      cta: 'Baixe na área comercial', media_use: 'Institucional B2B', pub_date: dia, weekday, month_label, updated_by: meId };
    const rowsIns: Record<string, unknown>[] = [
      { ...base, channel_id: 'wa-s', channel: 'Cardoso · WhatsApp · Clientes Sul', link_kind: 'matriz', origin: 'Original', pub_time: '10:00', caption: cap },
      ...([['wa-se', 'Sudeste'], ['wa-nne', 'Norte/Nordeste'], ['wa-co', 'Centro-Oeste']] as const).map(([c, r]) => ({ ...base, channel_id: c, channel: `Cardoso · WhatsApp · Clientes ${r}`, link_kind: 'reaproveita', origin: 'Reaproveitamento', pub_time: '10:00' })),
      { ...base, channel_id: 'wa-rep', channel: 'Cardoso · WhatsApp · Canal Representantes', link_kind: 'adapta', origin: 'Original', pub_time: '08:30',
        caption: `Time: subiu ${kindLabel(m.kind).toLowerCase()} novo de ${alvo}${ref} na área comercial. Avisem a carteira hoje.` },
    ];
    for (const r of rowsIns) {
      const { error: e } = await supabase.from('social_plan_items').insert(r);
      if (e) { setBusy(false); flash(e.message); return; }
    }
    await supabase.from('content_materials').update({ announced: true }).eq('id', m.id);
    setBusy(false);
    await onChanged();
    onOpenTopic(tid);
  };

  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => { const s = new Set(set); s.has(v) ? s.delete(v) : s.add(v); fn(s); };
  const active = profiles.filter((p) => !p.disabled);

  return (
    <div className="sp-mat">
      {error && <div className="sp-err">{error}</div>}
      <div className="sp-kpis sp-central-kpis">
        <div className="sp-kpi"><b>{count('liberado')}</b><span>liberados para o cliente</span></div>
        <div className="sp-kpi"><b>{count('aguardando')}</b><span>esperando liberação</span></div>
        <div className="sp-kpi"><b>{count('producao')}</b><span>em produção</span></div>
        <div className="sp-kpi"><b>{count('pedido')}</b><span>pedidos, ainda não começados</span></div>
      </div>

      <section className="sp-box">
        <h3>Cadastrar material <small>cole o link do Drive; sem link ele entra como pedido</small></h3>
        <div className="sp-matform">
          <label className="sp-erow"><span>Produto</span>
            <select id="mt-prod" value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}>
              <option value="">Não é de um produto (kit, catálogo…)</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </select></label>
          {!form.product_id && <label className="sp-erow"><span>Assunto</span><input id="mt-subj" placeholder="Ex.: Kit de Natal" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} /></label>}
          <label className="sp-erow"><span>Tipo</span>
            <select id="mt-kind" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as ContentMaterial['kind'] }))}>
              {KINDS.map((k) => <option key={k.k} value={k.k}>{k.label}</option>)}
            </select></label>
          <label className="sp-erow"><span>Nome</span><input id="mt-name" placeholder="PLAYMI_FOTO_1x1_PRODUTO_8005 - Trenzinho_01" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
          <label className="sp-erow"><span>Link do Drive</span><input id="mt-link" placeholder="https://drive.google.com/…" value={form.drive_url} onChange={(e) => setForm((f) => ({ ...f, drive_url: e.target.value }))} /></label>
        </div>
        {!form.drive_url.trim() && (
          <div className="sp-matdem">
            <label className="sp-check"><input id="mt-dem" type="checkbox" checked={form.demanda} onChange={(e) => setForm((f) => ({ ...f, demanda: e.target.checked }))} /> Criar a demanda de produção nas Demandas</label>
            {form.demanda && <>
              <label className="sp-erow"><span>Responsável</span>
                <select id="mt-resp" value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}>
                  <option value="">Sem responsável</option>{active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
              <label className="sp-erow"><span>Prazo</span><input id="mt-due" type="date" value={form.due} onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))} /></label>
            </>}
          </div>
        )}
        <button className="sp-ebtn prim" disabled={busy} onClick={add}>Cadastrar</button>
        {msg && <div className="sp-saved">{msg}</div>}
      </section>

      <div className="sp-frow" style={{ margin: '14px 0 10px' }}>
        <div className="sp-chips">{KINDS.map((k) => <button key={k.k} className="sp-chip" aria-pressed={fk.has(k.k)} onClick={() => toggle(fk, k.k, setFk)}>{k.label}</button>)}</div>
        <div className="sp-chips">{(Object.keys(MST) as ContentMaterial['status'][]).map((s) => <button key={s} className="sp-chip" aria-pressed={fs.has(s)} onClick={() => toggle(fs, s, setFs)}>{MST[s].label}</button>)}</div>
        <div className="sp-searchwrap"><span aria-hidden>🔍</span><input type="search" placeholder="produto, REF, material…" value={q} onChange={(e) => setQ(e.target.value.toLowerCase().trim())} /></div>
      </div>

      {groups.length === 0 ? (
        <div className="sp-empty"><b>Nenhum material {materials.length ? 'com esses filtros' : 'cadastrado ainda'}</b>{materials.length ? 'Ajuste os filtros.' : 'Cadastre o primeiro material acima.'}</div>
      ) : (
        <div className="sp-matgrid">
          {groups.map((g) => {
            const p = g.startsWith('s:') ? null : prodById.get(g);
            const all = materials.filter((m) => groupKey(m) === g);
            const shown = rows.filter((m) => groupKey(m) === g);
            const brand = p?.brand ?? all[0]?.brand ?? 'Cardoso';
            return (
              <section className="sp-box" key={g}>
                <h3><span><span className={`sp-dot b-${slug(brand)}`} /> {p ? p.name : g.slice(2)}</span><small>{p ? `REF ${p.code}` : 'sem produto'}</small></h3>
                <div className="sp-topic-chips" style={{ marginBottom: 6 }}>
                  {KINDS.map((k) => {
                    const ok = all.some((m) => m.kind === k.k && m.status === 'liberado');
                    const any = all.some((m) => m.kind === k.k);
                    return <span key={k.k} className={`sp-state t-${ok ? 'ok' : any ? 'warn' : ''}`}>{k.label} {ok ? '✓' : any ? '…' : 'falta'}</span>;
                  })}
                </div>
                {shown.map((m) => {
                  const tb = m.task_id ? board.get(m.task_id) : null;
                  return (
                    <div className="sp-crow" key={m.id}>
                      <div className="sp-cmain static">
                        <b style={{ fontSize: 13 }}>{m.name}</b>
                        <span>{kindLabel(m.kind)}{tb ? ` · demanda: ${tb.stage_name ?? '—'}${tb.assignee_name ? ` · ${tb.assignee_name}` : ''}${tb.due_date ? ` · até ${brShort(tb.due_date)}` : ''}` : ''}</span>
                      </div>
                      <span className={`sp-state t-${MST[m.status].tone}`}>{MST[m.status].label}</span>
                      <div className="sp-cacts">
                        {m.drive_url && <a className="sp-ebtn" href={m.drive_url} target="_blank" rel="noreferrer">Drive</a>}
                        {m.task_id && <a className="sp-ebtn" href={`/demandas?task=${m.task_id}`}>Demanda</a>}
                        {m.status === 'pedido' && !m.task_id && <button className="sp-ebtn" disabled={busy} onClick={() => run(() => supabase.from('content_materials').update({ status: 'producao' }).eq('id', m.id), 'Em produção.')}>Começar</button>}
                        {(m.status === 'pedido' || m.status === 'producao') && <button className="sp-ebtn" onClick={() => setLinkFor({ id: m.id, url: '' })}>Colar link e enviar</button>}
                        {m.status === 'aguardando' && canRelease && <button className="sp-ebtn prim" disabled={busy} onClick={() => run(() => supabase.from('content_materials').update({ status: 'liberado' }).eq('id', m.id), 'Liberado. Já aparece para o cliente na visão final.')}>Liberar para cliente</button>}
                        {m.status === 'liberado' && (m.announced ? <span className="sp-state t-sky">Aviso criado</span>
                          : <button className="sp-ebtn" disabled={busy} onClick={() => announce(m)}>Criar aviso no WhatsApp</button>)}
                      </div>
                      {linkFor?.id === m.id && (
                        <div className="sp-linkfor">
                          <input id={`lk-${m.id}`} autoFocus placeholder="https://drive.google.com/…" value={linkFor.url} onChange={(e) => setLinkFor({ id: m.id, url: e.target.value })} />
                          <button className="sp-ebtn prim" disabled={busy} onClick={() => setLink(m, linkFor.url)}>Enviar para liberação</button>
                          <button className="sp-ebtn" onClick={() => setLinkFor(null)}>Cancelar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
      <p className="sp-inherit" style={{ marginTop: 12 }}>
        O aviso no WhatsApp vira um assunto com os canais de clientes das 4 regiões e o de representantes, apontando para a página do produto na área comercial.
        Você ajusta a arte e a legenda, e ele segue a aprovação normal. {canRelease ? '' : 'Só o gerente ou a diretoria liberam material.'}
      </p>
    </div>
  );
}
