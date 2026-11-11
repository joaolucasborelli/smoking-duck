"""Estudo de marca de um ambiente novo (~20 min) e vigia diário dos ambientes ativos.

Roda no GitHub (estudo.yml). Cada agente é uma chamada à função "ambientes" (que fala com a OpenAI e busca na web);
aqui só se organiza o time: 7 agentes de pesquisa em paralelo → roteirista e editor → documento visual → configuração da fábrica.
"""
import base64, sys, time
from concurrent.futures import ThreadPoolExecutor
from robo import chamar, passou_do_teto
import marca_kit

AMB = "https://odwbspgnxwcqmbcegkhw.supabase.co/functions/v1/ambientes"
PESQUISA = [("empresa", "Pesquisador da empresa"), ("leitor_redes", "Leitor das redes"), ("mercado", "Pesquisador de mercado"),
            ("publico", "Analista de público"), ("marca", "Estrategista de marca"), ("regras", "Guardião das regras"), ("arte", "Diretor de Arte")]


def _agente(aid, papel, contexto=None, tentativas=2):
    ultimo = None
    for _ in range(tentativas):
        r = chamar({"acao": "agente", "id": aid, "papel": papel, "contexto": contexto}, timeout=200, url=AMB)
        if r.get("ok"):
            return r["resultado"]
        ultimo = r.get("erro") or r
        if "créditos" in str(ultimo):
            break
    raise RuntimeError(f"{papel}: {str(ultimo)[:200]}")


def _cores_da_imagem(png, n=5):
    """Cores dominantes da embalagem (ignorando o fundo transparente), para o agente de identidade."""
    from PIL import Image
    import io
    im = Image.open(io.BytesIO(png)).convert("RGBA"); im.thumbnail((200, 200))
    px = [p[:3] for p in im.getdata() if p[3] > 200]
    if not px:
        return []
    q = Image.new("RGB", (len(px), 1)); q.putdata(px)
    pal = q.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    cores = pal.getpalette()[: n * 3]; cont = sorted(pal.getcolors(), reverse=True)
    return ["#%02x%02x%02x" % tuple(cores[i * 3: i * 3 + 3]) for _, i in cont]


def _perfil_seguro(pf):
    """Garante leitura: texto escuro sobre o claro com contraste alto; destaque visível. Ajusta só o necessário."""
    import moldes
    pf = dict(pf)
    k = 0
    while moldes.contraste(pf["escuro"], pf["claro"]) < 7 and k < 20:
        pf["escuro"] = moldes._mistura(pf["escuro"], "#000000", 0.12); k += 1
    k = 0
    while moldes.contraste(pf["destaque"], pf["claro"]) < 3 and k < 20:
        pf["destaque"] = moldes._mistura(pf["destaque"], "#000000", 0.1); k += 1
    return pf


