"""Post completo com o KIT 2 (teste): roteiro (função roteiro, gpt-5.5) -> fotos certas para cada molde -> slides.
O robô do botão usa o mesmo motor em kit.py (aqui ficou a versão de teste, autocontida).
Uso: python post_kit.py pedidos.json pasta_saida
"""
import json, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import robo
from foto_fiel import foto_fiel, CAPAS, MONTADOR
from render import renderizar

ROTEIRO = "https://odwbspgnxwcqmbcegkhw.supabase.co/functions/v1/roteiro"
pedidos = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
saida = Path(sys.argv[2]).resolve(); saida.mkdir(parents=True, exist_ok=True)
FEEDBACK = "Expressão contida e fiel ao momento; foto bate 100% com o texto; marcas brasileiras na cena; ultra-realismo; muita variedade de moldes; gatilhos; PLANNER só no fim."
VERTICAIS = {"meia_tela", "foto_sticker", "fecho_foto"}
CADERNO = "assets/caderno_planner.png"


def ch(url, corpo, timeout=220):
    return robo.chamar(corpo, timeout=timeout, url=url)


def gerar(prompt, destino, vertical=False):
    g = ch(MONTADOR, {"acao": "imagem", "prompt": prompt + " Full-bleed photo, no text, no borders.", "caminho": destino,
                      "size": "1024x1536" if vertical else "1536x1024", "quality": "medium"})
    return g.get("ok")


def variar(base, destino, pers, prompt, vertical=False):
    e = ch(CAPAS, {"acao": "editar", "caminho": base, "destino": destino, "size": "1024x1536" if vertical else "1536x1024",
                   "instrucao": f"Use the person from the reference photo as the same character ({pers}); keep the face and identity identical. "
                                f"New photo of a different moment: {prompt} Natural, understated expression. Full-bleed photo, no text, no borders."})
    return e.get("ok")


def garantir_caderno(pasta):
    loc = pasta.parent / "_caderno.png"
    if loc.exists():
        return loc
    r = ch(MONTADOR, {"acao": "baixar", "caminho": CADERNO})
    if not r.get("ok"):
        gerar("Overhead photo of an open spiral planner notebook on a warm wooden desk, handwritten weekly money plan in Portuguese faintly visible, "
              "a pen, a coffee cup at the edge, soft morning light, shallow depth of field.", CADERNO)
    robo.baixar(CADERNO, loc)
    return loc


def um(p):
    t0 = time.time(); log = []; nome = p["nome"]; pasta = saida / nome; pasta.mkdir(exist_ok=True)
    r = ch(ROTEIRO, {**{k: v for k, v in p.items() if k != "nome"}, "feedback": FEEDBACK})
    if not r.get("ok"):
        return nome, [f"ERRO roteiro: {r}"]
    post = r["post"]; (pasta / "roteiro.json").write_text(json.dumps(post, ensure_ascii=False, indent=1), encoding="utf-8")
    capa = post["capa"]; pers = post["personagem"]; famosa = capa["estilo"].startswith("famoso"); base = f"posts_kit/{nome}"
    log.append(f"receita {post['receita'][:40]} · capa {capa['molde']}")
    # ---- capa
    cam_capa = None
    if capa["molde"] == "capa_caderno":
        loc = garantir_caderno(pasta); (pasta / "capa.png").write_bytes(loc.read_bytes())
    elif capa["molde"] == "capa_revista":
        cam_capa = f"{base}/capa.png"
        gerar(capa["foto_prompt"] + " Single isolated object, centered, on a plain pure white background, studio product photo, soft shadow.", cam_capa)
        robo.baixar(cam_capa, pasta / "capa.png")
    else:
        txt = capa["texto"] or capa["titulo"] or capa["numero"]
        ideia = capa["foto_prompt"] + (f" Main character: {pers}." if pers and not famosa else "") + (f" Famous person: {capa['famoso']} (fact: {capa['fato']})." if capa.get("famoso") else "")
        ff = foto_fiel(txt, capa["molde"], ideia, f"{base}/capa", vertical=capa["molde"] in ("capa_f3a", "capa_f3b", "capa_circulos", "capa_marcatexto", "capa_numero"), log=lambda *_: None)
        cam_capa = ff["melhor"]; robo.baixar(cam_capa, pasta / "capa.png"); log.append(f"capa nota {ff['nota']}")
    circulo = None
    if capa["molde"] == "capa_circulos" and capa.get("foto_prompt2"):
        dest = f"{base}/circulo.png"
        ok = gerar(capa["foto_prompt2"], dest) if famosa or not cam_capa else variar(cam_capa, dest, pers, capa["foto_prompt2"])
        if ok:
            circulo = pasta / "circulo.png"; robo.baixar(dest, circulo)

    # ---- fotos do miolo
    def foto(i, s, campo="foto_prompt", suf=""):
        pr = s.get(campo)
        if not pr:
            return None
        dest = f"{base}/s{i:02d}{suf}.png"; vert = s["molde"] in VERTICAIS
        ok = variar(cam_capa, dest, pers, pr, vert) if (s.get("mesma_pessoa") and pers and cam_capa and not famosa) else gerar(pr, dest, vert)
        if not ok:
            return None
        loc = pasta / f"s{i:02d}{suf}.png"; robo.baixar(dest, loc); return loc
    tarefas = []
    for i, s in enumerate(post["slides"], 2):
        tarefas.append((i, s, "foto_prompt", ""))
        if s["molde"] == "antes_hoje":
            tarefas.append((i, s, "foto_prompt2", "b"))
    with ThreadPoolExecutor(3) as ex:
        res = list(ex.map(lambda a: ((a[0], a[3]), foto(*a)), tarefas))
    fotos = {k: v for k, v in res if v}
    log.append(f"{len(fotos)} fotos de miolo")

    # ---- slides
    c = {k: v for k, v in capa.items() if v not in ("", [], None)}
    c["foto"] = (pasta / "capa.png").as_uri()
    if circulo:
        c["fotos_circulo"] = [circulo.as_uri()]
    slides = [c]
    reserva = (pasta / "capa.png").as_uri()
    for i, s in enumerate(post["slides"], 2):
        d = {k: v for k, v in s.items() if v not in ("", [], None) and k not in ("foto_prompt", "foto_prompt2")}
        f1 = fotos.get((i, "")); f2 = fotos.get((i, "b"))
        if s["molde"] == "antes_hoje":
            d["fotos"] = [(f1.as_uri() if f1 else reserva), (f2.as_uri() if f2 else reserva)]
        elif s["molde"] in ("f1_corrido", "meia_tela", "foto_sticker", "fecho_foto", "esc_checklist", "esc_titulo_moldura", "lista_linhas"):
            d["foto"] = f1.as_uri() if f1 else reserva
        slides.append(d)
    feitos = renderizar(slides, pasta / "slides")
    log.append(f"{len(feitos)} slides em {time.time()-t0:.0f}s")
    return nome, log


t0 = time.time()
with ThreadPoolExecutor(3) as ex:
    for nome, log in ex.map(um, pedidos):
        print(nome, " | ".join(log), flush=True)
print(f"tudo em {time.time()-t0:.0f}s")
