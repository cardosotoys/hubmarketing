-- Cardoso Hub — Trade: Visitas dos Promotores 28.09 a 04.10.26 (por NOME, dedup)
-- Resolve por nome contra o banco ao vivo. Loja nova so se o nome nao existir. Idempotente por source_file.
begin;

-- 1) lojas novas (verifique/renomeie depois)
insert into public.tm_stores (name,network_id) select 'Armarinhos Fernando São Miguel', n.id from public.tm_networks n where n.name='Armarinhos Fernando' and not exists (select 1 from public.tm_stores s where s.name='Armarinhos Fernando São Miguel');
insert into public.tm_stores (name,network_id) select 'Atacadão Ipapecerica', n.id from public.tm_networks n where n.name='Atacadão' and not exists (select 1 from public.tm_stores s where s.name='Atacadão Ipapecerica');
insert into public.tm_stores (name,network_id) select 'Barracão Cocaia', n.id from public.tm_networks n where n.name='Barracão' and not exists (select 1 from public.tm_stores s where s.name='Barracão Cocaia');
insert into public.tm_stores (name,network_id) select 'Barracão Otávio Braga', n.id from public.tm_networks n where n.name='Barracão' and not exists (select 1 from public.tm_stores s where s.name='Barracão Otávio Braga');
insert into public.tm_stores (name,network_id) select 'Barracão Parelheiros', n.id from public.tm_networks n where n.name='Barracão' and not exists (select 1 from public.tm_stores s where s.name='Barracão Parelheiros');
insert into public.tm_stores (name,network_id) select 'PB Kids Analia Franco', n.id from public.tm_networks n where n.name='PB Kids' and not exists (select 1 from public.tm_stores s where s.name='PB Kids Analia Franco');
insert into public.tm_stores (name,network_id) select 'PB Kids Ibirapuera', n.id from public.tm_networks n where n.name='PB Kids' and not exists (select 1 from public.tm_stores s where s.name='PB Kids Ibirapuera');
insert into public.tm_stores (name,network_id) select 'PB Kids Mooca', n.id from public.tm_networks n where n.name='PB Kids' and not exists (select 1 from public.tm_stores s where s.name='PB Kids Mooca');
insert into public.tm_stores (name,network_id) select 'Pirueta Central', n.id from public.tm_networks n where n.name='Pirueta' and not exists (select 1 from public.tm_stores s where s.name='Pirueta Central');
insert into public.tm_stores (name,network_id) select 'Pirueta Tateno', n.id from public.tm_networks n where n.name='Pirueta' and not exists (select 1 from public.tm_stores s where s.name='Pirueta Tateno');
insert into public.tm_stores (name,network_id) select 'Renascer Lapa', n.id from public.tm_networks n where n.name='Renascer' and not exists (select 1 from public.tm_stores s where s.name='Renascer Lapa');
insert into public.tm_stores (name,network_id) select 'Ri Happy Center Norte', n.id from public.tm_networks n where n.name='Ri Happy' and not exists (select 1 from public.tm_stores s where s.name='Ri Happy Center Norte');

