import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import StatusTag from '../components/StatusTag';
import Avatar from '../components/Avatar';
import { ROLE_LABELS, type Project } from '../types/database';

export default function Perfil() {
  const { profile, refreshProfile, setTheme } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('project_members')
      .select('project:projects(*)')
      .eq('user_id', profile.id)
      .then(({ data }) => {
        setProjects(((data as { project: Project | null }[] | null) ?? []).flatMap((row) => (row.project ? [row.project] : [])));
        setLoading(false);
      });
  }, [profile]);

  if (!profile) return null;

  function startEdit() {
    setName(profile!.name);
    setJobTitle(profile!.job_title);
    setPhone(profile!.phone);
    setBio(profile!.bio);
    setEditing(true);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ name, job_title: jobTitle, phone, bio })
      .eq('id', profile!.id);
    setSaving(false);
    setEditing(false);
    refreshProfile();
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    setUploadError(null);
    const path = `${profile!.id}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file);
    if (uploadErr) {
      setUploading(false);
      setUploadError(uploadErr.message);
      return;
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile!.id);
    setUploading(false);
    refreshProfile();
  }

  return (
    <div className="page">
      <h1 className="page-title">Perfil</h1>
      <div className="info-grid">
        <div>
          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <label style={{ cursor: 'pointer', position: 'relative' }} title="Trocar foto">
                <Avatar profile={profile} size="lg" />
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAvatar(file);
                  }}
                />
              </label>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15 }}>{profile.name}</div>
                <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                  {ROLE_LABELS[profile.role]}
                  {profile.job_title ? ` · ${profile.job_title}` : ''}
                </div>
                {profile.bio && <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 6 }}>{profile.bio}</div>}
              </div>
              {!editing && (
                <button className="btn ghost sm" onClick={startEdit}>
                  Editar
                </button>
              )}
            </div>
            {uploading && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>Enviando foto…</div>}
            {uploadError && (
              <div className="banner error" style={{ marginTop: 8 }}>
                <span className="ic">✕</span>
                <span>{uploadError}</span>
              </div>
            )}

            {editing && (
              <form onSubmit={saveEdit} style={{ marginTop: 14 }}>
                <div className="form-field">
                  <label htmlFor="pf-name">Nome</label>
                  <input id="pf-name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="form-field">
                  <label htmlFor="pf-job">Cargo</label>
                  <input id="pf-job" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                </div>
                <div className="form-field">
                  <label htmlFor="pf-phone">Telefone</label>
                  <input id="pf-phone" placeholder="+55 11 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="form-field">
                  <label htmlFor="pf-bio">Sobre você</label>
                  <textarea id="pf-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn ghost" onClick={() => setEditing(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn" disabled={saving}>
                    {saving ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </form>
            )}

            {!editing && profile.phone && (
              <div className="field-row" style={{ marginTop: 10 }}>
                <span className="k">Telefone</span>
                <span>{profile.phone}</span>
              </div>
            )}
          </div>
          <div className="panel">
            <h4>Projetos em que participa</h4>
            {loading ? (
              <div className="page-sub">Carregando…</div>
            ) : projects.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                Você ainda não foi adicionado a nenhum projeto.
              </div>
            ) : (
              projects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projetos/${p.id}`}
                  className="field-row"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  <span className="k">{p.name}</span>
                  <StatusTag status={p.status} />
                </Link>
              ))
            )}
          </div>
        </div>
        <div className="panel">
          <h4>Preferências</h4>
          <div className="field-row">
            <span className="k">Tema</span>
            <span
              style={{ cursor: 'pointer', color: 'var(--violet)' }}
              onClick={() => setTheme(profile.theme === 'light' ? 'dark' : 'light')}
            >
              {profile.theme === 'light' ? 'Claro' : 'Escuro'} · trocar
            </span>
          </div>
          <div className="field-row">
            <span className="k">Idioma</span>
            <span>Português (BR)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
