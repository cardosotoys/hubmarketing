-- Cardoso Marketing Hub — limpeza dos códigos de caixa master (DUN-14)
-- Roda depois de 0001..0100. Idempotente e conservador: cada UPDATE só escreve onde o
-- valor atual é exatamente o errado esperado. Rodar duas vezes não causa dano.
--
-- Origem de cada correção:
--   grupos 1 a 3  — o dado certo já estava no banco, só sujo (Excel, separador, marcador).
--   grupo 4       — códigos informados pelo Lucas (Compras) em 22/09/2026, conferidos um a
--                   um no dígito verificador GS1 módulo 10: os 11 passam.
--   grupo 5       — três EANs que o DUN correspondente prova estarem errados.
--
-- FORA DAQUI, DE PROPÓSITO:
--   3123  — o DUN informado (9789648413122-6) traz o miolo 413122, que é o código do produto
--           3122. O alternativo 9789648413123-3 também passa no dígito verificador, então a
--           conta não decide qual é o certo. Aguardando confirmação.
--   7172, 7173, 7174 — o EAN compartilhado. Depende da definição de sortido com o Fiscal.

set lock_timeout = '5s';

begin;

-- ============================================ 1) o marcador X vira campo vazio (29 produtos)
-- O 'X' era a anotação de "não temos este código" na planilha de origem. Estes produtos
-- não possuem DUN: são vendidos só com EAN. Vazio declara isso; 'X' finge que há dado.
update public.products set dun = ''
 where dun in ('X','x')
   and code in ('0300', '0301', '2015', '2016', '2017', '2019', '3053', '3054', '6005', '6006', '6007', '6008', '6009', '6010', '6011', '6012', '6013', '6017', '6018', '6019', '6021', '8014', '8017', '8018', '8022', '8029', '8030', '9505', '9506');

-- ============================================ 2) o .0 que o Excel deixou (12 produtos)
-- O número está inteiro e passa no dígito verificador; só ganhou sujeira de formatação.
update public.products set dun = '2789648413113-5' where code = '3113' and dun = '27896484131135.0';
update public.products set dun = '2789648414012-0' where code = '4012' and dun = '27896484140120.0';
update public.products set dun = '2789648414030-4' where code = '4030' and dun = '27896484140304.0';
update public.products set dun = '2789648414032-8' where code = '4032' and dun = '27896484140328.0';
update public.products set dun = '2789648417189-6' where code = '7189' and dun = '27896484171896.0';
update public.products set dun = '2789648417190-2' where code = '7190' and dun = '27896484171902.0';
update public.products set dun = '2789648417203-9' where code = '7203' and dun = '27896484172039.0';
update public.products set dun = '2789648417204-6' where code = '7204' and dun = '27896484172046.0';
update public.products set dun = '2789648417225-1' where code = '7225' and dun = '27896484172251.0';
update public.products set dun = '2789648417226-8' where code = '7226' and dun = '27896484172268.0';
update public.products set dun = '2789648417227-5' where code = '7227' and dun = '27896484172275.0';
update public.products set dun = '2789648417228-2' where code = '7228' and dun = '27896484172282.0';

