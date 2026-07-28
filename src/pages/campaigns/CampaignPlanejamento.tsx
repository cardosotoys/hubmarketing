import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import { normalizeUrl } from '../../lib/url';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import type { Campaign, CampaignChecklistItem, CampaignDocument, Product } from '../../types/database';

type FieldKey = keyof Pick<
  Campaign,
  | 'objective'
  | 'description'
  | 'problem'
  | 'opportunity'
  | 'target_audience'
  | 'personas'
  | 'competitors'
  | 'message_main'
  | 'tone_of_voice'
  | 'promise'
  | 'value_proposition'
  | 'differentiators'
  | 'strategy'
  | 'restrictions'
  | 'assumptions'
  | 'stakeholders'
>;

interface Section {
  title: string;
  fields: { key: FieldKey; label: string }[];
}

const SECTIONS: Section[] = [
  {
    title: 'Contexto',
    fields: [
      { key: 'objective', label: 'Objetivo' },
      { key: 'description', label: 'Descrição' },
      { key: 'problem', label: 'Problema' },
      { key: 'opportunity', label: 'Oportunidade' },
    ],
  },
  {
    title: 'Público & Mensagem',
    fields: [
      { key: 'target_audience', label: 'Público' },
      { key: 'personas', label: 'Personas' },
      { key: 'competitors', label: 'Concorrentes' },
      { key: 'message_main', label: 'Mensagem principal' },
      { key: 'tone_of_voice', label: 'Tom de voz' },
      { key: 'promise', label: 'Promessa' },
      { key: 'value_proposition', label: 'Proposta de valor' },
      { key: 'differentiators', label: 'Diferenciais' },
    ],
  },
  {
    title: 'Estratégia',
    fields: [
      { key: 'strategy', label: 'Estratégia' },
      { key: 'restrictions', label: 'Restrições' },
      { key: 'assumptions', label: 'Premissas' },
      { key: 'stakeholders', label: 'Stakeholders' },
    ],
  },
];