-- 2) aliases (variantes/novas grafias -> loja)
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Af Ipiranga' from public.tm_stores s where s.name='Armarinhos Fernando Ipiranga' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Af Ipiranga');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Af Ipiranga*' from public.tm_stores s where s.name='Armarinhos Fernando Ipiranga' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Af Ipiranga*');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Af Tatuapé' from public.tm_stores s where s.name='Armarinhos Fernando Tatuape' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Af Tatuapé');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Ame Aricanduva' from public.tm_stores s where s.name='Americanas Aricanduva' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Ame Aricanduva');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Ame Interlagos' from public.tm_stores s where s.name='Americanas Interlagos' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Ame Interlagos');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Ame Jardim Sul' from public.tm_stores s where s.name='Americanas Jardim Sul' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Ame Jardim Sul');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Ame SPMarket' from public.tm_stores s where s.name='Americanas Spmarket' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Ame SPMarket');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Ame Tatuapé' from public.tm_stores s where s.name='Americanas Tatuape' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Ame Tatuapé');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Ata Aricanduva' from public.tm_stores s where s.name='Atacadão Aricanduva' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Ata Aricanduva');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Ata Aricanduva *' from public.tm_stores s where s.name='Atacadão Aricanduva' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Ata Aricanduva *');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Ata Centro Gua' from public.tm_stores s where s.name='Atacadão Centro Gua' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Ata Centro Gua');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Ata Ipapecerica I' from public.tm_stores s where s.name='Atacadão Ipapecerica' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Ata Ipapecerica I');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Ata Itaquera *' from public.tm_stores s where s.name='Atacadão Itaquera' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Ata Itaquera *');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Ata Sto Amaro' from public.tm_stores s where s.name='Atacadão Santo Amaro' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Ata Sto Amaro');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Ata Sto André' from public.tm_stores s where s.name='Atacadão Sto Andre' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Ata Sto André');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Ata Vila Maria*' from public.tm_stores s where s.name='Atacadão Vila Maria' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Ata Vila Maria*');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Barra Parelheiros' from public.tm_stores s where s.name='Barracão Parelheiros' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Barra Parelheiros');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Fer Gua' from public.tm_stores s where s.name='Armarinhos Fernando Guarulhos' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Fer Gua');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Fer Suzano' from public.tm_stores s where s.name='Armarinhos Fernando Suzano' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Fer Suzano');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Fer São Miguel' from public.tm_stores s where s.name='Armarinhos Fernando São Miguel' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Fer São Miguel');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Fer tatuapé' from public.tm_stores s where s.name='Armarinhos Fernando Tatuape' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Fer tatuapé');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Fernando' from public.tm_stores s where s.name='Armarinhos Fernando' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Fernando');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Fernando Brás' from public.tm_stores s where s.name='Armarinhos Fernando Bras' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Fernando Brás');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Fernando Guarulhos' from public.tm_stores s where s.name='Armarinhos Fernando Guarulhos' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Fernando Guarulhos');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Fernando Mooca' from public.tm_stores s where s.name='Armarinhos Fernando Mooca' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Fernando Mooca');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Fernando Osasco' from public.tm_stores s where s.name='Armarinhos Fernando Osasco' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Fernando Osasco');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Mini Preço' from public.tm_stores s where s.name='MiniPreço' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Mini Preço');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Pbkids Analia Franco' from public.tm_stores s where s.name='PB Kids Analia Franco' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Pbkids Analia Franco');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Pbkids Eldorado' from public.tm_stores s where s.name='PB Kids Eldorado' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Pbkids Eldorado');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Pbkids Ibirapuera' from public.tm_stores s where s.name='PB Kids Ibirapuera' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Pbkids Ibirapuera');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Pbkids Jardim Sul' from public.tm_stores s where s.name='PB Kids Jardim Sul' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Pbkids Jardim Sul');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Pbkids Mooca' from public.tm_stores s where s.name='PB Kids Mooca' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Pbkids Mooca');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Pbkids Morumbi' from public.tm_stores s where s.name='PB Kids Morumbi' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Pbkids Morumbi');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'PBKs Eldorado' from public.tm_stores s where s.name='PB Kids Eldorado' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='PBKs Eldorado');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'PBks G. Vianna' from public.tm_stores s where s.name='PB Kids G Vianna' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='PBks G. Vianna');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'PBKs Tamboré' from public.tm_stores s where s.name='PB Kids Tambore' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='PBKs Tamboré');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH Aricanduva' from public.tm_stores s where s.name='Ri Happy Aricanduva' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH Aricanduva');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH Cid. São Paulo' from public.tm_stores s where s.name='Ri Happy Shop Cid Sao Paulo' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH Cid. São Paulo');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH Cidade São Paulo' from public.tm_stores s where s.name='Ri Happy Cid De Sao Paulo' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH Cidade São Paulo');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH Interlagos' from public.tm_stores s where s.name='Ri Happy Interlagos' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH Interlagos');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH Internacional' from public.tm_stores s where s.name='Ri Happy Internacional' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH Internacional');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH itaim' from public.tm_stores s where s.name='Ri Happy Itaim' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH itaim');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH Itaquera' from public.tm_stores s where s.name='Ri Happy Itaquera' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH Itaquera');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH Otto Baumgart' from public.tm_stores s where s.name='Ri Happy Otto Baumgard' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH Otto Baumgart');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH Penha' from public.tm_stores s where s.name='Ri Happy Penha' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH Penha');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH Raposo' from public.tm_stores s where s.name='Ri Happy Raposo' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH Raposo');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH SPMarket' from public.tm_stores s where s.name='Ri Happy Sp Market' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH SPMarket');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH Tatuapé' from public.tm_stores s where s.name='Ri Happy Tatuape' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH Tatuapé');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH Tietê' from public.tm_stores s where s.name='Ri Happy Tiete' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH Tietê');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH União' from public.tm_stores s where s.name='Ri Happy Uniao' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH União');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH Vila Mariana' from public.tm_stores s where s.name='Ri Happy Vila Mariana' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH Vila Mariana');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RH Villa Lobos' from public.tm_stores s where s.name='Ri Happy Villa Lobos' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RH Villa Lobos');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'RiHappy Augusta' from public.tm_stores s where s.name='Ri Happy Augusta' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='RiHappy Augusta');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Rihappy Center Norte' from public.tm_stores s where s.name='Ri Happy Center Norte' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Rihappy Center Norte');
insert into public.tm_store_aliases (store_id,raw_name) select s.id,'Rihappy Tucuruvi' from public.tm_stores s where s.name='Ri Happy Tucuruvi' and not exists (select 1 from public.tm_store_aliases a where a.raw_name='Rihappy Tucuruvi');

