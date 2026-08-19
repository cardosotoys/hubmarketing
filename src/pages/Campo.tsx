import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

/* ------------------------------------------------------------------ *
 * Página de CAMPO — link mágico (sem login) para a líder e os promotores
 * planejarem a semana e darem o report diário. Grava por RPC segura (token).
 * Mobile-first, letras grandes, poucos toques.
 * ------------------------------------------------------------------ */

type Store = { id: string; name: string; network: string | null; network_id: string | null; city: string | null; region: string | null; address: string | null; default_promoter_id: string | null };
type Ctx = {
  ok: boolean;
  kind?: 'lider' | 'promotor';
  promoter_id?: string | null;
  label?: string;
  week_start?: string;
  today?: string;
  today_weekday?: number;
  promoters?: { id: string; name: string }[];
  networks?: { id: string; name: string }[];
  stores?: Store[];
  plan?: { promoter_id: string; weekday: number; store_id: string }[];
  reports?: { promoter_id: string; report_date: string; store_id: string; status: 'foi' | 'nao_foi'; reason: string; note: string }[];
};

const DIAS = [
  { wd: 1, label: 'Segunda' }, { wd: 2, label: 'Terça' }, { wd: 3, label: 'Quarta' },
  { wd: 4, label: 'Quinta' }, { wd: 5, label: 'Sexta' }, { wd: 6, label: 'Sábado' },
];
const MOTIVOS = ['Loja fechada', 'Faltou tempo / rota cheia', 'Transporte / deslocamento', 'Problema pessoal', 'Sem material', 'Outro'];
const brDate = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');

