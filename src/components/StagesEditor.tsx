import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { ProjectStage, StageSubstep } from '../types/database';

// Editor de etapas + sub-etapas (com prazo em dias e condicional que trava o avanço), autossuficiente
// por packaging_track. Usado no módulo Marcas (e reaproveitável em outros boards por trilha).
export default function StagesEditor({
  packagingTrack,
  title,
  taskStageIds,
  onChange,
}: {
  packagingTrack: string;
  title: string;
  taskStageIds: string[]; // etapas que ainda têm demandas (não podem ser excluídas)
  onChange: () => void;
}) {
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [newStageName, setNewStageName] = useState('');
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('stages').select('*').eq('packaging_track', packagingTrack).order('position');
    setStages((data as ProjectStage[]) ?? []);
  }, [packagingTrack]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = [...stages].sort((a, b) => a.position - b.position);
  async function reload() {
    await load();
    onChange();
  }

  async function addStage(e: FormEvent) {
    e.preventDefault();
    if (!newStageName.trim()) return;
    const position = sorted.length > 0 ? Math.max(...sorted.map((s) => s.position)) + 1 : 1;
    await supabase.from('stages').insert({ project_id: null, packaging_track: packagingTrack, name: newStageName.trim(), position, is_final: false });
    setNewStageName('');
    reload();
  }
  async function renameStage(id: string, name: string) {
    if (!name.trim()) return;
    await supabase.from('stages').update({ name: name.trim() }).eq('id', id);
    reload();
  }
  async function toggleFinal(id: string, isFinal: boolean) {
    await supabase.from('stages').update({ is_final: isFinal }).eq('id', id);
    reload();
  }
  async function move(id: string, dir: 'up' | 'down') {
    const idx = sorted.findIndex((s) => s.id === id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swap];
    await Promise.all([
      supabase.from('stages').update({ position: b.position }).eq('id', a.id),
      supabase.from('stages').update({ position: a.position }).eq('id', b.id),
    ]);
    reload();
  }
  async function deleteStage(id: string) {
    if (taskStageIds.includes(id)) {
      setError('Essa etapa ainda tem demandas — mova ou exclua as demandas antes de remover a etapa.');
      return;
    }
    setError(null);
    await supabase.from('stages').delete().eq('id', id);
    reload();
  }

  return (
    <div className="panel" style={{ marginTop: 10 }}>
      <h4>Etapas — {title}</h4>
      {error && (
        <div className="banner error" style={{ marginBottom: 8 }}>
          <span className="ic">⚠</span>
          <span>{error}</span>
        </div>
      )}
      {sorted.map((s, i) => (
        <div key={s.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
            <input defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && renameStage(s.id, e.target.value)} style={{ flex: 1 }} />
            <label style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={s.is_final} onChange={(e) => toggleFinal(s.id, e.target.checked)} style={{ width: 'auto' }} /> final
            </label>
            <button className="btn ghost sm" onClick={() => setExpandedStage((v) => (v === s.id ? null : s.id))} title="Sub-etapas">
              {expandedStage === s.id ? '▾' : '▸'} sub-etapas
            </button>
            <button className="btn ghost sm" disabled={i === 0} onClick={() => move(s.id, 'up')}>↑</button>
            <button className="btn ghost sm" disabled={i === sorted.length - 1} onClick={() => move(s.id, 'down')}>↓</button>
            <button className="btn ghost sm" onClick={() => deleteStage(s.id)}>✕</button>
          </div>
          {expandedStage === s.id && <StageSubstepsEditor stageId={s.id} />}
        </div>
      ))}
      <form onSubmit={addStage} className="responsive-row" style={{ marginTop: 8 }}>
        <input placeholder="Nova etapa" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} style={{ flex: 1 }} />
        <button className="btn sm" type="submit">Adicionar etapa</button>
      </form>
    </div>
  );
}

