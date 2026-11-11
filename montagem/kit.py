"""Motor do KIT 2: a partir de um roteiro já diagramado, gera as fotos certas para cada molde
(capa conferida, mesma pessoa no miolo, objeto recortado, caderno fixo) e desenha os slides.
Usado pelo robô do botão Montar (robo.py) e pelos testes (post_kit.py)."""
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import robo
from foto_fiel import foto_fiel, CAPAS, MONTADOR
from render import renderizar

VERTICAIS = {"meia_tela", "foto_sticker", "fecho_foto"}
COM_FOTO = {"f1_corrido", "meia_tela", "foto_sticker", "fecho_foto", "esc_checklist", "esc_titulo_moldura", "lista_linhas"}
FOTO_OPCIONAL = {"noticia"}  # funciona com ou sem foto
DA = ("por_que", "foto_fonte", "busca_real", "pessoa_real")  # campos do Diretor de Arte (não vão para o desenho)
CADERNO = "assets/caderno_planner.png"


def _ch(url, corpo, timeout=220):
    return robo.chamar(corpo, timeout=timeout, url=url)


def gerar(prompt, destino, vertical=False):
    g = _ch(MONTADOR, {"acao": "imagem", "prompt": prompt + " Full-bleed photo, no text, no borders.", "caminho": destino,
                       "size": "1024x1536" if vertical else "1536x1024", "quality": "medium"})
    return g.get("ok")


def variar(base, destino, pers, prompt, vertical=False):
    e = _ch(CAPAS, {"acao": "editar", "caminho": base, "destino": destino, "size": "1024x1536" if vertical else "1536x1024",
                    "instrucao": f"Use the person from the reference photo as the same character ({pers}); keep the face and identity identical. "
                                 f"New photo of a different moment: {prompt} Natural, understated expression. Full-bleed photo, no text, no borders."})
    return e.get("ok")


def _caderno(pasta: Path):
    loc = pasta / "_caderno.png"
    r = _ch(MONTADOR, {"acao": "baixar", "caminho": CADERNO})
    if not r.get("ok"):
        gerar("Overhead photo of an open spiral planner notebook on a warm wooden desk, handwritten weekly money plan in Portuguese faintly visible, "
              "a pen, a coffee cup at the edge, soft morning light, shallow depth of field.", CADERNO)
    robo.baixar(CADERNO, loc)
    return loc


def _real(s, destino: Path, ev):
    """Foto REAL com licença livre (Wikimedia Commons) para pessoa pública ou evento oficial."""
    import fotos_reais
    quem = s.get("pessoa_real") or ""; busca = s.get("busca_real") or quem
    if not busca:
        return None
    ev("fotografo", f"Buscando foto real com licença livre: {busca}.")
    texto = " ".join(s.get("paragrafos") or []) or s.get("texto") or ""
    def aceitar(arq, cand):
        # o Conferente olha a foto: é a pessoa certa, num contexto que combina com o slide, sem nada constrangedor?
        import base64
        cam = f"reais/{destino.parent.name}_{arq.stem}_{abs(hash(cand['titulo'])) % 10**8}.jpg"  # o nome leva o post (medidor de custo)
        if not robo.chamar({"acao": "salvar", "caminho": cam, "base64": base64.b64encode(arq.read_bytes()).decode()}).get("ok"):
            return False
        cf = _ch(CAPAS, {"acao": "conferir", "caminho": cam, "texto": texto, "cena": {
            "momento": f"Foto REAL de arquivo de {quem or busca} para ilustrar este slide de notícia. Serve só retrato digno e neutro ou discurso/pronunciamento/evento oficial que combine com o texto.",
            "detalhes_do_texto": [f"{quem or busca} aparece claramente como o foco da foto", "contexto compatível com o texto do slide"],
            "pessoas": [], "regra": "Aprove (nota 7+) quando a pessoa é o foco principal, com o rosto nítido e bem visível (retrato, discurso, pronunciamento na mesa com bandeira, entrevista), mesmo em plano médio. Reprove (nota 0 a 5) mesa/almoço/reunião com várias pessoas, a pessoa pequena ou de costas, beijo, abraço, festa, piada, careta, momento constrangedor, outra pessoa em destaque, ou contexto que contradiz o texto. Ignore expressão contida e lógica de cena de IA: é foto real."}})
        k = cf.get("conferencia") or {}
        ev("conferente", f"Foto real: nota {k.get('nota', '?')}/10. {(k.get('defeitos') or [''])[0][:90]}")
        return (k.get("nota") or 0) >= 7
    r = None
    for termo in [f"{quem} pronunciamento à nação", f"{quem} retrato oficial", f"{quem} discurso", busca] if quem else [busca]:
        r = fotos_reais.buscar(termo, quem, destino, log=lambda *_: None, aceitar=aceitar, max_conferir=3)
        if r:
            break
    if r:
        ev("fotografo", f"Achei foto real ({r['credito'][:90]}). Vai com o crédito no slide.", "pronto")
    else:
        ev("fotografo", f"Não achei foto real livre de {busca}. Não vou inventar rosto por IA.", "pronto")
    return r