-- ============================================ 3) espaço no lugar do hífen (22 produtos)
update public.products set dun = '2789648417200-8' where code = '7200' and dun = '2789648417200 8';
update public.products set dun = '2789648417202-2' where code = '7202' and dun = '2789648417202 2';
update public.products set dun = '2789648417205-3' where code = '7205' and dun = '2789648417205 3';
update public.products set dun = '2789648417206-0' where code = '7206' and dun = '2789648417206 0';
update public.products set dun = '2789648417207-7' where code = '7207' and dun = '2789648417207 7';
update public.products set dun = '2789648417208-4' where code = '7208' and dun = '2789648417208 4';
update public.products set dun = '2789648417209-1' where code = '7209' and dun = '2789648417209 1';
update public.products set dun = '2789648417210-7' where code = '7210' and dun = '2789648417210 7';
update public.products set dun = '2789648417211-4' where code = '7211' and dun = '2789648417211 4';
update public.products set dun = '2789648417212-1' where code = '7212' and dun = '2789648417212 1';
update public.products set dun = '2789648417213-8' where code = '7213' and dun = '2789648417213 8';
update public.products set dun = '2789648417214-5' where code = '7214' and dun = '2789648417214 5';
update public.products set dun = '2789648417215-2' where code = '7215' and dun = '2789648417215 2';
update public.products set dun = '2789648417216-9' where code = '7216' and dun = '2789648417216 9';
update public.products set dun = '2789648417217-6' where code = '7217' and dun = '2789648417217 6';
update public.products set dun = '2789648417218-3' where code = '7218' and dun = '2789648417218 3';
update public.products set dun = '2789648417219-0' where code = '7219' and dun = '2789648417219 0';
update public.products set dun = '2789648417220-6' where code = '7220' and dun = '2789648417220 6';
update public.products set dun = '2789648417221-3' where code = '7221' and dun = '2789648417221 3';
update public.products set dun = '2789648417222-0' where code = '7222' and dun = '2789648417222 0';
update public.products set dun = '2789648417223-7' where code = '7223' and dun = '2789648417223 7';
update public.products set dun = '2789648417224-4' where code = '7224' and dun = '2789648417224 4';

-- ============================================ 4) códigos informados pelo Compras (11 produtos)
update public.products set dun = '2789648412010-8' where code = '2010' and dun = '278964842010-8';
update public.products set dun = '2789648412011-5' where code = '2011' and dun = '278964842011-5';
update public.products set dun = '2789648413038-1' where code = '3038' and dun = '2789648413013-8';
update public.products set dun = '1789648413052-0' where code = '3052' and dun = '1789648413052-0';
update public.products set dun = '2789648413122-7' where code = '3122' and coalesce(dun,'') = '';
update public.products set dun = '9789648413124-0' where code = '3124' and coalesce(dun,'') = '';
update public.products set dun = '2789648414026-7' where code = '4026' and dun = '5789648413044-3';
update public.products set dun = '2789648417151-3' where code = '7151' and dun = '2789648417151-3';
update public.products set dun = '2789648417152-0' where code = '7152' and dun = '2789648417152-0';
update public.products set dun = '2789648417201-5' where code = '7201' and dun = '278964817201 5';
update public.products set dun = '2789648417229-9' where code = '7229' and coalesce(dun,'') = '';

-- ============================================ 5) os três EANs que o DUN desmente
-- Em cada um, o DUN do próprio produto passa no dígito verificador e aponta outro número.
-- O padrão do catálogo (789648 + 41 + código) aponta o mesmo. Dois caminhos independentes.
update public.products set ean = '789648413052-3' where code = '3052' and ean = '798648413052-3';
update public.products set ean = '789648417151-9' where code = '7151' and ean = '789648417451-9';
update public.products set ean = '789648417152-6' where code = '7152' and ean = '789648417452-6';

-- ============================================ conferência
do $$
declare
  n_x int; n_ponto int; n_espaco int; n_curto int;
begin
  select count(*) into n_x      from public.products where dun in ('X','x');
  select count(*) into n_ponto  from public.products where dun like '%.0';
  select count(*) into n_espaco from public.products where dun like '% %';
  select count(*) into n_curto  from public.products
    where coalesce(dun,'') <> '' and length(regexp_replace(dun, '\D', '', 'g')) <> 14;

  raise notice 'DUN com X            : %', n_x;
  raise notice 'DUN com .0           : %', n_ponto;
  raise notice 'DUN com espaço       : %', n_espaco;
  raise notice 'DUN fora de 14 dígitos: %', n_curto;

  if n_x > 0 or n_ponto > 0 or n_espaco > 0 then
    raise exception 'ABORTADO: ainda restam códigos sujos (X=%, .0=%, espaço=%)', n_x, n_ponto, n_espaco;
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';