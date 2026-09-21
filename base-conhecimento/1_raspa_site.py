# -*- coding: utf-8 -*-
"""Raspagem ancorada: o texto do produto vive nos widgets
'elementor-widget-text-editor'. Titulos de menu (elementor-heading-title)
ficam de fora — foi de la que vinha 'Linha de primeira infancia.'"""
import json, re, html, time, urllib.request

prods = json.load(open("site_produtos.json"))
taxc  = json.load(open("tax_caracteristica.json"))

LIXO = re.compile(r'function\s*\(|document\.getElementById|\.cls-\d|©\s*20|'
                  r'Pol[íi]ticas de Privacidade|Nenhum resultado|CNPJ\s*\d|var\s+\w+\s*=', re.I)
ROTULOS = [('BENEFÍCIOS DO PRODUTO','beneficios'), ('BENEFICIOS DO PRODUTO','beneficios'),
    ('INDICADO PARA','indicado_para'), ('REFERÊNCIA','ficha_site'), ('REFERENCIA','ficha_site'),
    ('FUNCIONALIDADES','funcionalidades'), ('CONTEÚDO DA EMBALAGEM','conteudo_embalagem'),
    ('CONTEUDO DA EMBALAGEM','conteudo_embalagem'), ('DIMENSÕES DO PRODUTO','dimensoes_produto'),
    ('DIMENSOES DO PRODUTO','dimensoes_produto'), ('DIMENSÕES DA EMBALAGEM','dimensoes_embalagem'),
    ('PESO DO PRODUTO','peso_produto'), ('PESO DA EMBALAGEM','peso_embalagem'),
    ('INFORMAÇÕES FISCAIS','fiscal'), ('INFORMACOES FISCAIS','fiscal'),
    ('COMPOSIÇÃO','composicao'), ('MATERIAL','material'), ('CERTIFICAÇÃO','certificacao')]

def limpo(t):
    t = re.sub(r'<br\s*/?>', ' | ', t)
    t = re.sub(r'<[^>]+>', ' ', t)
    return re.sub(r'\s+', ' ', html.unescape(t)).strip()

def itens(t):
    return [re.sub(r'^[•\-–\s]+','',p).strip(' .') for p in re.split(r'\s*\|\s*|\s*•\s*', t)
            if len(p.strip(' .•-–')) > 3]

saida = []
for i, p in enumerate(prods):
    url = p['link']
    try:
        req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 (pesquisa interna Cardoso)'})
        with urllib.request.urlopen(req, timeout=30) as r:
            s = r.read().decode('utf-8','replace')
    except Exception as e:
        saida.append({'id': p['id'], 'link': url, 'erro': str(e)[:80]}); continue

    ref  = (re.search(r'REF\.\s*([0-9]{2,5}(?:\s*-\s*[A-Z])?)', s) or [None,''])[1].strip()
    ref2 = (re.search(r'Refer[êe]ncia\s*:?\s*([0-9]{2,5}(?:\s*-\s*[A-Z])?)', s) or [None,''])[1].strip()
    ean  = (re.search(r'EAN\s*:?\s*([0-9]{10,13}-?[0-9]?)', s) or [None,''])[1].strip()

    # SO os paragrafos dos widgets de texto
    paragrafos = []
    for bloco in re.findall(r'elementor-widget-text-editor.*?(?=elementor-widget-|</section|</footer)', s, re.S):
        for br in re.findall(r'<p[^>]*>(.*?)</p>', bloco, re.S):
            if 'elementor-heading-title' in br: continue
            t = limpo(br)
            if len(t) >= 20 and not LIXO.search(t):
                paragrafos.append(t)

    blocos, desc = {}, []
    vistos = set()
    for t in paragrafos:
        if t in vistos: continue
        vistos.add(t)
        achou = None
        for rot, chave in ROTULOS:
            if t.upper().startswith(rot):
                achou = chave; blocos[chave] = t[len(rot):].lstrip(' :|').strip(); break
        if not achou: desc.append(t)

    cars = [taxc.get(str(t),'') for t in (p.get('caracteristica') or [])]
    saida.append({'id': p['id'], 'ref': ref or ref2, 'ref_alt': ref2, 'ean_site': ean, 'link': url,
        'nome_site': limpo(p['title']['rendered']),
        'descricao_site': ' '.join(desc).strip(),
        'descricao_yoast': (p.get('yoast_head_json') or {}).get('description',''),
        'caracteristicas': [c for c in cars if c],
        'beneficios': itens(blocos.get('beneficios','')),
        'indicado_para': blocos.get('indicado_para',''),
        'tecnico': {k:v for k,v in blocos.items() if k not in ('beneficios','indicado_para')}})
    if (i+1) % 75 == 0: print(f"  {i+1}/{len(prods)}", flush=True)
    time.sleep(0.25)

json.dump(saida, open("site_extraido.json","w"), ensure_ascii=False, indent=1)
ok = [x for x in saida if not x.get('erro')]
print(f"FIM: {len(saida)} | REF {sum(1 for x in ok if x['ref'])} | descricao {sum(1 for x in ok if x['descricao_site'])} "
      f"| caracteristicas {sum(1 for x in ok if x['caracteristicas'])} | beneficios {sum(1 for x in ok if x['beneficios'])} "
      f"| erros {sum(1 for x in saida if x.get('erro'))}")
