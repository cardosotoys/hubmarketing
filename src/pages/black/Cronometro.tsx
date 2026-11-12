import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ic, Sv } from './Icones';
import { fmtData } from './api';

/* Antes da live a vitrine fica fechada: só esta contagem regressiva (pedido e ficha do QR).
   Ao zerar, a página recarrega sozinha e os produtos aparecem. */
export default function Cronometro({ alvo, canal, cadastro = true }: { alvo: string; canal?: string; cadastro?: boolean }) {
  const [agora, setAgora] = useState(Date.now());
  const recarregou = useRef(new Date(alvo).getTime() <= Date.now()); // já passou ao abrir: não recarrega em loop
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, new Date(alvo).getTime() - agora);
  useEffect(() => {
    if (ms === 0 && !recarregou.current) { recarregou.current = true; setTimeout(() => window.location.reload(), 1500); }
  }, [ms]);
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
  const dois = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="cb-card cb-pad cb-narrow cb-res cb-crono">
      <div className="bd" style={{ ['--c' as string]: 'var(--red)' }}><Ic n="calendar" /></div>
      <h2>{ms > 0 ? 'A Cardoso Black começa na live' : 'Abrindo a Cardoso Black…'}</h2>
      <p>Os produtos e as condições aparecem aqui na abertura, em {fmtData(alvo).replace(', ', ', às ')}.</p>
      <div className="cb-cnt cb-cnt4" role="timer" aria-live="off">
        <div><b>{d}</b><small>dias</small></div><div><b>{dois(h)}</b><small>horas</small></div>
        <div><b>{dois(m)}</b><small>min</small></div><div><b>{dois(s)}</b><small>seg</small></div>
      </div>
      {canal && <p className="cb-canal-txt">O link da live e os avisos saem pelo nosso canal da Cardoso Black no WhatsApp.</p>}
      {canal && <a className="cb-wab" href={canal} target="_blank" rel="noreferrer"><Sv.wa />Entrar no nosso canal no WhatsApp</a>}
      {cadastro && <div className="cb-note">Ainda não tem cadastro? <Link to="/black">Faça o pré-cadastro</Link></div>}
    </div>
  );
}