def montar_kit(aid, entrada, coleta=None, log=print):
    """KIT DA MARCA (barato): o robô coleta o site sem IA; o agente do produto escolhe as fotos e o robô recorta a embalagem;
    o agente de IDENTIDADE monta o PERFIL VISUAL (papel de cada cor, fontes, estilo, direção de foto) a partir das cores-token
    do site e das cores medidas na embalagem. Vira os layouts da marca (mk_*) e a direção das fotos de todo post."""
    coleta = coleta or marca_kit.coletar(entrada, log=log)
    kit = {"coleta": {k: coleta.get(k) for k in ("site", "plataforma", "cores", "tokens", "fontes", "avisos")}}
    cores_produto = []
    try:
        pr = _agente(aid, "produto", {k: coleta.get(k) for k in ("produtos", "imagens_produto", "plataforma")})
        produtos = []
        if pr.get("tem_produto_fisico"):
            for i, p in enumerate(pr.get("produtos", [])[:4]):
                recortes = []
                for j, u in enumerate(p.get("imagens", [])[:3]):
                    try:
                        png = marca_kit.recortar(marca_kit._get(u, binario=True))
                    except Exception:
                        png = None
                    if png:
                        cam = f"marcas/amb_{aid}/produto_{i + 1}_{j + 1}.png"
                        chamar({"acao": "salvar", "caminho": cam, "base64": base64.b64encode(png).decode()})
                        recortes.append(cam)
                        if not cores_produto:
                            try:
                                cores_produto = _cores_da_imagem(png)
                            except Exception:
                                pass
                if recortes:
                    produtos.append({"nome": p.get("nome", ""), "descricao": p.get("descricao", ""), "recortes": recortes})
        kit["produtos"] = produtos
        kit["regra_foto"] = pr.get("regra_foto", "")
        log(f"produto real: {sum(len(p['recortes']) for p in produtos)} fotos recortadas de {len(produtos)} produtos")
    except Exception as e:
        log(f"produto não saiu: {str(e)[:100]}")
    try:
        idn = _agente(aid, "identidade", {**{k: coleta.get(k) for k in ("cores", "tokens", "fontes", "logos", "site")}, "cores_produto": cores_produto})
        kit["tema"] = idn.get("tema")
        if idn.get("perfil"):
            pf = _perfil_seguro(idn["perfil"])
            kit["perfil"] = {**pf, "kit": "mk", "status": "proposta", "nunca": idn.get("nunca", []), "chapeu_capa": ""}
            kit["direcao_foto"] = idn.get("direcao_foto", "")
            log(f"perfil visual: estilo {pf['estilo']}, destaque {pf['destaque']}, fontes {pf['display']} + {pf['texto']}")
        if idn.get("logo_url"):
            try:
                dado = marca_kit._get(idn["logo_url"], binario=True)
                cam = f"marcas/amb_{aid}/logo" + (".svg" if idn["logo_url"].split("?")[0].endswith(".svg") else ".png")
                if cam.endswith(".png"):
                    from PIL import Image
                    import io
                    buf = io.BytesIO(); Image.open(io.BytesIO(dado)).convert("RGBA").save(buf, "PNG"); dado = buf.getvalue()
                    chamar({"acao": "salvar", "caminho": cam, "base64": base64.b64encode(dado).decode()})
                    kit["logo"] = cam
            except Exception as e:
                log(f"logo não baixou: {str(e)[:80]}")
    except Exception as e:
        log(f"identidade visual não saiu: {str(e)[:100]}")
    chamar({"acao": "salvar_kit", "id": aid, "kit": kit}, url=AMB)
    return kit


