"""MOLDES DE MARCA (mk_*): layouts novos que nascem da identidade de cada ambiente, em vez de pintar os moldes da
Do outro lado da Porta com outra cor.

Cada cor tem um PAPEL (não um lugar fixo):
  claro    = fundo claro (papel)            escuro  = fundo escuro / texto sobre claro
  sup      = superfície (cartões, faixas)   medio   = apoio
  destaque = 1 detalhe por slide (≤10%)     suave   = fios e enfeites (nunca texto)
Fontes: display (títulos e números) + texto (rótulos e corpo). Nada além de 2 famílias.
Estilos: "creme" (editorial claro), "ameixa" (escuro com brilho), "blush" (leve, rosado).
"""
import html
import re

PADRAO = {"claro": "#fdf3e8", "sup": "#f7c6d3", "escuro": "#4c1236", "medio": "#892b56", "destaque": "#d92258",
          "suave": "#dc93a5", "display": "Fraunces", "texto": "Archivo", "estilo": "creme", "handle": "@ruca.br"}


def _e(t):
    return html.escape(str(t or ""))


def _rico(t):
    """**palavra** = itálico da fonte de título (o jeito da marca destacar, sem marca-texto)."""
    t = _e(t)
    return re.sub(r"\*\*(.+?)\*\*", r"<em>\1</em>", t)


def _fontes(p):
    d = p["display"].replace(" ", "+"); x = p["texto"].replace(" ", "+")
    return (f"https://fonts.googleapis.com/css2?family={d}:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700"
            f"&family={x}:wght@400;500;600;700;800&display=block")


