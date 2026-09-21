# Base de conhecimento dos produtos — P5.8

Levantamento do conteúdo comercial e técnico dos **315 produtos**, a partir das
fontes oficiais da Cardoso. Serve para revisão humana antes de qualquer
publicação no Hub.

> **Nada aqui foi gravado no cadastro.** `products.description` e
> `products.differentials` continuam como estavam (19 descrições e nenhum
> diferencial). Esta pasta é uma camada de proposta, não de produção.

## O que tem aqui

| arquivo | o que é |
|---|---|
| `produtos.json` | a base completa, um registro por produto, com fonte e confiança campo a campo |
| `produtos.csv` | a mesma coisa achatada, para revisar em planilha |
| `conflitos.csv` | onde as fontes oficiais discordam entre si — **ninguém decidiu por você** |
| `sem_fonte_de_conteudo.csv` | os 19 produtos sem texto em nenhuma fonte, com o produto-base sugerido quando existe |
| `catalogo_nome_com_texto_colado.csv` | 90 produtos em que o catálogo 2026 gravou descrição junto do nome |
| `1_raspa_site.py` · `2_consolida.py` · `3_exporta.py` | como a base foi gerada, para refazer quando o site mudar |

## Fontes

| Fonte | Onde | Produtos | Descrição | Diferenciais | Técnico | Embalagem | Imagens |
|---|---|---:|---|---|---|---|---|
| **Site oficial** | `cardosotoys.com.br`, tipo `produto` + `wp-json` | 296 | ✅ texto comercial | ✅ taxonomia `caracteristica` (161 termos) + bullets "Benefícios" | parcial | parcial | ✅ |
| **Ficha Técnica 2026** | `2026 - CARDOSO -FICHA TÉCNICA-2.xlsx` | 315 | ❌ | ❌ | ✅ 43 campos | ✅ | ❌ |
| **Catálogo 2026** | `produtos_catalogo_2026.csv` (Hub) e `catalogo2026.json` (histórico do CRM) | 315 | ⚠️ só grudada no nome, em 90 casos | ❌ | mínimo | ✅ 307 | ❌ |
| **Cadastro do Hub** | `public.products` | 315 | 19 (7 quebradas) | 0 | ✅ | ✅ | ✅ 315 / 189 embalagem |

Descartadas por estarem vazias: `monday-dump/` (todos os arquivos com 0 byte) e
o tipo `material` do site (0 itens). O tipo `catalogo` do site tem só as duas
capas (Playmi e Tópi 2026), sem PDF exposto. **`topi.com.br` não é da Cardoso**
— é a ToPi Serigrafia, outra empresa; não foi usada.

## Chave de cruzamento

O **código do produto**, nunca o nome. O site publica o código em `REF. NNNN` e
repete em `Referência: N` dentro da ficha da página. A normalização tira zero à
esquerda e sufixo de display: `0071` → `71`, `7172 - A` → `7172`. Bateu em
**292 dos 315**.

## Como ler cada campo

- **`descricao_proposta`** — a **primeira frase do texto oficial do site,
  literal**. Não foi reescrita, resumida nem enfeitada. Por isso a confiança é
  `CONFIRMADO`: é a própria Cardoso falando.
- **`qualidade_descricao`** — `ESPECIFICA` quando o texto cita o produto, um
  número ou o que acompanha; `GENERICA` quando só tem verbo de desenvolvimento
  ("estimula a criatividade"), que não diferencia nada e pede mão humana.
- **`diferenciais_propostos`** — termos literais da taxonomia do site:
  "Acompanha 2 baquetas", "A porta do forno abre", "Para brincar no banho".
  Concretos e verificáveis.
- **`beneficios_site`** — os bullets de "Benefícios do produto" da página.
  **Ficam separados de propósito:** são genéricos e se repetem muito
  ("Desenvolve coordenação motora" aparece em 59 produtos). Servem de apoio,
  não de diferencial.
- **`dados_tecnicos`** — da Ficha Técnica 2026, com o bloco técnico do site
  como segunda fonte quando existe.
- **`fontes`** — a URL ou o arquivo de onde cada informação veio.
- **`nivel_confianca`** — `CONFIRMADO` (fonte oficial direta), `CONSOLIDADO`
  (duas fontes concordando), `PROPOSTO` (texto redigido a partir de fonte, sem
  fato novo), `NAO_ENCONTRADO`.
- **`status_revisao`** — `PENDENTE` em todos. O fluxo previsto é
  PENDENTE → REVISADO → APROVADO ou REJEITADO.

## Cobertura

| Campo | Total | Encontrados | Não encontrados |
|---|---:|---:|---:|
| Descrição (proposta ou existente) | 315 | **296** | 19 |
| — delas, específicas | 292 | 290 | 2 genéricas |
| Diferenciais concretos | 315 | **144** | 171 |
| Benefícios do site (apoio) | 315 | 231 | 84 |
| "Indicado para" | 315 | 276 | 39 |
| EAN | 315 | 315 | 0 |
| Material · Gênero | 315 | 315 | 0 |
| Sub-categoria | 315 | 314 | 1 |
| Cor | 315 | 313 | 2 |
| Conteúdo da caixa | 315 | 313 | 2 |
| Quantidade por caixa | 315 | 312 | 3 |
| Medidas do produto | 315 | 311 | 4 |
| Peso do produto | 315 | 310 | 5 |
| DUN | 315 | 310 | 5 |
| NCM | 315 | 304 | 11 |
| Paletização | 315 | 272 | 43 |
| CST | 315 | 139 | 176 |
| Nome técnico | 315 | 45 | 270 |
| Peso suportado | 315 | 33 | 282 |
| **INMETRO** | 315 | **0** | **315** |

O INMETRO não existe em nenhuma das quatro fontes. Só sai de documento de
certificação, que não está no projeto.

## O que precisa de decisão humana

1. **7 das 19 descrições que já estão no Hub são lixo de OCR** do catálogo — por
   exemplo `2017`: *"Puxe a 486A x 255C x 202L casquinha 2º Aperte o botão"*, e
   `6009`: *"Todas as referências desta página são sem eletrônico."* Foram
   preservadas como mandado (`DESCRICAO_EXISTENTE`), mas o site tem texto bom
   para elas.
2. **2 EANs divergem** entre ficha e site (`3083`, `4012`) — ver `conflitos.csv`.
3. **28 nomes divergem** entre ficha e site, incluindo erro de digitação dos dois
   lados: a ficha escreve "Caminho Air Truck" (falta o ã) e o site escreve
   "Fofilhotes Trezinho" (falta o n).
4. **`0263`** tem a descrição truncada **no próprio site**, começando no meio da
   frase.
5. **`7143 City Rescue Bombeiro`** tem o link quebrado no site (404).
6. **14 dos 19 sem conteúdo são variantes "Caixa Individual"** de produtos que
   têm texto no site. O produto-base está apontado em
   `sem_fonte_de_conteudo.csv`; reaproveitar é decisão de quem revisa.

## Refazer

```bash
cd base-conhecimento
python3 1_raspa_site.py    # ~2 min, 296 páginas, 0,25 s entre elas
python3 2_consolida.py
python3 3_exporta.py
```

O passo 2 espera `ficha_completa.json`, `catalogo_crm.json` e
`hub_descricoes.json` no diretório de trabalho — os três saem, respectivamente,
do .xlsx da ficha, do histórico do repositório do CRM e de um `select code,
description from public.products where description <> ''`.