export default function Campo() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoter, setPromoter] = useState<string>('');
  const [mode, setMode] = useState<'report' | 'plan' | 'stores'>('report');
  const [flash, setFlash] = useState('');
  const [picker, setPicker] = useState<null | { forWeekday?: number; onPick: (storeId: string) => void; taken: Set<string> }>(null);
  const [storeEdit, setStoreEdit] = useState<null | 'new' | Store>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    const { data } = await supabase.rpc('tm_field_context', { p_token: token });
    const c = (data as Ctx) ?? { ok: false };
    setCtx(c);
    setPromoter((prev) => prev || (c.kind === 'promotor' ? c.promoter_id ?? '' : c.promoters?.[0]?.id ?? ''));
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash((c) => (c === m ? '' : c)), 1800); };

  const storeById = useMemo(() => {
    const m = new Map<string, Store>();
    (ctx?.stores ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [ctx?.stores]);

  // plano do promotor selecionado por dia
  const planByDay = useMemo(() => {
    const m = new Map<number, string[]>();
    (ctx?.plan ?? []).filter((p) => p.promoter_id === promoter).forEach((p) => {
      m.set(p.weekday, [...(m.get(p.weekday) ?? []), p.store_id]);
    });
    return m;
  }, [ctx?.plan, promoter]);

  // reports de hoje do promotor selecionado
  const reportToday = useMemo(() => {
    const m = new Map<string, { status: 'foi' | 'nao_foi'; reason: string }>();
    (ctx?.reports ?? []).filter((r) => r.promoter_id === promoter && r.report_date === ctx?.today)
      .forEach((r) => m.set(r.store_id, { status: r.status, reason: r.reason }));
    return m;
  }, [ctx?.reports, ctx?.today, promoter]);

  const savePlanDay = async (wd: number, storeIds: string[]) => {
    await supabase.rpc('tm_field_plan_set', { p_token: token, p_promoter: promoter, p_week_start: ctx?.week_start, p_weekday: wd, p_store_ids: storeIds });
    showFlash('salvo'); await load();
  };
  const saveReport = async (storeId: string, status: 'foi' | 'nao_foi', reason = '') => {
    await supabase.rpc('tm_field_report_set', { p_token: token, p_promoter: promoter, p_date: ctx?.today, p_store: storeId, p_status: status, p_reason: reason, p_note: '' });
    showFlash('salvo'); await load();
  };
  const clearReport = async (storeId: string) => {
    await supabase.rpc('tm_field_report_clear', { p_token: token, p_promoter: promoter, p_date: ctx?.today, p_store: storeId });
    showFlash('desmarcado'); await load();
  };
  const saveStore = async (s: { id?: string; name: string; network: string; city: string; region: string; address: string; promoter: string }) => {
    const { data } = await supabase.rpc('tm_field_store_upsert', {
      p_token: token, p_store_id: s.id ?? null, p_name: s.name, p_network: s.network,
      p_city: s.city, p_region: s.region, p_address: s.address, p_promoter: s.promoter || null,
    });
    if ((data as { ok?: boolean })?.ok) { setStoreEdit(null); showFlash('loja salva'); await load(); }
    else showFlash('preencha o nome');
  };

  if (loading) return <div className="campo"><div className="campo-center">Carregando…</div></div>;
  if (!token || !ctx?.ok) {
    return (
      <div className="campo">
        <div className="campo-center">
          <div className="campo-erro">🔒</div>
          <h1>Link inválido</h1>
          <p>Este link não está ativo. Fale com a equipe de marketing da Cardoso para receber um link novo.</p>
        </div>
      </div>
    );
  }

  const isLider = ctx.kind === 'lider';
  const promoterName = ctx.promoters?.find((p) => p.id === promoter)?.name ?? '';
  const todayWd = ctx.today_weekday ?? 1;
  const plannedTodayIds = planByDay.get(todayWd) ?? [];
  const plannedToday = plannedTodayIds.map((id) => storeById.get(id)).filter(Boolean) as Store[];
  // lojas reportadas hoje que não estavam no plano (visitas extras)
  const extraToday = [...reportToday.keys()].filter((id) => !plannedTodayIds.includes(id)).map((id) => storeById.get(id)).filter(Boolean) as Store[];

  return (
    <div className="campo">
      <header className="campo-head">
        <div className="campo-logo">Cardoso · Campo</div>
        <h1>Olá{isLider ? '' : `, ${promoterName.split(' ')[0]}`}! 👋</h1>
        <p className="campo-sub">{brDate(ctx.today)} · {isLider ? 'Painel da líder' : promoterName}</p>
      </header>

      {isLider && (
        <div className="campo-promoters">
          <span className="campo-lbl">Promotor</span>
          <div className="campo-promchips">
            {ctx.promoters?.map((p) => (
              <button key={p.id} className={`campo-promchip ${promoter === p.id ? 'on' : ''}`} onClick={() => setPromoter(p.id)}>{p.name}</button>
            ))}
          </div>
        </div>
      )}

      <div className="campo-modes">
        <button className={mode === 'report' ? 'on' : ''} onClick={() => setMode('report')}>✅ Hoje</button>
        <button className={mode === 'plan' ? 'on' : ''} onClick={() => setMode('plan')}>📅 Semana</button>
        <button className={mode === 'stores' ? 'on' : ''} onClick={() => setMode('stores')}>🏪 Lojas</button>
      </div>

      {mode === 'report' && (
        <div className="campo-body">
          <h2 className="campo-h2">O que {isLider ? promoterName.split(' ')[0] : 'você'} fez hoje?</h2>
          {plannedToday.length === 0 && extraToday.length === 0 && (
            <p className="campo-empty">Nenhuma loja planejada para hoje. Use <b>“+ Visitei outra loja”</b> abaixo para registrar uma visita.</p>
          )}
          {[...plannedToday, ...extraToday].map((s) => {
            const r = reportToday.get(s.id);
            return (
              <div key={s.id} className={`campo-card ${r?.status === 'foi' ? 'ok' : r?.status === 'nao_foi' ? 'no' : ''}`}>
                <div className="campo-card-top">
                  <div>
                    <b>{s.name}</b>
                    <span className="campo-card-sub">{[s.network, s.city].filter(Boolean).join(' · ')}</span>
                  </div>
                  {!plannedTodayIds.includes(s.id) && <span className="campo-tagextra">extra</span>}
                </div>
                <div className="campo-btns">
                  <button className={`campo-yes ${r?.status === 'foi' ? 'on' : ''}`} onClick={() => (r?.status === 'foi' ? clearReport(s.id) : saveReport(s.id, 'foi'))}>✅ Foi</button>
                  <button className={`campo-no ${r?.status === 'nao_foi' ? 'on' : ''}`} onClick={() => saveReport(s.id, 'nao_foi', r?.reason || '')}>❌ Não foi</button>
                </div>
                {r?.status === 'nao_foi' && (
                  <div className="campo-motivos">
                    <span className="campo-lbl">Por quê?</span>
                    <div className="campo-motchips">
                      {MOTIVOS.map((m) => (
                        <button key={m} className={`campo-motchip ${r.reason === m ? 'on' : ''}`} onClick={() => saveReport(s.id, 'nao_foi', m)}>{m}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <button className="campo-add" onClick={() => setPicker({ onPick: (id) => { saveReport(id, 'foi'); setPicker(null); }, taken: new Set([...plannedTodayIds, ...reportToday.keys()]) })}>
            + Visitei outra loja
          </button>
        </div>
      )}

      {mode === 'plan' && (
        <div className="campo-body">
          <h2 className="campo-h2">Onde {isLider ? promoterName.split(' ')[0] : 'você'} vai nesta semana</h2>
          <p className="campo-empty" style={{ marginTop: -4 }}>Semana de {brDate(ctx.week_start)}. Toque em <b>+ loja</b> para adicionar em cada dia.</p>
          {DIAS.map((d) => {
            const ids = planByDay.get(d.wd) ?? [];
            return (
              <div key={d.wd} className="campo-day">
                <div className="campo-day-head"><b>{d.label}</b><span>{ids.length} loja(s)</span></div>
                <div className="campo-day-stores">
                  {ids.map((id) => {
                    const s = storeById.get(id);
                    return (
                      <span key={id} className="campo-storechip">
                        {s?.name ?? '—'}
                        <button onClick={() => savePlanDay(d.wd, ids.filter((x) => x !== id))} aria-label="remover">✕</button>
                      </span>
                    );
                  })}
                  <button className="campo-addstore" onClick={() => setPicker({ forWeekday: d.wd, onPick: (id) => { savePlanDay(d.wd, [...ids, id]); setPicker(null); }, taken: new Set(ids) })}>+ loja</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode === 'stores' && (
        <div className="campo-body">
          <h2 className="campo-h2">Cadastro de lojas</h2>
          <p className="campo-empty" style={{ marginTop: -4 }}>Cadastre as lojas visitadas e diga qual promotor é responsável. Isso abastece o hub automaticamente.</p>
          <button className="campo-add" onClick={() => setStoreEdit('new')} style={{ marginTop: 10 }}>+ Cadastrar nova loja</button>
          <StoreList stores={ctx.stores ?? []} promoters={ctx.promoters ?? []} onEdit={(s) => setStoreEdit(s)} />
        </div>
      )}

      {flash && <div className="campo-flash">{flash} ✓</div>}

      {storeEdit && (
        <StoreForm
          store={storeEdit === 'new' ? null : storeEdit}
          promoters={ctx.promoters ?? []}
          networks={ctx.networks ?? []}
          onSave={saveStore}
          onClose={() => setStoreEdit(null)}
        />
      )}

      {picker && (
        <StorePicker
          stores={ctx.stores ?? []}
          taken={picker.taken}
          onPick={picker.onPick}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function StoreList({ stores, promoters, onEdit }: {
  stores: Store[]; promoters: { id: string; name: string }[]; onEdit: (s: Store) => void;
}) {
  const [q, setQ] = useState('');
  const nameOf = (id: string | null) => promoters.find((p) => p.id === id)?.name ?? null;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return stores.filter((x) => !s || `${x.name} ${x.network ?? ''} ${x.city ?? ''}`.toLowerCase().includes(s));
  }, [stores, q]);
  return (
    <div style={{ marginTop: 14 }}>
      <input className="campo-searchinput" placeholder="🔍 Buscar loja cadastrada…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="campo-storelist">
        {list.map((s) => {
          const resp = nameOf(s.default_promoter_id);
          return (
            <button key={s.id} className="campo-storeitem" onClick={() => onEdit(s)}>
              <div>
                <b>{s.name}</b>
                <span>{[s.network, s.city].filter(Boolean).join(' · ') || 'sem rede/cidade'}</span>
              </div>
              <span className={`campo-resp ${resp ? '' : 'none'}`}>{resp ? `👤 ${resp.split(' ')[0]}` : 'sem responsável'}</span>
            </button>
          );
        })}
        {list.length === 0 && <div className="campo-picker-empty">Nenhuma loja. Toque em “+ Cadastrar nova loja”.</div>}
      </div>
    </div>
  );
}

function StoreForm({ store, promoters, networks, onSave, onClose }: {
  store: Store | null;
  promoters: { id: string; name: string }[];
  networks: { id: string; name: string }[];
  onSave: (s: { id?: string; name: string; network: string; city: string; region: string; address: string; promoter: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(store?.name ?? '');
  const [network, setNetwork] = useState(store?.network ?? '');
  const [city, setCity] = useState(store?.city ?? '');
  const [region, setRegion] = useState(store?.region ?? '');
  const [address, setAddress] = useState(store?.address ?? '');
  const [promoter, setPromoter] = useState(store?.default_promoter_id ?? '');
  return (
    <div className="campo-picker" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="campo-picker-sheet">
        <div className="campo-picker-head">
          <b style={{ flex: 1, fontSize: 18 }}>{store ? 'Editar loja' : 'Nova loja'}</b>
          <button onClick={onClose}>Fechar</button>
        </div>
        <div className="campo-form">
          <label className="campo-flabel">Nome da loja *
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ri Happy Shopping Aricanduva" />
          </label>
          <label className="campo-flabel">Rede
            <input list="campo-nets" value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="Ri Happy, Armarinhos Fernando…" />
            <datalist id="campo-nets">{networks.map((n) => <option key={n.id} value={n.name} />)}</datalist>
          </label>
          <div className="campo-frow">
            <label className="campo-flabel">Cidade<input value={city} onChange={(e) => setCity(e.target.value)} /></label>
            <label className="campo-flabel">Zona / Região<input value={region} onChange={(e) => setRegion(e.target.value)} /></label>
          </div>
          <label className="campo-flabel">Endereço (opcional)
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <div className="campo-flabel" style={{ marginTop: 4 }}>Responsável (promotor)</div>
          <div className="campo-promchips">
            {promoters.map((p) => (
              <button key={p.id} type="button" className={`campo-promchip ${promoter === p.id ? 'on' : ''}`} onClick={() => setPromoter(promoter === p.id ? '' : p.id)}>{p.name}</button>
            ))}
          </div>
          <button className="campo-save" disabled={!name.trim()} onClick={() => onSave({ id: store?.id, name, network, city, region, address, promoter })}>
            {store ? 'Salvar alterações' : 'Cadastrar loja'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StorePicker({ stores, taken, onPick, onClose }: {
  stores: Store[]; taken: Set<string>; onPick: (id: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return stores.filter((x) => !s || `${x.name} ${x.network ?? ''} ${x.city ?? ''}`.toLowerCase().includes(s)).slice(0, 80);
  }, [stores, q]);
  return (
    <div className="campo-picker" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="campo-picker-sheet">
        <div className="campo-picker-head">
          <input autoFocus placeholder="Buscar loja…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={onClose}>Fechar</button>
        </div>
        <div className="campo-picker-list">
          {list.map((s) => (
            <button key={s.id} className="campo-picker-item" disabled={taken.has(s.id)} onClick={() => onPick(s.id)}>
              <b>{s.name}</b>
              <span>{[s.network, s.city].filter(Boolean).join(' · ')}{taken.has(s.id) ? ' · já incluída' : ''}</span>
            </button>
          ))}
          {list.length === 0 && <div className="campo-picker-empty">Nenhuma loja encontrada.</div>}
        </div>
      </div>
    </div>
  );
}
