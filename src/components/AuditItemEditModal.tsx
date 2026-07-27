import { useState } from 'react';
import Modal from './Modal';
import { CORRECTION_STATUSES, PACKAGING_STATUSES, type AuditItem, type Brand, type Product } from '../types/database';

type ProductWithBrand = Product & { brand: Brand };

export default function AuditItemEditModal({
  product,
  item,
  onClose,
  onSave,
  onClear,
}: {
  product: ProductWithBrand;
  item: AuditItem | null;
  onClose: () => void;
  onSave: (fields: Partial<AuditItem>) => void;
  onClear: () => void;
}) {
  const [itemToChange, setItemToChange] = useState(item?.item_to_change ?? '');
  const [changeNeeded, setChangeNeeded] = useState(item?.change_needed ?? '');
  const [priority, setPriority] = useState(item?.priority_effective || 'Média');
  const [responsible, setResponsible] = useState(item?.responsible ?? '');
  const [correctionStatus, setCorrectionStatus] = useState(item?.correction_status ?? 'Não Iniciado');
  const [packagingStatus, setPackagingStatus] = useState(item?.packaging_status ?? 'Não Iniciado');
  const [available, setAvailable] = useState(item?.available ?? false);
  const [verifiedBy, setVerifiedBy] = useState(item?.verified_by ?? '');
  const [verifiedAt, setVerifiedAt] = useState(item?.verified_at ?? '');
  const [driveLink, setDriveLink] = useState(item?.drive_link ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [confirmingClear, setConfirmingClear] = useState(false);

  function handleSave() {
    onSave({
      item_to_change: itemToChange,
      change_needed: changeNeeded,
      priority_effective: priority,
      responsible,
      correction_status: correctionStatus,
      packaging_status: packagingStatus,
      available,
      verified_by: verifiedBy,
      verified_at: verifiedAt || null,
      drive_link: driveLink,
      notes,
    });
  }

  return (
    <Modal title={`${product.code} — ${product.name}`} onClose={onClose}>
      <div className="form-field">
        <label htmlFor="ai-item">Item a alterar</label>
        <input id="ai-item" value={itemToChange} onChange={(e) => setItemToChange(e.target.value)} placeholder="Embalagem, Produto, Logomarca…" />
      </div>
      <div className="form-field">
        <label htmlFor="ai-change">Alteração necessária</label>
        <textarea id="ai-change" rows={2} value={changeNeeded} onChange={(e) => setChangeNeeded(e.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="ai-priority">Prioridade</label>
        <select id="ai-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="Alta">Alta</option>
          <option value="Média">Média</option>
          <option value="Baixa">Baixa</option>
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="ai-responsible">Responsável</label>
        <input id="ai-responsible" value={responsible} onChange={(e) => setResponsible(e.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="ai-status">Status da correção</label>
        <select id="ai-status" value={correctionStatus} onChange={(e) => setCorrectionStatus(e.target.value)}>
          {CORRECTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="ai-packaging">Embalagem finalizada corretamente?</label>
        <select id="ai-packaging" value={packagingStatus} onChange={(e) => setPackagingStatus(e.target.value)}>
          {PACKAGING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input id="ai-available" type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} style={{ width: 'auto' }} />
        <label htmlFor="ai-available" style={{ margin: 0 }}>
          Já disponível (venda/produção/divulgação)?
        </label>
      </div>
      <div className="form-field">
        <label htmlFor="ai-verifiedby">Verificado por</label>
        <input id="ai-verifiedby" value={verifiedBy} onChange={(e) => setVerifiedBy(e.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="ai-verifiedat">Data da verificação</label>
        <input id="ai-verifiedat" type="date" value={verifiedAt} onChange={(e) => setVerifiedAt(e.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="ai-link">Link da imagem/arte atual (Drive)</label>
        <input id="ai-link" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="ai-notes">Observações</label>
        <textarea id="ai-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {confirmingClear ? (
        <div className="banner error" style={{ alignItems: 'center' }}>
          <span className="ic">⚠</span>
          <span style={{ flex: 1 }}>Remover a pendência e voltar este produto para "Sem pendência"?</span>
          <button className="btn ghost sm" onClick={() => setConfirmingClear(false)}>
            Cancelar
          </button>
          <button className="btn sm" style={{ background: 'var(--red)' }} onClick={onClear}>
            Remover
          </button>
        </div>
      ) : (
        <div className="modal-actions" style={{ justifyContent: item ? 'space-between' : 'flex-end' }}>
          {item && (
            <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => setConfirmingClear(true)}>
              Remover pendência
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn" onClick={handleSave}>
              Salvar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