def estudar(a):
    aid, t0 = a["id"], time.time()
    linhas = []

    def log(txt):
        linhas.append(f"{time.strftime('%H:%M')} {txt}")
        chamar({"acao": "progresso", "id": aid, "log": "em andamento\n" + "\n".join(linhas[-30:])}, url=AMB)

    coleta = marca_kit.coletar(a.get("entrada", ""), log=lambda *_: None)
    log(f"O robô leu o site ({len(coleta['cores'])} cores, {len(coleta['fontes'])} fontes, {len(coleta['produtos']) or len(coleta['imagens_produto'])} fotos de produto).")
    extras = []
    try:
        arq = _agente(aid, "arquiteto", {k: coleta.get(k) for k in ("site", "plataforma", "texto", "produtos")})
        extras = arq.get("especialistas", [])[:3]
        log(f"Arquiteto do time: {arq.get('tipo_empresa', '')[:60]}. Chamou {len(extras)} especialista(s): {', '.join(e['nome'] for e in extras) or 'nenhum'}.")
    except Exception as e:
        log(f"O arquiteto não respondeu ({str(e)[:60]}); seguimos com o time fixo.")
    log(f"O time começou a estudar {a['nome']}: {7 + len(extras)} agentes pesquisando ao mesmo tempo.")
    achados, falhas = {}, []

    def um(par):
        papel, nome = par
        try:
            r = _agente(aid, papel)
            log(f"✓ {nome} terminou ({len(r.get('itens', []))} respostas).")
            return papel, r
        except Exception as e:
            log(f"✗ {nome} não conseguiu: {str(e)[:120]}")
            falhas.append(str(e))
            return papel, None

    def extra(e):
        try:
            r = chamar({"acao": "agente", "id": aid, "papel": "especialista", "def": e, "contexto": {"texto": coleta.get("texto", "")[:4000]}}, timeout=200, url=AMB)
            if not r.get("ok"):
                raise RuntimeError(str(r.get("erro"))[:120])
            log(f"✓ {e['nome']} terminou.")
            return "extra_" + e.get("id", "x"), r["resultado"]
        except Exception as x:
            log(f"✗ {e['nome']} não conseguiu: {str(x)[:100]}")
            return None, None

    with ThreadPoolExecutor(4) as ex:
        for papel, r in ex.map(um, PESQUISA):
            if r:
                achados[papel] = r
        for papel, r in ex.map(extra, extras):
            if r:
                achados[papel] = r
    if not achados:
        raise RuntimeError(falhas[0] if falhas else "nenhum agente respondeu")

    log("Roteirista e Editor-chefe cruzando tudo.")
    with ThreadPoolExecutor(2) as ex:
        fr = ex.submit(_agente, aid, "roteirista", achados)
        fe = ex.submit(_agente, aid, "editor", achados)
        achados["roteirista"] = fr.result()
        log("✓ Roteirista terminou os pilares, o arco e os 3 posts-modelo.")
        achados["editor"] = fe.result()
        log("✓ Editor-chefe apontou brechas e perguntas para o cliente.")

    log("Montando o kit da marca: cores, fontes, logo e fotos reais do produto.")
    kit = montar_kit(aid, a.get("entrada", ""), coleta, log=log)
    achados["kit_da_marca"] = {"tema": kit.get("tema"), "produtos": [p["nome"] for p in kit.get("produtos", [])], "regra_foto": kit.get("regra_foto", "")}
    log("Montando o documento visual.")
    doc = _agente(aid, "documento", achados)
    log("Transformando o estudo nas regras, presets e personas da fábrica.")
    fab = _agente(aid, "fabrica", doc)
    chamar({"acao": "salvar_estudo", "id": aid, "estudo": {"documento": doc, "fabrica": fab, "agentes": achados,
                                                         "minutos": round((time.time() - t0) / 60, 1), "falhas": falhas}}, url=AMB)
    print(aid, "estudo pronto em", round((time.time() - t0) / 60, 1), "min")


def vigiar():
    lista = chamar({"acao": "vigia_lista"}, url=AMB)
    for a in lista.get("ambientes", []) if lista.get("ok") else []:
        try:
            r = chamar({"acao": "agente", "id": a["id"], "papel": "vigia", "desde": a.get("vigia_em")}, timeout=200, url=AMB)
            avisos = (r.get("resultado") or {}).get("avisos", []) if r.get("ok") else []
            chamar({"acao": "vigia_salvar", "id": a["id"], "avisos": avisos}, url=AMB)
            print(a["id"], "vigia:", len(avisos), "avisos")
        except Exception as e:
            print(a["id"], "vigia ERRO", e)


def kits_faltando():
    """Ambientes aprovados antes do kit da marca existir (ex.: a Rucá): monta só o kit, sem refazer o estudo."""
    f = chamar({"acao": "kit_fila"}, url=AMB)
    for a in f.get("ambientes", []) if f.get("ok") else []:
        try:
            k = montar_kit(a["id"], a.get("entrada", ""))
            print(a["id"], "kit:", (k.get("tema") or {}).get("destaque"), len(k.get("produtos", [])), "produtos")
        except Exception as e:
            print(a["id"], "kit ERRO", e)


def main():
    if passou_do_teto():
        return
    kits_faltando()
    fila = chamar({"acao": "fila_estudo"}, url=AMB)
    print("estudos na fila:", [a["id"] for a in fila.get("ambientes", [])] if fila.get("ok") else fila)
    for a in fila.get("ambientes", []) if fila.get("ok") else []:
        try:
            estudar(a)
        except Exception as e:
            print(a["id"], "ERRO", e)
            msg = "a OpenAI está sem créditos: recarregue e clique em estudar de novo" if "créditos" in str(e) else str(e)[:300]
            chamar({"acao": "salvar_estudo", "id": a["id"], "erro": msg}, url=AMB)
    if "--vigia" in sys.argv:
        vigiar()


if __name__ == "__main__":
    main()
