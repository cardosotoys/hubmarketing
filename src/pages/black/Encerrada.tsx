import { Link } from 'react-router-dom';
import { Ic } from './Icones';
import { fmtData } from './api';

/* Depois do fim da live (fecha_em) o link de pedido e as fichas fecham: só esta tela. */
export default function Encerrada({ fim, logado }: { fim: string; logado?: boolean }) {
  return (
    <div className="cb-card cb-pad cb-narrow cb-res cb-crono">
      <div className="bd" style={{ ['--c' as string]: 'var(--navy)' }}><Ic n="check" /></div>
      <h2>A Cardoso Black foi encerrada</h2>
      <p>Os pedidos foram aceitos até {fmtData(fim).replace(', ', ' às ')}. Este link não recebe mais pedidos.</p>
      <p>Quem enviou pedido recebe o contato do representante para a confirmação. Obrigado pela participação!</p>
      {logado && <Link className="cb-btn" to="/black/pedido?v=pedidos" style={{ justifyContent: 'center' }}>Ver meus pedidos</Link>}
    </div>
  );
}
