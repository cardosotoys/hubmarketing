const LICENSEES: [string, string, string][] = [
  ['Os Smurfs', 'Schtroumpfs / IMPS', 'var(--blue)'],
  ['Galinha Pintadinha', 'Pintadinha Ltda', 'var(--yellow)'],
  ['Marvel Spidey', 'Disney/Marvel', 'var(--red)'],
  ['Disney (Ariel, Mickey, Minnie, Buzz, Woody)', 'Disney', 'var(--violet)'],
  ['Bluey', 'BBC Studios', 'var(--accent)'],
  ['O Show da Luna', 'Mundo Luna', 'var(--green)'],
  ['Pocoyo', 'Zinkia', 'var(--playmi)'],
];

export default function Brand() {
  return (
    <div className="page">
      <h1 className="page-title">Brand</h1>
      <div className="page-sub">
        Brandbooks oficiais e manuais de marca — referência de linguagem, tom de voz e identidade visual para
        qualquer pessoa nova no time.
      </div>

      <div className="section-head">
        <h2>Marcas Cardoso</h2>
      </div>
      <div className="grid3">
        <div className="card" style={{ borderTop: '3px solid var(--cardoso)' }}>
          <h4>Cardoso</h4>
          <p>Marca-mãe institucional. Logo, paleta vermelha e aplicações corporativas.</p>
          <span className="pill" style={{ marginTop: 8, display: 'inline-block' }}>
            Brandbook
          </span>
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--playmi)' }}>
          <h4>Playmi</h4>
          <p>
            Submarca de valor agregado (classes B-C). Arquétipos Herói + Inocente, linhas Play&amp;Drive, Ride,
            Learn, Imagine, Collect e Molto.
          </p>
          <span className="pill" style={{ marginTop: 8, display: 'inline-block' }}>
            Brandbook · 2025
          </span>
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--topi)' }}>
          <h4>Tópi</h4>
          <p>Submarca de preço acessível e giro (classes C-D). Arquétipos Inocente + Cara Comum, tom de voz leve e popular.</p>
          <span className="pill" style={{ marginTop: 8, display: 'inline-block' }}>
            Brandbook · 2025
          </span>
        </div>
      </div>

      <div className="section-head">
        <h2>Linhas Playmi</h2>
      </div>
      <div className="grid4">
        <div className="card">
          <h4>Play&amp;Drive</h4>
          <p>Liberdade sobre rodas.</p>
        </div>
        <div className="card">
          <h4>Play&amp;Ride</h4>
          <p>Primeiro veículo, equilíbrio.</p>
        </div>
        <div className="card">
          <h4>Play&amp;Learn</h4>
          <p>Primeiras descobertas sensoriais.</p>
        </div>
        <div className="card">
          <h4>Play&amp;Imagine</h4>
          <p>Faz de conta e histórias.</p>
        </div>
        <div className="card">
          <h4>Play&amp;Collect</h4>
          <p>Personagens licenciados.</p>
        </div>
        <div className="card">
          <h4>Play&amp;Molto</h4>
          <p>Parceria Moltó (Espanha).</p>
        </div>
      </div>

      <div className="section-head">
        <h2>Playmi — identidade de marca</h2>
        <span className="pill">Brand Guidelines · 2025</span>
      </div>
      <div className="info-grid">
        <div>
          <div className="panel">
            <h4>Sobre a marca</h4>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              Playmi é a submarca de brinquedos da Cardoso de valor agregado, para as classes B-C. Arquitetura de
              marca: Cardoso é a marca-mãe institucional, e Playmi é a submarca voltada a um público que busca
              mais qualidade e diferenciação.
            </p>
          </div>
          <div className="panel">
            <h4>Arquétipos</h4>
            <div className="field-row">
              <span className="k">Posicionamento no mercado</span>
              <span style={{ textAlign: 'right' }}>Herói — liderança, ambição, inovação</span>
            </div>
            <div className="field-row">
              <span className="k">Com o consumidor</span>
              <span style={{ textAlign: 'right' }}>Inocente — acessível e confiável com pais e crianças</span>
            </div>
          </div>
          <div className="panel">
            <h4>Tom de voz</h4>
            <div className="field-row">
              <span className="k">Próxima e acessível</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>simples e acolhedora, nunca complexa ou distante</span>
            </div>
            <div className="field-row">
              <span className="k">Entusiástica e energética</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>animada e motivadora, nunca apática ou fria</span>
            </div>
            <div className="field-row">
              <span className="k">Confiável e inspiradora</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>segura e educadora, nunca genérica ou indiferente</span>
            </div>
            <div className="field-row">
              <span className="k">Respeitosa e inclusiva</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>acolhedora e familiar, nunca invasiva ou excludente</span>
            </div>
          </div>
          <div className="panel">
            <h4>Proposta de valor</h4>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6, margin: '0 0 10px 0' }}>
              <b>Propósito:</b> despertar o potencial único de aprendizado de cada criança através do ato de
              brincar, criando descobertas significativas e memórias afetivas que durarão para sempre.
            </p>
            <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: 0 }}>
              Valores: estímulo à imaginação · desenvolvimento da criança · segurança e confiabilidade · conexões
              genuínas.
            </p>
          </div>
          <div className="panel">
            <h4>Tagline &amp; manifesto</h4>
            <p style={{ fontFamily: 'Space Grotesk', fontSize: 15, margin: '0 0 10px 0' }}>“Brincar é crescer, juntos!”</p>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 10px 0' }}>
              Slogans: “O primeiro passo é brincar.” / “Descobrir, criar e crescer juntos.”
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6, fontStyle: 'italic' }}>
              "Acreditamos que o brincar é criar memórias, através da descoberta do 'eu' e da relação com o
              ambiente ao seu redor... Brincar faz parte de crescer. E estamos aqui para cada passo dessa
              jornada."
            </p>
          </div>
        </div>
        <div>
          <div className="panel">
            <h4>Tipografia</h4>
            <div className="field-row">
              <span className="k">Principal</span>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}>Goldray</span>
            </div>
            <div className="field-row">
              <span className="k">Complementar</span>
              <span>Urbanist</span>
            </div>
            <div className="field-row">
              <span className="k">Destaque secundário</span>
              <span>Unspoken</span>
            </div>
          </div>
          <div className="panel">
            <h4>Cores da marca</h4>
            <div className="field-row">
              <span className="k" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--playmi)', display: 'inline-block' }} />
                Azul Playmi
              </span>
              <span className="mono">#00B3C6</span>
            </div>
            <div className="field-row">
              <span className="k">Off Playmi</span>
              <span style={{ color: 'var(--text-faint)' }}>tom neutro complementar</span>
            </div>
          </div>
          <div className="panel">
            <h4>Cores por linha</h4>
            {[
              ['Play&Drive · Azul', '#2163C4'],
              ['Play&Imagine · Rosa', '#ED6199'],
              ['Play&Ride · Verde', '#70BD8F'],
              ['Play&Learn · Lilás', '#BF91D1'],
              ['Play&Collect · Laranja', '#E87821'],
            ].map(([name, hex]) => (
              <div className="field-row" key={hex}>
                <span className="k" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: hex, display: 'inline-block' }} />
                  {name}
                </span>
                <span className="mono">{hex}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section-head">
        <h2>Categorias Tópi</h2>
      </div>
      <div className="grid4">
        <div className="card">
          <h4>Ar Livre</h4>
          <p>Brincadeiras para gastar energia lá fora.</p>
        </div>
        <div className="card">
          <h4>Faz de Conta</h4>
          <p>Imaginação e histórias do dia a dia.</p>
        </div>
        <div className="card">
          <h4>Roda Livre</h4>
          <p>Veículos e brinquedos de rodas.</p>
        </div>
        <div className="card">
          <h4>Primeira Infância</h4>
          <p>Primeiras descobertas, a partir de 18 meses.</p>
        </div>
        <div className="card">
          <h4>Jogos</h4>
          <p>Diversão em grupo e raciocínio.</p>
        </div>
      </div>

      <div className="section-head">
        <h2>Tópi — identidade de marca</h2>
        <span className="pill">Brand Guidelines · 2025</span>
      </div>
      <div className="info-grid">
        <div>
          <div className="panel">
            <h4>Sobre a marca</h4>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              Tópi é a submarca de brinquedos da Cardoso Ind. de preço acessível e giro rápido, para crianças a
              partir de 18 meses — brinquedos que estimulam coordenação motora, criatividade, raciocínio lógico e
              trabalho em equipe. Público: classes C e D.
            </p>
          </div>
          <div className="panel">
            <h4>Arquétipos</h4>
            <div className="field-row">
              <span className="k">Com o consumidor</span>
              <span>Inocente — simplicidade, otimismo, confiança</span>
            </div>
            <div className="field-row">
              <span className="k">No mercado</span>
              <span>Cara Comum — inclusiva, acessível, preço justo</span>
            </div>
          </div>
          <div className="panel">
            <h4>Tom de voz</h4>
            <div className="field-row">
              <span className="k">Próxima e verdadeira</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>sem formalismo, fala como quem está ao lado da família</span>
            </div>
            <div className="field-row">
              <span className="k">Otimista e alegre</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>entusiasmo contagiante, nunca monótona</span>
            </div>
            <div className="field-row">
              <span className="k">Confiável e segura</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>simples e transparente, nunca técnica demais</span>
            </div>
            <div className="field-row">
              <span className="k">Inclusiva e empática</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>acessível a todas as famílias, nunca impositiva</span>
            </div>
          </div>
          <div className="panel">
            <h4>Tagline &amp; manifesto</h4>
            <p style={{ fontFamily: 'Space Grotesk', fontSize: 15, margin: '0 0 10px 0' }}>“Brincar é Tópi.”</p>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 10px 0' }}>
              Slogans: “Se divertir é Tópi.” / “Imaginar é Tópi!”
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6, fontStyle: 'italic' }}>
              "Porque Tópi é mais do que brinquedo. É um jeito de olhar para a infância com leveza, cor e
              imaginação... Porque quando a infância é livre, criativa e feliz — é Tópi demais!"
            </p>
          </div>
        </div>
        <div>
          <div className="panel">
            <h4>Tipografia</h4>
            <div className="field-row">
              <span className="k">Principal</span>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}>Chill Kids</span>
            </div>
            <div className="field-row">
              <span className="k">Complementar</span>
              <span>Maven Pro</span>
            </div>
          </div>
          <div className="panel">
            <h4>Paleta de cores</h4>
            {[
              ['Laranja · Alegria', '#EA5C18'],
              ['Amarelo · Sol', '#F3D22A'],
              ['Azul · Céu', '#2EBADA'],
              ['Branco', '#FFFFFF'],
            ].map(([name, hex]) => (
              <div className="field-row" key={hex}>
                <span className="k" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: hex,
                      border: hex === '#FFFFFF' ? '1px solid var(--border)' : 'none',
                      display: 'inline-block',
                    }}
                  />
                  {name}
                </span>
                <span className="mono">{hex}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section-head">
        <h2>Personagens licenciados</h2>
        <button className="btn ghost" disabled title="Formulário chega na Fase 2">
          + Adicionar licenciado
        </button>
      </div>
      <div className="grid4">
        {LICENSEES.map(([name, owner, color]) => (
          <div className="card" key={name} style={{ borderTop: `3px solid ${color}` }}>
            <h4>{name}</h4>
            <p>Licenciante: {owner}</p>
            <span className="pill" style={{ marginTop: 8, display: 'inline-block' }}>
              Guia de uso da marca
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
