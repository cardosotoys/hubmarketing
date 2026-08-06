import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Loading from '../components/Loading';
import { BRAND_IDENTITY, IDENTITY_STATUS, type BrandIdentityStatus } from '../lib/brandIdentity';
import type { Brand } from '../types/database';

type Tab = 'identidade' | 'demandas' | 'arquivos';
type StatusRow = { section_key: string; topic: string; status: BrandIdentityStatus; note: string };

const statusColor = (s: BrandIdentityStatus) => IDENTITY_STATUS.find((x) => x.key === s)?.color ?? 'var(--text-faint)';

export default function Marcas() {
  const { profile } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState<string>('');
  const [tab, setTab] = useState<Tab>('identidade');
  const [statuses, setStatuses] = useState<Record<string, StatusRow>>({});
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('brands')
      .select('*')
      .order('label')
      .then(({ data }) => {
        const list = (data as Brand[]) ?? [];
        setBrands(list);
        if (list.length && !brandId) setBrandId(list[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStatuses = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    const { data } = await supabase.from('brand_identity_status').select('section_key, topic, status, note').eq('brand_id', brandId);
    const map: Record<string, StatusRow> = {};
    ((data as StatusRow[]) ?? []).forEach((r) => {
      map[`${r.section_key}::${r.topic}`] = r;
    });
    setStatuses(map);
    setLoading(false);
  }, [brandId]);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const getStatus = (sectionKey: string, topic: string): BrandIdentityStatus =>
    statuses[`${sectionKey}::${topic}`]?.status ?? 'pendente';
  const getNote = (sectionKey: string, topic: string): string => statuses[`${sectionKey}::${topic}`]?.note ?? '';

  async function setStatus(sectionKey: string, topic: string, status: BrandIdentityStatus) {
    const key = `${sectionKey}::${topic}`;
    const prev = statuses[key];
    setStatuses((s) => ({ ...s, [key]: { section_key: sectionKey, topic, status, note: prev?.note ?? '' } }));
    await supabase
      .from('brand_identity_status')
      .upsert(
        { brand_id: brandId, section_key: sectionKey, topic, status, note: prev?.note ?? '', updated_by: profile?.id, updated_at: new Date().toISOString() },
        { onConflict: 'brand_id,section_key,topic' },
      );
  }

  async function setNote(sectionKey: string, topic: string, note: string) {
    const key = `${sectionKey}::${topic}`;
    const prev = statuses[key];
    if ((prev?.note ?? '') === note) return;
    setStatuses((s) => ({ ...s, [key]: { section_key: sectionKey, topic, status: prev?.status ?? 'pendente', note } }));
    await supabase
      .from('brand_identity_status')
      .upsert(
        { brand_id: brandId, section_key: sectionKey, topic, status: prev?.status ?? 'pendente', note, updated_by: profile?.id, updated_at: new Date().toISOString() },
        { onConflict: 'brand_id,section_key,topic' },
      );
  }

  function toggleSection(k: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  // progresso: % de tópicos "aprovados" sobre o total (ignora N/A)
  function sectionProgress(sectionKey: string, topics: string[]) {
    const considered = topics.filter((t) => getStatus(sectionKey, t) !== 'na');
    const done = considered.filter((t) => getStatus(sectionKey, t) === 'aprovado').length;
    return { done, total: considered.length };
  }
  const overall = BRAND_IDENTITY.reduce(
    (acc, sec) => {
      const p = sectionProgress(sec.key, sec.topics);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 },
  );
  const overallPct = overall.total ? Math.round((overall.done / overall.total) * 100) : 0;

  const brand = brands.find((b) => b.id === brandId);

  return (
    <div className="page">
      <h1 className="page-title">Marcas</h1>
      <div className="page-sub">
        Acompanhamento da identidade de cada marca — execução do planejamento visual, demandas e arquivos. Playmi,
        Cardoso e Tópi.
      </div>

      {/* Seletor de marca */}
      <div className="filters-row" style={{ marginTop: 4 }}>
        {brands.map((b) => (
          <div
            key={b.id}
            className={`filter-chip${brandId === b.id ? ' active' : ''}`}
            onClick={() => setBrandId(b.id)}
            style={brandId === b.id ? { borderLeft: `3px solid ${b.color}` } : undefined}
          >
            <span className="sw" style={{ background: b.color, display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 6 }} />
            {b.label}
          </div>
        ))}
      </div>

      {/* Abas do módulo */}
      <div className="detail-tabs" style={{ marginTop: 8 }}>
        {([['identidade', 'Identidade'], ['demandas', 'Demandas'], ['arquivos', 'Arquivos']] as [Tab, string][]).map(([key, label]) => (
          <div key={key} className={`dtab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </div>
        ))}
      </div>

      {tab === 'identidade' ? (
        loading ? (
          <Loading />
        ) : (
          <div style={{ marginTop: 12 }}>
            {/* progresso geral */}
            <div className="panel" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 700 }}>{brand?.label}</div>
                <div style={{ flex: 1, height: 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${overallPct}%`, height: '100%', background: 'var(--green)' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                  {overall.done}/{overall.total} aprovados · {overallPct}%
                </div>
              </div>
            </div>

            {BRAND_IDENTITY.map((sec) => {
              const p = sectionProgress(sec.key, sec.topics);
              const open = openSections.has(sec.key);
              return (
                <div key={sec.key} className="panel" style={{ marginBottom: 8 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                    onClick={() => toggleSection(sec.key)}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{open ? '▾' : '▸'}</span>
                    <h4 style={{ margin: 0, flex: 1 }}>{sec.title}</h4>
                    <span className="pill" style={{ background: 'var(--surface-2)' }}>
                      {p.done}/{p.total}
                    </span>
                  </div>
                  {open && (
                    <div style={{ marginTop: 10, overflowX: 'auto' }}>
                      <table className="simple">
                        <thead>
                          <tr>
                            <th>Tópico</th>
                            <th style={{ width: 150 }}>Status</th>
                            <th>Observação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sec.topics.map((topic) => {
                            const st = getStatus(sec.key, topic);
                            return (
                              <tr key={topic}>
                                <td data-label="Tópico">{topic}</td>
                                <td data-label="Status">
                                  <select
                                    className="chip-select"
                                    value={st}
                                    onChange={(e) => setStatus(sec.key, topic, e.target.value as BrandIdentityStatus)}
                                    style={{ color: statusColor(st), fontWeight: 600 }}
                                  >
                                    {IDENTITY_STATUS.map((s) => (
                                      <option key={s.key} value={s.key}>
                                        {s.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td data-label="Observação">
                                  <input
                                    defaultValue={getNote(sec.key, topic)}
                                    placeholder="—"
                                    onBlur={(e) => setNote(sec.key, topic, e.target.value)}
                                    style={{ width: '100%' }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 16px',
            color: 'var(--text-faint)',
            border: '1px dashed var(--border)',
            borderRadius: 12,
            marginTop: 16,
          }}
        >
          <div style={{ fontSize: 34, marginBottom: 8 }}>{tab === 'demandas' ? '☰' : '🗂️'}</div>
          <div style={{ color: 'var(--text-dim)', fontWeight: 600, marginBottom: 6 }}>
            {tab === 'demandas' ? 'Demandas da marca — em breve' : 'Arquivos da marca — em breve'}
          </div>
          <p style={{ fontSize: 13, maxWidth: 460, margin: '0 auto', lineHeight: 1.5 }}>
            {tab === 'demandas'
              ? 'Próxima etapa: criar e acompanhar demandas por marca (etapas, sub-etapas, prazos, comentários/menções e aprovações), no mesmo motor do módulo Embalagens.'
              : 'Próxima etapa: biblioteca de arquivos da marca — muitos materiais serão espelhados do Google Drive quando a sincronização estiver pronta.'}
          </p>
        </div>
      )}
    </div>
  );
}
