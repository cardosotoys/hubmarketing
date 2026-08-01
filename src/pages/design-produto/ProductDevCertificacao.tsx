import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import { useProductDevWorkspace } from '../../context/ProductDevWorkspaceContext';
import {
  CERTIFICATION_STATUSES,
  type CertificationStatus,
  type ProductDevDocument,
} from '../../types/database';

const CERT_COLOR: Record<CertificationStatus, string> = {
  nao_iniciado: 'var(--text-faint)',
  em_ensaio: 'var(--yellow)',
  aprovado: 'var(--green)',
  reprovado: 'var(--red)',
};

const REG_POINTS = [
  'Certificação compulsória do INMETRO, regida pela Portaria INMETRO nº 302/2021 (substituiu a 563/2016).',
  'Aplica-se a brinquedos destinados a crianças menores de 14 anos, nacionais e importados.',
  'Ensaios conforme a série ABNT NBR NM 300 (mecânico/físico, inflamabilidade, migração de elementos, químico/elétrico).',
  'Certificação por OCP acreditado pela CGCRE/INMETRO, com registro no Prodcert e uso do selo INMETRO na embalagem.',
  'Brinquedo com rádio-frequência sem fio (Wi-Fi, Bluetooth) exige também homologação na ANATEL.',
];

export default function ProductDevCertificacao() {
  const { profile } = useAuth();
  const { item, reload } = useProductDevWorkspace();
  const [status, setStatus] = useState<CertificationStatus>(item.certification_status);
  const [number, setNumber] = useState(item.certification_number);
  const [expiry, setExpiry] = useState(item.certification_expiry ?? '');
  const [requiresAnatel, setRequiresAnatel] = useState(item.requires_anatel);
  const [saving, setSaving] = useState(false);
  const [laudos, setLaudos] = useState<ProductDevDocument[]>([]);

  useEffect(() => {
    supabase
      .from('product_dev_documents')
      .select('*')
      .eq('item_id', item.id)
      .eq('kind', 'laudo')
      .order('created_at', { ascending: false })
      .then(({ data }) => setLaudos((data as ProductDevDocument[]) ?? []));
  }, [item.id]);

  async function save() {
    setSaving(true);
    await supabase
      .from('product_dev_items')
      .update({
        certification_status: status,
        certification_number: number,
        certification_expiry: expiry || null,
        requires_anatel: requiresAnatel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    await logActivity({
      actorId: profile?.id ?? '',
      actionText: `Certificação — ${CERTIFICATION_STATUSES.find((c) => c.key === status)?.label ?? status}`,
      productDevItemId: item.id,
    });
    setSaving(false);
    reload();
  }

  const expired = expiry && new Date(expiry + 'T00:00') < new Date(new Date().toDateString());

  return (
    <div>
      <div className="section-head">
        <h2>Certificação & conformidade</h2>
        <button className="btn sm" disabled={saving} onClick={save}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      <div className="banner" style={{ borderColor: status === 'aprovado' ? 'var(--green)' : 'var(--red)', marginBottom: 12 }}>
        <span className="ic">{status === 'aprovado' ? '✓' : '⛔'}</span>
        <span>
          <strong>Fase bloqueante.</strong> Nenhum produto pode ser comercializado sem certificação INMETRO válida
          (sujeito a multa e apreensão). Trate o campo "certificação válida" como pré-requisito para a Fase 8.
        </span>
      </div>

      <div className="panel">
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="c-status">Status</label>
            <select id="c-status" value={status} onChange={(e) => setStatus(e.target.value as CertificationStatus)}>
              {CERTIFICATION_STATUSES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="c-number">Nº do certificado / Prodcert</label>
            <input id="c-number" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="c-expiry">Validade</label>
            <input id="c-expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={requiresAnatel} onChange={(e) => setRequiresAnatel(e.target.checked)} style={{ width: 'auto' }} />
              Exige homologação ANATEL (rádio-frequência)
            </label>
          </div>
        </div>
        <div className="field-row">
          <span className="k">Situação atual</span>
          <span style={{ color: CERT_COLOR[status], fontWeight: 600 }}>
            {CERTIFICATION_STATUSES.find((c) => c.key === status)?.label}
            {expired && status === 'aprovado' ? ' — ⚠ certificado vencido' : ''}
          </span>
        </div>
      </div>

      <div className="panel">
        <h4>Laudos de laboratório</h4>
        {laudos.length === 0 ? (
          <div className="page-sub">
            Nenhum laudo anexado. Adicione os laudos do laboratório acreditado em <Link to="../ficha">Ficha & Requisitos → Documentos</Link> (tipo "Laudo").
          </div>
        ) : (
          laudos.map((l) => (
            <div key={l.id} className="field-row">
              <span className="k">Laudo</span>
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.name}
              </a>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <h4>Marco regulatório (vigente em 2026)</h4>
        {REG_POINTS.map((p) => (
          <div key={p} className="field-row">
            <span style={{ color: 'var(--violet)' }}>▸</span>
            <span>{p}</span>
          </div>
        ))}
        <div className="page-sub" style={{ marginTop: 8 }}>
          Entregáveis desta fase: laudos do laboratório acreditado, certificado emitido, registro Prodcert, arte de
          embalagem com selo INMETRO e advertências.
        </div>
      </div>
    </div>
  );
}
