const PROMPTS = [
  { name: 'Resposta World Smurfs Day (tom brincalhão)', category: 'Copywriting', brand: 'Cardoso', updated: '26 Jun' },
  { name: 'Briefing scratch card Dia das Crianças', category: 'Campanha', brand: 'Tópi', updated: '24 Jun' },
  { name: 'Naming linhas Playmi', category: 'Brand', brand: 'Playmi', updated: '20 Jun' },
];

export default function Ia() {
  return (
    <div className="page">
      <h1 className="page-title">IA</h1>
      <div className="page-sub">Prompts, templates, personas e brand voice centralizados.</div>
      <div className="banner soon">
        <span className="ic">◐</span>
        <span>Biblioteca de exemplo — ganha armazenamento e busca reais na Fase 2.</span>
      </div>
      <div className="grid4">
        <div className="card">
          <h4>📁 Biblioteca de prompts</h4>
          <p>32 prompts salvos — copywriting, SEO, social.</p>
        </div>
        <div className="card">
          <h4>🧩 Templates</h4>
          <p>12 templates de campanha e briefing.</p>
        </div>
        <div className="card">
          <h4>🗣 Brand voice</h4>
          <p>Cardoso, Playmi, Tópi — tom de voz documentado.</p>
        </div>
        <div className="card">
          <h4>👤 Personas</h4>
          <p>6 personas de público mapeadas.</p>
        </div>
      </div>
      <div className="section-head">
        <h2>Prompts recentes</h2>
      </div>
      <table className="simple">
        <thead>
          <tr>
            <th>Prompt</th>
            <th>Categoria</th>
            <th>Marca</th>
            <th>Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {PROMPTS.map((p, i) => (
            <tr key={i}>
              <td>{p.name}</td>
              <td>{p.category}</td>
              <td>{p.brand}</td>
              <td className="mono">{p.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
