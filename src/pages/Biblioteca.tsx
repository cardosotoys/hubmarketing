import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import { normalizeUrl } from '../lib/url';
import Loading from '../components/Loading';
import type { DriveKey, LibraryFolder, LibraryLink } from '../types/database';

const DRIVE_INFO: Record<DriveKey, { label: string; color: string; formula: string; example: string }> = {
  cardoso: {
    label: 'Cardoso (matriz)',
    color: 'var(--cardoso)',
    formula: 'CARDOSO_[TIPO-DE-ATIVO]_[VARIANTE]_[CONTEXTO]_[REFERÊNCIA] - [Nome legível]_[SEQUENCIAL]',
    example: 'CARDOSO_RELATORIO-KPI - Julho grupo',
  },
  playmi: {
    label: 'Playmi',
    color: 'var(--playmi)',
    formula: 'PLAYMI_[TIPO-DE-ATIVO]_[VARIANTE]_[CONTEXTO]_[REFERÊNCIA] - [Nome legível]_[SEQUENCIAL]',
    example: 'PLAYMI_IMAGEM-IA_1x1_PRODUTO_2018 - Acqua Bubble_01',
  },
  topi: {
    label: 'Tópi',
    color: 'var(--topi)',
    formula: 'TOPI_[TIPO-DE-ATIVO]_[VARIANTE]_[CONTEXTO]_[REFERÊNCIA] - [Nome legível]_[SEQUENCIAL]',
    example: 'TOPI_IMAGEM-IA_1x1_PRODUTO_3057 - Bombeirinho_01',
  },
};

function inputStyle(dashed = false) {
  return {
    background: 'var(--surface-2)',
    border: `1px ${dashed ? 'dashed' : 'solid'} var(--border)`,
    borderRadius: 6,
    color: 'var(--text)',
    padding: '5px 8px',
    fontSize: 12,
    width: '100%',
  };
}