delete from public.tm_visits where source_file = 'Visita dos Promotores -28.09 a 04.10.26.xlsx';

with v(prom,canon,d,wd,raw,src) as (values
  ('Theska','Ri Happy Center Norte','2026-09-28','Segunda','Rihappy Center Norte','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Ri Happy Otto Baumgard','2026-09-28','Segunda','RH Otto Baumgart','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Ri Happy Tucuruvi','2026-09-28','Segunda','Rihappy Tucuruvi','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','PB Kids Ibirapuera','2026-09-28','Segunda','Pbkids Ibirapuera','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Ri Happy Vila Mariana','2026-09-28','Segunda','RH Vila Mariana','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Armarinhos Fernando Mooca','2026-09-28','Segunda','Fernando Mooca','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','PB Kids Analia Franco','2026-09-28','Segunda','Pbkids Analia Franco','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','PB Kids Mooca','2026-09-28','Segunda','Pbkids Mooca','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Armarinhos Fernando Ipiranga','2026-09-28','Segunda','Af Ipiranga*','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Armarinhos Fernando Tatuape','2026-09-28','Segunda','Af Tatuapé','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Pirueta','2026-09-28','Segunda','Pirueta','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Ri Happy Uniao','2026-09-28','Segunda','RH União','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Americanas Uniao','2026-09-28','Segunda','Americanas União','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Eurípedes','Pirueta Ragueb','2026-09-28','Segunda','Pirueta Ragueb','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Atacadão Centro Gua','2026-10-01','Quinta','Ata Centro Gua','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Armarinhos Fernando Guarulhos','2026-10-01','Quinta','Fernando Guarulhos','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Barracão Otávio Braga','2026-10-01','Quinta','Barracão Otávio Braga','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Americanas Market Place','2026-10-01','Quinta','Americanas Market place','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','PB Kids Morumbi','2026-10-01','Quinta','Pbkids Morumbi','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','PB Kids Eldorado','2026-10-01','Quinta','Pbkids Eldorado','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Armarinhos Fernando Tatuape','2026-10-01','Quinta','Af Tatuapé','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Armarinhos Fernando Ipiranga','2026-10-01','Quinta','Af Ipiranga','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Ri Happy Tiete','2026-10-01','Quinta','RH Tietê','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Renascer Lapa','2026-10-01','Quinta','Renascer Lapa','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Americanas Lapa','2026-10-01','Quinta','Americanas Lapa','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Eurípedes','Pirueta Taubate','2026-10-01','Quinta','`Pirueta Taubaté','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Barracão Parelheiros','2026-10-01','Quinta','Barra Parelheiros','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Barracão Cocaia','2026-10-01','Quinta','Barracão Cocaia','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','MiniPreço','2026-10-01','Quinta','Mini Preço','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Ri Happy Internacional','2026-09-29','Terça','RH Internacional','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Armarinhos Fernando Bras','2026-09-29','Terça','Fernando Brás','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Ri Happy Villa Lobos','2026-09-29','Terça','RH Villa Lobos','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','PB Kids Eldorado','2026-09-29','Terça','Pbkids Eldorado','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Atacadão Itaquera','2026-09-29','Terça','Atacadao Itaquera','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Ri Happy Aricanduva','2026-09-29','Terça','RH Aricanduva','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Americanas Aricanduva','2026-09-29','Terça','Ame Aricanduva','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Ri Happy Itaquera','2026-09-29','Terça','RH Itaquera','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Americanas Itaquera','2026-09-29','Terça','Americanas Itaquera','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Armarinhos Fernando Osasco','2026-09-29','Terça','Fernando Osasco','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','PB Kids G Vianna','2026-09-29','Terça','PBks G. Vianna','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Eurípedes','Pirueta Atibaia','2026-09-29','Terça','Pirueta Atibaia','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Ri Happy Vila Mariana','2026-09-29','Terça','RH Vila Mariana','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Ri Happy Sp Market','2026-09-29','Terça','RH SPMarket','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Americanas Spmarket','2026-09-29','Terça','Ame SPMarket','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Ri Happy Penha','2026-10-02','Sexta','RH Penha','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Ri Happy Internacional','2026-10-02','Sexta','RH Internacional','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Armarinhos Fernando Mooca','2026-10-02','Sexta','Fernando Mooca','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Armarinhos Fernando Bras','2026-10-02','Sexta','Fernando Brás','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Ri Happy Villa Lobos','2026-10-02','Sexta','RH Villa Lobos','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Atacadão Itaquera','2026-10-02','Sexta','Atacadao Itaquera','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Ri Happy Aricanduva','2026-10-02','Sexta','RH Aricanduva','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Americanas Aricanduva','2026-10-02','Sexta','Ame Aricanduva','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Ri Happy Itaquera','2026-10-02','Sexta','RH Itaquera','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Ri Happy Raposo','2026-10-02','Sexta','RH Raposo','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Pirueta','2026-10-02','Sexta','Pirueta','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Eurípedes','Atacadão Sto Andre','2026-10-02','Sexta','Ata Sto André','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Armarinhos Fernando','2026-10-02','Sexta','Fernando','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Renascer','2026-10-02','Sexta','Renascer','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Barracão Sto Amaro','2026-10-02','Sexta','Barracão Sto Amaro','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Barracão S Miguel','2026-09-30','Quarta','Barracão S. Miguel','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Armarinhos Fernando São Miguel','2026-09-30','Quarta','Fer São Miguel','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Barracão Pimentas','2026-09-30','Quarta','Barracão Pimentas','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Armarinhos Fernando Mooca','2026-09-30','Quarta','Fernando Mooca','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Ri Happy Cid De Sao Paulo','2026-09-30','Quarta','RH Cidade São Paulo','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Ri Happy Augusta','2026-09-30','Quarta','RiHappy Augusta','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Ri Happy Itaim','2026-09-30','Quarta','RH itaim','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Atacadão Aricanduva','2026-09-30','Quarta','Ata Aricanduva','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Ri Happy Tatuape','2026-09-30','Quarta','RH Tatuapé','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Americanas Tatuape','2026-09-30','Quarta','Ame Tatuapé','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Ri Happy Aricanduva','2026-09-30','Quarta','RH Aricanduva','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Americanas Aricanduva','2026-09-30','Quarta','Ame Aricanduva','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','PB Kids Tambore','2026-09-30','Quarta','PBKs Tamboré','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Pirueta','2026-09-30','Quarta','Pirueta*','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Eurípedes','Pirueta Central','2026-09-30','Quarta','Pirueta Central','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Armarinhos Fernando','2026-09-30','Quarta','Fernando','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Renascer','2026-09-30','Quarta','Renascer','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Ri Happy Interlagos','2026-09-30','Quarta','RH Interlagos','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Atacadão Dutra','2026-10-03','Sábado','Atacadão Dutra','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Armarinhos Fernando Guarulhos','2026-10-03','Sábado','Fer Gua','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Atacadão Ipapecerica','2026-10-03','Sábado','Ata Ipapecerica I','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Atacadão Santo Amaro','2026-10-03','Sábado','Ata Sto Amaro','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','PB Kids Jardim Sul','2026-10-03','Sábado','Pbkids Jardim Sul','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Americanas Jardim Sul','2026-10-03','Sábado','Ame Jardim Sul','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','PB Kids Morumbi','2026-10-03','Sábado','Pbkids Morumbi','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Atacadão Itaquera','2026-10-03','Sábado','Ata Itaquera *','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Atacadão Aricanduva','2026-10-03','Sábado','Ata Aricanduva *','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Atacadão Vila Maria','2026-10-03','Sábado','Ata Vila Maria*','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Armarinhos Fernando Tatuape','2026-10-03','Sábado','Af Tatuapé','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Armarinhos Fernando','2026-10-03','Sábado','Fernando','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Ri Happy Uniao','2026-10-03','Sábado','RH União','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Eurípedes','Atacadão Suzano','2026-10-03','Sábado','Atacadão Suzano','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Eurípedes','Armarinhos Fernando Suzano','2026-10-03','Sábado','Fer Suzano','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Ri Happy Interlagos','2026-10-03','Sábado','RH Interlagos','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Americanas Interlagos','2026-10-03','Sábado','Ame Interlagos','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Ri Happy Sp Market','2026-10-03','Sábado','RH SPMarket','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Theska','Ri Happy Internacional','2026-10-04','Domingo','RH Internacional','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','Ri Happy Shop Cid Sao Paulo','2026-10-04','Domingo','RH Cid. São Paulo','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Aroldo','PB Kids Eldorado','2026-10-04','Domingo','PBKs Eldorado','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Armarinhos Fernando Tatuape','2026-10-04','Domingo','Fer tatuapé','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Marcelo','Ri Happy Aricanduva','2026-10-04','Domingo','RH Aricanduva','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Pirueta','2026-10-04','Domingo','Pirueta','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Jecilda','Ri Happy Uniao','2026-10-04','Domingo','RH União','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Eurípedes','Pirueta Tateno','2026-10-04','Domingo','Pirueta Tateno','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Armarinhos Fernando','2026-10-04','Domingo','Fernando','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Americanas Interlagos','2026-10-04','Domingo','Ame Interlagos','Visita dos Promotores -28.09 a 04.10.26.xlsx'),
  ('Gabriela','Ri Happy Interlagos','2026-10-04','Domingo','RH Interlagos','Visita dos Promotores -28.09 a 04.10.26.xlsx')
)
insert into public.tm_visits (promoter_id,store_id,visit_date,weekday,raw_store_name,source_file)
select p.id, s.id, v.d::date, v.wd, v.raw, v.src
from v join public.tm_promoters p on p.name = v.prom
left join public.tm_stores s on s.name = v.canon;

commit;

-- conferencia
select source_file, count(*) visitas, count(*) filter (where store_id is null) sem_loja
from public.tm_visits where source_file like 'Visita dos Promotores -%' group by 1 order by 1;
