import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { normalizeUrl } from '../../lib/url';
import type { Profile, SocialChannel, SocialPlanItem, SocialTopic } from '../../types/database';
import { KIND_LABEL, addDays, defaultPieceType, derive, todayISO, type ChannelMap, type Kind } from './shared';

/* ================= Assunto + destinos =================
 * O assunto é a ideia (pauta, estratégia). Cada destino é uma linha de social_plan_items:
 * canal, dia, hora e o vínculo com a matriz (reaproveita herda tudo; adapta tem legenda própria). */

type TopicForm = Pick<SocialTopic, 'title' | 'brand' | 'product' | 'sku' | 'front' | 'objective' | 'strategy' | 'cta' | 'media_use' | 'licensed' | 'licensor_ok' | 'licensor_proof'>;
type Draft = {
  key: string; id?: string; channel_id: string; piece_type: string; format: string;
  pub_date: string; pub_time: string; link_kind: Kind; caption: string; creative_url: string;
  creative_changed: boolean; mirror_facebook: boolean; origin?: string; status?: SocialPlanItem['status'];
};

const BRANDS = ['Playmi', 'Tópi', 'Cardoso'];
const IG_OF: Record<string, string> = { Playmi: 'pl-ig', 'Tópi': 'tp-ig', Cardoso: 'cd-ig' };
const WA_REGIOES = ['wa-s', 'wa-se', 'wa-nne', 'wa-co'];
let seq = 0;
const newKey = () => `n${++seq}`;

function blankTopic(): TopicForm {
  return { title: '', brand: 'Playmi', product: '', sku: '', front: '', objective: '', strategy: '', cta: '', media_use: '', licensed: false, licensor_ok: false, licensor_proof: '' };
}
function toDraft(x: SocialPlanItem): Draft {
  return {
    key: x.id, id: x.id, channel_id: x.channel_id ?? '', piece_type: x.piece_type, format: x.format,
    pub_date: x.pub_date, pub_time: x.pub_time ? x.pub_time.slice(0, 5) : '', link_kind: x.link_kind,
    caption: x.caption ?? '', creative_url: x.creative_url ?? '', creative_changed: x.creative_changed,
    mirror_facebook: x.mirror_facebook, origin: x.origin, status: x.status,
  };
}

