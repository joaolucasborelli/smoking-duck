"""Pede um lote de capas à função `capas` em 2 metades (para caber no limite de 150 s) e salva o JSON.
Uso: python gerar_lote.py lote2 refs.json saida.json
"""
import json, sys, time
import robo

robo.URL = "https://odwbspgnxwcqmbcegkhw.supabase.co/functions/v1/capas"
lote, refs_arq, saida = sys.argv[1], sys.argv[2], sys.argv[3]
refs = json.load(open(refs_arq, encoding="utf-8"))

FEEDBACK = """09/11 — o dono viu o lote 1 (20 capas) e disse:
- Achou muito bom, nota alta no geral. O MAIS IMPORTANTE é a expressão do rosto: muito realista e de acordo com o momento exato da foto (ex.: a filha vendo a mãe largar 9 itens no caixa NÃO chora muito; olha com tristeza tentando esconder da mãe, olhar de dó, querendo chorar; a mãe com cara difícil).
- Quer MARCAS FAMOSAS na cena (ex.: a mãe segurando um Danoninho). Vale para todas as capas, não só uma: as pessoas param para ver gente usando marcas.
- Achou que o lote 1 explorou só 2 tipos de capa. Quer muito mais variedade: comparação cortada ao meio, rosto de famoso (como as páginas grandes de IA: foto de famoso + manchete em caixa alta + perfil no divisor), print de tweet com foto, ilustração, produto.
- Nas capas de frase com fundo de foto, a foto tem que ser MUITO forte (o lote 1 ficou escuro e apagado).
- Para se diferenciar no meio de milhões de posts: rosto de famoso, marcas famosas, assuntos do momento, expressões fiéis ao momento, ultra-realismo. As pessoas precisam se identificar.
- NOTA MÁXIMA (09/11, "muito foda, nota 100000000000000 de detalhamento"): a capa do David Vélez — portal caixa alta "EM 2013, DAVID VÉLEZ CRIOU O NUBANK APÓS ENFRENTAR A BUROCRACIA DOS BANCOS", ano em amarelo, ele sério com papéis do banco, cartão roxo do Nubank GIGANTE ao lado, ícones 3D do app flutuando, fila de banco ao fundo. Faça mais capas com esse nível de detalhe: fato real + marca gigante + objetos-símbolo + cenário que conta a história."""

METADES = [
    ["capa_perfil|famoso", "capa_perfil|ilustracao", "capa_comparacao|foto_real", "capa_comparacao|foto_real", "capa_tweet|foto_real",
     "capa_f1|foto_real", "capa_f1b|famoso", "capa_f3a|foto_real", "capa_f3b|foto_real", "capa_perfil|produto"],
    ["capa_perfil|famoso", "capa_f1b|foto_real", "capa_comparacao|famoso", "capa_tweet|foto_real", "capa_f1|foto_real",
     "capa_f1|foto_real", "capa_f3a|foto_real", "capa_f3b|foto_real", "capa_perfil|ilustracao", "capa_comparacao|foto_real"],
]
todas = []
for i, slots in enumerate(METADES):
    t = time.time()
    r = robo.chamar({"acao": "lote", "lote": lote, "inicio": 1 + 10 * i, "slots": slots, "referencias": refs, "feedback": FEEDBACK}, timeout=300)
    print(f"metade {i+1}: ok={r.get('ok')} {r.get('erro') or ''} {len(r.get('capas') or [])} capas em {time.time()-t:.0f}s", flush=True)
    if not r.get("ok"):
        sys.exit(1)
    todas += r["capas"]
json.dump({"capas": todas}, open(saida, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for c in sorted(todas, key=lambda c: c["ordem"]):
    ex = c.get("extra") or {}
    print(f"{c['ordem']:02d} {c['molde']:16s} {ex.get('estilo',''):10s} {c['texto'][:90]} | famoso={ex.get('famoso','')} | marca={ex.get('marca','')}")
    if ex.get("fato"):
        print(f"     FATO: {ex['fato']}")