def _css(p):
    return f"""
:root{{--claro:{p['claro']};--sup:{p['sup']};--escuro:{p['escuro']};--medio:{p['medio']};--dest:{p['destaque']};--suave:{p['suave']};
--fd:'{p['display']}',Georgia,serif;--ft:'{p['texto']}',Arial,sans-serif}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{width:1080px;height:1350px;overflow:hidden;-webkit-font-smoothing:antialiased}}
.slide{{position:relative;width:1080px;height:1350px;overflow:hidden;font-family:var(--ft)}}
.foto{{width:100%;height:100%;object-fit:cover;object-position:var(--foco,50% 40%);display:block}}
.rot{{font:700 22px/1 var(--ft);letter-spacing:.14em;text-transform:uppercase}}
.pill{{display:inline-flex;align-items:center;gap:10px;padding:12px 22px;border-radius:999px;font:700 20px/1 var(--ft);letter-spacing:.12em;text-transform:uppercase}}
.tit{{font-family:var(--fd);font-weight:400;font-variation-settings:'opsz' 144,'SOFT' 50;letter-spacing:-.015em;line-height:1.02;text-wrap:balance}}
.tit em{{font-style:italic;font-weight:400}}
.txt{{font-family:var(--fd);font-weight:400;font-variation-settings:'opsz' 48;line-height:1.18;letter-spacing:-.005em;text-wrap:pretty}}
.txt em{{font-style:italic}}
.pe{{position:absolute;left:88px;right:88px;bottom:64px;display:flex;justify-content:space-between;align-items:center}}
.pe .rot{{font-size:18px;letter-spacing:.16em;opacity:.75}}
.n{{font:600 20px/1 var(--ft);letter-spacing:.16em}}

/* ---------- CREME: editorial claro ---------- */
.creme{{background:var(--claro);color:var(--escuro)}}
.creme .pe .rot,.creme .n{{color:var(--medio)}}
.creme.capa .quadro{{position:absolute;left:56px;right:56px;top:56px;height:760px;border-radius:28px;overflow:hidden}}
.creme.capa .bloco{{position:absolute;left:88px;right:88px;top:868px;bottom:130px;display:flex;flex-direction:column;gap:26px}}
.creme.capa .pill{{align-self:flex-start;background:var(--sup);color:var(--escuro)}}
.creme.capa .tit{{font-size:86px;color:var(--escuro)}}
.creme.capa .tit em{{color:var(--dest)}}
.creme.hist .bloco{{position:absolute;left:88px;right:88px;top:120px;height:520px;display:flex;flex-direction:column;justify-content:flex-end;gap:28px}}
.creme.hist .txt{{font-size:64px;color:var(--escuro)}}
.creme.hist .txt em{{color:var(--dest)}}
.creme.hist .quadro{{position:absolute;left:88px;right:88px;top:700px;height:520px;border-radius:24px;overflow:hidden}}
.creme.nums .cab{{position:absolute;left:88px;right:88px;top:120px;display:flex;flex-direction:column;gap:22px}}
.creme.nums .cab .rot{{color:var(--dest)}}
.creme.nums .cab .tit{{font-size:74px}}
.creme.nums .tabela{{position:absolute;left:88px;right:88px;top:420px;bottom:150px;display:flex;flex-direction:column;justify-content:space-between}}
.linha{{display:flex;align-items:baseline;gap:34px;padding:18px 0;border-top:2px solid var(--suave)}}
.linha:last-child{{border-bottom:2px solid var(--suave)}}
.linha .v{{font-family:var(--fd);font-weight:300;font-variation-settings:'opsz' 144;font-size:104px;line-height:.9;letter-spacing:-.02em;min-width:300px;font-variant-numeric:lining-nums}}
.linha .v small{{font-size:.5em;letter-spacing:0;margin-left:4px}}
.linha .l{{font:600 26px/1.25 var(--ft);letter-spacing:.1em;text-transform:uppercase}}
.creme .linha .v{{color:var(--escuro)}} .creme .linha .l{{color:var(--medio)}}
.creme .linha.foco .v,.creme .linha.foco .l{{color:var(--dest)}}

/* ---------- AMEIXA: escuro com brilho rosado (como as fotos de estúdio da marca) ---------- */
.ameixa{{background:var(--escuro);color:var(--claro)}}
.ameixa .pe .rot,.ameixa .n{{color:var(--sup)}}
.ameixa.capa .foto{{position:absolute;inset:0;height:100%}}
.ameixa.capa .veu{{position:absolute;inset:0;background:linear-gradient(180deg,rgba(76,18,54,0) 38%,rgba(76,18,54,.55) 58%,var(--escuro) 82%)}}
.ameixa.capa .bloco{{position:absolute;left:88px;right:88px;bottom:140px;height:430px;display:flex;flex-direction:column;justify-content:flex-end;gap:26px}}
.ameixa.capa .pill{{align-self:flex-start;border:2px solid var(--sup);color:var(--sup)}}
.ameixa.capa .tit{{font-size:90px;color:var(--claro)}}
.ameixa.capa .tit em{{color:var(--sup)}}
.ameixa.hist .meia{{position:absolute;left:0;right:0;top:0;height:690px}}
.ameixa.hist .meia::after{{content:"";position:absolute;inset:auto 0 0 0;height:140px;background:linear-gradient(180deg,rgba(76,18,54,0),var(--escuro))}}
.ameixa.hist .bloco{{position:absolute;left:88px;right:88px;top:740px;bottom:150px;display:flex;flex-direction:column;gap:26px}}
.ameixa.hist .txt{{font-size:60px;color:var(--claro)}}
.ameixa.hist .txt em{{color:var(--sup)}}
.ameixa.nums{{background:radial-gradient(900px 700px at 80% 0%,rgba(217,34,88,.32),rgba(217,34,88,0) 60%),var(--escuro)}}
.ameixa.nums .cab{{position:absolute;left:88px;right:88px;top:120px;display:flex;flex-direction:column;gap:22px}}
.ameixa.nums .cab .rot{{color:var(--sup)}}
.ameixa.nums .cab .tit{{font-size:74px}}
.ameixa.nums .tabela{{position:absolute;left:88px;right:88px;top:420px;bottom:150px;display:flex;flex-direction:column;justify-content:space-between}}
.ameixa .linha{{border-color:rgba(220,147,165,.45)}}
.ameixa .linha .v{{color:var(--claro)}} .ameixa .linha .l{{color:var(--sup)}}
.ameixa .linha.foco .v{{color:var(--sup)}}

/* ---------- BLUSH: leve, rosado, com cartão claro ---------- */
.blush{{background:var(--sup);color:var(--escuro)}}
.blush .pe .rot,.blush .n{{color:var(--medio)}}
.blush.capa .foto{{position:absolute;left:0;right:0;top:0;height:1000px}}
.blush.capa .cartao{{position:absolute;left:56px;right:56px;bottom:120px;max-height:560px;background:var(--claro);border-radius:32px;padding:56px 56px 48px;display:flex;flex-direction:column;gap:24px}}
.blush.capa .pill{{align-self:flex-start;background:var(--escuro);color:var(--claro)}}
.blush.capa .tit{{font-size:78px}}
.blush.capa .tit em{{color:var(--dest)}}
.blush.hist .quadro{{position:absolute;left:88px;right:88px;top:96px;height:640px;border-radius:300px 300px 28px 28px;overflow:hidden;border:10px solid var(--claro)}}
.blush.hist .bloco{{position:absolute;left:88px;right:88px;top:790px;bottom:150px;display:flex;flex-direction:column;gap:22px}}
.blush.hist .txt{{font-size:56px}}
.blush.hist .txt em{{color:var(--dest)}}
.blush.nums .cab{{position:absolute;left:88px;right:88px;top:110px;display:flex;flex-direction:column;gap:20px}}
.blush.nums .cab .rot{{color:var(--dest)}}
.blush.nums .cab .tit{{font-size:70px}}
.blush.nums .grade{{position:absolute;left:88px;right:88px;top:400px;bottom:150px;display:grid;grid-template-columns:1fr 1fr;gap:22px}}
.blush .cel{{background:var(--claro);border-radius:28px;padding:30px 34px;display:flex;flex-direction:column;justify-content:space-between}}
.blush .cel .v{{font-family:var(--fd);font-weight:300;font-variation-settings:'opsz' 144;font-size:110px;line-height:.9;letter-spacing:-.02em;color:var(--escuro)}}
.blush .cel .v small{{font-size:.5em}}
.blush .cel .l{{font:600 24px/1.25 var(--ft);letter-spacing:.1em;text-transform:uppercase;color:var(--medio)}}
.blush .cel.foco{{background:var(--escuro)}} .blush .cel.foco .v{{color:var(--claro)}} .blush .cel.foco .l{{color:var(--sup)}}
.blush .cel.larga{{grid-column:1 / -1;flex-direction:row;align-items:baseline;gap:30px}}

/* ---------- LISTA (itens com marcador fino) ---------- */
.lista .col{{position:absolute;left:88px;right:88px;top:120px;bottom:150px;display:flex;flex-direction:column;gap:64px}}
.lista .cab{{display:flex;flex-direction:column;gap:22px}}
.lista .cab .tit{{font-size:76px}}
.lista .cab .sub{{font:500 30px/1.4 var(--ft)}}
.lista .itens{{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-start;gap:0}}
.lista .it{{display:flex;align-items:center;gap:30px;padding:26px 0;border-top:2px solid var(--suave)}}
.lista .it:last-child{{border-bottom:2px solid var(--suave)}}
.lista .it i{{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font:600 22px/1 var(--ft);font-style:normal}}
.lista .it span{{font-family:var(--fd);font-variation-settings:'opsz' 48;font-size:48px;line-height:1.15}}
.creme.lista .cab .rot,.creme.lista .it i{{color:var(--dest)}} .creme.lista .it i{{border:2px solid var(--dest)}}
.creme.lista .cab .sub{{color:var(--medio)}} .creme.lista .it span{{color:var(--escuro)}}
.ameixa.lista .cab .rot{{color:var(--sup)}} .ameixa.lista .it i{{border:2px solid var(--sup);color:var(--sup)}} .ameixa.lista .cab .sub{{color:var(--sup)}}
.ameixa.lista .it{{border-color:rgba(220,147,165,.45)}}
.blush.lista .cab .rot{{color:var(--dest)}} .blush.lista .it{{border:0;background:var(--claro);border-radius:24px;padding:26px 30px;margin-bottom:16px}}
.blush.lista .it i{{background:var(--escuro);color:var(--claro)}}

/* ---------- FRASE (o slide de texto puro: virada, lição, aviso) ---------- */
.frase .bloco{{position:absolute;left:88px;right:88px;top:150px;bottom:170px;display:flex;flex-direction:column;justify-content:center;gap:34px}}
.frase .bloco .rot{{align-self:flex-start}}
.frase .antes,.frase .depois{{font-family:var(--fd);font-variation-settings:'opsz' 48;font-size:52px;line-height:1.2}}
.frase .virada{{font-family:var(--fd);font-style:italic;font-variation-settings:'opsz' 144;font-size:104px;line-height:1.02;letter-spacing:-.015em}}
.frase .corpo{{font-family:var(--fd);font-variation-settings:'opsz' 48;font-size:58px;line-height:1.2}}
.frase .corpo p+p{{margin-top:.6em}}
.frase .fio{{width:120px;height:2px}}
.creme.frase .rot,.creme.frase .virada{{color:var(--dest)}} .creme.frase .fio{{background:var(--suave)}}
.ameixa.frase .rot,.ameixa.frase .virada{{color:var(--sup)}} .ameixa.frase .fio{{background:var(--suave)}}
.ameixa.frase{{background:radial-gradient(900px 700px at 15% 100%,rgba(217,34,88,.28),rgba(217,34,88,0) 60%),var(--escuro)}}
.blush.frase .rot,.blush.frase .virada{{color:var(--dest)}} .blush.frase .fio{{background:var(--escuro)}}

/* ---------- FECHO (pedido do fim + o pacote REAL, sem IA) ---------- */
.fecho .bloco{{position:absolute;left:88px;right:88px;top:130px;height:600px;display:flex;flex-direction:column;justify-content:flex-start;gap:30px}}
.fecho .perg{{font-family:var(--fd);font-variation-settings:'opsz' 144;font-size:84px;line-height:1.04;letter-spacing:-.015em}}
.fecho .perg em{{font-style:italic}}
.fecho .corpo{{font:500 38px/1.42 var(--ft);max-width:860px}}
.fecho .corpo p+p{{margin-top:.55em}}
.fecho .palavra{{display:inline-block;padding:2px 16px;border-radius:999px;font-weight:800;letter-spacing:.06em}}
.fecho .pacote{{position:absolute;right:70px;bottom:120px;height:520px;filter:drop-shadow(0 30px 40px rgba(76,18,54,.35))}}
.fecho .brilho{{position:absolute;right:-120px;bottom:-60px;width:820px;height:820px;border-radius:50%;background:radial-gradient(closest-side,rgba(217,34,88,.35),rgba(217,34,88,0))}}
.fecho .siga{{position:absolute;left:88px;bottom:150px;font:700 22px/1 var(--ft);letter-spacing:.14em;text-transform:uppercase}}
.creme.fecho .perg{{color:var(--escuro)}} .creme.fecho .perg em{{color:var(--dest)}} .creme.fecho .corpo{{color:var(--medio)}}
.creme.fecho .palavra{{background:var(--dest);color:var(--claro)}} .creme.fecho .siga{{color:var(--dest)}}
.ameixa.fecho .perg{{color:var(--claro)}} .ameixa.fecho .perg em{{color:var(--sup)}} .ameixa.fecho .corpo{{color:var(--sup)}}
.ameixa.fecho .palavra{{background:var(--sup);color:var(--escuro)}} .ameixa.fecho .siga{{color:var(--sup)}}
.blush.fecho .perg{{color:var(--escuro)}} .blush.fecho .perg em{{color:var(--dest)}} .blush.fecho .corpo{{color:var(--medio)}}
.blush.fecho .palavra{{background:var(--escuro);color:var(--claro)}} .blush.fecho .siga{{color:var(--escuro)}}
"""