export default function CampaignPlanejamento() {
  const { profile } = useAuth();
  const { campaign, reload } = useCampaignWorkspace();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Campaign>>({});
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [pickProduct, setPickProduct] = useState('');
  const [checklist, setChecklist] = useState<CampaignChecklistItem[]>([]);
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const [documents, setDocuments] = useState<CampaignDocument[]>([]);
  const [docName, setDocName] = useState('');
  const [docUrl, setDocUrl] = useState('');

  async function loadExtras() {
    const [productsRes, linkedRes, checklistRes, docsRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('campaign_products').select('product_id').eq('campaign_id', campaign.id),
      supabase.from('campaign_checklist_items').select('*').eq('campaign_id', campaign.id).order('position'),
      supabase.from('campaign_documents').select('*').eq('campaign_id', campaign.id).order('created_at'),
    ]);
    setProducts((productsRes.data as Product[]) ?? []);
    setLinkedIds(((linkedRes.data as { product_id: string }[]) ?? []).map((r) => r.product_id));
    setChecklist((checklistRes.data as CampaignChecklistItem[]) ?? []);
    setDocuments((docsRes.data as CampaignDocument[]) ?? []);
  }

  useEffect(() => {
    loadExtras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  function startEdit(section: Section) {
    const values: Partial<Campaign> = {};
    section.fields.forEach((f) => {
      values[f.key] = campaign[f.key];
    });
    setDraft(values);
    setEditingSection(section.title);
  }

  async function saveSection() {
    if (!profile) return;
    setSaving(true);
    await supabase.from('campaigns').update(draft).eq('id', campaign.id);
    await logActivity({ actorId: profile.id, actionText: 'Planejamento atualizado', campaignId: campaign.id });
    setSaving(false);
    setEditingSection(null);
    reload();
  }

  async function attachProduct() {
    if (!pickProduct) return;
    await supabase.from('campaign_products').insert({ campaign_id: campaign.id, product_id: pickProduct });
    if (profile) {
      const p = products.find((pr) => pr.id === pickProduct);
      await logActivity({ actorId: profile.id, actionText: 'Produto vinculado à campanha', detail: p?.name, campaignId: campaign.id });
    }
    setPickProduct('');
    loadExtras();
  }

  async function detachProduct(productId: string) {
    await supabase.from('campaign_products').delete().eq('campaign_id', campaign.id).eq('product_id', productId);
    loadExtras();
  }

  async function addChecklistItem(e: FormEvent) {
    e.preventDefault();
    if (!newChecklistLabel.trim()) return;
    await supabase
      .from('campaign_checklist_items')
      .insert({ campaign_id: campaign.id, label: newChecklistLabel.trim(), position: checklist.length });
    setNewChecklistLabel('');
    loadExtras();
  }

  async function toggleChecklistItem(item: CampaignChecklistItem) {
    await supabase.from('campaign_checklist_items').update({ done: !item.done }).eq('id', item.id);
    loadExtras();
  }

  async function deleteChecklistItem(id: string) {
    await supabase.from('campaign_checklist_items').delete().eq('id', id);
    loadExtras();
  }

  async function addDocument(e: FormEvent) {
    e.preventDefault();
    if (!docName.trim() || !docUrl.trim() || !profile) return;
    await supabase.from('campaign_documents').insert({ campaign_id: campaign.id, name: docName.trim(), url: normalizeUrl(docUrl), added_by: profile.id });
    setDocName('');
    setDocUrl('');
    loadExtras();
  }

  async function deleteDocument(id: string) {
    await supabase.from('campaign_documents').delete().eq('id', id);
    loadExtras();
  }

  const linkedProducts = products.filter((p) => linkedIds.includes(p.id));
  const unlinkedProducts = products.filter((p) => !linkedIds.includes(p.id));

  return (
    <div>
      {SECTIONS.map((section) => (
        <div className="panel" key={section.title}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>{section.title}</h4>
            {editingSection !== section.title && (
              <button className="btn ghost sm" onClick={() => startEdit(section)}>
                Editar
              </button>
            )}
          </div>
          {editingSection === section.title ? (
            <div>
              {section.fields.map((f) => (
                <div className="form-field" key={f.key}>
                  <label htmlFor={`pl-${f.key}`}>{f.label}</label>
                  <textarea
                    id={`pl-${f.key}`}
                    rows={2}
                    value={(draft[f.key] as string) ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="modal-actions">
                <button className="btn ghost" onClick={() => setEditingSection(null)}>
                  Cancelar
                </button>
                <button className="btn" disabled={saving} onClick={saveSection}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            section.fields.map((f) => (
              <div className="field-row" key={f.key}>
                <span className="k">{f.label}</span>
                <span style={{ textAlign: 'right', color: campaign[f.key] ? 'var(--text)' : 'var(--text-faint)' }}>
                  {(campaign[f.key] as string) || 'Não preenchido'}
                </span>
              </div>
            ))
          )}
        </div>
      ))}

      <div className="panel">
        <h4>Produtos vinculados</h4>
        {linkedProducts.length === 0 ? (
          <p style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>Nenhum produto vinculado ainda.</p>
        ) : (
          linkedProducts.map((p) => (
            <div className="field-row" key={p.id}>
              <span>
                {p.name} {p.licensed && <span className="pill">licenciado</span>}
              </span>
              <button className="btn ghost sm" onClick={() => detachProduct(p.id)}>
                Remover
              </button>
            </div>
          ))
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <select value={pickProduct} onChange={(e) => setPickProduct(e.target.value)} style={{ flex: 1 }}>
            <option value="">Escolher produto do catálogo…</option>
            {unlinkedProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn sm" onClick={attachProduct} disabled={!pickProduct}>
            Vincular
          </button>
        </div>
      </div>

      <div className="panel">
        <h4>Checklist de kickoff</h4>
        {checklist.map((item) => (
          <div className="field-row" key={item.id}>
            <span onClick={() => toggleChecklistItem(item)} style={{ cursor: 'pointer', textDecoration: item.done ? 'line-through' : 'none' }}>
              {item.done ? '✅' : '◻︎'} {item.label}
            </span>
            <button className="btn ghost sm" onClick={() => deleteChecklistItem(item.id)}>
              ✕
            </button>
          </div>
        ))}
        <form onSubmit={addChecklistItem} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            placeholder="+ novo item…"
            value={newChecklistLabel}
            onChange={(e) => setNewChecklistLabel(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn sm" type="submit">
            Adicionar
          </button>
        </form>
      </div>

      <div className="panel">
        <h4>Documentos & links</h4>
        {documents.map((d) => (
          <div className="field-row" key={d.id}>
            <a href={d.url} target="_blank" rel="noreferrer">
              {d.name}
            </a>
            <button className="btn ghost sm" onClick={() => deleteDocument(d.id)}>
              Remover
            </button>
          </div>
        ))}
        <form onSubmit={addDocument} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input placeholder="Nome" value={docName} onChange={(e) => setDocName(e.target.value)} style={{ flex: 1 }} />
          <input placeholder="URL" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} style={{ flex: 2 }} />
          <button className="btn sm" type="submit">
            Adicionar
          </button>
        </form>
      </div>
    </div>
  );
}
