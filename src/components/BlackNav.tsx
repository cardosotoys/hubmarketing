import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { ROLE_LABELS } from '../types/database';
import { Ic } from '../pages/black/Icones';
import { ABAS, abaValida, verComoCliente, type Aba } from '../pages/black/abas';

const dt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

// Painel do módulo Cardoso Black: ocupa o lugar do painel claro, no navy do onboarding aprovado.
export default function BlackNav({ onClose }: { onClose: () => void }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const naBlack = location.pathname.startsWith('/cardoso-black');
  const atual = naBlack ? abaValida(new URLSearchParams(location.search).get('aba')) : null;
  const [analise, setAnalise] = useState(0);
  const [janela, setJanela] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    supabase.from('black_inscritos').select('id', { count: 'exact', head: true }).eq('status', 'analise').neq('origem', 'previa')
      .then(({ count }) => setAnalise(count ?? 0));
    supabase.from('black_config').select('abre_em, fecha_em').eq('id', 1).maybeSingle()
      .then(({ data }) => { if (data) setJanela(`${dt(data.abre_em)} a ${dt(data.fecha_em)}`); });
  }, [location.search]);

  const item = ([k, l, ic]: (typeof ABAS)[number]) => (
    <Link key={k} to={k === 'resumo' ? '/cardoso-black' : `/cardoso-black?aba=${k}`} onClick={onClose}
      className={`bnv-i${atual === (k as Aba) ? ' on' : ''}`} aria-current={atual === k ? 'page' : undefined}>
      <span className="ic"><Ic n={ic} /></span>{l}{k === 'inscritos' && analise > 0 && <em>{analise}</em>}
    </Link>
  );

  return (
    <div className="navpanel bnv">
      <button className="navpanel-x" onClick={onClose} aria-label="Fechar">✕</button>
      <div className="bnv-lo"><img src="/black/simbolo-branco.svg" alt="" />Cardoso <span>Black</span></div>
      <span className="bnv-gp">Cardoso Black</span>
      {ABAS.filter((x) => x[3] === 1).map(item)}
      <span className="bnv-gp">Operação</span>
      {ABAS.filter((x) => x[3] === 2).map(item)}
      <div className="bnv-lk">
        <button type="button" onClick={async () => setAviso(await verComoCliente())}>Ver como cliente</button>
        {aviso && <small>{aviso}</small>}
        <a href="/black" target="_blank" rel="noreferrer">Pré-cadastro ↗</a>
        <a href="/black/pedido" target="_blank" rel="noreferrer">Página de pedido ↗</a>
      </div>
      {janela && <div className="bnv-jn"><b>Pedidos</b>{janela}</div>}
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