function FolderRow({
  folder,
  allFolders,
  depth,
  selectedId,
  canEdit,
  onSelect,
  onCreateChild,
  onRename,
  onDelete,
}: {
  folder: LibraryFolder;
  allFolders: LibraryFolder[];
  depth: number;
  selectedId: string | null;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onCreateChild: (parentId: string, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [draft, setDraft] = useState(folder.name);
  const [childDraft, setChildDraft] = useState('');

  const children = allFolders.filter((f) => f.parent_id === folder.id).sort((a, b) => a.position - b.position);
  const isSelected = selectedId === folder.id;

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== folder.name) onRename(folder.id, trimmed);
    else setDraft(folder.name);
    setRenaming(false);
  }

  function handleRenameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') {
      setDraft(folder.name);
      setRenaming(false);
    }
  }

  function handleChildKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && childDraft.trim()) {
      onCreateChild(folder.id, childDraft.trim());
      setChildDraft('');
      setAddingChild(false);
    }
    if (e.key === 'Escape') setAddingChild(false);
  }

  return (
    <div>
      <div
        className="folder-row"
        style={{ paddingLeft: 10 + depth * 20, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span className="ic">{children.length ? '▾' : '▸'}</span>
        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKey}
            style={{ ...inputStyle(), flex: 1 }}
          />
        ) : (
          <span
            onClick={() => onSelect(folder.id)}
            style={{
              flex: 1,
              cursor: 'pointer',
              color: isSelected ? 'var(--text)' : undefined,
              fontWeight: isSelected ? 600 : undefined,
            }}
          >
            {folder.name}
            {folder.note && (
              <span style={{ color: 'var(--text-faint)', marginLeft: 8, fontSize: 11 }}>— {folder.note}</span>
            )}
          </span>
        )}
        {canEdit && (
          <>
            <span className="ic" style={{ cursor: 'pointer' }} title="Nova subpasta" onClick={() => setAddingChild((v) => !v)}>
              +
            </span>
            <span className="ic" style={{ cursor: 'pointer' }} title="Renomear" onClick={() => setRenaming(true)}>
              ✎
            </span>
            <span
              className="ic"
              style={{ cursor: 'pointer', color: 'var(--red)' }}
              title="Excluir"
              onClick={() => {
                if (window.confirm(`Excluir "${folder.name}" e tudo dentro dela?`)) onDelete(folder.id);
              }}
            >
              ✕
            </span>
          </>
        )}
      </div>
      {addingChild && (
        <div style={{ paddingLeft: 10 + (depth + 1) * 20, marginBottom: 6, paddingTop: 2 }}>
          <input
            autoFocus
            placeholder="Nome da nova subpasta…"
            value={childDraft}
            onChange={(e) => setChildDraft(e.target.value)}
            onKeyDown={handleChildKey}
            onBlur={() => setAddingChild(false)}
            style={inputStyle(true)}
          />
        </div>
      )}
      {children.map((c) => (
        <FolderRow
          key={c.id}
          folder={c}
          allFolders={allFolders}
          depth={depth + 1}
          selectedId={selectedId}
          canEdit={canEdit}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default function Biblioteca() {
  const { profile } = useAuth();
  const [drive, setDrive] = useState<DriveKey>('cardoso');
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [links, setLinks] = useState<LibraryLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newRootName, setNewRootName] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const loadFolders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('library_folders').select('*').eq('drive', drive).order('position');
    setFolders((data as LibraryFolder[]) ?? []);
    setLoading(false);
  }, [drive]);

  useEffect(() => {
    loadFolders();
    setSelectedId(null);
  }, [loadFolders]);

  useEffect(() => {
    if (!selectedId) {
      setLinks([]);
      return;
    }
    supabase
      .from('library_links')
      .select('*')
      .eq('folder_id', selectedId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setLinks((data as LibraryLink[]) ?? []));
  }, [selectedId]);

  async function createFolder(parentId: string | null, name: string) {
    if (!profile) return;
    const siblingCount = folders.filter((f) => f.parent_id === parentId).length;
    await supabase.from('library_folders').insert({
      drive,
      parent_id: parentId,
      name,
      position: siblingCount,
      created_by: profile.id,
    });
    await logActivity({ actorId: profile.id, actionText: 'Pasta criada na Biblioteca', detail: name });
    loadFolders();
  }

  async function renameFolder(id: string, name: string) {
    if (!profile) return;
    await supabase.from('library_folders').update({ name }).eq('id', id);
    await logActivity({ actorId: profile.id, actionText: 'Pasta renomeada na Biblioteca', detail: name });
    loadFolders();
  }

  async function deleteFolder(id: string) {
    if (!profile) return;
    await supabase.from('library_folders').delete().eq('id', id);
    await logActivity({ actorId: profile.id, actionText: 'Pasta excluída na Biblioteca' });
    if (selectedId === id) setSelectedId(null);
    loadFolders();
  }

  async function addLink(e: FormEvent) {
    e.preventDefault();
    if (!profile || !selectedId || !linkName.trim() || !linkUrl.trim()) return;
    await supabase.from('library_links').insert({
      folder_id: selectedId,
      name: linkName.trim(),
      url: normalizeUrl(linkUrl),
      added_by: profile.id,
    });
    await logActivity({ actorId: profile.id, actionText: 'Link anexado na Biblioteca', detail: linkName.trim() });
    setLinkName('');
    setLinkUrl('');
    const { data } = await supabase
      .from('library_links')
      .select('*')
      .eq('folder_id', selectedId)
      .order('created_at', { ascending: false });
    setLinks((data as LibraryLink[]) ?? []);
  }

  async function deleteLink(id: string) {
    await supabase.from('library_links').delete().eq('id', id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  const info = DRIVE_INFO[drive];
  const roots = folders.filter((f) => f.parent_id === null).sort((a, b) => a.position - b.position);
  const selectedFolder = folders.find((f) => f.id === selectedId) ?? null;
  const canEdit = profile?.department !== 'assistente';

  return (
    <div className="page">
      <h1 className="page-title">Biblioteca</h1>
      <div className="page-sub">
        Espelho editável da estrutura dos 3 Drives do grupo — Cardoso (matriz), Playmi e Tópi. Crie, renomeie e
        exclua pastas, e anexe links de pasta/arquivo do Drive a qualquer uma delas.
      </div>

      <div className="banner soon">
        <span className="ic">⛓</span>
        <span>
          <b>Roadmap:</b> esta árvore já é real e editável no Hub, mas ainda não está ligada de verdade ao Google
          Drive. O próximo passo é a API do Drive (+ conta de serviço no Google Workspace da Cardoso) para que
          colocar um arquivo numa pasta lá gere o link espelhado aqui sozinho.
        </span>
      </div>

      <div className="brand-tabs">
        {(Object.keys(DRIVE_INFO) as DriveKey[]).map((key) => (
          <div key={key} className={`brand-tab${drive === key ? ' active' : ''}`} onClick={() => setDrive(key)}>
            <span className="sw" style={{ background: DRIVE_INFO[key].color }} />
            {DRIVE_INFO[key].label}
          </div>
        ))}
      </div>

      <div className="info-grid" style={{ gridTemplateColumns: '1fr 300px' }}>
        <div className="panel">
          <h4>Árvore do Drive {info.label}</h4>
          {loading ? (
            <Loading />
          ) : (
            <div className="folder-tree">
              {roots.map((f) => (
                <FolderRow
                  key={f.id}
                  folder={f}
                  allFolders={folders}
                  depth={0}
                  selectedId={selectedId}
                  canEdit={canEdit}
                  onSelect={setSelectedId}
                  onCreateChild={createFolder}
                  onRename={renameFolder}
                  onDelete={deleteFolder}
                />
              ))}
              {canEdit && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newRootName.trim()) return;
                    createFolder(null, newRootName.trim());
                    setNewRootName('');
                  }}
                  style={{ marginTop: 8 }}
                >
                  <input
                    placeholder="+ nova pasta de topo…"
                    value={newRootName}
                    onChange={(e) => setNewRootName(e.target.value)}
                    style={inputStyle(true)}
                  />
                </form>
              )}
            </div>
          )}
        </div>
        <div>
          <div className="panel">
            <h4>{selectedFolder ? selectedFolder.name : 'Selecione uma pasta'}</h4>
            {selectedFolder ? (
              <>
                {links.map((l) => (
                  <div className="file-row" key={l.id}>
                    <div className="ext">↗</div>
                    <div style={{ flex: 1, fontSize: 12 }}>{l.name}</div>
                    <a href={l.url} target="_blank" rel="noreferrer" style={{ color: 'var(--violet)', fontSize: 11.5 }}>
                      abrir ↗
                    </a>
                    {canEdit && (
                      <span
                        style={{ marginLeft: 8, cursor: 'pointer', color: 'var(--text-faint)' }}
                        onClick={() => deleteLink(l.id)}
                      >
                        ✕
                      </span>
                    )}
                  </div>
                ))}
                {links.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>
                    Nenhum link anexado ainda.
                  </div>
                )}
                {canEdit && (
                  <form onSubmit={addLink} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    <input placeholder="Nome do arquivo/pasta" value={linkName} onChange={(e) => setLinkName(e.target.value)} style={inputStyle()} />
                    <input placeholder="Link do Drive" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} style={inputStyle()} />
                    <button className="btn sm" type="submit">
                      Anexar link
                    </button>
                  </form>
                )}
              </>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
                Clique numa pasta à esquerda para ver ou anexar links do Drive.
              </p>
            )}
          </div>
          <div className="panel">
            <h4>Nomenclatura</h4>
            <div
              className="mono"
              style={{ fontSize: 10.5, background: 'var(--surface-2)', padding: 8, borderRadius: 6, marginBottom: 10, wordBreak: 'break-word' }}
            >
              {info.formula}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: 0 }}>Exemplo real:</p>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--violet)' }}>
              {info.example}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
