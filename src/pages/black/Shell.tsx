import { useEffect, type ReactNode } from 'react';
import './black.css';

/* Moldura das páginas públicas: cabeçalho padrão da Cardoso + faixa navy com o título. */
export default function Shell({ sub, clock, children, wide = true }: {
  sub: string;
  clock?: { label: string; value: string } | null;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const t = document.title;
    document.title = 'Cardoso Black · Cardoso Toys';
    // as páginas públicas são sempre claras, independente do tema do Hub
    const prev = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'light');
    return () => { document.title = t; if (prev) document.documentElement.setAttribute('data-theme', prev); };
  }, []);
  return (
    <div className="cb">
      <header className="cb-hd">
        <div className="cb-wrap">
          <img className="wm" src="/black/cardoso-branco.png" alt="Cardoso" />
          <span className="fr">Construímos muito mais que brinquedos.</span>
          <img className="sym" src="/black/simbolo-branco.svg" alt="" />
        </div>
      </header>
      <div className="cb-band">
        <div className="cb-wrap">
          <div>
            <h1>Cardoso <em>Black</em></h1>
            <p>{sub}</p>
          </div>
          {clock && <div className="cb-clock"><small>{clock.label}</small><b>{clock.value}</b></div>}
        </div>
      </div>
      <main className="cb-main"><div className="cb-wrap" style={wide ? undefined : { maxWidth: 640 }}>{children}</div></main>
      <footer className="cb-foot">Cardoso Toys · Cardoso Black 2026 · exclusivo para lojas de e-commerce</footer>
    </div>
  );
}

export function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [msg, onDone]);
  return <div className="cb-toast" role="status">{msg}</div>;
}
