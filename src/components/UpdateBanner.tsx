import { useEffect, useRef, useState } from 'react';

// Detecta quando um novo deploy subiu (aba aberta há muito tempo continua rodando o JS antigo,
// já que a SPA não recarrega sozinha). Compara o nome do bundle principal do index.html.
async function currentBundle(): Promise<string | null> {
  try {
    // query única burla cache do navegador e do service worker; no-store por garantia
    const res = await fetch(`/?__vcheck=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/\/assets\/[A-Za-z0-9_.-]+\.js/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

export default function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  const bootRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      bootRef.current = await currentBundle();
    })();

    async function check() {
      if (cancelled || available || !bootRef.current) return;
      const now = await currentBundle();
      if (!cancelled && now && bootRef.current && now !== bootRef.current) setAvailable(true);
    }

    const iv = setInterval(check, 5 * 60 * 1000); // a cada 5 min
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [available]);

  if (!available) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        padding: '10px 14px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        maxWidth: '92vw',
      }}
    >
      <span style={{ fontSize: 13 }}>🔄 Nova versão disponível.</span>
      <button className="btn sm" onClick={() => window.location.reload()}>
        Atualizar
      </button>
    </div>
  );
}
