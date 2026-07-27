-- Cardoso Marketing Hub — correção de dados: linha "Solapas" para o catálogo Tópi
-- Roda uma vez no SQL Editor (depois de 0001/0002/0003 já terem rodado).
-- Os 44 itens da categoria "Solapas" (embalagem tipo cartela/solapa) da planilha de
-- rastreamento batem exatamente com produtos já cadastrados no catálogo — a "linha" deles
-- só não tinha sido preenchida na primeira extração automática.

update public.products
set line = 'Solapas'
where code in ('0125', '2001', '2003', '2009', '3057', '3058', '3059', '4009', '4010', '4012', '4013', '4014', '4015', '4016', '4018', '4019', '4020', '4021', '4022', '4023', '4024', '4025', '4026', '4028', '4029', '4030', '4031', '4032', '7189', '7190', '7208', '7209', '7210', '7211', '7212', '7213', '7214', '7215', '7216', '7217', '7218', '7219', '7220', '7221')
  and brand_id = (select id from public.brands where key = 'topi');

-- Os 4 produtos Tópi abaixo (Tandy e Jeep Rally) não aparecem na planilha de correções e
-- não têm categoria confirmada em nenhuma fonte disponível — ficam marcados para revisão
-- manual em vez de eu adivinhar a linha.
update public.products
set needs_review = true
where code in ('0071', '0072', '0078', '1036')
  and brand_id = (select id from public.brands where key = 'topi');
