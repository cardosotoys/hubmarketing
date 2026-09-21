# -*- coding: utf-8 -*-
"""Leva a base consolidada para o repositorio do Hub, em JSON (completo) e
CSV (para revisar na planilha)."""
import csv, json, os, re

DEST = "/Users/aldairbras/Desktop/cardoso-marketing-hub/base-conhecimento"
os.makedirs(DEST, exist_ok=True)

base = json.load(open("base_conhecimento.json"))
conf = json.load(open("conflitos.json"))
ruido = json.load(open("ruido_catalogo.json"))

json.dump(base, open(f"{DEST}/produtos.json", "w"), ensure_ascii=False, indent=1)

def achata(t):
    """dados tecnicos em uma linha legivel"""
    p = []
    for k in ['material','cor','genero','idade','conteudo_caixa','ncm','cst','dun']:
        v = t.get(k)
        if v and v != '-': p.append(f"{k}={v}")
    mp = [x for x in t.get('medidas_produto_mm', []) if x]
    if mp: p.append("produto_mm=" + "x".join(mp))
    cm = t.get('caixa_master', {})
    if cm.get('quantidade'): p.append(f"caixa={cm['quantidade']}un/{cm.get('peso_bruto_kg','?')}kg")
    if t.get('peso_produto_kg'): p.append(f"peso={t['peso_produto_kg']}kg")
    return " | ".join(p)

with open(f"{DEST}/produtos.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(['codigo','nome','marca','linha','descricao_atual','descricao_proposta',
                'diferenciais_propostos','beneficios_site','indicado_para','dados_tecnicos',
                'qualidade_descricao','fonte_descricao','fonte_diferenciais','confianca_descricao','confianca_diferenciais',
                'status_revisao','observacao'])
    for b in base:
        w.writerow([b['codigo'], b['nome'], b['marca'], b['linha'],
                    b['descricao_atual'], b['descricao_proposta'],
                    ' | '.join(b['diferenciais_propostos']), ' | '.join(b['beneficios_site']),
                    b['indicado_para'], achata(b['dados_tecnicos']),
                    b['qualidade_descricao'],
                    b['fontes']['descricao_proposta'], b['fontes']['diferenciais_propostos'],
                    b['nivel_confianca']['descricao_proposta'], b['nivel_confianca']['diferenciais_propostos'],
                    b['status_revisao'], b['observacao']])

with open(f"{DEST}/conflitos.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(['codigo','campo','ficha_tecnica','site'])
    for c in conf: w.writerow([c['codigo'], c['campo'], c.get('ficha_tecnica',''), c.get('site','')])

with open(f"{DEST}/catalogo_nome_com_texto_colado.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(['codigo','nome_correto_ficha','nome_no_catalogo_2026'])
    for r in ruido: w.writerow([r['codigo'], r['ficha_tecnica'], r['catalogo_2026']])

sem = [b for b in base if not b['descricao_proposta'] and not b['descricao_atual']]
with open(f"{DEST}/sem_fonte_de_conteudo.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(['codigo','nome','marca','linha','tem_diferenciais'])
    for b in sem: w.writerow([b['codigo'], b['nome'], b['marca'], b['linha'],
                              'sim' if b['diferenciais_propostos'] else 'nao'])

print("arquivos em", DEST)
for f in sorted(os.listdir(DEST)):
    print(f"  {f:44} {os.path.getsize(os.path.join(DEST,f)):>9,} bytes")