def _num(v):
    """'16 g' -> '16<small>g</small>' (a unidade menor e o número grande)."""
    m = re.match(r"^\s*([\d.,]+)\s*([^\d\s].*)?$", str(v))
    if not m:
        return _e(v)
    return _e(m.group(1)) + (f"<small>{_e(m.group(2))}</small>" if m.group(2) else "")


def html_slide(s, p=None):
    p = {**PADRAO, **(p or {})}
    est = s.get("estilo") or p["estilo"]
    m = s["molde"]; foco = _e(s.get("foco") or "50% 40%")
    handle = _e(p.get("handle") or "")
    pe = lambda n="": f'<div class="pe"><span class="rot">{handle}</span><span class="n">{_e(n)}</span></div>'
    if m == "mk_capa":
        pill = f'<span class="pill">{_e(s["chapeu"])}</span>' if s.get("chapeu") else ""
        foto = f'<img class="foto" src="{s["foto"]}" style="--foco:{foco}">'
        if est == "creme":
            corpo = f'<div class="quadro">{foto}</div><div class="bloco">{pill}<div class="tit fit" data-max="86">{_rico(s["texto"])}</div></div>'
        elif est == "ameixa":
            corpo = f'{foto}<div class="veu"></div><div class="bloco">{pill}<div class="tit fit" data-max="90">{_rico(s["texto"])}</div></div>'
        else:
            corpo = f'{foto}<div class="cartao">{pill}<div class="tit fit" data-max="78">{_rico(s["texto"])}</div></div>'
        corpo += pe("arrasta →")
    elif m == "mk_historia":
        foto = f'<img class="foto" src="{s["foto"]}" style="--foco:{foco}">'
        txt = f'<div class="txt fit" data-max="64">{_rico(s["texto"])}</div>'
        if est == "creme":
            corpo = f'<div class="bloco">{txt}</div><div class="quadro">{foto}</div>'
        elif est == "ameixa":
            corpo = f'<div class="meia">{foto}</div><div class="bloco">{txt}</div>'
        else:
            corpo = f'<div class="quadro">{foto}</div><div class="bloco">{txt}</div>'
        corpo += pe(s.get("n", ""))
    elif m == "mk_numeros":
        itens = s["itens"]  # [{"v": "18", "l": "alimentos", "foco": bool}]
        cab = f'<div class="cab"><span class="rot">{_e(s.get("chapeu", ""))}</span><div class="tit">{_rico(s.get("titulo", ""))}</div></div>'
        if est == "blush":
            cels = []
            for i, it in enumerate(itens):
                larga = " larga" if (len(itens) % 2 == 1 and i == len(itens) - 1) else ""
                cels.append(f'<div class="cel{larga}{" foco" if it.get("foco") else ""}"><div class="v">{_num(it["v"])}</div><div class="l">{_e(it["l"])}</div></div>')
            corpo = cab + f'<div class="grade">{"".join(cels)}</div>'
        else:
            linhas = "".join(f'<div class="linha{" foco" if it.get("foco") else ""}"><div class="v">{_num(it["v"])}</div><div class="l">{_e(it["l"])}</div></div>' for it in itens)
            corpo = cab + f'<div class="tabela">{linhas}</div>'
        corpo += pe(s.get("n", ""))
    elif m == "mk_lista":
        cab = (f'<div class="cab"><span class="rot">{_e(s.get("chapeu", ""))}</span><div class="tit">{_rico(s.get("titulo", ""))}</div>'
               + (f'<div class="sub">{_rico(s["sub"])}</div>' if s.get("sub") else "") + '</div>')
        marca = (lambda i: "✓") if s.get("check") else (lambda i: str(i))
        itens = "".join(f'<div class="it"><i>{marca(i)}</i><span>{_rico(t)}</span></div>' for i, t in enumerate(s.get("itens") or [], 1))
        corpo = f'<div class="col">{cab}<div class="itens"><div class="fit" style="font-size:inherit">{itens}</div></div></div>' + pe(s.get("n", ""))
    elif m == "mk_frase":
        rot = f'<span class="rot">{_e(s["rotulo"])}</span>' if s.get("rotulo") else ""
        if s.get("virada"):
            miolo = ((f'<div class="antes">{_rico(s.get("antes", ""))}</div>' if s.get("antes") else "")
                     + f'<div class="fio"></div><div class="virada">{_rico(s["virada"])}</div>'
                     + (f'<div class="depois">{_rico(s.get("depois", ""))}</div>' if s.get("depois") else ""))
        else:
            miolo = '<div class="corpo">' + "".join(f"<p>{_rico(x)}</p>" for x in (s.get("paragrafos") or [])) + "</div>"
        corpo = f'<div class="bloco"><div class="fit" style="display:flex;flex-direction:column;gap:30px">{rot}{miolo}</div></div>' + pe(s.get("n", ""))
    elif m == "mk_fecho":
        pal = s.get("palavra", "")
        ps = s.get("paragrafos") or []
        cta = [x for x in ps if "[[" in x or re.match(r"^\s*(comenta|comente|clica|clique|acesse|salva|salve)", x, re.I)]
        narr = " ".join(x for x in ps if x not in cta)
        txt = "".join(f"<p>{_rico(x)}</p>" for x in ([narr] if narr else []) + cta)
        if pal:
            txt = re.sub(r"\[\[(.+?)\]\]", lambda mm: f'<span class="palavra">{mm.group(1)}</span>', txt)
        pac = (f'<div class="brilho"></div><img class="pacote" src="{s["produto"]}">' if s.get("produto") else "")
        corpo = (f'{pac}<div class="bloco"><div class="fit" style="display:flex;flex-direction:column;gap:30px">'
                 f'<div class="perg">{_rico(s.get("pergunta", ""))}</div><div class="corpo">{txt}</div></div></div>'
                 f'<div class="siga">Siga {handle}</div>' + pe(""))
    else:
        raise ValueError(m)
    tipo = {"mk_capa": "capa", "mk_historia": "hist", "mk_numeros": "nums", "mk_lista": "lista", "mk_frase": "frase", "mk_fecho": "fecho"}[m]
    return (f'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="{_fontes(p)}">'
            f'<style>{_css(p)}</style></head><body><div class="slide {est} {tipo}">{corpo}</div></body></html>')