function StageSubstepsEditor({ stageId }: { stageId: string }) {
  const [subs, setSubs] = useState<StageSubstep[]>([]);
  const [label, setLabel] = useState('');
  const [cond, setCond] = useState(false);
  const [prazo, setPrazo] = useState('');

  async function load() {
    const { data } = await supabase.from('stage_substeps').select('*').eq('stage_id', stageId).order('position');
    setSubs((data as StageSubstep[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    const position = subs.length > 0 ? Math.max(...subs.map((s) => s.position)) + 1 : 1;
    await supabase.from('stage_substeps').insert({
      stage_id: stageId,
      label: label.trim(),
      position,
      is_conditional: cond,
      due_offset_days: prazo ? Number(prazo) : null,
    });
    setLabel('');
    setCond(false);
    setPrazo('');
    load();
  }
  async function rename(s: StageSubstep, name: string) {
    if (!name.trim() || name === s.label) return;
    await supabase.from('stage_substeps').update({ label: name.trim() }).eq('id', s.id);
    load();
  }
  async function toggleCond(s: StageSubstep) {
    await supabase.from('stage_substeps').update({ is_conditional: !s.is_conditional }).eq('id', s.id);
    load();
  }
  async function setOffset(s: StageSubstep, val: string) {
    await supabase.from('stage_substeps').update({ due_offset_days: val === '' ? null : Number(val) }).eq('id', s.id);
    load();
  }
  async function move(s: StageSubstep, dir: 'up' | 'down') {
    const idx = subs.findIndex((x) => x.id === s.id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= subs.length) return;
    const a = subs[idx];
    const b = subs[swap];
    await Promise.all([
      supabase.from('stage_substeps').update({ position: b.position }).eq('id', a.id),
      supabase.from('stage_substeps').update({ position: a.position }).eq('id', b.id),
    ]);
    load();
  }
  async function del(id: string) {
    await supabase.from('stage_substeps').delete().eq('id', id);
    load();
  }

  return (
    <div style={{ margin: '2px 0 8px 16px', padding: '8px 10px', borderLeft: '2px solid var(--border)', background: 'var(--surface)' }}>
      {subs.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Sem sub-etapas nesta etapa.</div>}
      {subs.map((s, i) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
          <input defaultValue={s.label} onBlur={(e) => rename(s, e.target.value)} style={{ flex: 1 }} />
          <input
            type="number"
            defaultValue={s.due_offset_days ?? ''}
            onBlur={(e) => setOffset(s, e.target.value)}
            placeholder="prazo (d)"
            title="Prazo em dias após entrar na etapa (conta a partir da etapa/sub-etapa anterior)"
            style={{ width: 90 }}
          />
          <button
            type="button"
            className="btn ghost sm"
            title={s.is_conditional ? 'Condicional (trava avanço) — clique p/ opcional' : 'Tornar condicional (trava avanço)'}
            onClick={() => toggleCond(s)}
            style={{ color: s.is_conditional ? 'var(--yellow)' : 'var(--text-faint)' }}
          >
            {s.is_conditional ? '🔒' : '🔓'}
          </button>
          <button type="button" className="btn ghost sm" disabled={i === 0} onClick={() => move(s, 'up')}>↑</button>
          <button type="button" className="btn ghost sm" disabled={i === subs.length - 1} onClick={() => move(s, 'down')}>↓</button>
          <button type="button" className="btn ghost sm" onClick={() => del(s.id)}>✕</button>
        </div>
      ))}
      <form onSubmit={add} className="responsive-row" style={{ marginTop: 6, alignItems: 'center' }}>
        <input placeholder="Nova sub-etapa" value={label} onChange={(e) => setLabel(e.target.value)} style={{ flex: 1 }} />
        <input type="number" placeholder="prazo (d)" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={{ width: 90 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={cond} onChange={(e) => setCond(e.target.checked)} style={{ width: 'auto' }} /> 🔒 condicional
        </label>
        <button type="submit" className="btn sm">Adicionar</button>
      </form>
    </div>
  );
}
