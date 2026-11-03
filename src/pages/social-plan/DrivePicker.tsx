import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { driveTarget } from './DrivePlayer';

/* Seletor de criativo no Drive. Cada peça aponta para a pasta da marca e do formato em
 * <MARCA>/Redes Sociais/<Instagram - Reels | Instagram - Post | ...>; a função drive-pasta lê a pasta com a
 * conta de serviço e aqui é só escolher. Carrossel: escolhe as lâminas na ordem ou usa uma subpasta inteira.
 * Mostra o que bate com o assunto (produto, REF, data) e o que já foi usado em outra peça. */

type Marca = 'Cardoso' | 'Playmi' | 'Tópi';
type Item = {
  id: string; nome: string; tipo: 'pasta' | 'video' | 'imagem' | 'outro'; alterado: string | null;
  miniatura: string | null; largura: number | null; altura: number | null; duracao: number | null;
};
type Resposta = { pastas?: { id: string; nome: string }[]; pasta?: { id: string; nome: string; caminho: string[] }; itens?: Item[]; error?: string };

const fileUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Pasta de Redes Sociais de cada canal/formato. */
export function driveFolderFor(channelId: string, account: string | undefined, pieceType: string, carousel: boolean): { marca: Marca; pasta: string } | null {
  if (channelId === 'cd-yt-pl') return { marca: 'Playmi', pasta: 'Youtube - Shorts' };
  if (channelId === 'cd-yt-tp') return { marca: 'Tópi', pasta: 'Youtube - Shorts' };
  if (channelId === 'wa-st') return { marca: 'Cardoso', pasta: 'WhatsApp - Status' };
  if (channelId.startsWith('wa-')) return { marca: 'Cardoso', pasta: 'WhatsApp - Canais' };
  if (channelId === 'cd-gmn') return { marca: 'Cardoso', pasta: 'Google Meu Negócio' };
  if (channelId === 'cd-pin') return { marca: 'Cardoso', pasta: 'Pinterest' };
  if (channelId === 'cd-li') return { marca: 'Cardoso', pasta: 'Linkedin' };
  const marca = (account === 'Playmi' || account === 'Tópi' || account === 'Cardoso') ? account : null;
  if (!marca) return null;
  if (/Reels|TikTok/i.test(pieceType) || channelId.endsWith('-tt')) return { marca, pasta: 'Instagram - Reels' };
  if (/Stor/i.test(pieceType)) return { marca, pasta: 'Instagram - Story' };
  if (carousel && marca !== 'Cardoso') return { marca, pasta: 'Instagram - Carrossel' };
  return { marca, pasta: 'Instagram - Post' };
}