# encaixe do texto: diminui a letra de cada .fit até o bloco (o pai) parar de transbordar
FIT_MK = """
(() => {
  for (const el of document.querySelectorAll('.fit')) {
    const pai = el.parentElement; let fs = parseFloat(getComputedStyle(el).fontSize); let k = 0;
    // transborda se o texto sai da caixa do pai (por cima ou por baixo) ou fica mais largo que ela
    const passa = () => { const a = el.getBoundingClientRect(), c = pai.getBoundingClientRect();
      let topo = a.top; for (const f of pai.children) topo = Math.min(topo, f.getBoundingClientRect().top);
      return topo < c.top - 1 || a.bottom > c.bottom + 1 || el.scrollWidth > el.clientWidth + 1; };
    while (passa() && fs > 24 && k < 60) { fs *= 0.96; el.style.fontSize = fs + 'px'; k++; }
    el.dataset.encolheu = k;
  }
})();
"""


# ---------------- TRADUTOR: a diagramação da fábrica (moldes antigos) vira os layouts da marca ----------------
_NUM = re.compile(r"^\s*([\d.,]+\s*(?:g|kg|mg|ml|l|kcal|%|x)?)\s+(?:de\s+)?(.+)$", re.I)
FOTO = {"meia_tela", "f1_corrido", "foto_sticker", "esc_titulo_moldura", "antes_hoje", "esc_checklist", "lista_linhas", "noticia"}


