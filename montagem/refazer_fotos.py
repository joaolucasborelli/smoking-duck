"""Refaz as fotos de capas com o ciclo foto fiel (diretor de cena -> foto -> conferente -> correção).
Uso: python refazer_fotos.py lote.json pasta_saida nome_lote [ordens separadas por vírgula | todas]
"""
import json, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import robo
from foto_fiel import foto_fiel

lote = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
saida = Path(sys.argv[2]); nome = sys.argv[3]
ordens = None if len(sys.argv) < 5 or sys.argv[4] == "todas" else {int(x) for x in sys.argv[4].split(",")}
capas = [c for c in lote["capas"] if ordens is None or c["ordem"] in ordens]
relatorio = []


def um(c):
    linhas = []
    ex = c.get("extra") or {}
    ideia = c["foto_prompt"] + (f" Famous person: {ex['famoso']} (fact: {ex['fato']})." if ex.get("famoso") else "")
    try:
        r = foto_fiel(c["texto"], c["molde"], ideia, f"thumbs/{nome}/{c['ordem']:02d}_fiel",
                      vertical=c["molde"] in ("capa_f3a", "capa_f3b"), log=linhas.append)
        robo.baixar(r["melhor"], saida / f"{c['ordem']:02d}_foto.png")
        robo.chamar({"acao": "thumb_atualizar", "id": c["id"], "foto": r["melhor"]})
        return c, r["nota"], len(r["historico"]), linhas
    except Exception as e:
        return c, None, 0, linhas + [f"  ERRO {e}"]


t0 = time.time()
with ThreadPoolExecutor(4) as ex:
    for c, nota, rodadas, linhas in ex.map(um, capas):
        print(f"{c['ordem']:02d} {c['molde']} nota final {nota} ({rodadas} conferências)")
        for l in linhas:
            print(l)
        relatorio.append({"ordem": c["ordem"], "nota": nota, "log": linhas})
json.dump(relatorio, open(saida / "relatorio_fiel.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"pronto em {time.time()-t0:.0f}s")
