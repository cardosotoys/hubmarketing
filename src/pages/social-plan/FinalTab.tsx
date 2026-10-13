import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import FinalBoard from './FinalBoard';
import { useFinalData } from './useFinalData';
import { brShort, todayISO, ymOf } from './shared';

type Link = { token: string; label: string; active: boolean; created_at: string; last_seen_at: string | null; views: number };

/* Aba Visão final dentro do Hub: os links sem login (criar, copiar, desativar) e a prévia do que eles mostram. */
export default function FinalTab({ canManage }: { canManage: boolean }) {
  const [links, setLinks] = useState<Link[]>([]);
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState('');
  const [month, setMonth] = useState(() => ymOf(todayISO()));
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg((c) => (c === m ? '' : c)), 3000); };
  const load = useCallback(async () => {
    const { data } = await supabase.from('final_view_links').select('*').order('created_at', { ascending: false });
    setLinks((data as Link[]) ?? []);
  }, []);
  useEffect(() => { if (canManage) load(); }, [canManage, load]);
  const active = links.find((l) => l.active);
  const { data, state } = useFinalData(active?.token ?? '', month);
  const url = (t: string) => `${window.location.origin}/visao-final?t=${t}`;

  const create = async () => {
    const { error } = await supabase.from('final_view_links').insert({ label: label.trim() || 'Link da visão final' });
    if (error) { flash(error.message); return; }
    setLabel(''); flash('Link criado.'); await load();
  };
  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(url(t)); flash('Link copiado. É só colar no WhatsApp ou no e-mail.'); } catch { flash(url(t)); }
  };
  const setActive = async (t: string, on: boolean) => {
    const { error } = await supabase.from('final_view_links').update({ active: on }).eq('token', t);
    if (error) flash(error.message); else { flash(on ? 'Link reativado.' : 'Link desativado: quem tiver ele não abre mais.'); await load(); }
  };

  if (!canManage) {
    return <div className="sp-empty"><b>Os links da visão final ficam com o gerente</b>Só o aprovador ou a diretoria criam e enviam o link sem login. Para ver o cenário interno, use a Visão 2 da Área comercial e a Prévia do feed.</div>;
  }
  return (
    <>
      <section className="sp-box">
        <h3>Links sem login <small>quem abre vê só o que está pronto: redes, calendário e área comercial</small></h3>
        <div className="sp-linkfor" style={{ marginBottom: 8 }}>
          <input id="fv-label" placeholder="Para quem é o link? Ex.: Diretoria, Representantes" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="sp-ebtn prim" onClick={create}>Criar link</button>
        </div>
        {links.length ? links.map((l) => (
          <div className="sp-crow" key={l.token}>
            <div className="sp-cmain static">
              <b>{l.label || 'Link da visão final'}</b>
              <span>Criado em {brShort(l.created_at.slice(0, 10))} · {l.views} visita{l.views === 1 ? '' : 's'}{l.last_seen_at ? ` · última em ${brShort(l.last_seen_at.slice(0, 10))}` : ''}</span>
            </div>
            <span className={`sp-state t-${l.active ? 'ok' : ''}`}>{l.active ? 'Ativo' : 'Desativado'}</span>
            <div className="sp-cacts">
              {l.active && <button className="sp-ebtn" onClick={() => copy(l.token)}>Copiar link</button>}
              {l.active && <a className="sp-ebtn" href={url(l.token)} target="_blank" rel="noreferrer">Abrir</a>}
              <button className="sp-ebtn" onClick={() => setActive(l.token, !l.active)}>{l.active ? 'Desativar' : 'Reativar'}</button>
            </div>
          </div>
        )) : <p className="sp-calhint">Nenhum link ainda. Crie o primeiro acima.</p>}
        {msg && <div className="sp-saved">{msg}</div>}
      </section>
      <h4 className="sp-sech">Prévia: o que o link mostra</h4>
      {!active ? <p className="sp-calhint">Crie um link para ver a prévia.</p>
        : state === 'ok' && data ? <FinalBoard data={data} month={month} onMonth={setMonth} />
        : <p className="sp-calhint">{state === 'loading' ? 'Carregando…' : 'Não foi possível ler a visão final. A migration 0112 já rodou?'}</p>}
    </>
  );
}