def foco_rosto(foto, padrao="50% 30%"):
    """Acha o rosto maior da foto (OpenCV, grátis) e devolve o object-position que mantém o rosto no quadro.
    Sem rosto ou sem OpenCV: padrao (um pouco acima do meio, onde costumam estar as cabeças)."""
    try:
        import cv2
        from urllib.parse import urlparse, unquote
        from urllib.request import url2pathname
        cam = url2pathname(unquote(urlparse(foto).path)) if str(foto).startswith("file:") else str(foto)
        im = cv2.imread(cam)
        if im is None:
            return padrao
        h, w = im.shape[:2]; k = 640 / max(h, w)
        pq = cv2.cvtColor(cv2.resize(im, (int(w * k), int(h * k))), cv2.COLOR_BGR2GRAY)
        cas = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        rs = cas.detectMultiScale(pq, 1.1, 6, minSize=(28, 28))
        if len(rs) == 0:
            cas = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")
            rs = cas.detectMultiScale(pq, 1.1, 6, minSize=(28, 28))
        if len(rs) == 0:
            return padrao
        x, y, fw, fh = max(rs, key=lambda r: r[2] * r[3])
        cx = (x + fw / 2) / pq.shape[1]; cy = (y + fh / 2) / pq.shape[0]
        return f"{max(0, min(100, round(cx * 100)))}% {max(0, min(100, round(cy * 100 - 12)))}%"
    except Exception:
        return padrao


