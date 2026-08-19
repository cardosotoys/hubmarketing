import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

/* ------------------------------------------------------------------ *
 * Página de CAMPO — link mágico (sem login) para a líder e os promotores
 * planejarem a semana e darem o report diário. Grava por RPC segura (token).
 * Mobile-first, letras grandes, poucos toques.
 * ------------------------------------------------------------------ */

type Store = { id: string; name: string; network: string | null; city: string | null; region: string | null; default_promoter_id: string | null };
type Ctx = {
  ok: boolean;
  kind?: 'lider' | 'promotor';
  promoter_id?: string | null;
  label?: string;
  week_start?: string;
  today?: string;
  today_weekday?: number;
  promoters?: { id: string; name: string }[];
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
  const [mode, setMode] = useState<'report' | 'plan'>('report');
  const [flash, setFlash] = useState('');
  const [picker, setPicker] = useState<null | { forWeekday?: number; onPick: (storeId: string) => void; taken: Set<string> }>(null);

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
        <button className={mode === 'report' ? 'on' : ''} onClick={() => setMode('report')}>✅ Report de hoje</button>
        <button className={mode === 'plan' ? 'on' : ''} onClick={() => setMode('plan')}>📅 Planejar a semana</button>
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

      {flash && <div className="campo-flash">{flash} ✓</div>}

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
