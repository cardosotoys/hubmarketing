-- Cardoso Marketing Hub — Biblioteca real (pastas e links editáveis)
-- Roda uma vez no SQL Editor, depois de 0001/0002/0003/0004.

create table public.library_folders (
  id uuid primary key default gen_random_uuid(),
  drive text not null check (drive in ('cardoso', 'playmi', 'topi')),
  parent_id uuid references public.library_folders (id) on delete cascade,
  name text not null,
  note text not null default '',
  position integer not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.library_folders (drive);
create index on public.library_folders (parent_id);

create table public.library_links (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.library_folders (id) on delete cascade,
  name text not null,
  url text not null,
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.library_links (folder_id);

alter table public.library_folders enable row level security;
create policy "library_folders_select_authenticated" on public.library_folders for select to authenticated using (true);
create policy "library_folders_insert_authenticated" on public.library_folders for insert to authenticated with check (true);
create policy "library_folders_update_authenticated" on public.library_folders for update to authenticated using (true);
create policy "library_folders_delete_authenticated" on public.library_folders for delete to authenticated using (true);

alter table public.library_links enable row level security;
create policy "library_links_select_authenticated" on public.library_links for select to authenticated using (true);
create policy "library_links_insert_authenticated" on public.library_links for insert to authenticated with check (true);
create policy "library_links_delete_authenticated" on public.library_links for delete to authenticated using (true);

-- Árvore inicial, espelhando os guias oficiais de Governança de Arquivos (v1.0, jul/2026)
insert into public.library_folders (id, drive, parent_id, name, note, position) values
('da72f6c7-f2e4-495e-9988-f34ad68c408d', 'cardoso', null, 'Branding', '', 0),
('7dcf28dd-ca29-4633-aa73-ad15ec7cd1a3', 'cardoso', 'da72f6c7-f2e4-495e-9988-f34ad68c408d', 'Guideline, Tipografia, Logo', '', 0),
('c8a47ff6-eef0-4024-bc96-7bcf05b86be2', 'cardoso', 'da72f6c7-f2e4-495e-9988-f34ad68c408d', 'Aplicações da Marca', 'templates, assinaturas, cartões, wallpapers, redes sociais', 1),
('6e16a45a-a0a0-4623-8dda-a81122809122', 'cardoso', 'c8a47ff6-eef0-4024-bc96-7bcf05b86be2', 'Apresentações - Template', '', 0),
('12eede14-2e9a-4879-9105-371431cfd4e5', 'cardoso', 'c8a47ff6-eef0-4024-bc96-7bcf05b86be2', 'Assinaturas de Email', '', 1),
('e7d1284d-6baa-4fe7-88e2-97755da557ea', 'cardoso', 'c8a47ff6-eef0-4024-bc96-7bcf05b86be2', 'Cartões de Visita', '', 2),
('e7e6ad42-d9b2-4625-a1c0-c6244ad31116', 'cardoso', 'c8a47ff6-eef0-4024-bc96-7bcf05b86be2', 'Papelaria', 'atalho para Documentos', 3),
('2e0c6398-3dc9-4c6d-9e3f-9dd8a73ce6a4', 'cardoso', 'c8a47ff6-eef0-4024-bc96-7bcf05b86be2', 'Wallpapers (Zoom/Teams)', '', 4),
('2fe3eac0-4127-498e-afa8-e73e0faeeff6', 'cardoso', 'c8a47ff6-eef0-4024-bc96-7bcf05b86be2', 'Redes Sociais', 'Facebook, Instagram, LinkedIn, YouTube', 5),
('3d6ed597-fbff-46fe-8b3a-48663f19b6b3', 'cardoso', '2fe3eac0-4127-498e-afa8-e73e0faeeff6', 'Fotos de Perfil', '', 0),
('c0f50545-f263-4f6e-8b5e-fbc7b570d092', 'cardoso', '2fe3eac0-4127-498e-afa8-e73e0faeeff6', 'Capas', '', 1),
('5e44b6b6-904a-433a-a65d-3828e1c03bf4', 'cardoso', null, 'Documentos', '', 1),
('0e3f553f-e6cb-45f7-81a1-012df84bbcf7', 'cardoso', '5e44b6b6-904a-433a-a65d-3828e1c03bf4', 'Apresentação Institucional', '', 0),
('2727855a-1108-4204-a9da-701bd4abe202', 'cardoso', '5e44b6b6-904a-433a-a65d-3828e1c03bf4', 'Atas de Reunião', '', 1),
('dcd3ca6d-c42f-4bbd-ab96-92eae6ac5923', 'cardoso', '5e44b6b6-904a-433a-a65d-3828e1c03bf4', 'Modelos Contratos e Termos', '', 2),
('03afdcc3-d3e1-4395-ae9b-9fd4922e3f3c', 'cardoso', '5e44b6b6-904a-433a-a65d-3828e1c03bf4', 'Papelaria', '', 3),
('cd8b2e9c-170d-41dc-9086-7805dca9550e', 'cardoso', '5e44b6b6-904a-433a-a65d-3828e1c03bf4', 'Processos e SOPs', '', 4),
('d4677123-1c57-4c3f-a7f7-5e4e05359521', 'cardoso', '5e44b6b6-904a-433a-a65d-3828e1c03bf4', 'Fornecedores e Agências', '', 5),
('44c4d9b9-0ad1-4977-aef1-0d928475b08d', 'cardoso', null, 'Financeiro', 'acesso restrito', 2),
('aa916356-5ef4-43fe-bcba-4a090963e11c', 'cardoso', '44c4d9b9-0ad1-4977-aef1-0d928475b08d', 'Notas Fiscais', '', 0),
('809f149c-a61d-4562-a501-04ba440728d4', 'cardoso', 'aa916356-5ef4-43fe-bcba-4a090963e11c', '[Ano] › [Mês]', '', 0),
('7562a227-ccd1-466f-8d99-ce8fa087a7ca', 'cardoso', '44c4d9b9-0ad1-4977-aef1-0d928475b08d', 'Boletos', '', 1),
('6281a728-93c8-4b9a-b813-cbbb35daa27c', 'cardoso', '7562a227-ccd1-466f-8d99-ce8fa087a7ca', '[Ano] › [Mês]', '', 0),
('bab72e19-c40f-4334-bd0c-f29261163f51', 'cardoso', '44c4d9b9-0ad1-4977-aef1-0d928475b08d', 'Comprovantes Pagamento', '', 2),
('c99e99ae-8f9f-4efe-bd95-ff9639dcea1d', 'cardoso', 'bab72e19-c40f-4334-bd0c-f29261163f51', '[Ano] › [Mês]', '', 0),
('5e3a1752-7d12-4451-9c22-c4d76524db85', 'cardoso', null, 'Redes Sociais', 'institucional, por etapa de produção', 3),
('931c3b96-56c9-4b5a-bf34-5272f3e2ef9c', 'cardoso', '5e3a1752-7d12-4451-9c22-c4d76524db85', 'Influenciadores / UGC', '', 0),
('ebb4645f-cdab-450b-993d-a75575170d91', 'cardoso', '5e3a1752-7d12-4451-9c22-c4d76524db85', 'Material Coletado', '', 1),
('2dd5dadb-af99-4aca-ac4a-61c1833f376d', 'cardoso', '5e3a1752-7d12-4451-9c22-c4d76524db85', 'Material Finalizado', '', 2),
('bd3821fb-b167-4b38-b4ab-23e0e2986193', 'cardoso', '5e3a1752-7d12-4451-9c22-c4d76524db85', 'Material IA', '', 3),
('8e7d80da-c382-4d71-816b-6a3cdb3cba37', 'cardoso', null, 'Orçamentos', '', 4),
('687463fc-dfd7-41f3-863d-64a96b15171b', 'cardoso', '8e7d80da-c382-4d71-816b-6a3cdb3cba37', 'Mídia Paga', '', 0),
('2abb216f-9a72-46c4-a84e-357c496640ee', 'cardoso', '8e7d80da-c382-4d71-816b-6a3cdb3cba37', 'Eventos', '', 1),
('f00deba5-30b1-456c-9e7c-d25f6e3406bb', 'cardoso', '2abb216f-9a72-46c4-a84e-357c496640ee', 'ABRIN 2027', '', 0),
('c7c28ecc-f0f3-43a7-a1f7-01a602269309', 'cardoso', '2abb216f-9a72-46c4-a84e-357c496640ee', 'Dia das Crianças', '', 1),
('52545423-1e20-42cd-a998-b4d7218e904d', 'cardoso', '2abb216f-9a72-46c4-a84e-357c496640ee', 'Natal', '', 2),
('812ae090-6bdf-4204-8fb6-36b804db59a2', 'cardoso', null, 'Projetos', '', 5),
('ca3a38d4-bfad-4df0-a038-2d641838a10d', 'cardoso', '812ae090-6bdf-4204-8fb6-36b804db59a2', '[Nome do Projeto]', 'ex.: Dia das Crianças, ABRIN', 0),
('07d46b44-c7d5-4a80-8aba-56b1f6634b17', 'cardoso', 'ca3a38d4-bfad-4df0-a038-2d641838a10d', 'Atas e Reuniões', '', 0),
('ce36223b-403b-47b6-b999-63117d17cad4', 'cardoso', 'ca3a38d4-bfad-4df0-a038-2d641838a10d', 'Material Finalizado', '', 1),
('9fecd241-b067-4631-b190-35811718a408', 'cardoso', 'ca3a38d4-bfad-4df0-a038-2d641838a10d', 'Orçamentos', 'atalho para Orçamentos › Eventos', 2),
('b57c4618-b368-46c2-a0c9-bd4112886837', 'cardoso', null, 'Relatórios', '', 6),
('9aebb677-346a-4fa8-b941-f382f9e5269c', 'cardoso', 'b57c4618-b368-46c2-a0c9-bd4112886837', 'Financeiro', '', 0),
('e2bc9653-b777-4c13-a22a-2fe086682605', 'cardoso', 'b57c4618-b368-46c2-a0c9-bd4112886837', 'GA4', '', 1),
('7b576af4-ccc5-4cd1-af44-99993f33ddf6', 'cardoso', 'b57c4618-b368-46c2-a0c9-bd4112886837', 'Google Ads', '', 2),
('ef720dc6-e377-4af6-a670-bebae326f6f5', 'cardoso', 'b57c4618-b368-46c2-a0c9-bd4112886837', 'Performance e Indicadores (KPIs)', '', 3),
('ff45c68e-a586-417a-ae6d-f73c805e9132', 'cardoso', 'b57c4618-b368-46c2-a0c9-bd4112886837', 'Redes Sociais', '', 4),
('81bf531a-6a94-4799-81c7-3a0630f7cd39', 'cardoso', null, 'Certificação', 'restrito · estrutura proposta', 7),
('f1705409-ff9a-44e0-8281-c7847cd59b13', 'cardoso', '81bf531a-6a94-4799-81c7-3a0630f7cd39', '[REF + Nome do Produto]', '', 0),
('eeb9df40-f955-4a3d-882b-3922e81586b1', 'cardoso', 'f1705409-ff9a-44e0-8281-c7847cd59b13', 'Certificado de Segurança', 'ex.: INMETRO', 0),
('d1ef87b4-b85d-4536-ae5c-59b8424e3678', 'cardoso', 'f1705409-ff9a-44e0-8281-c7847cd59b13', 'Laudos de Ensaio', '', 1),
('e56bd06f-2443-405a-96b6-2b99cf836ecf', 'cardoso', 'f1705409-ff9a-44e0-8281-c7847cd59b13', 'Certificações Internacionais', '', 2),
('3a53b2b7-d62b-412c-a0de-4bb9d170d3b8', 'cardoso', null, 'Documentos de Apoio', 'estrutura proposta', 8),
('ede3b633-e967-4189-a3be-13d5a3f218e1', 'cardoso', '3a53b2b7-d62b-412c-a0de-4bb9d170d3b8', 'Manuais e Templates', '', 0),
('15c54d97-e333-4255-9897-4f578ae9ad71', 'cardoso', '3a53b2b7-d62b-412c-a0de-4bb9d170d3b8', 'Planilhas de Controle', '', 1),
('67ab4599-56b0-47cf-a26b-f628cf88775e', 'cardoso', '3a53b2b7-d62b-412c-a0de-4bb9d170d3b8', 'Referências de Mercado', '', 2),
('3875da63-b583-45cb-b6fc-7c0a41ad4187', 'cardoso', null, 'Embalagens', 'multimarca — arte de design entregue à gráfica', 9),
('3209d921-3305-4af8-ac9e-ac31d371201a', 'cardoso', '3875da63-b583-45cb-b6fc-7c0a41ad4187', 'PLAYMI', '', 0),
('17535171-c0b8-40b0-8ba7-792a90bff2a5', 'cardoso', '3209d921-3305-4af8-ac9e-ac31d371201a', '[Linha]', 'Play&Drive, Ride, Learn, Imagine, Collect, Molto', 0),
('8b911d25-e680-4485-9bc6-8dc2ff51d41c', 'cardoso', '17535171-c0b8-40b0-8ba7-792a90bff2a5', '[REF + Nome do Produto]', '', 0),
('065a4fc4-d7ff-4e6b-a298-4373c63ca25f', 'cardoso', '8b911d25-e680-4485-9bc6-8dc2ff51d41c', 'Litografia', '', 0),
('4769fb73-1796-4a7b-8a3d-e9ed67068e3f', 'cardoso', '8b911d25-e680-4485-9bc6-8dc2ff51d41c', 'Adesivo Decorativo', '', 1),
('cb6a0d32-f6f6-4155-aace-a692b335e4a2', 'cardoso', '8b911d25-e680-4485-9bc6-8dc2ff51d41c', 'Etiqueta Técnica', '', 2),
('1e8e88dd-d995-4526-979a-5a63f1c1302f', 'cardoso', '8b911d25-e680-4485-9bc6-8dc2ff51d41c', 'Caixa de Transporte', '', 3),
('0da14ba0-0f50-4f08-9850-e99c87f7111b', 'cardoso', '3875da63-b583-45cb-b6fc-7c0a41ad4187', 'TÓPI', 'mesma subestrutura, por categoria', 1),
('f4667dbc-f6b5-4ff6-bcc0-0ba217ddc549', 'cardoso', '3875da63-b583-45cb-b6fc-7c0a41ad4187', 'CHINA 2027', 'mesma subestrutura, sem agrupamento por linha', 2),
('8eab5bd3-19cf-45ae-851a-72fc260e5fd6', 'cardoso', null, 'Facas', 'multimarca — moldes de corte (dielines)', 10),
('c69e87e5-c02b-40e0-91a4-37ca0913de5e', 'cardoso', '8eab5bd3-19cf-45ae-851a-72fc260e5fd6', 'Playmi', '', 0),
('060f94f0-f26f-4bbc-8666-aaac06c0e781', 'cardoso', 'c69e87e5-c02b-40e0-91a4-37ca0913de5e', '[Linha]', '', 0),
('3002a05d-2b0f-487a-8787-d1dc1b2686a7', 'cardoso', '060f94f0-f26f-4bbc-8666-aaac06c0e781', '[REF + Nome do Produto]', 'arquivo(s), sem subpastas', 0),
('0eca1c52-de2e-4979-94fa-c287568f3071', 'cardoso', '8eab5bd3-19cf-45ae-851a-72fc260e5fd6', 'Tópi', 'mesma subestrutura, por categoria', 1),
('8ecbefdf-0811-4134-a944-2324b0ccaa89', 'playmi', null, 'Branding', '', 0),
('34da1622-59ba-4776-9789-92ab2d965106', 'playmi', '8ecbefdf-0811-4134-a944-2324b0ccaa89', 'Guideline, Tipografia, Logo', '', 0),
('b837faf5-cfb4-425b-854f-a7da4338355b', 'playmi', '8ecbefdf-0811-4134-a944-2324b0ccaa89', 'Aplicações da Marca', 'templates, assinaturas, cartões, wallpapers, redes sociais', 1),
('9db98ba8-49e6-4934-9d18-5967295608dc', 'playmi', null, 'Licenciados', 'uma pasta por personagem — Smurfs, Galinha Pintadinha, Spidey, Disney, Bluey, Luna, Pocoyo…', 1),
('705cfe40-c2b0-46a2-9b60-37c5002dcbe0', 'playmi', null, 'Documentos', 'catálogo, apresentações, atas, contratos, papelaria', 2),
('67ac6647-f382-429c-ae33-172f42b39c6b', 'playmi', null, 'Produtos', '', 3),
('6e87c306-1550-4947-b155-a0ba724dc0af', 'playmi', '67ac6647-f382-429c-ae33-172f42b39c6b', '[Linha Playmi]', 'Play&Drive · Ride · Learn · Imagine · Collect · Molto', 0),
('5810403c-83f0-4a8c-87f3-0956d4aabf8c', 'playmi', '6e87c306-1550-4947-b155-a0ba724dc0af', '[Nome do Produto]', 'ficha técnica, imagens, vídeos', 0),
('ca376027-9ee2-46be-9e9c-10e2c0e379b7', 'playmi', null, 'Redes Sociais', 'influenciadores/UGC, material coletado e finalizado', 4),
('e9433b4a-230d-47a9-8c9a-b687ae9d1077', 'playmi', null, 'Área Comercial', 'comunicados, postagens comerciais, arquivos', 5),
('46847892-024f-481b-a337-b2458879e380', 'playmi', null, 'Relatórios', 'financeiro, GA4, Google Ads, KPIs, redes sociais', 6),
('fce935f1-8f4d-4f68-b6cd-219d911633d3', 'topi', null, 'Branding', '', 0),
('ffa73956-00de-4d22-bd27-9c47af1bfa49', 'topi', 'fce935f1-8f4d-4f68-b6cd-219d911633d3', 'Guideline, Tipografia, Logo', '', 0),
('11ff52c9-5e46-44f6-8d8f-87422ec10bfc', 'topi', 'fce935f1-8f4d-4f68-b6cd-219d911633d3', 'Aplicações da Marca', 'templates, assinaturas, cartões, wallpapers, redes sociais', 1),
('c41bc8f1-7a4d-447d-b499-5f50ffb8c721', 'topi', null, 'Documentos', 'catálogo, apresentações, atas, contratos, papelaria', 1),
('dfd5920c-4657-47dd-a43e-0412e33f9fc8', 'topi', null, 'Produtos', '', 2),
('e7b07bfe-297a-48d9-8400-e5c5a5ce0c84', 'topi', 'dfd5920c-4657-47dd-a43e-0412e33f9fc8', '[Categoria]', 'Ar Livre · Faz de Conta · Roda Livre · Primeira Infância · Jogos · Solapas', 0),
('8e3019c5-6499-4f44-9a15-7dd59d3dc617', 'topi', 'e7b07bfe-297a-48d9-8400-e5c5a5ce0c84', '[Nome do Produto]', 'ficha técnica, imagens, vídeos', 0),
('76f4c4ae-fb3e-4828-a2c3-4a1cfcefa79d', 'topi', null, 'Redes Sociais', 'influenciadores/UGC, material coletado e finalizado', 3),
('8a83a472-2086-4862-8a2f-8c128f4b9a83', 'topi', null, 'Área Comercial', 'comunicados, postagens comerciais, arquivos', 4),
('f26f57bc-5598-4943-9ac5-ead4e1eb6eae', 'topi', null, 'Relatórios', 'financeiro, GA4, Google Ads, KPIs, redes sociais', 5);
