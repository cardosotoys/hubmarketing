import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Shell from './Shell';

/* /black/senha?t=<token> — nova senha pelo link que a equipe gera no Hub (Inscritos → Gerar link de senha). */
export default function BlackSenha() {
  const [params] = useSearchParams();
  const t = params.get('t') ?? '';
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [indo, setIndo] = useState(false);
  async function salvar(e: FormEvent) {
    e.preventDefault(); setErro('');
    if (s1.length < 6) { setErro('Use pelo menos 6 caracteres.'); return; }
    if (s1 !== s2) { setErro('As senhas não conferem.'); return; }
    setIndo(true);
    const { data, error } = await supabase.rpc('black_senha_definir', { p_reset: t, p_senha: s1 });
    setIndo(false);
    const r = data as { ok?: boolean; erro?: string } | null;
    if (error || !r) { setErro('Não consegui salvar agora. Tente de novo.'); return; }
    if (r.erro === 'link') { setErro('Este link expirou ou já foi usado. Peça um novo ao seu representante.'); return; }
    if (r.erro) { setErro('Use pelo menos 6 caracteres.'); return; }
    setOk(true);
  }
  return (
    <Shell sub="Nova senha de acesso" wide={false}>
      {ok ? (
        <div className="cb-card cb-pad cb-res">
          <div className="bd" style={{ ['--c' as string]: 'var(--teal)' }}>✓</div>
          <h2>Senha alterada</h2>
          <p>Agora é só entrar com o CNPJ e a nova senha.</p>
          <Link className="cb-btn" to="/black/pedido">Entrar</Link>
        </div>
      ) : (
        <form className="cb-card cb-pad cb-form" onSubmit={salvar}>
          <h2 style={{ fontSize: 22 }}>Crie uma nova senha</h2>
          {!t && <div className="cb-alert err">Link incompleto. Peça um novo ao seu representante.</div>}
          <div className="cb-field"><label>Nova senha</label><input type="password" autoComplete="new-password" value={s1} onChange={(e) => setS1(e.target.value)} /></div>
          <div className="cb-field"><label>Repita a senha</label><input type="password" autoComplete="new-password" value={s2} onChange={(e) => setS2(e.target.value)} /></div>
          {erro && <div className="cb-alert err">{erro}</div>}
          <button className="cb-btn full" type="submit" disabled={!t || indo}>{indo ? 'Salvando…' : 'Salvar nova senha'}</button>
        </form>
      )}
    </Shell>
  );
}
