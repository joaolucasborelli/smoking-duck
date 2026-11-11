"""Gera as fotos e monta as capas de um lote de thumbs_teste (para o dono avaliar e treinar a fábrica).
Uso: python lote_thumbs.py lote1.json pasta_saida
lote1.json = resposta da ação thumbs_lote ({capas:[{id, ordem, molde, foto_prompt, foco, texto}]})
"""
import base64, json, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import robo
from render import renderizar

lote = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
saida = Path(sys.argv[2]).resolve(); saida.mkdir(parents=True, exist_ok=True)
nome = sys.argv[3] if len(sys.argv) > 3 else "lote1"
capas = sorted(lote["capas"], key=lambda c: c["ordem"])


def foto(c):
    vertical = c["molde"] in ("capa_f3a", "capa_f3b")
    caminho = f"thumbs/{nome}/{c['ordem']:02d}_foto.png"
    destino = saida / f"{c['ordem']:02d}_foto.png"
    if destino.exists():
        return c, caminho, "já tinha"
    for t in range(2):
        r = robo.chamar({"acao": "imagem", "prompt": c["foto_prompt"], "caminho": caminho,
                         "size": "1024x1536" if vertical else "1536x1024", "quality": "medium"}, timeout=200)
        if r.get("ok"):
            robo.baixar(caminho, destino)
            robo.chamar({"acao": "thumb_atualizar", "id": c["id"], "foto": caminho})
            return c, caminho, f"{r.get('segundos')}s"
        time.sleep(3)
    return c, None, f"ERRO {r}"


t0 = time.time()
with ThreadPoolExecutor(5) as ex:
    for c, cam, info in ex.map(foto, capas):
        print(f"{c['ordem']:02d} {c['molde']:9s} foto {info}", flush=True)

slides = []
for c in capas:
    f = saida / f"{c['ordem']:02d}_foto.png"
    if f.exists():
        slides.append({"molde": c["molde"], "foto": f.as_uri(), "foco": c.get("foco"), "texto": c["texto"],
                       "rotulos": (c.get("extra") or {}).get("rotulos"), "_c": c})
feitos = renderizar([{k: v for k, v in s.items() if k != "_c"} for s in slides], saida / "capas")
for s, f in zip(slides, feitos):
    c = s["_c"]; destino = f"thumbs/{nome}/{c['ordem']:02d}.png"
    b64 = base64.b64encode(Path(f["arquivo"]).read_bytes()).decode()
    robo.chamar({"acao": "salvar", "caminho": destino, "base64": b64})
    robo.chamar({"acao": "thumb_atualizar", "id": c["id"], "imagem": destino})
    Path(f["arquivo"]).rename(saida / "capas" / f"{c['ordem']:02d}_{c['molde']}.png")
print(f"{len(feitos)} capas em {time.time()-t0:.0f}s")
