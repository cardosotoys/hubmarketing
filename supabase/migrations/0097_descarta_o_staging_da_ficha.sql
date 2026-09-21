-- Cardoso Hub — descarta a tabela de apoio da carga da FICHA TECNICA 2026.
--
-- NAO APLICADA AINDA. Esta migration existe pronta para o dia em que a
-- operacao estiver rodando ha tempo suficiente para ninguem precisar do
-- rastro da carga.
--
-- public.ficha_2026_stage foi criada pela 0090 so para receber as 315 linhas
-- da planilha e alimentar a 0092. Levantamento de 20/09/2026:
--   registros ............ 315
--   tamanho .............. 112 kB
--   FKs apontando ........ 0
--   views usando ......... 0
--   funcoes usando ....... 0
--   triggers ............. 0
--   codigo da aplicacao .. nenhum (nem CRM nem Hub)
--   permissoes ........... nenhuma para anon/authenticated
-- Ou seja: nada no sistema a alcanca. O unico valor dela e historico — se a
-- carga precisar ser conferida ou refeita, o arquivo .xlsx e as migrations
-- 0091 reconstroem a tabela do zero.
--
-- Impacto de rodar: nenhum em runtime. O que se perde e a copia das 315 linhas
-- da planilha dentro do banco; a fonte continua no repositorio.

set lock_timeout = '5s';

drop table if exists public.ficha_2026_stage;
