import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { ROLE_LABELS } from '../types/database';
import { Ic } from '../pages/black/Icones';
import { ABAS, abaValida, verComoCliente, type Aba } from '../pages/black/abas';
import { ABAS_ARQ, EDICOES, edicaoDe, ler, urlAba } from '../pages/black/edicoes';

const dt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

// Painel do módulo Cardoso Black: ocupa o lugar do painel claro, no navy do onboarding aprovado.
export default function BlackNav({ onClose }: { onClose: () => void }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const naBlack = location.pathname.startsWith('/cardoso-black');
  const sp = new URLSearchParams(location.search);
  const ed = edicaoDe(naBlack ? sp.get('ed') : null);
  const atual = naBlack ? abaValida(sp.get('aba')) : null;
  const abasEd = ed.arq ? ABAS.filter((a) => ABAS_ARQ.includes(a[0])) : ABAS;
  const [analise, setAnalise] = useState(0);
  const [janela, setJanela] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    supabase.from('black_inscritos').select('id', { count: 'exact', head: true }).eq('status', 'analise').neq('origem', 'previa')
      .then(({ count }) => setAnalise(count ?? 0));
    ler('config', 'abre_em, fecha_em', ed.arq).eq('id', 1).maybeSingle()
      .then(({ data }) => { const d = data as { abre_em: string; fecha_em: string } | null; setJanela(d ? `${dt(d.abre_em)} a ${dt(d.fecha_em)}` : ''); });
  }, [location.search, ed.arq]);

  const item = ([k, l, ic]: (typeof ABAS)[number]) => (
    <Link key={k} to={urlAba(k, ed)} onClick={onClose}
      className={`bnv-i${atual === (k as Aba) ? ' on' : ''}`} aria-current={atual === k ? 'page' : undefined}>
      <span className="ic"><Ic n={ic} /></span>{l}{k === 'inscritos' && analise > 0 && !ed.arq && <em>{analise}</em>}
    </Link>
  );

  return (
    <div className="navpanel bnv">
      <button className="navpanel-x" onClick={onClose} aria-label="Fechar">✕</button>
      <div className="bnv-lo"><img src="/black/simbolo-branco.svg" alt="" />Cardoso <span>Black</span></div>
      <div className="bnv-ed" role="tablist" aria-label="Edição">
        {EDICOES.map((e) => <Link key={e.id} role="tab" aria-selected={e.id === ed.id} to={urlAba(atual && (!e.arq || ABAS_ARQ.includes(atual)) ? atual : 'resumo', e)} onClick={onClose} className={e.id === ed.id ? 'on' : ''}>{e.curto}</Link>)}
      </div>
      <span className="bnv-gp">Cardoso Black{ed.arq ? ` · ${ed.curto}` : ''}</span>
      {abasEd.filter((x) => x[3] === 1).map(item)}
      {abasEd.some((x) => x[3] === 2) && <span className="bnv-gp">Operação</span>}
      {abasEd.filter((x) => x[3] === 2).map(item)}
      <div className="bnv-lk">
        <button type="button" onClick={async () => setAviso(await verComoCliente())}>Ver como cliente</button>
        {aviso && <small>{aviso}</small>}
        <a href="/black" target="_blank" rel="noreferrer">Pré-cadastro ↗</a>
        <a href="/black/pedido" target="_blank" rel="noreferrer">Página de pedido ↗</a>
      </div>
      {janela && <div className="bnv-jn"><b>Pedidos{ed.arq ? ` · ${ed.curto}` : ''}</b>{janela}</div>}
      <div className="navpanel-foot bnv-foot">
        <Avatar profile={profile} />
        <div className="meta">
          <div className="name">{profile?.name ?? '…'}</div>
          <div className="role">{ROLE_LABELS[profile?.role ?? 'equipe']}</div>
        </div>
        <button className="logout-btn" onClick={signOut}>Sair</button>
      </div>
    </div>
  );
}