export default function DrivePicker({ marca, pasta, multiple, hints, onPick, onClose }: {
  marca: Marca;
  pasta: string;
  multiple?: boolean;                    // carrossel: várias lâminas, na ordem do clique
  hints: { title?: string; product?: string; sku?: string; date?: string };
  onPick: (urls: string[]) => void;
  onClose: () => void;
}) {
  const [nav, setNav] = useState<{ pasta?: string; folderId?: string }>({ pasta });
  const [data, setData] = useState<Resposta | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [usados, setUsados] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase.functions.invoke('drive-pasta', { body: { marca, ...nav } }).then(({ data: d, error }) => {
      if (!alive) return;
      const r = (d ?? {}) as Resposta;
      if (error && !r.error) r.error = /not found|404/i.test(error.message) ? 'A função drive-pasta ainda não foi publicada no Supabase.' : error.message;
      setData(r);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [marca, nav]);

  // o que já está ligado a alguma peça
  useEffect(() => {
    supabase.from('social_plan_items').select('creative_url, creative_slides, pub_date').eq('archived', false)
      .or('creative_url.not.is.null,creative_slides.neq.{}')
      .then(({ data: rows }) => {
        const m = new Map<string, string>();
        for (const r of (rows ?? []) as { creative_url: string | null; creative_slides: string[] | null; pub_date: string }[]) {
          for (const u of [r.creative_url, ...(r.creative_slides ?? [])]) {
            const t = driveTarget(u);
            if (t) m.set(t.id, r.pub_date.slice(8, 10) + '/' + r.pub_date.slice(5, 7));
          }
        }
        setUsados(m);
      });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  // palavras do assunto e a data da peça para destacar o arquivo provável
  const chaves = useMemo(() => {
    const words = norm(`${hints.title ?? ''} ${hints.product ?? ''}`).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
    const sku = (hints.sku ?? '').match(/\d{3,5}/)?.[0];
    const d = hints.date ?? '';
    const datas = d ? [d, `${d.slice(8, 10)}.${d.slice(5, 7)}`, `${d.slice(8, 10)}-${d.slice(5, 7)}`, `${d.slice(8, 10)}_${d.slice(5, 7)}`] : [];
    return { words: [...new Set(words)], sku, datas };
  }, [hints]);
  const pontos = (nome: string) => {
    const n = norm(nome);
    let p = 0;
    if (chaves.sku && n.includes(chaves.sku)) p += 3;
    if (chaves.datas.some((x) => n.includes(x))) p += 3;
    p += chaves.words.filter((w) => n.includes(w)).length;
    return p;
  };

  const itens = useMemo(() => {
    const all = data?.itens ?? [];
    const f = q.trim() ? all.filter((i) => norm(i.nome).includes(norm(q.trim()))) : all;
    return f.map((i) => ({ ...i, pts: pontos(i.nome) }))
      .sort((a, b) => (a.tipo === 'pasta' ? 0 : 1) - (b.tipo === 'pasta' ? 0 : 1) || b.pts - a.pts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, chaves]);

  const usarPasta = async (folderId: string) => {
    const { data: d } = await supabase.functions.invoke('drive-pasta', { body: { marca, folderId } });
    const imgs = ((d as Resposta)?.itens ?? []).filter((i) => i.tipo !== 'pasta').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
    if (imgs.length) onPick(imgs.map((i) => fileUrl(i.id)));
  };
  const clicar = (i: Item) => {
    if (i.tipo === 'pasta') { setNav({ folderId: i.id }); setSel([]); return; }
    if (!multiple) { onPick([fileUrl(i.id)]); return; }
    setSel((s) => (s.includes(i.id) ? s.filter((x) => x !== i.id) : [...s, i.id]));
  };

  const caminho = data?.pasta?.caminho ?? [nav.pasta ?? ''];
  return createPortal(
    <div className="dpk" role="dialog" aria-label="Escolher criativo no Drive" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dpk-box">
        <div className="dpk-head">
          <div>
            <small>{marca} · Redes Sociais</small>
            <b>{caminho.join(' / ') || 'Escolha a pasta'}</b>
          </div>
          <button type="button" className="dpk-x" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        {!!data?.pastas?.length && (
          <div className="dpk-chips" role="tablist">
            {data.pastas.map((p) => (
              <button key={p.id} type="button" role="tab" aria-selected={data.pasta?.id === p.id || (!data.pasta && p.nome === nav.pasta)}
                onClick={() => { setNav({ folderId: p.id }); setSel([]); }}>{p.nome}</button>
            ))}
          </div>
        )}
        <div className="dpk-tools">
          {caminho.length > 1 && <button type="button" className="dpk-back" onClick={() => setNav({ pasta: caminho[0] })}>← {caminho[0]}</button>}
          <input type="search" placeholder="Buscar pelo nome do arquivo" value={q} onChange={(e) => setQ(e.target.value)} />
          {data?.pasta && <a href={`https://drive.google.com/drive/folders/${data.pasta.id}`} target="_blank" rel="noreferrer">Abrir no Drive ↗</a>}
        </div>

        <div className="dpk-body">
          {loading ? <p className="dpk-msg">Lendo a pasta no Drive…</p>
            : data?.error ? <p className="dpk-msg err">{data.error}</p>
            : !itens.length ? <p className="dpk-msg">{q ? 'Nada com esse nome nesta pasta.' : 'Esta pasta ainda está vazia. Suba o material no Drive e abra de novo.'}</p>
            : (
              <ul className="dpk-grid">
                {itens.map((i) => {
                  const ordem = sel.indexOf(i.id);
                  const usado = usados.get(i.id);
                  return (
                    <li key={i.id} className={`${i.tipo} ${ordem >= 0 ? 'on' : ''}`}>
                      <button type="button" onClick={() => clicar(i)} title={i.nome}>
                        <span className="dpk-thumb">
                          {i.tipo === 'pasta' ? <span className="dpk-ico">📁</span>
                            : i.miniatura ? <img src={i.miniatura} alt="" loading="lazy" referrerPolicy="no-referrer" />
                            : <span className="dpk-ico">{i.tipo === 'video' ? '▶' : '🖼'}</span>}
                          {i.tipo === 'video' && i.duracao != null && <em className="dpk-dur">{Math.floor(i.duracao / 60)}:{String(i.duracao % 60).padStart(2, '0')}</em>}
                          {ordem >= 0 && <em className="dpk-n">{ordem + 1}</em>}
                        </span>
                        <span className="dpk-name">{i.nome}</span>
                        <span className="dpk-meta">
                          {i.pts >= 2 && <i className="sug">combina com a peça</i>}
                          {usado && <i className="used">já usado em {usado}</i>}
                          {!usado && i.alterado && <span>{i.alterado.slice(8, 10)}/{i.alterado.slice(5, 7)}</span>}
                        </span>
                      </button>
                      {multiple && i.tipo === 'pasta' && <button type="button" className="dpk-all" onClick={() => usarPasta(i.id)}>Usar a pasta como lâminas</button>}
                    </li>
                  );
                })}
              </ul>
            )}
        </div>

        {multiple && (
          <div className="dpk-foot">
            <span>{sel.length ? `${sel.length} lâmina${sel.length > 1 ? 's' : ''} na ordem do clique` : 'Clique nas lâminas na ordem em que vão aparecer'}</span>
            <button type="button" className="dpk-ok" disabled={!sel.length} onClick={() => onPick(sel.map(fileUrl))}>Usar {sel.length || ''} lâmina{sel.length === 1 ? '' : 's'}</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