def _italico_final(t):
    """Capa: se não houver destaque, a última frase vira itálico (o jeito da marca)."""
    t = str(t or "").replace("\n", " ").strip()
    if "**" in t:
        return t
    partes = re.split(r"(?<=[.!?…])\s+", t)
    if len(partes) >= 2:
        return " ".join(partes[:-1]) + " **" + partes[-1] + "**"
    return t


_ASPAS = "\"“”«»'"


def _sem_aspas(t):
    return str(t or "").strip().strip(_ASPAS).strip()


def _maiuscula(t):
    t = str(t or "")
    return t[:1].upper() + t[1:] if t else t


def _com_titulo(s, ps):
    """O título do passo ("Segundo teste:") não pode sumir: entra como abertura em itálico, se ainda não estiver no texto."""
    tit = (s.get("titulo") or "").strip()
    junto = " ".join(ps).lower()
    if not tit or tit.lower().rstrip(":") in junto:
        return ps
    return [f"**{tit}**"] + [_maiuscula(ps[0])] + ps[1:] if ps else [f"**{tit}**"]


def adaptar(capa, slides, perfil=None):
    """Recebe a capa e os slides já diagramados e devolve os slides nos layouts da marca.
    Alterna o estilo claro com o escuro nos slides de virada e de números, para dar ritmo sem cor nova."""
    p = {**PADRAO, **(perfil or {})}
    base, alt = p.get("estilo", "creme"), p.get("alternar", "ameixa")
    out = [{"molde": "mk_capa", "estilo": base, "foto": capa.get("foto"), "foco": capa.get("foco") or foco_rosto(capa.get("foto"), "50% 30%"),
            "chapeu": capa.get("chapeu_marca") or p.get("chapeu_capa", ""), "texto": _italico_final(capa.get("texto") or capa.get("titulo"))}]
    n = len(slides)
    hist = 0
    for i, s in enumerate(slides, 2):
        m = s.get("molde", ""); ps = [x for x in (s.get("paragrafos") or []) if x]
        ult = (i == n + 1)
        nn = f"{i:02d}"
        itens = s.get("itens") or [c.get("nome") for c in (s.get("cards") or []) if c.get("nome")]
        numeros = [_NUM.match(str(t).replace("**", "")) for t in itens]
        if ult and m in ("cta_f6", "fecho_foto"):
            if s.get("texto") and s["texto"] not in ps:  # o pedido do fim às vezes vem no "texto" (cta_f6): não pode sumir
                ps = ps + [s["texto"]]
            junto = " ".join(ps)
            pal = re.search(r"\[\[(.+?)\]\]", junto)
            perg = s.get("pergunta") or ""
            if not perg:
                cands = [x for x in ps if x.rstrip().endswith("?") and "[[" not in x and not x.lstrip().startswith(tuple(_ASPAS))]
                if cands:
                    perg = cands[-1]; ps = [x for x in ps if x is not perg]
                elif ps and "[[" not in ps[0]:
                    frases = re.split(r"(?<=[.!])\s+", ps[0].strip(), maxsplit=1)
                    if 12 <= len(frases[0]) <= 80:
                        perg = frases[0]; ps = ([frases[1]] if len(frases) > 1 else []) + ps[1:]
            out.append({"molde": "mk_fecho", "estilo": base, "pergunta": perg, "paragrafos": ps,
                        "palavra": pal.group(1) if pal else "", "produto": p.get("produto_arquivo")})
        elif itens and sum(1 for x in numeros if x) >= max(2, len(itens) - 1):
            its = [{"v": x.group(1), "l": x.group(2)} if x else {"v": "", "l": str(t).replace("**", "")} for x, t in zip(numeros, itens)]
            for it in its:
                if re.match(r"^0\s*g", it["v"]):
                    it["foco"] = True
            out.append({"molde": "mk_numeros", "estilo": alt, "n": nn, "chapeu": s.get("titulo") or "", "titulo": s.get("sub") or "",
                        "itens": its})
        elif itens:
            out.append({"molde": "mk_lista", "estilo": base, "n": nn, "titulo": s.get("titulo") or "",
                        "sub": s.get("chapeu") or s.get("sub") or " ".join(ps), "itens": itens, "check": m == "esc_checklist"})
        elif m == "faixa_amarela":
            out.append({"molde": "mk_frase", "estilo": alt, "n": nn, "antes": " ".join(s.get("antes") or []),
                        "virada": s.get("faixa") or "", "depois": " ".join(s.get("depois") or [])})
        elif m in FOTO and (s.get("foto") or s.get("fotos")):
            hist += 1
            est_h = "blush" if (base == "creme" and hist % 3 == 2) else base
            fh = s.get("foto") or (s.get("fotos") or [None])[-1]
            out.append({"molde": "mk_historia", "estilo": est_h, "n": nn, "foto": fh, "foco": s.get("foco") or foco_rosto(fh, "50% 35%"),
                        "texto": " ".join(_com_titulo(s, ps)) or s.get("titulo") or s.get("texto") or ""})
        else:  # papel, lição, citação, aviso: frase pura
            rot = s.get("rotulo") or ("Atenção" if any(x.lower().startswith("atenção") for x in ps) else "")
            ps2 = [re.sub(r"^\s*Atenção:\s*", "", x) for x in ps] if rot == "Atenção" else ps
            ps2 = [x[:1].upper() + x[1:] if x else x for x in ps2]
            if m == "citacao" and s.get("texto"):
                nome = (s.get("nome") or "").strip()
                passo = re.match(r"^(sa[ií]da|passo|teste|dica|regra|parte|etapa|erro|motivo|pergunta)\b|^\d", nome, re.I)
                out.append({"molde": "mk_frase", "estilo": base, "n": nn, "rotulo": nome if passo else "",
                            "antes": " ".join(ps2) or _maiuscula(s.get("sub") or ""),
                            "virada": f"“{_sem_aspas(s['texto'])}”" if not passo else _sem_aspas(s["texto"]),
                            "depois": f"— {nome}" if nome and s.get("papel") and not passo else ""})
                continue
            ps2 = _com_titulo(s, ps2)
            junto = " ".join(ps2 or [s.get("texto", "")]).strip()
            mm = re.match(r"^(.{20,140}?):\s*(.{3,60})$", junto)
            if not rot and m != "citacao" and mm and len(mm.group(2).split()) <= 8:
                antes_v, resto = mm.group(1) + ":", mm.group(2)
                vir, _, dep = resto.partition(",")
                out.append({"molde": "mk_frase", "estilo": alt, "n": nn, "antes": antes_v, "virada": vir.strip().rstrip("."),
                            "depois": dep.strip()})
            else:
                out.append({"molde": "mk_frase", "estilo": base, "n": nn, "rotulo": rot, "paragrafos": ps2 or [s.get("texto", "")]})
    return out