def palavras(s):
    s = re.sub(r"\*\*|\[\[|\]\]", "", s or "").lower()
    import unicodedata
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.findall(r"[a-z0-9$]+", s)


def textos(o):
    if isinstance(o, str):
        return [o]
    if isinstance(o, list):
        return [t for x in o for t in textos(x)]
    if isinstance(o, dict):
        return [t for k, v in o.items() if k not in ("foto_prompt", "foto_prompt2", "molde", "estilo", "personagem", "cor", "lado", "fato", "marca", "famoso") + DA for t in textos(v)]
    return []


def cobertura(pecas, post):
    """Quanto das palavras do texto aprovado aparece na diagramação (0 a 1)."""
    orig = palavras(" ".join([pecas.get("capa", "")] + list(pecas.get("slides") or [])))
    novo = {}
    for w in palavras(" ".join(textos({"capa": post["capa"], "slides": post["slides"]}))):
        novo[w] = novo.get(w, 0) + 1
    achou = 0
    for w in orig:
        if novo.get(w, 0) > 0:
            novo[w] -= 1; achou += 1
    return achou / max(1, len(orig))


SEM_PARAGRAFO = {"esc_cards", "esc_checklist", "lista_linhas", "conta_visual", "antes_hoje", "citacao"}


def _norm(t):
    import unicodedata
    return re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFD", str(t or "")).encode("ascii", "ignore").decode().lower()).strip()


def ajustar(s):
    """Moldes que não mostram "paragrafos": a frase vai para o subtítulo ou o slide vira texto corrido (nada se perde).
    Cards cujo texto só repete o nome ficam só com o nome."""
    if len(s.get("chapeu") or "") > 40:
        s["paragrafos"] = [s["chapeu"]] + [x for x in (s.get("paragrafos") or []) if x]
        s["chapeu"] = ""
    for c in s.get("cards") or []:
        if c.get("texto") and (_norm(c["texto"]) == _norm(c.get("nome")) or _norm(c["texto"]) in _norm(c.get("nome"))):
            c["texto"] = ""
    ps = [x for x in (s.get("paragrafos") or []) if x and x.strip()]
    if s["molde"] in SEM_PARAGRAFO and ps:
        txt = " ".join(ps)
        if len(txt.split()) <= 22 and not s.get("sub"):
            s["sub"] = txt; s["paragrafos"] = []
        else:
            itens = [i for i in (s.get("itens") or []) if i] + [f"{c['nome']}: {c['texto']}" for c in (s.get("cards") or []) if c.get("nome")]
            s["molde"] = "papel_f2"; s["paragrafos"] = ([f"**{s['titulo']}**"] if s.get("titulo") else []) + ps + itens
    return s


def desenho(s, eh_capa=False):
    """O dicionário que o desenhador recebe (sem os campos de foto e do Diretor de Arte)."""
    if eh_capa:
        return {k: v for k, v in s.items() if v not in ("", [], None)}
    return {k: v for k, v in ajustar(dict(s)).items() if v not in ("", [], None) and k not in ("foto_prompt", "foto_prompt2") + DA}


