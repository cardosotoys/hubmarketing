# Migração do Monday.com → Cardoso Hub

Migração **única** (você vai aposentar o Monday). Duas etapas:

## Etapa 1 — Exportar (READ-ONLY, já pronto)

Puxa **tudo** do Monday e salva em `monday-dump/` como JSON. **Não altera nada.**

1. Pegue seu token no Monday: **foto do perfil → Developers → My access tokens**
   (ou **Admin → API**). É pessoal e enxerga o que a sua conta enxerga.
2. No terminal, dentro da pasta do projeto:

   ```bash
   MONDAY_TOKEN="cole_seu_token_aqui" node scripts/monday-export.mjs
   ```

   Opcionais:
   - Só alguns quadros: `MONDAY_BOARD_IDS="123,456"`
   - Trocar versão da API: `MONDAY_API_VERSION="2024-01"`

3. No fim ele imprime um **RESUMO** e salva `monday-dump/summary.json`.
   **Me mande esse `summary.json`** (não tem dado sensível — só nomes de
   quadros/colunas e contagens). Com ele eu monto a Etapa 2.

O que o export traz: quadros, grupos, colunas, itens, subitens,
**comentários (updates)** e **log de atividades** (histórico). O histórico
tem retenção limitada pelo plano do Monday — o script mostra quanto veio de
cada quadro.

## Etapa 2 — Importar (será escrito após a Etapa 1)

Com o `summary.json` em mãos, eu escrevo `scripts/monday-import.mjs`, que
mapeia cada quadro para o lugar certo do hub (demandas/etapas/comentários/
histórico), preservando **datas e autores originais**. Ele roda em modo de
teste (dry-run) primeiro, e só grava com `--commit`.

Precisa de duas variáveis (você define local, não compartilha):
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Settings → API).
