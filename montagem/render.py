"""Renderiza uma ficha de montagem (lista de slides) em PNGs 1080x1350 com o Chromium do Playwright.
Uso: python render.py ficha.json pasta_saida
"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
from moldes_marca import FIT_MK
from moldes import slide_html, FIT_JS


def aparar_faixas(uri: str) -> str:
    """Corta faixas pretas/lisas que a IA às vezes desenha em cima ou embaixo da foto (quebram o degradê)."""
    from urllib.parse import urlparse
    from urllib.request import url2pathname
    from PIL import Image, ImageStat
    if not uri.startswith("file:"):
        return uri
    p = Path(url2pathname(urlparse(uri).path))  # funciona no Windows (/C:/...) e no Linux (/home/...)
    im = Image.open(p).convert("RGB"); w, h = im.size
    def lisa(y):
        st = ImageStat.Stat(im.crop((0, y, w, y + 1)))
        return max(st.mean) < 28 and max(st.stddev) < 10
    baixo = h
    while baixo > h * 0.5 and lisa(baixo - 1):
        baixo -= 1
    topo = 0
    while topo < h * 0.3 and lisa(topo):
        topo += 1
    if baixo >= h - 4 and topo <= 4:
        return uri
    novo = p.with_name(p.stem + "_aparada.png")
    im.crop((0, topo, w, baixo)).save(novo)
    return novo.as_uri()


def renderizar(slides, saida: Path):
    saida.mkdir(parents=True, exist_ok=True)
    slides = [dict(s, foto=aparar_faixas(s["foto"])) if s.get("foto") else s for s in slides]
    feitos = []
    with sync_playwright() as p:
        nav = p.chromium.launch()
        pg = nav.new_page(viewport={"width": 1080, "height": 1350}, device_scale_factor=1)
        for i, s in enumerate(slides, 1):
            tmp = saida / f"_slide{i:02d}.html"
            tmp.write_text(slide_html(s), encoding="utf-8")
            pg.goto(tmp.as_uri(), wait_until="networkidle")
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(150)
            pg.evaluate(FIT_MK if str(s.get("molde", "")).startswith("mk_") else FIT_JS)
            encolheu = pg.evaluate("[...document.querySelectorAll('.fit')].map(b=>+b.dataset.encolheu)")
            arq = saida / f"{i:02d}.png"
            pg.screenshot(path=str(arq), clip={"x": 0, "y": 0, "width": 1080, "height": 1350})
            tmp.unlink()
            feitos.append({"slide": i, "molde": s["molde"], "arquivo": str(arq), "encolheu": encolheu})
        nav.close()
    return feitos


if __name__ == "__main__":
    t = time.time()
    fp = Path(sys.argv[1]).resolve()
    ficha = json.loads(fp.read_text(encoding="utf-8"))
    for s in ficha["slides"]:
        if s.get("foto") and not s["foto"].startswith(("http", "file:")):
            s["foto"] = (fp.parent / s["foto"]).resolve().as_uri()
    r = renderizar(ficha["slides"], Path(sys.argv[2]).resolve())
    print(json.dumps(r, ensure_ascii=False, indent=1))
    print(f"{len(r)} slides em {time.time()-t:.1f}s")
