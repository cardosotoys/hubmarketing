import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import { BUDGET_CATEGORIES, type CampaignBudgetItem } from '../../types/database';

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ProjectFinanceiro({ projectId, actorId }: { projectId: string; actorId: string }) {
  const [items, setItems] = useState<CampaignBudgetItem[]>([]);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(BUDGET_CATEGORIES[0]);
  const [planned, setPlanned] = useState('');
  const [spentDrafts, setSpentDrafts] = useState<Record<string, string>>({});

  async function load() {
    const { data } = await supabase.from('campaign_budget_items').select('*').eq('project_id', projectId).order('created_at');
    setItems((data as CampaignBudgetItem[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const totalPlanned = items.reduce((s, b) => s + Number(b.planned_amount), 0);
  const totalSpent = items.reduce((s, b) => s + Number(b.spent_amount), 0);
  const saldo = totalPlanned - totalSpent;

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    await supabase.from('campaign_budget_items').insert({
      project_id: projectId,
      description: description.trim(),
      category,
      planned_amount: Number(planned) || 0,
      spent_amount: 0,
    });
    await logActivity({ actorId, actionText: 'Item de verba adicionado', detail: description, projectId });
    setDescription('');
    setPlanned('');
    load();
  }

  async function commitSpent(item: CampaignBudgetItem) {
    const draft = spentDrafts[item.id];
    if (draft === undefined) return;
    const value = Number(draft) || 0;
    await supabase.from('campaign_budget_items').update({ spent_amount: value }).eq('id', item.id);
    await logActivity({ actorId, actionText: 'Verba executada atualizada', detail: `${item.description}: ${formatBRL(value)}`, projectId });
    load();
  }

  async function deleteItem(id: string) {
    await supabase.from('campaign_budget_items').delete().eq('id', id);
    load();
  }

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{formatBRL(totalPlanned)}</div>
          <div className="stat-label">Previsto</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{formatBRL(totalSpent)}</div>
          <div className="stat-label">Executado</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: saldo < 0 ? 'var(--red)' : undefined }}>
            {formatBRL(saldo)}
          </div>
          <div className="stat-label">Saldo</div>
        </div>
      </div>

      <div className="section-head">
        <h2>Itens de verba</h2>
      </div>
      {items.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum item de verba cadastrado ainda.
        </div>
      ) : (
        <table className="simple">
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td style={{ color: 'var(--text-faint)' }}>{item.category}</td>
                <td style={{ color: 'var(--text-faint)' }}>{formatBRL(Number(item.planned_amount))}</td>
                <td>
                  <input
                    type="number"
                    value={spentDrafts[item.id] ?? item.spent_amount}
                    onChange={(e) => setSpentDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                    onBlur={() => commitSpent(item)}
                    style={{ width: 90 }}
                  />
                </td>
                <td>
                  <button className="btn ghost sm" onClick={() => deleteItem(item.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={addItem} className="panel" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} style={{ flex: 2 }} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {BUDGET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input type="number" placeholder="Previsto" value={planned} onChange={(e) => setPlanned(e.target.value)} style={{ width: 110 }} />
        <button className="btn sm" type="submit">
          Adicionar
        </button>
      </form>
    </div>
  );
}
