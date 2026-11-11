"""Foto fiel ao texto: diretor de cena -> foto -> conferente (visão) -> correção, até 2 rodadas.
Usado pelo lote de capas e (depois) pelo montador.
"""
import json, time
import robo

CAPAS = "https://odwbspgnxwcqmbcegkhw.supabase.co/functions/v1/capas"
MONTADOR = "https://odwbspgnxwcqmbcegkhw.supabase.co/functions/v1/montador"


def _chamar(url, corpo, timeout=200):
    return robo.chamar(corpo, timeout=timeout, url=url)


def foto_fiel(texto, molde, ideia, caminho_base, vertical=False, nota_minima=8, max_edicoes=2, log=print, ev=None):
    ev = ev or (lambda *a, **k: None)
    size = "1024x1536" if vertical else "1536x1024"
    ev("diretor", "Lendo a capa para decidir o instante exato da foto e o que tem que aparecer nela.")
    c = _chamar(CAPAS, {"acao": "cena", "texto": texto, "molde": molde, "ideia": ideia, "caminho": caminho_base})
    if not c.get("ok"):
        ev("diretor", "Não consegui montar a cena.", "erro")
        raise RuntimeError(f"cena: {c}")
    cena = c["cena"]
    det = ", ".join(cena["detalhes_do_texto"][:5])
    rostos = "; ".join(f"{p['quem']}: {p['o_que_aparece_no_rosto']}" for p in cena["pessoas"][:2])
    ev("diretor", f"Cena: {cena['momento'][:120]}. Tem que aparecer: {det}. Rosto: {rostos[:140]}.", "pronto",
       detalhes=cena["detalhes_do_texto"])
    log(f"  cena: {cena['momento'][:110]} | detalhes: {det[:120]}")
    cam = f"{caminho_base}_v0.png"
    ev("fotografo", "Fotografando a cena (foto realista de celular, expressão contida, sem faixa preta).")
    g = _chamar(MONTADOR, {"acao": "imagem", "prompt": cena["prompt"], "caminho": cam, "size": size, "quality": "medium"})
    if not g.get("ok") and "safety" in str(g.get("erro", "")).lower():
        # o gerador recusou (ex.: criança doente): o diretor refaz a cena de um jeito seguro, sem perder a história
        ev("fotografo", "O gerador recusou a foto por segurança. Vou pedir ao Diretor uma cena mais segura, com a mesma história.")
        c2 = _chamar(CAPAS, {"acao": "cena", "texto": texto, "molde": molde, "caminho": caminho_base, "ideia": ideia + (
            " SAFETY REWRITE: the previous prompt was rejected by the image safety system. Keep the story and the key objects, but show ONLY adults in focus;"
            " any child appears calm, asleep, seen from behind or out of frame; no illness, fever, medicine close-ups, injuries or distress on children;"
            " imply the situation through objects and the adult's restrained expression.")})
        if c2.get("ok"):
            cena = c2["cena"]
            g = _chamar(MONTADOR, {"acao": "imagem", "prompt": cena["prompt"], "caminho": cam, "size": size, "quality": "medium"})
    if not g.get("ok"):
        ev("fotografo", "A foto foi recusada pelo gerador mesmo depois de ajustar a cena.", "erro")
        raise RuntimeError(f"imagem: {g}")
    ev("fotografo", f"Foto pronta em {g.get('segundos', '?')}s. Mandei para o Conferente.", "pronto")
    historico = []
    melhor = (-1, cam)
    for rodada in range(max_edicoes + 1):
        ev("conferente", "Olhando a foto: os detalhes do texto estão lá? A expressão bate com o momento?")
        cf = _chamar(CAPAS, {"acao": "conferir", "caminho": cam, "texto": texto, "cena": cena})
        if not cf.get("ok"):
            log(f"  conferente falhou: {cf}"); ev("conferente", "Não consegui conferir esta versão.", "erro"); break
        k = cf["conferencia"]; historico.append({"versao": cam, **k})
        falta = "; ".join(k["detalhes_faltando"][:2]) or "nada"
        ev("conferente", f"Nota {k['nota']}/10. Falta: {falta[:150]}. Expressão: {k['expressao_problema'][:90] or 'ok'}.",
           "pronto" if k["nota"] >= nota_minima else "trabalhando", nota=k["nota"])
        log(f"  v{rodada}: nota {k['nota']} | faltando: {k['detalhes_faltando']} | expressão: {k['expressao_problema'] or 'ok'} | defeitos: {k['defeitos']}")
        if k["nota"] > melhor[0]:
            melhor = (k["nota"], cam)
        if k["nota"] >= nota_minima or rodada == max_edicoes or not k["correcao"]:
            break
        novo = f"{caminho_base}_v{rodada+1}.png"
        ev("retocador", f"Corrigindo só o que o Conferente apontou: {k['correcao'][:150]}")
        e = _chamar(CAPAS, {"acao": "editar", "caminho": cam, "destino": novo, "instrucao": k["correcao"], "size": size})
        if not e.get("ok"):
            log(f"  edição falhou: {e}"); ev("retocador", "A correção falhou; fico com a melhor versão.", "erro"); break
        ev("retocador", "Corrigido. Devolvi para o Conferente olhar de novo.", "pronto")
        cam = novo
    return {"cena": cena, "melhor": melhor[1], "nota": melhor[0], "historico": historico}
