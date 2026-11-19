"""Gera poses novas do boneco da TRIPE (juiz, sentado, dormindo, dançando...) a partir do render oficial.
Roda SÓ no GitHub Actions (workflow "Gerar bonecos", botão manual) com a identidade OIDC do repositório:
  1. sobe o render oficial e as referências do Instagram para o armazenamento (montador.salvar);
  2. pede cada pose à função capas.editar (a chave da OpenAI fica no servidor; o custo vai para a tabela custos);
  3. baixa os PNGs para saida_bonecos/ (vira artefato do run).
Pedidos em montagem/assets/tripe_refs/pedidos.json: [{"id": "juiz", "prompt": "...", "size": "1024x1536"}].
"""
import base64, json, os, sys, time, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import robo

AQUI = Path(__file__).resolve().parent
REFS = AQUI / "assets" / "tripe_refs"
SAIDA = Path(os.environ.get("SAIDA", "saida_bonecos"))
CAPAS = "https://odwbspgnxwcqmbcegkhw.supabase.co/functions/v1/capas"
PASTA = "tripe_bonecos"
TENTATIVAS = max(1, min(3, int(os.environ.get("TENTATIVAS") or "1")))


def subir(arq: Path):
    cam = f"{PASTA}/refs/{arq.name}"
    r = robo.chamar({"acao": "salvar", "caminho": cam, "base64": base64.b64encode(arq.read_bytes()).decode(), "tipo": "image/png"})
    if not r.get("ok"):
        sys.exit(f"não subiu {arq.name}: {r}")
    return cam


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    pedidos = json.loads((REFS / "pedidos.json").read_text(encoding="utf-8"))
    so = set(filter(None, (os.environ.get("SO") or "").split(",")))
    base = subir(REFS / "boneco_oficial.png")
    refs = [subir(p) for p in sorted(REFS.glob("ref_*.png"))]
    log = []
    for p in pedidos:
        if so and p["id"] not in so:
            continue
        for t in range(1, TENTATIVAS + 1):
            destino = f"{PASTA}/saida/{p['id']}_{t}.png"
            r = robo.chamar({"acao": "editar", "caminho": base, "referencias": refs, "destino": destino, "instrucao": p["prompt"],
                             "size": p.get("size", "1024x1536"), "quality": p.get("quality", "high")}, timeout=300, url=CAPAS)
            log.append({"id": p["id"], "tentativa": t, "ok": bool(r.get("ok")), "erro": r.get("erro")})
            print(p["id"], t, "ok" if r.get("ok") else f"erro: {r.get('erro')}", flush=True)
            if r.get("ok"):
                robo.baixar(destino, SAIDA / f"{p['id']}_{t}.png")
            elif any(k in str(r.get("erro", "")).lower() for k in ("billing", "credit", "quota", "créditos")):
                (SAIDA / "log.json").write_text(json.dumps(log, ensure_ascii=False, indent=1))
                sys.exit("OpenAI sem créditos")
            time.sleep(2)
    (SAIDA / "log.json").write_text(json.dumps(log, ensure_ascii=False, indent=1))
    if not any(x["ok"] for x in log):
        sys.exit("nenhuma imagem saiu")


if __name__ == "__main__":
    main()
