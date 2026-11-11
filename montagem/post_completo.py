"""Post completo: roteiro já diagramado (gpt-5.5) -> capa com foto fiel -> fotos do miolo com a MESMA pessoa -> slides.
Uso: python post_completo.py pedidos.json pasta_saida
pedidos.json = [{"nome": "p1", "tipo": "historia", "persona": "mulher", "molde_capa": "capa_f1", "estilo": "foto_real", "tema": "..."}]
"""
import json, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import robo
from foto_fiel import foto_fiel, CAPAS, MONTADOR
from render import renderizar

pedidos = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
saida = Path(sys.argv[2]).resolve(); saida.mkdir(parents=True, exist_ok=True)
FEEDBACK = ("Expressão contida e fiel ao momento; foto bate 100% com o texto; marcas famosas na cena; ultra-realismo; "
            "variedade de moldes no miolo; storytelling com gatilhos; oferta disfarçada no fim com PLANNER.")


def chamar(url, corpo, timeout=220):
    return robo.chamar(corpo, timeout=timeout, url=url)


def um(p):
    t0 = time.time(); log = []; nome = p["nome"]; pasta = saida / nome; pasta.mkdir(exist_ok=True)
    r = chamar(CAPAS, {"acao": "post_completo", **{k: v for k, v in p.items() if k != "nome"}, "feedback": FEEDBACK, "esforco": "low"})
    if not r.get("ok"):
        return nome, [f"ERRO roteiro: {r}"]
    post = r["post"]; (pasta / "roteiro.json").write_text(json.dumps(post, ensure_ascii=False, indent=1), encoding="utf-8")
    capa = post["capa"]; pers = post["personagem"]
    vertical = capa["molde"] in ("capa_f3a", "capa_f3b")
    ideia = capa["foto_prompt"] + (f" Main character: {pers}." if pers else "") + (f" Famous person: {capa['famoso']} (fact: {capa['fato']})." if capa.get("famoso") else "")
    ff = foto_fiel(capa["texto"], capa["molde"], ideia, f"posts_teste/{nome}/capa", vertical=vertical, log=lambda *_: None)
    log.append(f"capa {capa['molde']}/{capa['estilo']} nota {ff['nota']}")
    robo.baixar(ff["melhor"], pasta / "capa.png")
    fotos_extra = []
    if capa["molde"] == "capa_tweet2" or capa["molde"] == "capa_tweet":
        pass
    # fotos do miolo. Capa de famoso: o famoso NUNCA vira referência para cenas inventadas (o protagonista é anônimo).
    capa_famosa = capa.get("estilo", "").startswith("famoso")
    def foto_slide(i, s):
        if not s.get("foto_prompt"):
            return i, None
        dest = f"posts_teste/{nome}/s{i:02d}.png"
        if s.get("mesma_pessoa") and pers and not capa_famosa:
            e = chamar(CAPAS, {"acao": "editar", "caminho": ff["melhor"], "destino": dest,
                               "instrucao": f"Use the person from the reference photo as the same character ({pers}); keep the face and identity identical. "
                                            f"Create a new photo of a different moment: {s['foto_prompt']} Natural, understated expression. Full-bleed photo, no text, no borders."})
            ok = e.get("ok")
        else:
            g = chamar(MONTADOR, {"acao": "imagem", "prompt": s["foto_prompt"] + " Full-bleed photo, no text, no borders.", "caminho": dest, "size": "1536x1024", "quality": "medium"})
            ok = g.get("ok")
        if not ok:
            return i, None
        loc = pasta / f"s{i:02d}.png"; robo.baixar(dest, loc); return i, loc
    with ThreadPoolExecutor(3) as ex:
        fotos = dict(ex.map(lambda a: foto_slide(*a), enumerate(post["slides"], 2)))
    log.append(f"{sum(1 for v in fotos.values() if v)} fotos de miolo")
    # monta
    slides = [{"molde": capa["molde"], "foto": (pasta / "capa.png").as_uri(), "texto": capa["texto"], "rotulos": capa.get("rotulos")}]
    if capa["molde"] == "capa_tweet2":
        slides[0]["fotos"] = [(pasta / "capa.png").as_uri()] * 2
    for i, s in enumerate(post["slides"], 2):
        d = {k: v for k, v in s.items() if v not in ("", [], None)}
        if fotos.get(i):
            d["foto"] = fotos[i].as_uri()
        elif s["molde"] in ("esc_titulo_moldura", "esc_checklist"):
            d["foto"] = (pasta / "capa.png").as_uri()
        slides.append(d)
    feitos = renderizar(slides, pasta / "slides")
    log.append(f"{len(feitos)} slides em {time.time()-t0:.0f}s")
    return nome, log


t0 = time.time()
with ThreadPoolExecutor(4) as ex:
    for nome, log in ex.map(um, pedidos):
        print(nome, " | ".join(log), flush=True)
print(f"tudo em {time.time()-t0:.0f}s")
