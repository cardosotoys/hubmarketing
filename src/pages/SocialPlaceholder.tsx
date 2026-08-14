import EmptyState from '../components/EmptyState';

// Página neutra: o módulo de Social está sendo repensado. O pipeline anterior (SocialContent) e o
// board antigo (RedesSociais) seguem no repositório, apenas fora da rota, para retomada futura.
export default function SocialPlaceholder() {
  return (
    <div className="page">
      <h1 className="page-title">Redes Sociais</h1>
      <div className="page-sub">Módulo em repensamento — em breve um novo fluxo.</div>
      <EmptyState icon="🧩" title="Em definição" hint="Estamos redesenhando como o Social vai funcionar no hub. Nada foi perdido; o material anterior está guardado para retomada." />
    </div>
  );
}
