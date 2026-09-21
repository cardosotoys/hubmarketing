# -*- coding: utf-8 -*-
"""Cruza as fontes oficiais da Cardoso e monta a base de conhecimento dos 315
produtos. Chave: o codigo do produto (nunca so o nome).

Nada e inventado. A descricao proposta e a primeira frase do texto oficial do
site, literal. Os diferenciais sao os termos da taxonomia de caracteristicas do
site, literais. O que o site chama de "Beneficios do produto" fica num campo
separado, porque e texto generico de marketing e merece decisao humana."""
import csv, json, re

def norm_codigo(c):
    return re.sub(r'^0+', '', str(c).split(' - ')[0].strip()) or '0'

def esp(t):
    return re.sub(r'\s+', ' ', (t or '')).strip()

def chave_nome(t):
    t = esp(t).lower()
    t = re.sub(r'\((licenciado|sem embalagem|na rede|no filme)\)', ' ', t)
    t = t.replace('–', ' ').replace('-', ' ').replace('.', ' ')
    t = re.sub(r'[^a-z0-9áàâãéêíóôõúüç ]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()

def primeira_frase(t, minimo=60, maximo=320):
    t = esp(t)
    if not t: return ''
    acc = ''
    for f in re.split(r'(?<=[.!?])\s+', t):
        cand = (acc + ' ' + f).strip() if acc else f
        if len(cand) > maximo and acc: break
        acc = cand
        if len(acc) >= minimo: break
    return acc.strip()

so_num = lambda x: re.sub(r'\D', '', x or '')

catalogo = {l['codigo']: l for l in csv.DictReader(
    open("/Users/aldairbras/Desktop/cardoso-marketing-hub/produtos_catalogo_2026.csv", encoding="utf-8"))}
ficha   = json.load(open("ficha_completa.json"))
site    = json.load(open("site_extraido.json"))
hubdesc = json.load(open("hub_descricoes.json"))
catjson = {p['codigo']: p for p in json.load(open("catalogo_crm.json"))}

site_por_ref = {}
for s in site:
    if s.get('erro') or not s.get('ref'): continue
    site_por_ref.setdefault(norm_codigo(s['ref']), []).append(s)

def sem_acento(t):
    import unicodedata
    t = unicodedata.normalize('NFKD', (t or '').lower())
    return ''.join(c for c in t if not unicodedata.combining(c))

def e_especifica(desc, nome):
    """Descricao que cita o proprio produto, um numero ou o que acompanha vale
    para a vitrine. So verbo de desenvolvimento ('estimula a criatividade') nao
    diferencia nada e precisa de mao humana."""
    d = sem_acento(desc)
    if not d: return False
    if any(w in d for w in [w for w in sem_acento(nome).split() if len(w) > 3]): return True
    if re.search(r'\d', d): return True
    return bool(re.search(r'\b(acompanha|vem com|possui|contem|conjunto com|inclui|com \w+ pecas)\b', d))

E_IDADE = re.compile(r'^\s*\+?\s*\d+\s*(anos?|meses|m)\s*$|^para maiores de|^a partir de', re.I)

base, conflitos, ruido_catalogo = [], [], []
for codigo in sorted(catalogo, key=lambda c: (norm_codigo(c).zfill(6), c)):
    n = norm_codigo(codigo)
    f, cat, cj = ficha.get(n, {}), catalogo[codigo], catjson.get(codigo, {})
    achados = site_por_ref.get(n, [])
    s = achados[0] if achados else None
    nome = esp(f.get('cadastro') or cat.get('nome'))

    # ---------------------------------------------------------- descricao
    desc_atual = hubdesc.get(codigo, '')
    texto_site = esp(s['descricao_site']) if s else ''
    if s and not texto_site:
        texto_site = esp(s.get('descricao_yoast'))
    desc_prop = primeira_frase(texto_site) if texto_site else ''
    if desc_prop:
        conf_desc = 'CONFIRMADO' if desc_prop in texto_site else 'PROPOSTO'
        fonte_desc = s['link']
    else:
        conf_desc, fonte_desc = 'NAO_ENCONTRADO', ''

    # ---------------------------------------------------- diferenciais
    difs = []
    if s:
        for c in s.get('caracteristicas') or []:
            c = esp(c)
            if c and not E_IDADE.match(c) and c.lower() not in [d.lower() for d in difs]:
                difs.append(c)
    difs = difs[:6]
    beneficios = [esp(b) for b in (s.get('beneficios') or [])] if s else []
    beneficios = [b for b in beneficios
                  if b and not b.lower().startswith('benef') and not E_IDADE.match(b)
                  and not re.match(r'^(indicado|ideal) para\s*\+?\s*\d', b, re.I)][:6]

    # ------------------------------------------------------------ tecnico
    tec = {
        'ean': f.get('ean',''), 'dun': f.get('dun',''), 'ncm': f.get('ncm',''), 'cst': f.get('cst',''),
        'inmetro': '', 'idade': f.get('idade',''), 'genero': f.get('genero',''),
        'material': f.get('material',''), 'cor': f.get('cor',''), 'conteudo_caixa': f.get('conteudo',''),
        'medidas_produto_mm': [f.get('prod_c',''), f.get('prod_l',''), f.get('prod_a','')],
        'peso_produto_kg': f.get('prod_peso',''),
        'medidas_embalagem_mm': [f.get('emb_c',''), f.get('emb_l',''), f.get('emb_a','')],
        'peso_embalagem_kg': f.get('emb_peso',''),
        'caixa_master': {'quantidade': f.get('cx_qtd',''), 'peso_bruto_kg': f.get('cx_peso','')},
        'paletizacao': {'lastro': f.get('pal_lastro',''), 'altura_m': f.get('pal_alt',''), 'caixas': f.get('pal_qtd','')},
        'mecanismo': f.get('mecanismo',''), 'som': f.get('som',''), 'luz': f.get('luz',''),
        'bateria': f.get('bateria',''), 'peso_suportado': f.get('peso_suportado',''),
        'categoria': f.get('categoria',''), 'sub_categoria': f.get('sub',''),
        'nome_tecnico': f.get('tecnico',''), 'nome_antigo': f.get('nome_antigo',''),
        'nome_embalagem': f.get('emb_nome',''), 'embalagem_catalogo': esp(cj.get('embalagem','')),
    }
    if s and s.get('tecnico'): tec['do_site'] = s['tecnico']

    # --------------------------------------------------------- conflitos
    if s:
        if chave_nome(s['nome_site']) != chave_nome(nome):
            conflitos.append({'codigo': codigo, 'campo': 'nome', 'ficha_tecnica': nome, 'site': esp(s['nome_site'])})
        if s.get('ean_site') and f.get('ean') and so_num(s['ean_site']) != so_num(f['ean']):
            conflitos.append({'codigo': codigo, 'campo': 'ean', 'ficha_tecnica': f['ean'], 'site': s['ean_site']})
        if s.get('ref_alt') and norm_codigo(s['ref_alt']) != n:
            conflitos.append({'codigo': codigo, 'campo': 'referencia_na_pagina',
                              'ficha_tecnica': n, 'site': s['ref_alt']})
    if esp(cat.get('nome','')) and chave_nome(cat['nome']) != chave_nome(nome):
        ruido_catalogo.append({'codigo': codigo, 'ficha_tecnica': nome, 'catalogo_2026': esp(cat['nome'])})

    base.append({
        'codigo': codigo,
        'nome': nome,
        'marca': esp(f.get('marca','')).lower() or esp(cat.get('marca','')),
        'linha': esp(f.get('linha') or f.get('categoria') or ''),
        'descricao_atual': desc_atual,
        'descricao_proposta': desc_prop,
        'diferenciais_propostos': difs,
        'beneficios_site': beneficios,
        'indicado_para': esp(s.get('indicado_para','')) if s else '',
        'descricao_site_integral': texto_site,
        'dados_tecnicos': tec,
        'fontes': {
            'nome': 'FICHA TECNICA 2026 — coluna NOME DO PRODUTO ATUAL - CADASTRO',
            'descricao_proposta': fonte_desc or '(sem fonte)',
            'diferenciais_propostos': s['link'] if difs else '(sem fonte)',
            'beneficios_site': s['link'] if beneficios else '(sem fonte)',
            'dados_tecnicos': 'FICHA TECNICA 2026' + (' + site oficial' if s and s.get('tecnico') else ''),
            'descricao_atual': 'public.products.description (Hub)' if desc_atual else '(vazia)',
        },
        'nivel_confianca': {
            'descricao_proposta': conf_desc,
            'diferenciais_propostos': 'CONFIRMADO' if difs else 'NAO_ENCONTRADO',
            'beneficios_site': 'CONFIRMADO' if beneficios else 'NAO_ENCONTRADO',
            'dados_tecnicos': 'CONSOLIDADO' if (f and s and s.get('tecnico')) else ('CONFIRMADO' if f else 'NAO_ENCONTRADO'),
            'nome': 'CONSOLIDADO' if (s and chave_nome(s['nome_site']) == chave_nome(nome)) else 'CONFIRMADO',
        },
        'qualidade_descricao': ('' if not desc_prop else
                                ('ESPECIFICA' if e_especifica(desc_prop, nome) else 'GENERICA')),
        'status_revisao': 'PENDENTE',
        'observacao': 'DESCRICAO_EXISTENTE — preservada, nao substituir' if desc_atual else '',
    })

json.dump(base, open("base_conhecimento.json","w"), ensure_ascii=False, indent=1)
json.dump(conflitos, open("conflitos.json","w"), ensure_ascii=False, indent=1)
json.dump(ruido_catalogo, open("ruido_catalogo.json","w"), ensure_ascii=False, indent=1)

print("PRODUTOS:", len(base))
print("  descricao proposta .........", sum(1 for b in base if b['descricao_proposta']))
print("  descricao existente (Hub) ..", sum(1 for b in base if b['descricao_atual']))
print("  sem descricao nenhuma ......", sum(1 for b in base if not b['descricao_proposta'] and not b['descricao_atual']))
print("  diferenciais concretos .....", sum(1 for b in base if b['diferenciais_propostos']))
print("  beneficios do site .........", sum(1 for b in base if b['beneficios_site']))
print("  casaram com o site .........", sum(1 for b in base if b['fontes']['descricao_proposta'] != '(sem fonte)'))
print("CONFLITOS reais:", len(conflitos), {c: sum(1 for x in conflitos if x['campo']==c) for c in {x['campo'] for x in conflitos}})
print("  descricao ESPECIFICA .......", sum(1 for b in base if b['qualidade_descricao']=='ESPECIFICA'))
print("  descricao GENERICA .........", sum(1 for b in base if b['qualidade_descricao']=='GENERICA'))
print("RUIDO do catalogo (nome com texto colado):", len(ruido_catalogo))
