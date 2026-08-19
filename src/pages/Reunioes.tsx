import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import type { Meeting, MeetingItem, Profile } from '../types/database';

/* Módulo Reuniões — registra todas as reuniões (foco em licenciamento) com agência,
 * marca, data, participantes, assuntos + demandas (responsável/prazo) e pontos de decisão.
 * Painel "Aguardando decisão" reúne os pontos que precisam de avaliação. */

const brDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function Reunioes() {
  const { profile } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [items, setItems] = useState<MeetingItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeF, setTypeF] = useState<'all' | 'licenciamento' | 'geral'>('all');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  const load = useCallback(async () => {
    const [mt, it, pf] = await Promise.all([
      supabase.from('meetings').select('*').order('meeting_date', { ascending: false, nullsFirst: false }),
      supabase.from('meeting_items').select('*').order('position'),
      supabase.from('profiles').select('*').order('name'),
    ]);
    setMeetings((mt.data as Meeting[]) ?? []);
    setItems((it.data as MeetingItem[]) ?? []);
    setProfiles((pf.data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  // deep-link ?meeting=ID (vindo da notificação) → abre a reunião direto
  useEffect(() => {
    const id = params.get('meeting');
    if (id && meetings.some((m) => m.id === id)) setSelId(id);
  }, [params, meetings]);
  useEffect(() => {
    const ch = supabase.channel('meetings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_items' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const itemsOf = useCallback((mid: string) => items.filter((i) => i.meeting_id === mid), [items]);
  const openDecisions = useMemo(() => items.filter((i) => i.kind === 'decisao' && i.status === 'aberto'), [items]);
  const openDemandas = useMemo(() => items.filter((i) => i.kind === 'demanda' && i.status === 'aberto'), [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return meetings.filter((m) => {
      if (typeF !== 'all' && m.type !== typeF) return false;
      if (s && !`${m.agency} ${m.brand} ${m.title} ${m.topics} ${m.participants}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [meetings, typeF, q]);

  const meetingById = (id: string) => meetings.find((m) => m.id === id);

  const novaReuniao = async () => {
    const { data } = await supabase.from('meetings')
      .insert({ type: 'licenciamento', meeting_date: todayISO(), created_by: profile?.id ?? null })
      .select('id').single();
    await load();
    if (data) setSelId((data as { id: string }).id);
  };

  if (loading) return <Loading />;
  const selected = selId ? meetingById(selId) ?? null : null;

  return (
    <div className="page rm">
      <div className="rm-head">
        <div>
          <h1 className="page-title">Reuniões</h1>
          <div className="page-sub">Registro de reuniões — foco em licenciamento (agência, marca, demandas e decisões).</div>
        </div>
        <button className="btn primary" onClick={novaReuniao}>+ Nova reunião</button>
      </div>

      <div className="rm-kpis">
        <div className="rm-kpi"><b>{meetings.length}</b><span>reuniões</span></div>
        <div className="rm-kpi"><b>{openDemandas.length}</b><span>demandas abertas</span></div>
        <div className="rm-kpi warn"><b>{openDecisions.length}</b><span>aguardando decisão</span></div>
      </div>

      {openDecisions.length > 0 && (
        <div className="rm-decisions">
          <h3>⚖️ Pontos aguardando sua avaliação / decisão</h3>
          {openDecisions.map((d) => {
            const m = meetingById(d.meeting_id);
            return (
              <button key={d.id} className="rm-decision" onClick={() => setSelId(d.meeting_id)}>
                <span className="rm-decision-desc">{d.description || '(sem descrição)'}</span>
                <span className="rm-decision-ctx">{m ? `${m.agency || m.brand || 'reunião'} · ${brDate(m.meeting_date)}` : ''} →</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="rm-filters">
        <div className="rm-typchips">
          {([['all', 'Todas'], ['licenciamento', 'Licenciamento'], ['geral', 'Geral']] as const).map(([k, l]) => (
            <button key={k} className={`rm-chip ${typeF === k ? 'on' : ''}`} onClick={() => setTypeF(k)}>{l}</button>
          ))}
        </div>
        <input className="rm-search" placeholder="🔍 Agência, marca, assunto…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🤝" title="Nenhuma reunião" hint="Clique em “+ Nova reunião” para registrar a primeira." />
      ) : (
        <div className="rm-list">
          {filtered.map((m) => {
            const its = itemsOf(m.id);
            const dem = its.filter((i) => i.kind === 'demanda' && i.status === 'aberto').length;
            const dec = its.filter((i) => i.kind === 'decisao' && i.status === 'aberto').length;
            return (
              <button key={m.id} className="rm-card" onClick={() => setSelId(m.id)}>
                <div className="rm-card-top">
                  <span className={`rm-type ${m.type}`}>{m.type === 'licenciamento' ? 'Licenciamento' : 'Geral'}</span>
                  <span className="rm-card-date">{brDate(m.meeting_date)}{m.meeting_time ? ` · ${m.meeting_time.slice(0, 5)}` : ''}</span>
                </div>
                <div className="rm-card-title">{m.agency || m.title || 'Reunião'}{m.brand ? <span className="rm-card-brand"> · {m.brand}</span> : null}</div>
                {m.topics && <div className="rm-card-topics">{m.topics}</div>}
                <div className="rm-card-meta">
                  {(m.participant_ids?.length ?? 0) > 0 && <span>👥 {m.participant_ids.length} particip.</span>}
                  {dem > 0 && <span className="rm-tag">📋 {dem} demanda(s)</span>}
                  {dec > 0 && <span className="rm-tag warn">⚖️ {dec} decisão(ões)</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <MeetingModal
          key={selected.id}
          meeting={selected}
          items={itemsOf(selected.id)}
          profiles={profiles}
          me={profile}
          canDelete={profile?.role === 'diretoria' || profile?.role === 'administrador'}
          onClose={() => { setSelId(null); if (params.get('meeting')) { const p = new URLSearchParams(params); p.delete('meeting'); setParams(p, { replace: true }); } }}
          onChanged={load}
        />
      )}
    </div>
  );
}

/* ------------------------- detalhe / edição da reunião ------------------------- */
type Header = Pick<Meeting, 'type' | 'agency' | 'brand' | 'meeting_date' | 'meeting_time' | 'participant_ids' | 'topics' | 'notes' | 'title'>;

function MeetingModal({ meeting, items, profiles, me, canDelete, onClose, onChanged }: {
  meeting: Meeting;
  items: MeetingItem[];
  profiles: Profile[];
  me: Profile | null;
  canDelete: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [h, setH] = useState<Header>(() => pickHeader(meeting));
  const [saved, setSaved] = useState('');

  const flash = (m: string) => { setSaved(m); setTimeout(() => setSaved((c) => (c === m ? '' : c)), 1800); };
  const upd = (k: keyof Header, v: string) => setH((p) => ({ ...p, [k]: v }));

  const saveHeader = async () => {
    await supabase.from('meetings').update({ ...h, meeting_time: h.meeting_time || null, updated_by: me?.id ?? null }).eq('id', meeting.id);
    flash('reunião salva'); onChanged();
  };
  const toggleParticipant = (id: string) =>
    setH((p) => ({ ...p, participant_ids: p.participant_ids.includes(id) ? p.participant_ids.filter((x) => x !== id) : [...p.participant_ids, id] }));

  const addItem = async (kind: 'demanda' | 'decisao') => {
    const pos = items.length;
    await supabase.from('meeting_items').insert({ meeting_id: meeting.id, kind, position: pos, created_by: me?.id ?? null });
    onChanged();
  };
  const saveItem = async (id: string, patch: Partial<MeetingItem>) => {
    await supabase.from('meeting_items').update(patch).eq('id', id);
    onChanged();
  };
  const delItem = async (id: string) => {
    await supabase.from('meeting_items').delete().eq('id', id);
    onChanged();
  };
  const delMeeting = async () => {
    if (!window.confirm('Excluir esta reunião e todos os seus itens?')) return;
    await supabase.from('meetings').delete().eq('id', meeting.id);
    onClose(); onChanged();
  };

  const demandas = items.filter((i) => i.kind === 'demanda');
  const decisoes = items.filter((i) => i.kind === 'decisao');

  return (
    <Modal wide title="Reunião" onClose={onClose}>
      <div className="rm-form">
        <div className="rm-frow">
          <label className="rm-f">Tipo
            <select value={h.type} onChange={(e) => upd('type', e.target.value)}>
              <option value="licenciamento">Licenciamento</option>
              <option value="geral">Geral</option>
            </select>
          </label>
          <label className="rm-f">Data
            <input type="date" value={h.meeting_date ?? ''} onChange={(e) => upd('meeting_date', e.target.value)} />
          </label>
          <label className="rm-f">Horário
            <input type="time" value={h.meeting_time ?? ''} onChange={(e) => upd('meeting_time', e.target.value)} />
          </label>
        </div>
        <div className="rm-frow">
          <label className="rm-f">Agência
            <input value={h.agency} onChange={(e) => upd('agency', e.target.value)} placeholder="Agência / licenciador" />
          </label>
          <label className="rm-f">Marca
            <input value={h.brand} onChange={(e) => upd('brand', e.target.value)} placeholder="Marca / propriedade" />
          </label>
        </div>
        <div className="rm-f">Participantes
          <div className="rm-partchips">
            {profiles.filter((p) => !p.disabled).map((p) => (
              <button key={p.id} type="button" className={`rm-partchip ${h.participant_ids.includes(p.id) ? 'on' : ''}`} onClick={() => toggleParticipant(p.id)}>
                {h.participant_ids.includes(p.id) ? '✓ ' : ''}{p.name}
              </button>
            ))}
          </div>
          <p className="rm-parthint">Quem for marcado recebe notificação e vê a reunião no próprio Calendário.</p>
        </div>
        <label className="rm-f">Principais assuntos
          <textarea rows={3} value={h.topics} onChange={(e) => upd('topics', e.target.value)} placeholder="Do que se tratou a reunião…" />
        </label>
        <label className="rm-f">Observações / resumo
          <textarea rows={2} value={h.notes} onChange={(e) => upd('notes', e.target.value)} />
        </label>
        <div className="rm-form-actions">
          <button className="btn primary" onClick={saveHeader}>Salvar reunião</button>
          {saved && <span className="rm-saved">{saved} ✓</span>}
          {canDelete && <button className="btn ghost danger" style={{ marginLeft: 'auto' }} onClick={delMeeting}>Excluir</button>}
        </div>
      </div>

      <div className="rm-section">
        <div className="rm-section-head"><h4>📋 Demandas &amp; responsáveis</h4><button className="btn ghost sm" onClick={() => addItem('demanda')}>+ Demanda</button></div>
        {demandas.length === 0 && <p className="rm-nada">Nenhuma demanda registrada.</p>}
        {demandas.map((it) => <DemandaRow key={it.id} it={it} profiles={profiles} onSave={saveItem} onDelete={delItem} />)}
      </div>

      <div className="rm-section">
        <div className="rm-section-head"><h4>⚖️ Pontos para avaliação / decisão</h4><button className="btn ghost sm" onClick={() => addItem('decisao')}>+ Ponto de decisão</button></div>
        {decisoes.length === 0 && <p className="rm-nada">Nenhum ponto de decisão.</p>}
        {decisoes.map((it) => <DecisaoRow key={it.id} it={it} onSave={saveItem} onDelete={delItem} />)}
      </div>
    </Modal>
  );
}

function DemandaRow({ it, profiles, onSave, onDelete }: {
  it: MeetingItem; profiles: Profile[]; onSave: (id: string, p: Partial<MeetingItem>) => void; onDelete: (id: string) => void;
}) {
  const [desc, setDesc] = useState(it.description);
  const [owner, setOwner] = useState(it.owner);
  const [due, setDue] = useState(it.due_date ?? '');
  const done = it.status === 'concluido';
  return (
    <div className={`rm-item ${done ? 'done' : ''}`}>
      <button className="rm-check" onClick={() => onSave(it.id, { status: done ? 'aberto' : 'concluido' })} title={done ? 'Reabrir' : 'Concluir'}>{done ? '✅' : '⬜'}</button>
      <div className="rm-item-body">
        <input className="rm-item-desc" value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== it.description && onSave(it.id, { description: desc })} placeholder="O que precisa ser feito…" />
        <div className="rm-item-meta">
          <input className="rm-owner" list={`prof-${it.id}`} value={owner} onChange={(e) => setOwner(e.target.value)} onBlur={() => owner !== it.owner && onSave(it.id, { owner })} placeholder="Responsável" />
          <datalist id={`prof-${it.id}`}>{profiles.filter((p) => !p.disabled).map((p) => <option key={p.id} value={p.name} />)}</datalist>
          <input className="rm-due" type="date" value={due} onChange={(e) => { setDue(e.target.value); onSave(it.id, { due_date: e.target.value || null }); }} />
        </div>
      </div>
      <button className="rm-del" onClick={() => onDelete(it.id)} title="Remover">✕</button>
    </div>
  );
}

function DecisaoRow({ it, onSave, onDelete }: {
  it: MeetingItem; onSave: (id: string, p: Partial<MeetingItem>) => void; onDelete: (id: string) => void;
}) {
  const [desc, setDesc] = useState(it.description);
  const [decision, setDecision] = useState(it.decision);
  const decided = it.status === 'concluido';
  return (
    <div className={`rm-item decisao ${decided ? 'done' : 'pend'}`}>
      <span className="rm-decis-flag">{decided ? '✔' : '⚖️'}</span>
      <div className="rm-item-body">
        <input className="rm-item-desc" value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== it.description && onSave(it.id, { description: desc })} placeholder="Ponto que precisa da sua decisão…" />
        <div className="rm-decis-row">
          <input className="rm-decision-in" value={decision} onChange={(e) => setDecision(e.target.value)} onBlur={() => decision !== it.decision && onSave(it.id, { decision })} placeholder="Decisão registrada (opcional)…" />
          <button className={`rm-decide ${decided ? 'on' : ''}`} onClick={() => onSave(it.id, { status: decided ? 'aberto' : 'concluido' })}>
            {decided ? 'Decidido' : 'Marcar decidido'}
          </button>
        </div>
      </div>
      <button className="rm-del" onClick={() => onDelete(it.id)} title="Remover">✕</button>
    </div>
  );
}

function pickHeader(m: Meeting): Header {
  const { type, agency, brand, meeting_date, meeting_time, participant_ids, topics, notes, title } = m;
  return { type, agency, brand, meeting_date, meeting_time, participant_ids: participant_ids ?? [], topics, notes, title };
}
