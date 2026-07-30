-- Cardoso Marketing Hub — ficha técnica completa dos produtos
-- Roda uma vez no SQL Editor, depois de 0001..0030 já terem rodado.
--
-- A planilha real de produtos ("FICHA TÉCNICA") tem muito mais informação do que o Hub
-- rastreava: gênero, material, cor, categoria de brinquedo (distinta de "linha"), medidas
-- precisas do produto/embalagem/caixa master, dados fiscais (NCM/CST/DUN) e paletização.
-- Essa migration só adiciona os campos — o preenchimento de dado real vem na migration
-- seguinte (0032_product_data_update.sql).

alter table public.products
  add column gender text not null default '',
  add column material text not null default '',
  add column color text not null default '',
  add column toy_category text not null default '',
  add column technical_name text not null default '',
  add column has_mechanism boolean not null default false,
  add column has_sound boolean not null default false,
  add column has_light boolean not null default false,
  add column battery_type text not null default '',
  add column supported_weight text not null default '',
  -- Medidas precisas do produto (substituem gradualmente o antigo campo "dimensions" de texto livre)
  add column product_length_mm numeric,
  add column product_width_mm numeric,
  add column product_height_mm numeric,
  add column product_volume_m3 numeric,
  add column product_weight_kg numeric,
  -- Embalagem individual (a caixinha de cada unidade)
  add column package_contents text not null default '',
  add column package_length_mm numeric,
  add column package_width_mm numeric,
  add column package_height_mm numeric,
  add column package_volume_m3 numeric,
  add column package_weight_kg numeric,
  -- Fiscal
  add column ncm text not null default '',
  add column cst text not null default '',
  add column dun text not null default '',
  -- Caixa master (carton) e paletização
  add column carton_length_mm numeric,
  add column carton_width_mm numeric,
  add column carton_height_mm numeric,
  add column carton_volume_m3 numeric,
  add column carton_quantity integer,
  add column carton_gross_weight_kg numeric,
  add column pallet_layer_pattern text not null default '',
  add column pallet_height_m numeric,
  add column pallet_total_units integer;