def montar(post, pasta: Path, base: str, ev=None, log=print):
    """Gera as fotos e desenha. Devolve a lista de PNGs locais na ordem dos slides."""
    ev = ev or (lambda *a, **k: None)
    pasta.mkdir(parents=True, exist_ok=True)
    capa = post["capa"]; pers = post.get("personagem", ""); famosa = capa["estilo"].startswith("famoso")
    produtos = post.get("_produtos") or []
    DIRECAO = (" " + post["_direcao"]) if post.get("_direcao") else ""  # a cena veste a identidade visual da marca (cores, figurino, objetos)
    SEM_PACOTE = (" IMPORTANT: do not show any product packaging, pouch, sachet, box, bottle, jar or brand label anywhere in the image"
                  " (the real product is added later).") if produtos else ""
    VAGA = " Leave a clean empty area on the table or surface in the lower-right third of the frame." if produtos else ""
    PACOTE = re.compile(r"[^.]*\b(pouch|sachets?|sach[eê]s?|packag\w*|packets?|labels?|wrappers?|bags? of|box(?:es)? of|carton|jar|tub)\b[^.]*\.?", re.I)
    def limpo(txt):
        return PACOTE.sub("", txt or "") if produtos else (txt or "")
    nomes = [_norm(p.get("nome", "")).split(" ")[0] for p in produtos] + [_norm((post.get("marca") or {}).get("nome", "")).split(" ")[0]]
    nomes = [n for n in nomes if len(n) >= 3]
    def fala_do_produto(s):
        t = _norm(" ".join(textos(s)))
        return any(n in t for n in nomes)
    MAO = re.compile(r"embalag|rotulo|sache|pouch|pacote|sachet|abre o|abrir o|vira o|virar a", re.I)
    com_produto, na_mao = set(), set()
    if produtos:
        for i, s in enumerate(post["slides"], 2):
            if s["molde"] not in COM_FOTO:
                continue
            if len(na_mao) < 3 and MAO.search(_norm(" ".join(textos(s)))):
                na_mao.add(i)  # a cena precisa da pessoa com o produto na mão: troca o pacote da IA pelo real (por referência)
            elif len(com_produto) < 3 and fala_do_produto(s):
                com_produto.add(i)  # cita o produto: cola a embalagem real num canto da cena
    def trocar_na_mao(dest, loc, vert, k):
        try:
            p = produtos[k % len(produtos)]
            novo = dest.replace(".png", "_real.png")
            e = _ch(CAPAS, {"acao": "editar", "caminho": dest, "destino": novo, "referencias": [p["caminho"]], "size": "1024x1536" if vert else "1536x1024",
                            "instrucao": "Replace the package the person is holding (or the package in the scene) with the exact product from the second image: "
                                         "same shape, colors, logo and printed text, at a natural size for the hand. Keep everything else exactly the same."})
            if e.get("ok"):
                robo.baixar(novo, loc)
                ev("fotografo", f"Troquei o pacote da foto pela embalagem real de {p.get('nome', 'produto')}.")
        except Exception as x:
            ev("fotografo", f"Não consegui trocar o pacote: {str(x)[:80]}", "erro")
    def colar(loc, k, capa=False):
        p = produtos[k % len(produtos)]
        try:  # agente do produto: 3D com o rótulo real + acabamento de IA + conferente (caminho B do dono)
            import produto3d
            r = produto3d.integrar(Path(loc), p, base, "prod_capa" if capa else f"prod_s{k:02d}", zona="capa" if capa else "miolo", ev=ev)
            log(f"produto 3D {'capa' if capa else k}: {r.get('modo')} nota {r.get('nota')}")
            return
        except Exception as e3:
            ev("fotografo", f"O produto em 3D falhou ({str(e3)[:60]}); usei a colagem simples.", "erro")
        try:
            import marca_kit
            if capa:  # na capa o texto ocupa a parte de baixo: o produto vai no meio, à direita
                marca_kit.colar_produto(loc, p["arquivo"], loc, altura=0.34, base=0.6)
            else:
                marca_kit.colar_produto(loc, p["arquivo"], loc, altura=0.38)
            ev("fotografo", f"Colei a embalagem real de {p.get('nome', 'produto')} na foto (o rótulo é o de verdade, pixel por pixel).")
        except Exception as e:
            ev("fotografo", f"Não consegui colar o produto: {str(e)[:80]}", "erro")
    cam_capa = None; cred_capa = None
    real_capa = _real(capa, pasta / "capa_real.jpg", ev) if capa.get("foto_fonte") == "real" else None
    if real_capa:
        (pasta / "capa.png").write_bytes(real_capa["arquivo"].read_bytes()); cred_capa = real_capa["credito"]
    elif capa["molde"] == "capa_caderno":
        ev("fotografo", "Capa de caderno: usando a foto fixa do planner aberto.")
        (pasta / "capa.png").write_bytes(_caderno(pasta).read_bytes())
    elif capa["molde"] == "capa_revista" and produtos and (capa.get("estilo") == "produto" or fala_do_produto(capa) or PACOTE.search(capa.get("foto_prompt") or "")):
        # o objeto da capa é o produto: usa a foto recortada do pacote DE VERDADE (a IA inventava um pacote genérico)
        from PIL import Image
        p = produtos[0]
        pf = post.get("_perfil") or {}
        W, H = (1536, 1206) if pf else (1024, 1536)  # layouts da marca põem a capa num quadro horizontal
        cor = pf.get("sup") or "#ffffff"
        pac = Image.open(p["arquivo"]).convert("RGBA"); pac.thumbnail((int(W * 0.7), int(H * 0.78)))
        fundo = Image.new("RGBA", (W, H), tuple(int(cor.lstrip("#")[k:k + 2], 16) for k in (0, 2, 4)) + (255,))
        sombra = Image.new("RGBA", pac.size, (0, 0, 0, 0)); sombra.putalpha(pac.getchannel("A").point(lambda v: int(v * 0.18)))
        from PIL import ImageFilter
        x, y = (W - pac.width) // 2, (H - pac.height) // 2 - 20
        fundo.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(28)), (x + 18, y + 34)); fundo.alpha_composite(pac, (x, y))
        fundo.convert("RGB").save(pasta / "capa.png")
        ev("fotografo", f"Capa revista com o pacote real de {p.get('nome', 'produto')} (sem IA, rótulo exato).")
    elif capa["molde"] == "capa_revista":
        ev("fotografo", "Capa revista: fotografando só o objeto, em fundo branco, para recortar.")
        cam_capa = f"{base}/capa.png"
        gerar(limpo(capa["foto_prompt"]) + SEM_PACOTE + " Single isolated object, centered, on a plain pure white background, studio product photo, soft shadow.", cam_capa)
        robo.baixar(cam_capa, pasta / "capa.png")
    else:
        txt = capa.get("texto") or capa.get("titulo") or capa.get("numero")
        prod_capa = bool(produtos) and (capa.get("estilo") == "produto" or fala_do_produto(capa))  # produto só entra na capa quando a capa é sobre ele
        ideia = limpo(capa["foto_prompt"]) + (f" Main character: {pers}." if pers and not famosa else "") + (f" Famous person: {capa['famoso']} (fact: {capa['fato']})." if capa.get("famoso") else "") + SEM_PACOTE + DIRECAO + (" Leave a clean empty area on a table or shelf, at mid height, away from the bottom third." if prod_capa else "")
        ff = foto_fiel(txt, capa["molde"], ideia, f"{base}/capa", vertical=capa["molde"] in ("capa_f3a", "capa_f3b", "capa_circulos", "capa_marcatexto", "capa_numero"), log=lambda *_: None, ev=ev)
        cam_capa = ff["melhor"]; robo.baixar(cam_capa, pasta / "capa.png"); log(f"capa nota {ff['nota']}")
        if prod_capa:
            colar(pasta / "capa.png", 0, capa=True)
    circulo = None
    if capa["molde"] == "capa_circulos" and capa.get("foto_prompt2"):
        dest = f"{base}/circulo.png"
        if (gerar(capa["foto_prompt2"], dest) if famosa or not cam_capa else variar(cam_capa, dest, pers, capa["foto_prompt2"])):
            circulo = pasta / "circulo.png"; robo.baixar(dest, circulo)

    tarefas = []; reais = {}
    for i, s in enumerate(post["slides"], 2):
        fonte = s.get("foto_fonte") or "ia"
        if fonte == "real" and s["molde"] in COM_FOTO | FOTO_OPCIONAL:
            r = _real(s, pasta / f"s{i:02d}_real.jpg", ev)
            if r:
                reais[i] = r; continue
            if s.get("pessoa_real"):  # nunca rosto de pessoa pública por IA: vira cartão de notícia sem foto
                s["molde"] = "noticia"; s.setdefault("chapeu", ""); continue
        if fonte == "nenhuma" and s["molde"] in FOTO_OPCIONAL:
            continue
        if s.get("foto_prompt") and s["molde"] in COM_FOTO | {"antes_hoje"}:
            tarefas.append((i, s, "foto_prompt", ""))
        if s["molde"] == "antes_hoje" and s.get("foto_prompt2"):
            tarefas.append((i, s, "foto_prompt2", "b"))
    if tarefas:
        ev("fotografo", f"Fotografando {len(tarefas)} cenas do miolo" + (" com a mesma pessoa da capa." if pers and not famosa else "."))

    def foto(a):
        i, s, campo, suf = a
        dest = f"{base}/s{i:02d}{suf}.png"; vert = s["molde"] in VERTICAIS
        if i in na_mao:
            prompt = s[campo] + " The person holds one plain product package naturally in one hand, front facing the camera." + DIRECAO
        else:
            prompt = limpo(s[campo]) + SEM_PACOTE + DIRECAO + (VAGA if i in com_produto else "")
        ok = variar(cam_capa, dest, pers, prompt, vert) if (s.get("mesma_pessoa") and pers and cam_capa and not famosa) else gerar(prompt, dest, vert)
        if not ok:
            return (i, suf), None
        loc = pasta / f"s{i:02d}{suf}.png"; robo.baixar(dest, loc)
        if i in na_mao and not suf:
            trocar_na_mao(dest, loc, vert, i)
        elif i in com_produto and not suf:
            colar(loc, i)
        return (i, suf), loc
    with ThreadPoolExecutor(3) as ex:
        fotos = {k: v for k, v in ex.map(foto, tarefas) if v}
    if tarefas:
        ev("fotografo", f"{len(fotos)} de {len(tarefas)} fotos do miolo prontas.", "pronto")

    for s in post["slides"]:
        ajustar(s)
    c = desenho(capa, eh_capa=True)
    c["foto"] = (pasta / "capa.png").as_uri()
    if cred_capa:
        c["credito"] = cred_capa
    if circulo:
        c["fotos_circulo"] = [circulo.as_uri()]
    slides = [c]; reserva = c["foto"]
    for i, s in enumerate(post["slides"], 2):
        d = desenho(s)
        f1 = fotos.get((i, "")); f2 = fotos.get((i, "b"))
        if s["molde"] == "antes_hoje":
            d["fotos"] = [(f1.as_uri() if f1 else reserva), (f2.as_uri() if f2 else reserva)]
        elif i in reais:
            d["foto"] = reais[i]["arquivo"].as_uri(); d["credito"] = reais[i]["credito"]
        elif s["molde"] in COM_FOTO:
            d["foto"] = f1.as_uri() if f1 else reserva
        slides.append(d)
    if post.get("_perfil"):  # ambiente com perfil visual aprovado: layouts da marca (não os da Do outro lado da Porta pintados)
        import moldes_marca
        slides = moldes_marca.adaptar(slides[0], slides[1:], post["_perfil"])
        ev("diretor_arte", f"Usando os layouts da marca (estilo {post['_perfil'].get('estilo', 'creme')}, alternando com {post['_perfil'].get('alternar', 'ameixa')}).")
    ev("montador", f"Desenhando os {len(slides)} slides com os moldes do kit (receita {post.get('receita','')[:30]}).")
    feitos = renderizar(slides, pasta / "slides")
    ev("montador", f"{len(feitos)} slides desenhados.", "pronto")
    return [Path(f["arquivo"]) for f in feitos]
