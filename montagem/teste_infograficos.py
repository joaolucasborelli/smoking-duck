"""Amostras dos moldes de infográfico (antes/depois). Uso: python teste_infograficos.py pasta_saida"""
import sys, shutil
from pathlib import Path
from render import renderizar

F = Path(__file__).resolve().parents[2] / "montagem" / "saida" / "posts_kit" / "kit_R1_aluguel"
foto = lambda n: (F / n).as_uri()

SLIDES = [
    {"molde": "conta_visual", "titulo": "FIM DO MÊS:", "caixas": [
        {"valor": "Fim do mês", "rotulo": "mecânico pago"},
        {"op": "+", "valor": "Zero", "rotulo": "briga"},
        {"op": "=", "valor": "sem nó", "rotulo": "no peito", "fim": True}]},
    {"molde": "conta_visual", "titulo": "A CONTA QUE **LUCAS** NUNCA FEZ", "caixas": [
        {"valor": "R$ 300", "rotulo": "por mês"},
        {"op": "×", "valor": "12", "rotulo": "meses"},
        {"op": "×", "valor": "12", "rotulo": "anos de juros"},
        {"op": "=", "valor": "uma entrada", "rotulo": "do apartamento", "fim": True}]},
    {"molde": "lista_linhas", "chapeu": "O que ele mudou", "titulo": "4 REGRAS DO **ENVELOPE**", "progresso": .6, "foto": foto("s03.png"),
     "itens": ["Separar o aluguel no dia que o salário cai", "Anotar tudo que passa de R$ 20", "Um envelope para cada conta fixa", "O que sobra vai para a caixinha, não para o Pix"]},
    {"molde": "antes_hoje", "fotos": [foto("s02.png"), foto("s04.png")], "rotulos": ["Antes", "Hoje"],
     "texto": "Mesma casa, mesmo salário. A diferença foi **saber para onde ia cada real**."},
    {"molde": "esc_cards", "titulo": "ONDE O **DINHEIRO** SUMIA", "sub": "O extrato de um mês comum do Lucas",
     "cards": [{"nome": "Delivery", "texto": "R$ 412 em 19 pedidos"}, {"nome": "Assinaturas", "texto": "6 apps, 2 que ele nem abria"},
               {"nome": "Parcelas", "texto": "R$ 640 de coisas que já tinham quebrado"}, {"nome": "Pix sem nome", "texto": "R$ 290 que ele não lembrava"}]},
    {"molde": "esc_checklist", "titulo": "O PLANO DE **30 DIAS**", "sub": "O que ele fez no primeiro mês", "foto": foto("s05.png"),
     "itens": ["Cancelou 4 assinaturas", "Levou marmita 3 dias por semana", "Guardou R$ 300 antes de gastar"]},
]

if __name__ == "__main__":
    out = Path(sys.argv[1]).resolve()
    if out.exists(): shutil.rmtree(out)
    r = renderizar(SLIDES, out)
    for x in r: print(x["molde"], x["arquivo"], x["encolheu"])
