"""Kit da marca de um ambiente, coletado do site SEM IA (custo zero): cores, fontes, logo e fotos oficiais do produto.

Visita poucas páginas (educado com o site) e, se o site bloquear, segue com o que já pegou.
Também recorta a foto do produto (tira o fundo branco/liso) para colar nas cenas sem mudar nenhum pixel do rótulo.
"""
import io, json, re, time, urllib.request, urllib.parse
from collections import Counter

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"}


def _get(url, binario=False, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        dado = r.read()
    return dado if binario else dado.decode("utf-8", "replace")


def _abs(base, u):
    if not u:
        return ""
    u = u.strip().split(" ")[0]
    if u.startswith("//"):
        return "https:" + u
    return urllib.parse.urljoin(base, u)


def achar_site(texto):
    """O primeiro site que o dono colou (ignora links de redes sociais)."""
    for u in re.findall(r"https?://[^\s<>\"']+", texto or ""):
        if not re.search(r"instagram|tiktok|facebook|youtube|linkedin|wa\.me|whatsapp|twitter|x\.com", u, re.I):
            return u.rstrip(".,;)")
    m = re.search(r"\b([a-z0-9-]+\.(?:com\.br|com|br|net|org)(?:/[^\s]*)?)", texto or "", re.I)
    return ("https://" + m.group(1)) if m else ""


def _cinza(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    try:
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return True
    mx, mn = max(r, g, b), min(r, g, b)
    return (mx - mn) < 28 or mx < 25 or mn > 238  # cinza, quase preto ou quase branco


def coletar(texto_dono, log=print):
    site = achar_site(texto_dono)
    out = {"site": site, "cores": [], "fontes": [], "logos": [], "imagens_produto": [], "produtos": [], "texto": "", "plataforma": "", "avisos": []}
    if not site:
        out["avisos"].append("não achei o link do site no texto colado")
        return out
    try:
        h = _get(site)
    except Exception as e:
        out["avisos"].append(f"o site não abriu: {str(e)[:80]}")
        return out
    base = site
    out["plataforma"] = "shopify" if "cdn/shop" in h or "Shopify" in h else ("nuvemshop" if "nuvemshop" in h.lower() else "")
    # texto visível (para os agentes lerem sem gastar busca)
    txt = re.sub(r"<script.*?</script>|<style.*?</style>", " ", h, flags=re.S | re.I)
    out["texto"] = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", txt)).strip()[:6000]
    # fontes do Google e font-family
    fontes = []
    for link in re.findall(r"fonts\.googleapis\.com/css2?\?([^\"'>]+)", h):
        fontes += [urllib.parse.unquote(f.split(":")[0]).replace("+", " ") for f in re.findall(r"family=([^&]+)", link)]
    css_txt = " ".join(re.findall(r"<style[^>]*>(.*?)</style>", h, re.S | re.I))
    # folhas de estilo do próprio site (href pode vir antes ou depois do rel; as do Google Fonts ficam de fora)
    folhas = [re.search(r"href=[\"']([^\"']+)", l).group(1) for l in re.findall(r"<link\b[^>]*>", h, re.S)
              if re.search(r"rel=[\"']stylesheet", l) and re.search(r"href=[\"']", l) and "fonts.googleapis" not in l]
    for href in folhas[:4]:
        for tent in range(2):  # a loja pode responder 429 (muitas visitas): espera e tenta 1 vez mais
            try:
                css_txt += " " + _get(_abs(base, href))[:400000]
                break
            except Exception as e:
                if tent:
                    out["avisos"].append(f"a folha de estilo não abriu ({str(e)[:40]})")
                else:
                    time.sleep(8)
    fontes += [f.strip().strip("'\"") for f in re.findall(r"font-family\s*:\s*([^;,}]+)", css_txt)]
    vist = []
    for f in fontes:
        if f and not re.search(r"inherit|var\(|serif|sans|system|apple|segoe|helvetica|arial|monospace|icon", f, re.I) and f not in vist:
            vist.append(f)
    out["fontes"] = vist[:6]
    # cores mais usadas (sem cinzas)
    cores = Counter()
    for hx in re.findall(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b", css_txt + h):
        hx = hx.lower()
        if len(hx) == 4:
            hx = "#" + "".join(c * 2 for c in hx[1:])
        if not _cinza(hx):
            cores[hx] += 1
    # os tokens de cor do site (--pink: #d92258) são a identidade de verdade: valem muito mais que cor solta no CSS
    for nome, hx in re.findall(r"--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\b", css_txt + h):
        if not _cinza(hx.lower()):
            cores[hx.lower()] += 50
    out["tokens"] = dict(re.findall(r"--((?:[\w-]*(?:color|cor|pink|plum|rose|blush|cream|brand|primary|accent|ink)[\w-]*))\s*:\s*(#[0-9a-fA-F]{6})\b", css_txt + h))
    out["cores"] = [{"hex": c, "vezes": n} for c, n in cores.most_common(10)]
    # logo
    logos = []
    for tag in re.findall(r"<img[^>]+>", h, re.I):
        if re.search(r"logo", tag, re.I):
            m = re.search(r"src=[\"']([^\"']+)", tag)
            if m:
                logos.append(_abs(base, m.group(1)))
    logos += [_abs(base, u) for u in re.findall(r"<link[^>]+rel=[\"'](?:apple-touch-icon|icon)[\"'][^>]*href=[\"']([^\"']+)", h)]
    out["logos"] = list(dict.fromkeys(logos))[:4]
    # fotos de produto
    imgs = [_abs(base, u) for u in re.findall(r"og:image[\"'][^>]*content=[\"']([^\"']+)", h)]
    for u in re.findall(r"<img[^>]+src=[\"']([^\"']+)", h):
        if re.search(r"produto|product|pouch|sache|sachet|embalagem|pack|kit|frasco|garrafa|lata|caixa", u, re.I):
            imgs.append(_abs(base, u))
    out["imagens_produto"] = list(dict.fromkeys(imgs))[:20]
    if out["plataforma"] == "shopify":  # a Shopify entrega a lista oficial de produtos com as fotos
        try:
            d = json.loads(_get(urllib.parse.urljoin(base, "/products.json?limit=30")))
            for p in d.get("products", [])[:15]:
                out["produtos"].append({"nome": p.get("title", ""), "tipo": p.get("product_type", ""),
                                        "imagens": [i["src"] for i in p.get("images", [])[:4]]})
        except Exception as e:
            out["avisos"].append(f"a lista de produtos não abriu ({str(e)[:40]})")
    log(f"coletor: {len(out['cores'])} cores, {len(out['fontes'])} fontes, {len(out['logos'])} logos, "
        f"{len(out['produtos'])} produtos, {len(out['imagens_produto'])} fotos")
    return out


def recortar(dado):
    """Tira o fundo liso da foto do produto. Devolve PNG com transparência, ou None se não der para recortar com segurança."""
    from PIL import Image, ImageDraw, ImageChops
    im = Image.open(io.BytesIO(dado)).convert("RGBA")
    if im.width > 1400:
        im = im.resize((1400, round(im.height * 1400 / im.width)))
    a = im.getchannel("A")
    if a.getextrema()[0] < 250:  # já tem fundo transparente
        bb = a.point(lambda v: 255 if v > 20 else 0).getbbox()
        return _png(im.crop(bb)) if bb else None
    rgb = im.convert("RGB")
    marca = Image.new("L", im.size, 0)
    # preenche o fundo a partir dos 4 cantos, só se os cantos forem parecidos (fundo liso)
    cantos = [rgb.getpixel(p) for p in ((0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1))]
    ref = cantos[0]
    if max(max(abs(c[i] - ref[i]) for i in range(3)) for c in cantos) > 30:
        return None  # fundo não é liso (foto de cena): não recorta
    work = rgb.copy()
    for p in ((0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)):
        ImageDraw.floodfill(work, p, (255, 0, 255), thresh=28)
    dif = ImageChops.difference(work, Image.new("RGB", im.size, (255, 0, 255))).convert("L")
    fundo = dif.point(lambda v: 255 if v < 8 else 0)
    alfa = ImageChops.invert(fundo)
    frac = sum(1 for v in alfa.getdata() if v > 0) / (im.width * im.height)
    if frac < 0.06 or frac > 0.92:
        return None
    im.putalpha(alfa)
    bb = alfa.getbbox()
    return _png(im.crop(bb)) if bb else None


def _png(im):
    buf = io.BytesIO(); im.save(buf, "PNG"); return buf.getvalue()


def colar_produto(foto, produto_png, destino, lado="dir", altura=0.42, base=0.97):
    """Cola o produto real na cena (canto de baixo), com sombra suave. O rótulo fica pixel por pixel igual."""
    from PIL import Image, ImageFilter
    bg = Image.open(foto).convert("RGBA")
    pr = Image.open(produto_png).convert("RGBA")
    h = round(bg.height * altura); w = round(pr.width * h / pr.height)
    if w > bg.width * 0.45:
        w = round(bg.width * 0.45); h = round(pr.height * w / pr.width)
    pr = pr.resize((w, h), Image.LANCZOS)
    m = round(bg.width * 0.04)
    x = bg.width - w - m if lado == "dir" else m
    y = round(bg.height * base) - h  # base = onde fica o pé do produto (0.97 = embaixo; na capa, mais alto, longe do texto)
    sombra = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    alfa = pr.getchannel("A").point(lambda v: int(v * 0.45))
    preta = Image.new("RGBA", pr.size, (0, 0, 0, 255)); preta.putalpha(alfa)
    sombra.paste(preta, (x + round(w * 0.04), y + round(h * 0.03)), preta)
    sombra = sombra.filter(ImageFilter.GaussianBlur(max(4, w // 25)))
    out = Image.alpha_composite(bg, sombra)
    out.alpha_composite(pr, (x, y))
    out.convert("RGB").save(destino, "PNG")
    return destino