export default function TopicSheet({ topic, items, channels, chans, me, isPriv, fronts, onClose, onSaved, onOpenItem, inline }: {
  topic: SocialTopic | null;
  items: SocialPlanItem[];          // todos os destinos deste assunto (inclui canal futuro)
  channels: SocialChannel[];
  chans: ChannelMap;
  me: Profile | null;
  isPriv: boolean;
  fronts: string[];
  onClose: () => void;
  onSaved: (topicId: string) => void;
  onOpenItem: (id: string) => void;
  inline?: boolean;               // dentro da aba Assuntos, sem sobrepor a tela
}) {
  const [form, setForm] = useState<TopicForm>(() => (topic ? {
    title: topic.title, brand: topic.brand, product: topic.product, sku: topic.sku, front: topic.front,
    objective: topic.objective, strategy: topic.strategy, cta: topic.cta, media_use: topic.media_use,
    licensed: topic.licensed, licensor_ok: topic.licensor_ok, licensor_proof: topic.licensor_proof,
  } : blankTopic()));
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    if (items.length) {
      const ds = items.map(toDraft);
      return [...ds.filter((d) => d.link_kind === 'matriz'), ...ds.filter((d) => d.link_kind !== 'matriz').sort((a, b) => (a.pub_date + a.pub_time).localeCompare(b.pub_date + b.pub_time))];
    }
    return [{ key: newKey(), channel_id: 'pl-ig', piece_type: 'Feed', format: '', pub_date: todayISO(), pub_time: '', link_kind: 'matriz', caption: '', creative_url: '', creative_changed: false, mirror_facebook: true }];
  });
  const [removed, setRemoved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [add, setAdd] = useState({ channel_id: 'wa-st', link_kind: 'reaproveita' as Kind, pub_date: '', pub_time: '' });

  const matriz = drafts.find((d) => d.link_kind === 'matriz');
  const upd = <K extends keyof TopicForm>(k: K, v: TopicForm[K]) => setForm((p) => ({ ...p, [k]: v }));
  const updD = (key: string, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const grupos = useMemo(() => ['Cardoso', 'Playmi', 'Tópi'].map((acc) => ({ acc, list: channels.filter((c) => c.account === acc && c.active) })), [channels]);
  const chanSelect = (value: string, onChange: (v: string) => void, id: string) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {!value && <option value="">Escolha o canal</option>}
      {grupos.map((g) => (
        <optgroup key={g.acc} label={g.acc}>
          {g.list.map((c) => <option key={c.id} value={c.id}>{c.account} · {c.name}{c.future ? ' (futuro: a peça fica guardada)' : ''}</option>)}
        </optgroup>
      ))}
    </select>
  );

  const pushDraft = (d: Omit<Draft, 'key'>) => setDrafts((ds) => [...ds, { key: newKey(), ...d }]);
  const fresh = (channel_id: string, link_kind: Kind, pub_date: string, pub_time: string, piece_type?: string): Omit<Draft, 'key'> => {
    const ch = chans.get(channel_id);
    return {
      channel_id, link_kind, pub_date, pub_time,
      piece_type: piece_type ?? (ch ? defaultPieceType(ch) : ''), format: '',
      caption: link_kind === 'adapta' ? matriz?.caption ?? '' : '', creative_url: '', creative_changed: false,
      mirror_facebook: !!ch?.mirror && piece_type !== 'Stories',
    };
  };
  const preset = (k: string) => {
    if (!matriz) return;
    const d0 = matriz.pub_date;
    if (k === 'story') pushDraft(fresh(IG_OF[form.brand], 'reaproveita', addDays(d0, 1), '10:00', 'Stories'));
    if (k === 'tiktok') pushDraft(fresh(form.brand === 'Playmi' ? 'pl-tt' : 'tp-tt', 'reaproveita', addDays(d0, 2), '19:30'));
    if (k === 'yt') pushDraft(fresh(form.brand === 'Tópi' ? 'cd-yt-tp' : 'cd-yt-pl', 'reaproveita', addDays(d0, 5), '11:00', 'Shorts'));
    if (k === 'li') pushDraft(fresh('cd-li', 'adapta', addDays(d0, 5), '08:30'));
    if (k === 'status') pushDraft(fresh('wa-st', 'reaproveita', d0, '14:00'));
    if (k === 'rep') pushDraft(fresh('wa-rep', 'adapta', d0, '08:30'));
    if (k === 'wa') WA_REGIOES.forEach((c) => pushDraft(fresh(c, 'adapta', d0, '10:00')));
  };
  const addCustom = () => {
    if (!add.channel_id) return;
    const kind = matriz ? add.link_kind : 'matriz';
    pushDraft(fresh(add.channel_id, kind, add.pub_date || (matriz ? addDays(matriz.pub_date, 1) : todayISO()), add.pub_time));
  };
  const makeMatriz = (key: string) => setDrafts((ds) => {
    const old = ds.find((d) => d.link_kind === 'matriz');
    const next = ds.map((d) => {
      if (d.key === key) return { ...d, link_kind: 'matriz' as Kind, caption: d.caption || old?.caption || '', creative_url: d.creative_url || old?.creative_url || '' };
      if (old && d.key === old.key) return { ...d, link_kind: 'adapta' as Kind };
      return d;
    });
    return [...next.filter((d) => d.link_kind === 'matriz'), ...next.filter((d) => d.link_kind !== 'matriz')];
  });
  const removeDraft = (d: Draft) => {
    if (d.id) setRemoved((r) => [...r, d.id!]);
    setDrafts((ds) => ds.filter((x) => x.key !== d.key));
  };

  const save = async () => {
    setErr('');
    if (!form.title.trim() && !form.product.trim()) { setErr('Dê um título ou um produto ao assunto.'); return; }
    if (!matriz) { setErr('O assunto precisa de uma peça matriz.'); return; }
    const semCanal = drafts.find((d) => !d.channel_id || !d.pub_date);
    if (semCanal) { setErr('Todo destino precisa de canal e dia.'); return; }
    setSaving(true);
    const payload = { ...form, updated_by: me?.id ?? null };
    let tid = topic?.id ?? null;
    if (tid) {
      const { error } = await supabase.from('social_topics').update(payload).eq('id', tid);
      if (error) { setSaving(false); setErr(error.message); return; }
    } else {
      const { data, error } = await supabase.from('social_topics').insert({ ...payload, created_by: me?.id ?? null }).select('id').single();
      if (error || !data) { setSaving(false); setErr(error?.message ?? 'Não foi possível criar o assunto.'); return; }
      tid = (data as { id: string }).id;
    }
    for (const d of drafts) {
      const ch = chans.get(d.channel_id);
      const { weekday, month_label } = derive(d.pub_date);
      const origin = d.link_kind === 'reaproveita' ? 'Reaproveitamento'
        : d.origin && d.origin !== 'Reaproveitamento' ? d.origin : 'Original';
      const row = {
        topic_id: tid, channel_id: d.channel_id, link_kind: d.link_kind,
        pub_date: d.pub_date, weekday, month_label, pub_time: d.pub_time || null,
        brand: form.brand, network: ch?.network ?? '', channel: ch ? `${ch.account} · ${ch.name}` : '',
        piece_type: d.piece_type, format: d.format, origin,
        pauta: form.title, product: form.product, sku: form.sku, week_theme: form.front,
        objective: form.objective, cta: form.cta, media_use: form.media_use,
        caption: d.link_kind === 'reaproveita' ? null : d.caption || null,
        creative_url: d.link_kind === 'matriz' || (d.link_kind === 'adapta' && d.creative_changed) ? (d.creative_url ? normalizeUrl(d.creative_url) : null) : null,
        creative_changed: d.link_kind === 'adapta' && d.creative_changed,
        mirror_facebook: !!ch?.mirror && d.mirror_facebook,
        updated_by: me?.id ?? null,
      };
      const { error } = d.id
        ? await supabase.from('social_plan_items').update(row).eq('id', d.id)
        : await supabase.from('social_plan_items').insert(row);
      if (error) { setSaving(false); setErr(error.message); return; }
    }
    if (removed.length) {
      const { error } = await supabase.from('social_plan_items').delete().in('id', removed);
      if (error) { setSaving(false); setErr(`Assunto salvo, mas não deu para remover destinos: ${error.message}`); return; }
    }
    setSaving(false);
    onSaved(tid!);
  };

  const removeTopic = async () => {
    if (!topic || !window.confirm('Excluir este assunto e todos os destinos dele? Esta ação não pode ser desfeita.')) return;
    const { error } = await supabase.from('social_topics').delete().eq('id', topic.id);
    if (error) { setErr(error.message); return; }
    onSaved('');
  };

  const counter = (txt: string, chId: string) => {
    const lim = chans.get(chId)?.caption_limit;
    if (!lim) return null;
    return <span className={`sp-counter ${txt.length > lim ? 'over' : ''}`}>{txt.length} / {lim}</span>;
  };

  return (
    <Wrap inline={inline} onClose={onClose}>
        <div className="sp-tags"><span className="sp-badge" style={{ background: 'var(--surf2)', color: 'var(--muted)' }}>{topic ? 'Assunto' : 'Novo assunto'}</span></div>
        <h3 className="sp-panel-h3">{form.title || 'Assunto sem título'}</h3>

        <div className="sp-edit">
          <label className="sp-erow"><span>Título da pauta</span><textarea id="tp-title" rows={2} value={form.title} onChange={(e) => upd('title', e.target.value)} /></label>
          <div className="sp-egrid">
            <label className="sp-erow"><span>Marca</span>
              <select id="tp-brand" value={form.brand} onChange={(e) => {
                const b = e.target.value; const old = IG_OF[form.brand];
                upd('brand', b);
                // assunto novo: a matriz no Instagram acompanha a marca
                if (!topic) setDrafts((ds) => ds.map((d) => (d.link_kind === 'matriz' && d.channel_id === old ? { ...d, channel_id: IG_OF[b] } : d)));
              }}>{BRANDS.map((b) => <option key={b}>{b}</option>)}</select></label>
            <label className="sp-erow"><span>Frente / tema da semana</span>
              <input id="tp-front" list="sp-fronts" value={form.front} onChange={(e) => upd('front', e.target.value)} />
              <datalist id="sp-fronts">{fronts.map((f) => <option key={f} value={f} />)}</datalist></label>
            <label className="sp-erow"><span>Produto</span><input id="tp-product" value={form.product} onChange={(e) => upd('product', e.target.value)} /></label>
            <label className="sp-erow"><span>SKU / eixo</span><input id="tp-sku" value={form.sku} onChange={(e) => upd('sku', e.target.value)} /></label>
          </div>
          <label className="sp-erow"><span>Objetivo</span><textarea id="tp-obj" rows={2} value={form.objective} onChange={(e) => upd('objective', e.target.value)} /></label>
          <label className="sp-erow"><span>Estratégia: por que esta peça existe agora</span><textarea id="tp-strat" rows={2} value={form.strategy} onChange={(e) => upd('strategy', e.target.value)} /></label>
          <div className="sp-egrid">
            <label className="sp-erow"><span>Chamada (CTA)</span><input id="tp-cta" value={form.cta} onChange={(e) => upd('cta', e.target.value)} /></label>
            <label className="sp-erow"><span>Uso de mídia</span><input id="tp-media" value={form.media_use} onChange={(e) => upd('media_use', e.target.value)} /></label>
          </div>
          <label className="sp-check"><input id="tp-lic" type="checkbox" checked={form.licensed} onChange={(e) => upd('licensed', e.target.checked)} /> Produto licenciado (Marvel, Disney, Galinha Pintadinha, Bluey, Smurfs…)</label>
          {form.licensed && (
            <div className="sp-licbox">
              <label className="sp-check"><input id="tp-licok" type="checkbox" checked={form.licensor_ok} onChange={(e) => upd('licensor_ok', e.target.checked)} /> Aprovado pelo licenciador (a aprovação acontece por e-mail)</label>
              <label className="sp-erow"><span>Comprovante do licenciador</span><input id="tp-licproof" placeholder="Link do e-mail ou PDF no Drive" value={form.licensor_proof} onChange={(e) => upd('licensor_proof', e.target.value)} /></label>
            </div>
          )}
        </div>

        <h4 className="sp-sech">Destinos <small>onde e quando sai, e o que herda da matriz</small></h4>
        <div className="sp-dests">
          {drafts.map((d) => {
            const ch = chans.get(d.channel_id);
            const fmts = ch?.formats.length ? [...new Set([...ch.formats, d.piece_type].filter(Boolean))] : [];
            const herdada = matriz?.caption ?? '';
            return (
              <div key={d.key} className={`sp-dest ${d.link_kind === 'matriz' ? 'matriz' : ''}`}>
                <div className="sp-dest-top">
                  <span className={`sp-kind k-${d.link_kind}`}>{KIND_LABEL[d.link_kind]}</span>
                  {ch?.future && <span className="sp-badge" style={{ background: 'var(--surf2)', color: 'var(--muted)' }}>guardada · canal futuro</span>}
                  {d.status === 'aprovada' && <span className="sp-badge" style={{ background: '#EAF6F0', color: '#1E7A50' }}>Aprovada</span>}
                  {d.status === 'ajuste' && <span className="sp-badge" style={{ background: '#FDF5E4', color: '#8A6113' }}>Com ajuste</span>}
                  <span className="sp-dest-actions">
                    {d.id && <button className="sp-linkbtn" onClick={() => onOpenItem(d.id!)}>comentários e aprovação</button>}
                    {d.link_kind !== 'matriz' && <button className="sp-linkbtn" onClick={() => makeMatriz(d.key)}>tornar matriz</button>}
                    {d.link_kind !== 'matriz' && (!d.id || isPriv) && <button className="sp-linkbtn danger" onClick={() => removeDraft(d)}>remover</button>}
                  </span>
                </div>
                <div className="sp-dest-grid">
                  <label className="sp-erow"><span>Canal</span>{chanSelect(d.channel_id, (v) => {
                    const c = chans.get(v);
                    updD(d.key, { channel_id: v, piece_type: c ? (c.formats.includes(d.piece_type) ? d.piece_type : defaultPieceType(c)) : d.piece_type, mirror_facebook: !!c?.mirror });
                  }, `ch-${d.key}`)}</label>
                  {fmts.length > 0 && <label className="sp-erow"><span>Formato</span>
                    <select id={`pt-${d.key}`} value={d.piece_type} onChange={(e) => updD(d.key, { piece_type: e.target.value })}>{fmts.map((f) => <option key={f}>{f}</option>)}</select></label>}
                  {d.link_kind !== 'matriz' && <label className="sp-erow"><span>Vínculo</span>
                    <select id={`k-${d.key}`} value={d.link_kind} onChange={(e) => {
                      const k = e.target.value as Kind;
                      updD(d.key, { link_kind: k, caption: k === 'adapta' && !d.caption ? herdada : d.caption });
                    }}>
                      <option value="reaproveita">Reaproveita (mesma legenda e criativo)</option>
                      <option value="adapta">Adapta (legenda própria)</option>
                    </select></label>}
                  <label className="sp-erow"><span>Dia</span><input id={`d-${d.key}`} type="date" value={d.pub_date} onChange={(e) => updD(d.key, { pub_date: e.target.value })} /></label>
                  <label className="sp-erow"><span>Hora</span><input id={`h-${d.key}`} type="time" value={d.pub_time} onChange={(e) => updD(d.key, { pub_time: e.target.value })} /></label>
                </div>
                {ch?.mirror && <label className="sp-check"><input id={`m-${d.key}`} type="checkbox" checked={d.mirror_facebook} onChange={(e) => updD(d.key, { mirror_facebook: e.target.checked })} /> Espelhar no {ch.mirror} (mesma peça, mesmo horário)</label>}
                {d.link_kind === 'reaproveita' ? (
                  <p className="sp-inherit">↳ Usa a legenda e o criativo da matriz.{herdada ? ` “${herdada.slice(0, 110)}${herdada.length > 110 ? '…' : ''}”` : ' A matriz ainda não tem legenda.'}</p>
                ) : (
                  <>
                    <label className="sp-erow"><span>{d.link_kind === 'matriz' ? 'Legenda' : 'Legenda própria'} {counter(d.caption, d.channel_id)}</span>
                      <textarea id={`c-${d.key}`} rows={4} value={d.caption} onChange={(e) => updD(d.key, { caption: e.target.value })} /></label>
                    {d.link_kind === 'adapta' && <label className="sp-check"><input id={`cc-${d.key}`} type="checkbox" checked={d.creative_changed} onChange={(e) => updD(d.key, { creative_changed: e.target.checked })} /> O criativo também muda (recorte, versão, nova arte)</label>}
                    {(d.link_kind === 'matriz' || d.creative_changed) ? (
                      <label className="sp-erow"><span>{d.link_kind === 'matriz' ? 'Criativo no Drive' : 'Criativo adaptado no Drive'}</span>
                        <input id={`cr-${d.key}`} placeholder="Cole o link do arquivo ou da pasta no Drive" value={d.creative_url} onChange={(e) => updD(d.key, { creative_url: e.target.value })} /></label>
                    ) : <p className="sp-inherit">↳ Usa o criativo da matriz.</p>}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {matriz && (
          <div className="sp-presets">
            <span className="sp-flabel">Atalhos</span>
            <div className="sp-mchips">
              <button className="sp-mchip" onClick={() => preset('story')}>+ Story no dia seguinte</button>
              {form.brand !== 'Cardoso' && <button className="sp-mchip" onClick={() => preset('tiktok')}>+ TikTok +2 dias{form.brand === 'Playmi' ? ' (guardado)' : ''}</button>}
              {form.brand !== 'Cardoso' && <button className="sp-mchip" onClick={() => preset('yt')}>+ YouTube Shorts +5 dias</button>}
              <button className="sp-mchip" onClick={() => preset('li')}>+ LinkedIn adaptado +5 dias</button>
              <button className="sp-mchip" onClick={() => preset('status')}>+ WhatsApp Status</button>
              <button className="sp-mchip" onClick={() => preset('rep')}>+ Canal Representantes</button>
              <button className="sp-mchip" onClick={() => preset('wa')}>+ WhatsApp Clientes (4 regiões)</button>
            </div>
          </div>
        )}
        <div className="sp-adder">
          <label className="sp-erow"><span>Canal</span>{chanSelect(add.channel_id, (v) => setAdd((a) => ({ ...a, channel_id: v })), 'add-ch')}</label>
          {matriz && <label className="sp-erow"><span>Vínculo</span>
            <select id="add-k" value={add.link_kind} onChange={(e) => setAdd((a) => ({ ...a, link_kind: e.target.value as Kind }))}>
              <option value="reaproveita">Reaproveita</option><option value="adapta">Adapta</option>
            </select></label>}
          <label className="sp-erow"><span>Dia</span><input id="add-d" type="date" value={add.pub_date} onChange={(e) => setAdd((a) => ({ ...a, pub_date: e.target.value }))} /></label>
          <label className="sp-erow"><span>Hora</span><input id="add-h" type="time" value={add.pub_time} onChange={(e) => setAdd((a) => ({ ...a, pub_time: e.target.value }))} /></label>
          <button className="sp-ebtn" onClick={addCustom}>+ Adicionar destino</button>
        </div>
        <p className="sp-inherit">O que reaproveita segue a aprovação da matriz. O que adapta tem a própria legenda aprovada{removed.length ? `. ${removed.length} destino(s) serão removidos ao salvar.` : '.'}</p>

        {err && <div className="sp-err">{err}</div>}
        <div className="sp-edit-actions">
          <button className="sp-ebtn prim" onClick={save} disabled={saving}>{saving ? 'Salvando…' : topic ? 'Salvar assunto' : 'Criar assunto'}</button>
          <button className="sp-ebtn" onClick={onClose}>Cancelar</button>
          {topic && isPriv && <button className="sp-ebtn danger" style={{ marginLeft: 'auto' }} onClick={removeTopic}>Excluir assunto</button>}
        </div>
    </Wrap>
  );
}

function Wrap({ inline, onClose, children }: { inline?: boolean; onClose: () => void; children: React.ReactNode }) {
  if (inline) return <div className="coc-topic-inline">{children}</div>;
  return (
    <div className="sp-sheet on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sp-panel sp-panel-wide">
        <button className="close" aria-label="Fechar" onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  );
}
