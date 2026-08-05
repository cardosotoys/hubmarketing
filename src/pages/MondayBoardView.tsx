import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import Modal from '../components/Modal';
import type { MondayActivity, MondayBoard, MondayItem, MondayUpdate } from '../types/database';

function fmt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url) || /\/storage\/v1\/object\/public\/monday-assets\//.test(url);
}

// Texto com URLs → links clicáveis; URLs de imagem → miniatura.
function RichText({ text }: { text: string }) {
  const parts = String(text || '').split(/(https?:\/\/[^\s)"]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!/^https?:\/\//.test(p)) return <span key={i}>{p}</span>;
        if (isImageUrl(p)) {
          return (
            <a key={i} href={p} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
              <img src={p} alt="anexo" style={{ maxWidth: 200, maxHeight: 150, borderRadius: 6, display: 'block', margin: '4px 0', border: '1px solid var(--border)' }} />
            </a>
          );
        }
        return <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a>;
      })}
    </>
  );
}

export default function MondayBoardView() {
  const { id } = useParams<{ id: string }>();
  const [board, setBoard] = useState<MondayBoard | null>(null);
  const [items, setItems] = useState<MondayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openItem, setOpenItem] = useState<MondayItem | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      supabase.from('monday_boards').select('*').eq('id', id).single(),
      supabase.from('monday_items').select('*').eq('board_id', id).order('position'),
    ]).then(([bRes, iRes]) => {
      setBoard((bRes.data as MondayBoard) ?? null);
      setItems((iRes.data as MondayItem[]) ?? []);
      setLoading(false);
    });
  }, [id]);

  const filtered = items.filter((it) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return it.name.toLowerCase().includes(q) || it.column_values.some((c) => (c.text || '').toLowerCase().includes(q));
  });

  const grouped = useMemo(() => {
    const map = new Map<string, MondayItem[]>();
    for (const it of filtered) {
      const key = it.group_title || 'Sem grupo';
      (map.get(key) ?? map.set(key, []).get(key))!.push(it);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (loading) return <div className="page-sub">Carregando…</div>;
  if (!board) return <div className="banner error"><span className="ic">⚠</span><span>Quadro não encontrado.</span></div>;

  return (
    <div className="page">
      <div style={{ marginBottom: 6 }}>
        <Link to="/monday" style={{ fontSize: 12, color: 'var(--violet)' }}>← Monday</Link>
      </div>
      <div className="workspace-title-row">
        <h1 className="page-title" style={{ margin: 0 }}>{board.name}</h1>
        <span className="pill" style={{ background: 'var(--violet-dim)', color: 'var(--violet)' }}>→ {board.suggested_destination || 'A definir'}</span>
      </div>
      <div className="page-sub">
        {board.item_count} itens · {board.update_count} comentários · {board.activity_count} eventos de histórico. Clique
        num item para ver colunas, comentários e histórico.
      </div>

      <div className="filters-row" style={{ marginTop: 6 }}>
        <input className="chip-select" placeholder="Buscar item…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 260, flex: 1 }} />
      </div>

      {grouped.map(([group, groupItems]) => (
        <div key={group} style={{ marginTop: 14 }}>
          <div className="section-head">
            <h2>{group} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>· {groupItems.length}</span></h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="simple">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Criado por</th>
                  <th>Criado em</th>
                  <th>Colunas preenchidas</th>
                </tr>
              </thead>
              <tbody>
                {groupItems.map((it) => (
                  <tr key={it.id} style={{ cursor: 'pointer' }} onClick={() => setOpenItem(it)}>
                    <td data-label="Item">{it.name}</td>
                    <td data-label="Criado por" style={{ color: 'var(--text-faint)' }}>{it.creator_name || '—'}</td>
                    <td data-label="Criado em" style={{ color: 'var(--text-faint)' }}>{fmt(it.monday_created_at)}</td>
                    <td data-label="Colunas" style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                      {it.column_values.filter((c) => c.text).slice(0, 4).map((c) => `${c.title}: ${c.text}`).join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {openItem && <ItemModal item={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}

function ItemModal({ item, onClose }: { item: MondayItem; onClose: () => void }) {
  const [updates, setUpdates] = useState<MondayUpdate[]>([]);
  const [activity, setActivity] = useState<MondayActivity[]>([]);
  const [tab, setTab] = useState<'dados' | 'comentarios' | 'historico'>('dados');

  useEffect(() => {
    Promise.all([
      supabase.from('monday_updates').select('*').eq('item_id', item.id).order('monday_created_at', { ascending: false }),
      supabase.from('monday_activity').select('*').eq('item_id', item.id).order('monday_created_at', { ascending: false }),
    ]).then(([uRes, aRes]) => {
      setUpdates((uRes.data as MondayUpdate[]) ?? []);
      setActivity((aRes.data as MondayActivity[]) ?? []);
    });
  }, [item.id]);

  return (
    <Modal title={item.name} onClose={onClose} wide>
      <div className="page-sub" style={{ marginTop: -4 }}>
        Grupo: {item.group_title || '—'} · Criado por {item.creator_name || '—'} em {fmt(item.monday_created_at)}
      </div>

      <div className="detail-tabs" style={{ marginTop: 8 }}>
        {([['dados', `Dados (${item.column_values.filter((c) => c.text).length})`], ['comentarios', `Comentários (${updates.length})`], ['historico', `Histórico (${activity.length})`]] as [typeof tab, string][]).map(([k, label]) => (
          <div key={k} className={`dtab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{label}</div>
        ))}
      </div>

      {tab === 'dados' && (
        <div className="panel" style={{ marginTop: 10 }}>
          {item.column_values.filter((c) => c.text).length === 0 && <div className="page-sub">Sem colunas preenchidas.</div>}
          {item.column_values.filter((c) => c.text || c.url).map((c) => (
            <div className="field-row" key={c.id}>
              <span className="k">{c.title}</span>
              <span>{c.url ? <RichText text={c.url} /> : <RichText text={c.text} />}</span>
            </div>
          ))}
          {item.subitems.length > 0 && (
            <>
              <h4 style={{ marginTop: 12 }}>Subitens</h4>
              {item.subitems.map((s, i) => (
                <div className="field-row" key={i}>
                  <span>{s.name}</span>
                  {s.status && <span className="tag" style={{ background: 'var(--surface-2)' }}>{s.status}</span>}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'comentarios' && (
        <div className="panel" style={{ marginTop: 10 }}>
          {updates.length === 0 && <div className="page-sub">Nenhum comentário.</div>}
          {updates.map((u) => (
            <div className="comment" key={u.id}>
              <div className="comment-head">
                <span className="name">{u.author_name || 'Alguém'}</span>
                <span className="time">{fmtDateTime(u.monday_created_at)}</span>
              </div>
              <div className="body" style={{ whiteSpace: 'pre-wrap' }}><RichText text={u.body} /></div>
              {(u.replies ?? []).length > 0 && (
                <div style={{ marginTop: 8, marginLeft: 12, borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>{u.replies.length} resposta(s)</div>
                  {u.replies.map((r, i) => (
                    <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      <div className="comment-head">
                        <span className="name" style={{ fontSize: 12 }}>{r.author_name || 'Alguém'}</span>
                        <span className="time">{fmtDateTime(r.created_at)}</span>
                      </div>
                      <div className="body" style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}><RichText text={r.body} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'historico' && (
        <div className="panel" style={{ marginTop: 10 }}>
          {activity.length === 0 && <div className="page-sub">Sem histórico deste item.</div>}
          {activity.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
              <span>
                <strong>{a.actor_name || '—'}</strong> {a.action_text}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{fmtDateTime(a.monday_created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
