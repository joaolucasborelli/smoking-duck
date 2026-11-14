/* Documento visual da marca + modo cliente (S2, plano v4 seção 3; contrato.md seções B, C, E).
   Modos:
   - documento.html?demo=1                → Marca Exemplo, tudo na memória (corrigir e desfazer simulados)
   - documento.html?demo=1&cliente=demo   → modo cliente de demonstração
   - documento.html?amb=<id>[&versao=N]   → modo dono (login do dono já feito na fábrica)
   - documento.html?cliente=<codigo>      → modo cliente (função pública "aprovacao", sem login)
   - em ?demo=1 também: &ficha=<endereço.json> ou o botão "Abrir ficha do computador" (só na memória)
   Nenhuma linha daqui chama IA direto. O único caminho que gastaria é marca.corrigir_trecho sem novo_valor,
   e ele só vai com a confirmação do dono (confirmar:true) e segue a regra de ensaio do servidor. */
(function () {
"use strict";

const SB_URL = "https://odwbspgnxwcqmbcegkhw.supabase.co";
const SB_KEY = "sb_publishable_foge1lfQeHHmC2TXOPKMFA_r1McAIjh";
const SB_LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
const CUSTO_TRECHO_MEDIDOR = 0.10;            // contrato F.4: correção de trecho
const CUSTO_TRECHO_REAL = +(CUSTO_TRECHO_MEDIDOR * 1.4).toFixed(2);

const q = new URLSearchParams(location.search);
const DEMO = q.get("demo") === "1";
const CLIENTE = q.get("cliente");
const AMB = q.get("amb") ? parseInt(q.get("amb"), 10) : null;
const MODO = CLIENTE ? "cliente" : (DEMO ? "demo" : (AMB ? "dono" : "nada"));

const $ = s => document.querySelector(s);
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = o => JSON.parse(JSON.stringify(o));

let F = null;              // ficha (formato do contrato, já normalizada)
let VERSAO = 1;
let INFO_CLIENTE = null;   // resposta de aprovacao.ver
let sb = null;
const respostas = {};      // modo cliente: parte -> {ok:true|false, texto}
const historico = [];      // correções desta sessão (demo) ou do servidor

/* ============================== avisos ============================== */
let avisoT = null;
function aviso(t, ms) {
  const a = $("#aviso"); a.textContent = t; a.hidden = false;
  clearTimeout(avisoT); avisoT = setTimeout(() => { a.hidden = true; }, ms || 3800);
}
function estado(html) { $("#doc").innerHTML = `<div class="estado">${html}</div>`; }

/* ============================== cores e contraste ============================== */
function hexRgb(h) {
  h = String(h || "").trim().replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16));
}
const rgbHex = r => "#" + r.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
function lum(h) {
  const r = hexRgb(h); if (!r) return 0;
  const c = r.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a, b) { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
function misturar(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); }
/* escurece/clareia a cor até ter contraste mínimo sobre o fundo */
function legivel(cor, fundo, alvo, puxarPara) {
  if (!hexRgb(cor)) return puxarPara;
  if (contraste(cor, fundo) >= alvo) return cor;
  for (let t = 0.08; t <= 1; t += 0.06) { const c = misturar(cor, puxarPara, t); if (contraste(c, fundo) >= alvo) return c; }
  return puxarPara;
}
function saturacao(h) { const r = hexRgb(h); if (!r) return 0; const mx = Math.max(...r), mn = Math.min(...r); return mx === 0 ? 0 : (mx - mn) / mx; }

/* ============================== ficha: leitura ============================== */
function pegar(obj, caminho) {
  return String(caminho || "").split(".").filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function ehCampo(o) { return o && typeof o === "object" && !Array.isArray(o) && "valor" in o && ("origem" in o || "certeza" in o); }
function selo(c) {
  if (!c || c.valor == null || (Array.isArray(c.valor) && !c.valor.length) || c.valor === "") return "cinza";
  if (c.conflito) return "amarelo";
  if (["socio", "anexo", "cliente"].includes(c.origem) && c.certeza === "alta") return "verde";
  return "amarelo";
}
const SELO_TXT = { verde: "confirmado", amarelo: "proposta com fonte", cinza: "falta" };
function seloHtml(c, comTexto) {
  const s = selo(c);
  const dica = `${SELO_TXT[s]}${c && c.fonte ? " · fonte: " + c.fonte : ""}${c && c.conflito ? " · conflito: " + c.conflito : ""}`;
  return comTexto
    ? `<span class="selo-txt"><i class="selo s-${s}" title="${esc(dica)}"></i>${SELO_TXT[s]}</span>`
    : `<i class="selo s-${s}" title="${esc(dica)}"></i>`;
}
/* todos os campos da ficha, com caminho */
function todosCampos(f) {
  const out = [];
  ["socios", "grupos"].forEach(sec => Object.entries(f[sec] || {}).forEach(([k, b]) => {
    Object.entries((b && b.campos) || {}).forEach(([c, v]) => { if (ehCampo(v)) out.push({ caminho: `${sec}.${k}.campos.${c}`, campo: v, bloco: b, sec, k, c }); });
  }));
  return out;
}
/* caminhos de campo a partir de uma fonte de página ("grupos.G1" → todos os campos do G1) */
function camposDaFonte(f, fonte) {
  const v = pegar(f, fonte);
  if (ehCampo(v)) return [fonte];
  if (v && v.campos) return Object.keys(v.campos).filter(c => ehCampo(v.campos[c])).map(c => `${fonte}.campos.${c}`);
  return [];
}

/* ============================== ficha: normalizar ============================== */
/* Aceita o formato do contrato ("ficha-v4") e o formato antigo montado à mão ("ficha_marca", usado só em prévia local). */
const ALIAS_BLOCO = { quem_ela_e: "quem_e", modelo_de_negocio: "modelo_negocio", tipos_de_post: "tipos_post", limites_e_aprovacao: "limites" };
const ALIAS_CAMPO = {
  quem_e: { arroba_instagram: "handle", o_que_e_em_1_frase: "uma_frase", fora_do_foco: "nao_e_foco", historia: "fundadores_historia" },
  modelo_negocio: { como_ganha_dinheiro: "como_ganha", onde_a_venda_acontece: "onde_vende", ticket_e_frequencia: "ticket_frequencia", o_que_o_post_move_agora: "o_que_o_post_move" },
  como_funciona: { jornada_do_seguidor: "jornada" },
  estrategia: { proporcao_marca_x_venda: "proporcao_marca_venda", frase_de_posicionamento: "posicionamento", tom_do_humor: "tom_humor" },
  tipos_post: { tipos: "lista" },
  limites: { nunca_faria: "proibidos", ia_pode_alterar_o_produto: "ia_altera_produto" },
  G1: { receita_em_palavras_simples: "receita_simples", por_que_agora_numeros: "numeros" },
  G2: { palavras_que_a_marca_ja_usa: "glossario" },
  G3: { concorrentes_do_produto: "concorrentes" },
  G4: { promessa_e_prova: "promessa_prova" },
  G5: { pares_em_vez_de_fala_assim: "pares", a_marca_soa: "soa", a_marca_nunca_soa: "nunca_soa" },
  G6: { estilo_de_foto: "estilo_foto" },
  G7: { molde_dos_vencedores: "moldes_vencedores", banco_de_ganchos: "banco_ganchos" },
  G8: { marcos_da_marca: "marcos", datas_do_setor_e_da_cultura: "datas_cultura" },
  G9: { fontes_a_vigiar: "fontes_vigiar", validade_da_noticia: "validade_horas" },
  G10: { promessas_proibidas: "proibidos", gatilhos_de_pausa: "gatilhos_pausa", direitos_de_imagem_e_audio: "direitos_imagem_audio", marcas_de_terceiros: "marcas_terceiros" },
  G12: { custo_por_mes: "custo_mes", quem_aprova_e_grava: "quem_aprova" },
  G15: { nome_de_busca: "nome_busca", posts_fixados: "fixados" },
  G17: { hashtags_e_busca: "hashtags" }
};
function renomearCampos(bloco, mapa) {
  if (!bloco || !bloco.campos || !mapa) return bloco;
  const novo = {};
  Object.entries(bloco.campos).forEach(([k, v]) => { const n = mapa[k] || k; if (!(n in novo)) novo[n] = v; else novo[k] = v; });
  bloco.campos = novo; return bloco;
}
function normalizar(f0) {
  const f = clone(f0);
  if (f.formato === "ficha_marca") {
    const socios = {};
    Object.entries(f.socios || {}).forEach(([k, b]) => {
      if (k === "anexos") return;
      const n = ALIAS_BLOCO[k] || k; b.titulo = b.titulo || b.nome; socios[n] = renomearCampos(b, ALIAS_CAMPO[n]);
    });
    const an = pegar(f0, "socios.anexos.campos") || {};
    f.anexos = Object.values(an).filter(c => c && c.valor).map((c, i) => ({ id: i + 1, nome: c.valor.arquivo || "", papel: c.valor.quanto_vale || "", descricao: c.valor.o_que_e || "" }));
    f.socios = socios;
    Object.entries(f.grupos || {}).forEach(([g, b]) => { b.titulo = b.titulo || b.nome; renomearCampos(b, ALIAS_CAMPO[g]); });
    f.marca = Object.assign({ handle: valor(f, "socios.quem_e.campos.handle") || "" }, f.marca || {});
    f.gerada_em = f.gerada_em || f.data; f.status = f.status || "rascunho";
  }
  f.socios = f.socios || {}; f.grupos = f.grupos || {}; f.marca = f.marca || { nome: "Marca" };
  f.conflitos = f.conflitos || []; f.faltando = f.faltando || [];
  if (!f.documento || !Array.isArray(f.documento.paginas) || !f.documento.paginas.length) f.documento = { paginas: planoPadrao(f) };
  return f;
}
function valor(f, caminho) { const c = pegar(f, caminho); return ehCampo(c) ? c.valor : undefined; }

/* plano de páginas quando a ficha não traz "documento" (seção 3.3 do plano) */
function planoPadrao(f) {
  const p = []; const add = (parte, modelo, titulo, fontes, extra) => p.push(Object.assign({ n: p.length + 1, parte, modelo, titulo, numero_destaque: null, fontes, feito_por: "editor", conferido_por: "cetico" }, extra || {}));
  const nome = f.marca.nome || "A marca";
  add("capa", "capa_parte", `${nome} · Estratégia de conteúdo · v${f.versao || 1}`, []);
  add("capa", "como_ler", "Verde é confirmado, amarelo é proposta com fonte, cinza é o que falta", []);
  const meta = valor(f, "grupos.G11.campos.meta");
  add("0", "frase_numero", textoMeta(meta) || valor(f, "socios.estrategia.campos.objetivo_90_dias") || "O que vocês pediram", ["grupos.G11.campos.meta", "socios.estrategia"]);
  add("1", "frase_numero", valor(f, "socios.quem_e.campos.uma_frase") || `Quem é ${nome}`, ["socios.quem_e", "grupos.G1"]);
  const pers = valor(f, "grupos.G2.campos.personas");
  if (Array.isArray(pers) && pers.length) pers.slice(0, 2).forEach(x => add("2", "persona", x.descricao || x.nome, ["grupos.G2.campos.personas"]));
  else add("2", "persona", "Para quem a gente fala", ["grupos.G2"]);
  add("3", "concorrente", "Quem já está lá fora", ["grupos.G3.campos.concorrentes"]);
  if (valor(f, "grupos.G3.campos.mapa_eixos")) add("3", "concorrente", "Onde sobra espaço", ["grupos.G3.campos.mapa_eixos"]);
  add("4", "frase_numero", valor(f, "grupos.G4.campos.frase") || "Posicionamento", ["grupos.G4"]);
  add("5", "em_vez_de", "Se precisa explicar a frase, a frase está errada", ["grupos.G5.campos.pares"]);
  add("5", "em_vez_de", "Como a marca soa e como nunca soa", ["grupos.G5.campos.palavras_sim", "grupos.G5.campos.palavras_nunca"]);
  add("6", "frase_numero", "O perfil decide em 3 segundos", ["grupos.G15"]);
  add("6", "frase_numero", "As cores e as letras da marca", ["grupos.G6"]);
  add("7", "roda_pilares", "Pilares e mix de formatos", ["grupos.G7.campos.pilares"]);
  const tipos = valor(f, "socios.tipos_post.campos.lista");
  (Array.isArray(tipos) ? tipos.slice(0, 4) : [null]).forEach(t => add("8", "tipo_post", t ? (t.nome || "Tipo de post") : "Tipos de post", ["socios.tipos_post"]));
  add("9", "calendario", "Até o próximo marco", ["grupos.G8", "grupos.G9"]);
  add("10", "semaforo", "Na dúvida, pausa", ["grupos.G10"]);
  add("11", "frase_numero", "Ritmo, quem faz o quê e o que ainda falta", ["grupos.G11", "grupos.G12"]);
  add("aprovacao", "aprovacao", "É a nossa cara?", []);
  return p;
}
function textoMeta(m) {
  if (!m) return "";
  if (typeof m === "string") return m.replace(/\.$/, "");
  if (typeof m === "object" && m.valor != null) return `${m.valor} ${m.unidade || ""}${m.data ? " até " + dataBonita(m.data) : ""}`.trim();
  return "";
}

/* ============================== textos ============================== */
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function dataBonita(d) {
  const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}`;
  return String(d || "");
}
function dataCurta(d) { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}` : String(d || ""); }
function extrairNumero(t) {
  const m = String(t || "").match(/(\d[\d.,]*\s?(mil|mi|milhões|%|min|dias|h|k|x)?)/i);
  return m ? m[1].trim() : null;
}
function texto(v) {
  if (v == null || v === "") return `<span class="falta">falta</span>`;
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number") return String(v).replace(".", ",");
  if (typeof v === "string") return esc(v);
  if (Array.isArray(v)) return v.map(x => typeof x === "object" ? texto(x) : esc(x)).join(" · ");
  return Object.entries(v).map(([k, x]) => `<b>${esc(rotulo(k))}:</b> ${typeof x === "object" && x ? texto(x) : esc(x == null ? "—" : x)}`).join("<br>");
}
function rotulo(k) { return String(k).replace(/_/g, " ").replace(/^./, c => c.toUpperCase()); }
function lista(v, cls) {
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) return `<span class="falta">falta</span>`;
  if (!Array.isArray(v)) return `<p>${texto(v)}</p>`;
  return `<ul class="lim ${cls || ""}">${v.map(x => `<li>${typeof x === "object" ? texto(x) : esc(x)}</li>`).join("")}</ul>`;
}
function listaDe(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim()) return v.split(/\s·\s|;\s|\n/).map(s => s.trim()).filter(Boolean);
  return [];
}
const AGENTE_TXT = { editor: "Editor", cetico: "Cético", critico: "Crítico", estrategista: "Estrategista", pesquisador_publico: "Pesquisador de público", pesquisador_concorrencia: "Pesquisador de concorrência", redator_voz: "Redator de voz", diretor_arte_marca: "Diretor de arte da marca", calendarista: "Calendarista", guardiao_riscos: "Guardião de riscos", especialista_instagram: "Especialista em Instagram", socio: "sócios", dono: "dono" };
const agente = k => AGENTE_TXT[k] || (k ? rotulo(k) : "—");

/* ============================== tema (veste a roupa da marca, G6) ============================== */
function paletaDe(f) {
  const p = valor(f, "grupos.G6.campos.paleta"); const perf = valor(f, "grupos.G6.campos.perfil_montagem") || {};
  let fundo, texto_, destaque, apoio, cores = [];
  if (Array.isArray(p)) {
    cores = p.filter(c => hexRgb(c.hex)).map(c => ({ nome: c.nome, hex: c.hex, papel: c.papel }));
    const princ = cores.find(c => /principal|destaque/i.test(c.papel || "")) || cores.slice().sort((a, b) => saturacao(b.hex) - saturacao(a.hex))[0];
    const porLum = cores.slice().sort((a, b) => lum(a.hex) - lum(b.hex));
    destaque = princ && princ.hex; texto_ = porLum[0] && porLum[0].hex;
    const claros = porLum.filter(c => lum(c.hex) > 0.6);
    // fundo: a cor que a ficha chama de fundo claro; senão o branco da paleta; senão a clara mais neutra
    fundo = (cores.find(c => /fundo/i.test(c.papel || "") && lum(c.hex) > 0.6) || claros.find(c => c.hex.toUpperCase() === "#FFFFFF") || claros.slice().sort((a, b) => saturacao(a.hex) - saturacao(b.hex))[0] || {}).hex;
    apoio = (cores.find(c => c.hex !== destaque && c.hex !== texto_ && c.hex !== fundo && lum(c.hex) < 0.4) || {}).hex;
  } else if (p && typeof p === "object") {
    ({ fundo, texto: texto_, destaque, apoio } = p);
    cores = Object.entries(p).filter(([, h]) => hexRgb(h)).map(([k, h]) => ({ nome: rotulo(k), hex: h, papel: (valor(f, "grupos.G6.campos.papel_das_cores") || {})[k] || "" }));
  }
  return { fundo: fundo || perf.claro, texto: texto_ || perf.escuro, destaque: destaque || perf.destaque, apoio: apoio || perf.medio, sup: perf.sup, escuro: perf.escuro, cores };
}
function tom(h) {
  const r = hexRgb(h); if (!r) return 0; const [R, G, B] = r.map(v => v / 255); const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
  if (!d) return 0; let t = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; t *= 60; return t < 0 ? t + 360 : t;
}
function distTom(a, b) { const d = Math.abs(tom(a) - tom(b)); return Math.min(d, 360 - d); }
function nomeFonte(s) { return s ? String(s).split(/[(:,]/)[0].trim() : ""; }
function aplicarTema(f) {
  const P = paletaDe(f); const r = document.documentElement.style;
  const temCor = hexRgb(P.destaque) || hexRgb(P.fundo);
  let bg = hexRgb(P.fundo) && lum(P.fundo) > 0.55 ? P.fundo : "#FAFAF7";
  let ink = hexRgb(P.texto) && contraste(P.texto, bg) >= 7 ? P.texto : "#16171A";
  let dark = hexRgb(P.escuro) && lum(P.escuro) < 0.08 ? P.escuro : (lum(ink) < 0.08 ? ink : "#16181D");
  let acc = hexRgb(P.destaque) ? P.destaque : "#0F766E";
  const onDark = contraste(bg, dark) >= 7 ? bg : "#F7F7F5";
  // contraste automático: destaque fraco no claro (ex.: amarelo-limão sobre branco) vira texto escurecido; nas páginas escuras o destaque aparece puro
  // 1º tenta uma cor da própria paleta com o mesmo tom e leitura boa; senão escurece o destaque
  const irma = P.cores.filter(c => c.hex !== acc && contraste(c.hex, bg) >= 4.5 && saturacao(c.hex) >= 0.5 && distTom(c.hex, acc) < 40).sort((a, b) => distTom(a.hex, acc) - distTom(b.hex, acc))[0];
  const accInk = contraste(acc, bg) >= 3.2 ? acc : (irma ? irma.hex : legivel(acc, bg, 3.2, ink));
  const accOnDark = contraste(acc, dark) >= 3 ? acc : legivel(acc, dark, 3.2, onDark);
  const sup = hexRgb(P.sup) && contraste(ink, P.sup) >= 7 ? P.sup : misturar(bg, ink, 0.06);
  if (temCor) {
    r.setProperty("--bg", bg); r.setProperty("--ink", ink); r.setProperty("--dark", dark); r.setProperty("--on-dark", onDark);
    r.setProperty("--acc", acc); r.setProperty("--acc-ink", accInk); r.setProperty("--acc-on-dark", accOnDark); r.setProperty("--sup", sup);
    r.setProperty("--muted", misturar(ink, bg, 0.38)); r.setProperty("--line", misturar(bg, ink, 0.16));
  }
  // fontes: título e texto da ficha; sem licença → substituta grátis com aviso
  const fo = valor(f, "grupos.G6.campos.fontes") || {};
  const perf = valor(f, "grupos.G6.campos.perfil_montagem") || {};
  let tit = nomeFonte(fo.substituta_gratis && fo.substituta_gratis.titulo) || nomeFonte(fo.titulo || fo.titulos) || nomeFonte(perf.display);
  let txt = nomeFonte(fo.substituta_gratis && fo.substituta_gratis.texto) || nomeFonte(fo.texto) || nomeFonte(perf.texto);
  if (typeof fo.substituta_gratis === "string" && /substitut/i.test(fo.substituta_gratis) && !/não precisa/i.test(fo.substituta_gratis)) {
    const m = fo.substituta_gratis.match(/([A-Z][\w ]+?)(?: no Google| \(|$)/); if (m) tit = m[1].trim();
  }
  const fams = [tit, txt].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  if (fams.length) {
    const l = document.createElement("link"); l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?" + fams.map(n => "family=" + encodeURIComponent(n).replace(/%20/g, "+") + ":wght@400;500;600;700;800").join("&") + "&display=swap";
    document.head.appendChild(l);
  }
  if (tit) r.setProperty("--f-tit", `"${tit}","Inter Tight",system-ui,sans-serif`);
  if (txt) r.setProperty("--f-txt", `"${txt}","Inter",system-ui,sans-serif`);
  return { P, tit, txt, temCor };
}

/* ============================== montar páginas ============================== */
const PARTES = {
  capa: "Capa", "0": "O que vocês pediram", "1": "Quem é a marca", "2": "Para quem", "3": "Onde a gente joga", "4": "Posicionamento",
  "5": "Como a gente fala", "6": "Perfil, visual e formatos", "7": "Pilares e mix", "8": "Tipos de post", "9": "Calendário e assuntos do momento",
  "10": "Riscos e Pausa", "11": "Metas, operação e o que falta", aprovacao: "Aprovação", apendice: "Apêndice"
};
const ATOS = [
  { antes: "0", n: "01", rot: "Parte um", tit: "Onde a gente está", lead: "O que vocês pediram, quem é a marca, para quem ela fala e quem já está lá fora." },
  { antes: "4", n: "02", rot: "Parte dois", tit: "Quem a gente é", lead: "A frase que posiciona, o jeito de falar e a roupa que a marca veste no Instagram." },
  { antes: "7", n: "03", rot: "Parte três", tit: "O que a gente posta", lead: "Pilares, mix de formatos, os tipos de post com exemplos e o calendário até o próximo marco." },
  { antes: "10", n: "04", rot: "Parte quatro", tit: "Como a gente cuida", lead: "O que nunca entra, quando pausar, a meta e quem faz o quê." }
];
const numParte = p => /^\d+$/.test(p) ? String(p).padStart(2, "0") : "";

/* contexto de uma página: registra os campos usados (para o rodapé e o "corrigir") */
function novoCtx(pag) {
  const ctx = { pag, usados: [] };
  ctx.C = caminho => { const c = pegar(F, caminho); if (ehCampo(c) && !ctx.usados.includes(caminho)) ctx.usados.push(caminho); return ehCampo(c) ? c : null; };
  ctx.V = caminho => { const c = ctx.C(caminho); return c ? c.valor : undefined; };
  ctx.S = (caminho, txt) => seloHtml(ctx.C(caminho), txt);
  return ctx;
}

function montarDocumento() {
  const paginas = F.documento.paginas.slice().sort((a, b) => (a.n || 0) - (b.n || 0));
  const html = []; let num = 0; const atosFeitos = new Set();
  const temCapaParte = new Set(paginas.filter(p => p.modelo === "capa_parte" && p.parte !== "capa").map(p => p.parte));
  const todas = [];
  paginas.forEach(p => {
    const ato = ATOS.find(a => a.antes === String(p.parte));
    if (ato && !atosFeitos.has(ato.antes) && !temCapaParte.has(p.parte)) { atosFeitos.add(ato.antes); todas.push({ _ato: ato, parte: p.parte, modelo: "capa_parte" }); }
    todas.push(p);
  });
  if (!paginas.some(p => p.parte === "apendice")) apendicePaginas().forEach(p => todas.push(p));
  todas.forEach((p, i) => { num++; html.push(montarPagina(p, num, i, todas)); });
  $("#doc").innerHTML = html.join("");
  ligarPaginas();
  $("#rodape-geral").hidden = false;
}

function montarPagina(pag, num, idx, todas) {
  const ctx = novoCtx(pag);
  const modelo = pag.modelo;
  const fn = MODELOS[modelo] || MODELOS._generico;
  // índice entre páginas do mesmo modelo e parte (ex.: 2ª persona → personas[1])
  ctx.ordem = todas.slice(0, idx).filter(x => x.modelo === modelo && x.parte === pag.parte && !x._ato).length;
  const corpo = fn(ctx);
  const escura = ctx.escura ? " escura" : "";
  const parteTxt = pag._ato ? pag._ato.rot : (PARTES[pag.parte] || pag.parte || "");
  const topo = pag._ato || modelo === "capa_parte" ? "" :
    `<div class="pg-topo"><span>${numParte(pag.parte) ? numParte(pag.parte) + " · " : ""}${esc(parteTxt)}</span><span>${resumoSelos(ctx)}</span></div>`;
  const id = `pg-${num}`;
  return `<section class="pg${escura}" id="${id}" data-n="${num}" data-parte="${esc(pag.parte)}" data-titulo="${esc(pag.titulo || parteTxt)}" data-caminhos="${esc(JSON.stringify(caminhosDaPagina(pag, ctx)))}" data-idx="${idx}">
    <div class="pg-acoes"></div>
    ${topo}
    <div class="pg-corpo">${corpo}</div>
    ${rodape(pag, ctx, num)}
  </section>`;
}
function caminhosDaPagina(pag, ctx) {
  const c = ctx.usados.slice();
  (pag.fontes || []).forEach(fo => camposDaFonte(F, fo).forEach(x => { if (!c.includes(x)) c.push(x); }));
  return c;
}
function resumoSelos(ctx) {
  if (!ctx.usados.length) return "";
  const n = { verde: 0, amarelo: 0, cinza: 0 };
  ctx.usados.forEach(cm => { n[selo(pegar(F, cm))]++; });
  return ["verde", "amarelo", "cinza"].filter(s => n[s]).map(s => `<span class="selo-txt" style="margin-left:1em"><i class="selo s-${s}"></i>${n[s]}</span>`).join("");
}
function rodape(pag, ctx, num) {
  if (pag._ato) return `<div class="pg-rodape"><span></span><span class="num">${String(num).padStart(2, "0")}</span></div>`;
  const fontes = [];
  ctx.usados.forEach(cm => { const c = pegar(F, cm); if (c && c.fonte && !fontes.includes(c.fonte)) fontes.push(c.fonte); });
  const feito = pag.feito_por || ((ctx.usados[0] || "").startsWith("grupos.") ? pegar(F, ctx.usados[0].split(".").slice(0, 2).join(".") + ".feito_por") : "") || "editor";
  const fonteTxt = fontes.length ? fontes.slice(0, 3).map(esc).join("; ") + (fontes.length > 3 ? ` e mais ${fontes.length - 3}` : "") : "—";
  return `<div class="pg-rodape"><span><b>feito por</b> ${esc(agente(feito))} · <b>fonte</b> ${fonteTxt} · <b>conferido por</b> ${esc(agente(pag.conferido_por || "critico"))}</span><span class="num">${String(num).padStart(2, "0")}</span></div>`;
}

/* ---------- pedaços reutilizados ---------- */
function blocoCampo(ctx, caminho, rot, opts) {
  const c = ctx.C(caminho); opts = opts || {};
  const v = c ? c.valor : null;
  const corpo = opts.lista ? lista(listaDe(v).length ? listaDe(v) : v) : `<p>${texto(v)}</p>`;
  return `<div class="${opts.cls || ""}"><div class="rot">${seloHtml(c)}${esc(rot)}</div>${corpo}</div>`;
}
function numeroComFonte(valor_, txt, fonte, c) {
  return `<div><div class="num-g">${esc(valor_)}</div>${txt ? `<div class="num-txt">${esc(txt)}</div>` : ""}<div class="num-fonte">${c ? seloHtml(c) : ""}${fonte ? "fonte: " + esc(fonte) : ""}</div></div>`;
}
function caixa(rot, conteudo, cls, c) { return `<div class="caixa ${cls || ""}"><div class="rot">${c ? seloHtml(c) : ""}${esc(rot)}</div><div>${conteudo}</div></div>`; }
function tituloPag(ctx, alt, grande) {
  const t = ctx.pag.titulo || alt || "";
  return `<h2 class="titulo${grande ? " g" : ""}">${destacarFinal(t)}</h2>`;
}
/* destaca a última parte do título (depois de ":" ou a última palavra forte), como num bom documento de marca */
function destacarFinal(t) {
  t = String(t || "");
  const i = t.indexOf(":");
  if (i > 0 && i < t.length - 2) return esc(t.slice(0, i + 1)) + " <em>" + esc(t.slice(i + 1).trim()) + "</em>";
  return esc(t);
}

/* ============================== os modelos de página ============================== */
const MODELOS = {
  /* 1 · capa (do documento) e capa de parte */
  capa_parte(ctx) {
    ctx.escura = true; const p = ctx.pag;
    if (p._ato) {
      return `<div class="parte-rot">${esc(p._ato.rot)}</div><div class="parte-tit">${esc(p._ato.tit)}</div><div class="parte-lead">${esc(p._ato.lead)}</div><div class="parte-n">${p._ato.n}</div>`;
    }
    if (p.parte !== "capa") {
      return `<div class="parte-rot">${esc(PARTES[p.parte] || p.parte)}</div><div class="parte-tit">${esc(p.titulo || "")}</div><div class="parte-n">${numParte(p.parte)}</div>`;
    }
    const handle = ctx.V("socios.quem_e.campos.handle") || F.marca.handle || "";
    const frase = ctx.V("grupos.G4.campos.frase") || ctx.V("socios.estrategia.campos.posicionamento") || ctx.V("socios.quem_e.campos.slogan");
    return `<div class="pg-topo" style="margin:0"><span>${esc(handle)}</span><span>Estratégia de conteúdo</span></div>
      <div class="capa-marca">${esc(F.marca.nome || "")}</div>
      <div class="capa-sub">Estratégia de conteúdo · v${esc(VERSAO)} · ${esc(dataBonita(F.gerada_em) || "")}</div>
      ${frase ? `<div class="capa-meta" style="font-size:max(14px,1.5cqw);max-width:50ch;margin:.6cqw 0 1.4cqw">${esc(typeof frase === "string" ? frase : "")}</div>` : ""}
      <div class="legenda-selos"><span><i class="selo s-verde"></i>verde · confirmado</span><span><i class="selo s-amarelo"></i>amarelo · proposta com fonte</span><span><i class="selo s-cinza"></i>cinza · falta</span></div>`;
  },

  /* 2 · como ler: os selos e a contagem */
  como_ler(ctx) {
    const n = { verde: 0, amarelo: 0, cinza: 0 }; todosCampos(F).forEach(x => n[selo(x.campo)]++);
    const total = n.verde + n.amarelo + n.cinza || 1;
    const cart = (s, t, d) => `<div class="cartao"><div class="num-m" style="color:var(--s-${s})">${n[s]}</div><h4 style="margin-top:.6cqw"><i class="selo s-${s}"></i> ${t}</h4><div class="mini">${d}</div></div>`;
    return `${tituloPag(ctx, "Como ler este documento")}
      <p class="lead">Cada página tem uma ideia só. Em cada informação há um selo: ele diz de onde veio e se já foi conferido. No pé da página: quem fez, de onde tirou e quem conferiu.</p>
      <div class="g3" style="margin-top:auto">
        ${cart("verde", "Confirmado", "Vocês disseram ou está nos seus documentos, com certeza alta.")}
        ${cart("amarelo", "Proposta com fonte", "Ideia dos agentes, com a fonte ao lado. Confira e diga se é a cara de vocês.")}
        ${cart("cinza", "Falta", "Ninguém disse ainda. No fim tem perguntas de múltipla escolha.")}
      </div>
      <p class="num-fonte" style="margin-top:1.6cqw">${total} informações nesta versão · ${Math.round(n.verde / total * 100)}% já confirmadas</p>`;
  },

  /* 3 · frase + número gigante com fonte (varia pela parte) */
  frase_numero(ctx) {
    const p = ctx.pag; const parte = String(p.parte);
    if (parte === "0") return paginaPedido(ctx);
    if (parte === "1") return paginaQuemE(ctx);
    if (parte === "4") return paginaPosicionamento(ctx);
    if (parte === "6") return (p.fontes || []).some(x => /G15/.test(x)) || ctx.ordem === 0 && !(p.fontes || []).some(x => /G6/.test(x)) ? paginaPerfil(ctx) : paginaVisual(ctx);
    if (parte === "11") return paginaOperacao(ctx);
    return MODELOS._generico(ctx);
  },

  /* 4 · persona */
  persona(ctx) {
    const pers = ctx.V("grupos.G2.campos.personas");
    const x = Array.isArray(pers) ? pers[ctx.ordem] : null;
    if (x) {
      const ini = (x.nome || "?").trim().charAt(0).toUpperCase();
      const col = (r, v) => `<div class="campo-p"><div class="rot">${r}</div>${lista(v)}</div>`;
      return `${tituloPag(ctx, x.nome)}
        <div class="persona-cab"><div class="avatar">${esc(ini)}</div><div><h3 style="font:800 max(18px,2.2cqw)/1.1 var(--f-tit);margin:0">${esc(x.nome || "")} ${ctx.S("grupos.G2.campos.personas")}</h3><div class="lead" style="margin:.3cqw 0 0">${esc(x.faixa || "")}${x.faixa ? " · " : ""}${esc(x.descricao || "")}</div></div></div>
        <div class="g3" style="margin-top:auto">${col("O que dói", x.dores)}${col("O que quer", x.desejos)}${col("O que trava", x.objecoes)}</div>
        ${ctx.ordem === 0 ? `<div class="g2" style="margin-top:1.8cqw">${blocoCampo(ctx, "grupos.G2.campos.o_que_faz_marcar_amigo", "O que faz marcar um amigo")}${blocoCampo(ctx, "grupos.G2.campos.horarios", "Quando o perfil está olhando")}</div>` : ""}`;
    }
    const perfil = ctx.V("grupos.G2.campos.perfil_principal");
    if (perfil && typeof perfil === "object") {
      return `${tituloPag(ctx, "Para quem a gente fala")}
        <div class="g3" style="margin-top:auto">${Object.entries(perfil).map(([k, v]) => `<div class="campo-p"><div class="rot">${ctx.S("grupos.G2.campos.perfil_principal")}${esc(rotulo(k))}</div><p>${texto(v)}</p></div>`).join("")}
        ${ctx.C("grupos.G2.campos.quem_espera") ? `<div class="campo-p"><div class="rot">${ctx.S("grupos.G2.campos.quem_espera")}Quem espera</div><p>${texto(ctx.V("grupos.G2.campos.quem_espera"))}</p></div>` : ""}</div>
        <div class="g2" style="margin-top:1.8cqw">${blocoCampo(ctx, "grupos.G2.campos.o_que_faz_marcar_amigo", "O que faz marcar um amigo")}${blocoCampo(ctx, "grupos.G2.campos.personas", "Personas detalhadas")}</div>`;
    }
    return MODELOS._generico(ctx);
  },

  /* 5 · cartões de concorrente com BRECHA (ou o mapa de eixos) */
  concorrente(ctx) {
    const usaMapa = (ctx.pag.fontes || []).some(x => /mapa_eixos/.test(x));
    if (usaMapa) {
      const m = ctx.V("grupos.G3.campos.mapa_eixos") || {};
      const conc = ctx.V("grupos.G3.campos.concorrentes") || [];
      const pos = [[22, 70], [70, 22], [30, 30], [78, 62], [50, 80], [15, 45]];
      return `${tituloPag(ctx)}
        <div class="col-l"><div><div class="eixos">
          <span class="ex" style="left:0;bottom:-2.2cqw">${esc((m.x || "").split("→")[0] || "")}</span><span class="ex" style="right:0;bottom:-2.2cqw">${esc((m.x || "").split("→")[1] || "")}</span>
          <span class="ex" style="left:-1.4cqw;bottom:0;transform:rotate(-90deg);transform-origin:left bottom">${esc((m.y || "").split("→")[0] || "")}</span><span class="ex" style="left:-1.4cqw;top:0;transform:rotate(-90deg) translateX(-100%);transform-origin:left top">${esc((m.y || "").split("→")[1] || "")}</span>
          ${conc.slice(0, 6).map((c, i) => `<span class="ponto" style="left:${pos[i][0]}%;top:${pos[i][1]}%">${esc(c.perfil || c.nome)}</span>`).join("")}
          <span class="ponto nos" style="left:86%;top:8%">${esc(F.marca.nome)}</span>
        </div><div class="num-fonte">${ctx.S("grupos.G3.campos.mapa_eixos")}nossa posição: ${esc(m.nossa_posicao || "—")}</div></div>
        <div>${blocoCampo(ctx, "grupos.G3.campos.promessas_gastas", "Promessas gastas (ninguém acredita mais)", { lista: true })}
        ${caixa("A brecha", texto(m.nossa_posicao ? `Ninguém ocupa “${m.nossa_posicao}”. É aí que a gente joga.` : null), "", ctx.C("grupos.G3.campos.mapa_eixos"))}</div></div>`;
    }
    const conc = ctx.V("grupos.G3.campos.concorrentes");
    const sinc = ctx.C("grupos.G3.campos.sendo_sincero");
    if (!Array.isArray(conc) || !conc.length) return MODELOS._generico(ctx);
    return `${tituloPag(ctx, "Quem já está lá fora")}
      <div class="g3" style="flex:1;align-content:center">${conc.slice(0, 6).map(c => `<div class="conc">
        <h4>${esc(c.perfil || c.nome || "")}</h4>
        <div class="oque">${esc(c.o_que_faz || [c.tipo, c.frequencia, Array.isArray(c.formatos) ? c.formatos.join(", ") : c.formatos, c.tom].filter(Boolean).join(" · "))}</div>
        <div class="brecha"><div class="rot">Brecha</div><p>${esc(c.brecha || "—")}</p></div></div>`).join("")}</div>
      ${sinc ? caixa("Sendo sincero", texto(sinc.valor), "sincero", sinc) : ""}
      <div class="num-fonte" style="margin-top:1cqw">${ctx.S("grupos.G3.campos.concorrentes")}${conc.length} concorrentes olhados</div>`;
  },

  /* 6 · em vez de / fala assim (ou palavras sim/nunca + réguas) */
  em_vez_de(ctx) {
    const palavras = (ctx.pag.fontes || []).some(x => /palavras_/.test(x));
    if (palavras || ctx.ordem > 0) {
      const sim = listaDe(ctx.V("grupos.G5.campos.palavras_sim") || ctx.V("grupos.G5.campos.soa"));
      const nunca = listaDe(ctx.V("grupos.G5.campos.palavras_nunca") || ctx.V("grupos.G5.campos.nunca_soa"));
      const reg = ctx.V("grupos.G5.campos.reguas_tom");
      const enao = ctx.V("grupos.G4.campos.e_nao_e");
      return `${tituloPag(ctx)}
        <div class="col-l"><div>
          <div class="rot">${ctx.S(ctx.C("grupos.G5.campos.palavras_sim") ? "grupos.G5.campos.palavras_sim" : "grupos.G5.campos.soa")}A marca soa / usa</div><div class="soa">${sim.map(w => `<span>${esc(w)}</span>`).join("") || '<span class="falta">falta</span>'}</div>
          <div class="rot" style="margin-top:1.6cqw">${ctx.S(ctx.C("grupos.G5.campos.palavras_nunca") ? "grupos.G5.campos.palavras_nunca" : "grupos.G5.campos.nunca_soa")}Nunca soa / nunca usa</div><div class="soa nunca">${nunca.map(w => `<span>${esc(w)}</span>`).join("") || '<span class="falta">falta</span>'}</div>
          ${enao ? `<div class="g2" style="margin-top:1.8cqw"><div class="campo-p"><div class="rot">${ctx.S("grupos.G4.campos.e_nao_e")}A marca é</div><p>${texto(enao.e)}</p></div><div class="campo-p"><div class="rot">A marca não é</div><p>${texto(enao.nao_e)}</p></div></div>` : ""}
        </div><div>
          ${Array.isArray(reg) && reg.length ? `<div class="rot">${ctx.S("grupos.G5.campos.reguas_tom")}Réguas de tom</div>${reg.map(r => `<div class="regua"><div class="linha"><i style="left:${Math.max(0, Math.min(10, +r.nos || 5)) * 10}%"></i></div><div class="pontas"><span>${esc(r.de)}</span><span>${esc(r.ate)}</span></div></div>`).join("")}` : ""}
          ${blocoCampo(ctx, "grupos.G5.campos.personalidade", "Personalidade", { cls: "campo-p" })}
          ${blocoCampo(ctx, "grupos.G5.campos.emojis", "Emojis", { cls: "campo-p" })}
        </div></div>`;
    }
    const pares = ctx.V("grupos.G5.campos.pares");
    if (!Array.isArray(pares) || !pares.length) return MODELOS._generico(ctx);
    const comp = pares.length > 6;
    const cSoa = ctx.C("grupos.G5.campos.soa") || ctx.C("grupos.G5.campos.palavras_sim");
    const cNunca = ctx.C("grupos.G5.campos.nunca_soa") || ctx.C("grupos.G5.campos.palavras_nunca");
    const soa = !comp && cSoa ? `<div class="g2" style="margin-top:auto;padding-top:2cqw"><div class="campo-p"><div class="rot">${seloHtml(cSoa)}A marca soa</div><div class="soa">${listaDe(cSoa.valor).map(w => `<span>${esc(w)}</span>`).join("")}</div></div>${cNunca ? `<div class="campo-p"><div class="rot">${seloHtml(cNunca)}A marca nunca soa</div><div class="soa nunca">${listaDe(cNunca.valor).map(w => `<span>${esc(w)}</span>`).join("")}</div></div>` : ""}</div>` : "";
    return `${tituloPag(ctx)}
      <table class="evd${comp ? " compacto" : ""}"><thead><tr><th>${ctx.S("grupos.G5.campos.pares")} Em vez de</th><th>${esc(F.marca.nome)} fala assim</th></tr></thead>
      <tbody>${pares.slice(0, 12).map(x => `<tr><td>${esc(x.em_vez_de)}</td><td>${esc(x.fala_assim)}</td></tr>`).join("")}</tbody></table>${soa}`;
  },

  /* 7 · tipo de post com 2 exemplos em moldura de celular */
  tipo_post(ctx) {
    const tipos = ctx.V("socios.tipos_post.campos.lista");
    const t = Array.isArray(tipos) ? (tipos.find(x => x.nome && ctx.pag.titulo && ctx.pag.titulo.toLowerCase().startsWith(x.nome.toLowerCase())) || tipos[ctx.ordem]) : null;
    if (!t) return MODELOS._generico(ctx);
    const formato = t.formato || formatoProvavel(t);
    const desc = t.o_que_copiar || t.o_que_e || "";
    const info = [["Formato", NOMES_FORMATO[formato] || formato || "—"], ["Pilar", t.pilar || "—"], ["Quanto", t.percentual != null ? t.percentual + "% · " + (t.frequencia || "") : (t.frequencia || "—")], ["Série fixa", t.serie_fixa == null ? "—" : (t.serie_fixa ? "sim" : "não")]];
    const exemplos = exemplosDoTipo(ctx, t, formato);
    return `${tituloPag(ctx, t.nome)}
      <div class="tipo-info">${info.map(([r, v]) => `<div><div class="rot">${r}</div>${esc(v)}</div>`).join("")}</div>
      <div class="tipo-corpo"><div>
        <div class="rot">${ctx.S("socios.tipos_post.campos.lista")}O que é / o que copiar</div><p>${esc(desc || "—")}</p>
        ${t.referencia ? `<div class="rot" style="margin-top:1.2cqw">Referência</div><p>${esc(t.referencia)}</p>` : ""}
        ${t.nao_fazer ? caixa("Não fazer", esc(t.nao_fazer)) : ""}
        ${t.quem_grava ? `<p class="num-fonte">quem grava: ${esc(t.quem_grava)}</p>` : ""}
      </div>${exemplos}</div>`;
  },

  /* 8 · calendário */
  calendario(ctx) {
    const marcos = (Array.isArray(ctx.V("grupos.G8.campos.marcos")) ? ctx.V("grupos.G8.campos.marcos") : (Array.isArray(ctx.V("socios.estrategia.campos.marcos")) ? ctx.V("socios.estrategia.campos.marcos") : [])).map(m => Object.assign({ forte: true }, m));
    const cult = Array.isArray(ctx.V("grupos.G8.campos.datas_cultura")) ? ctx.V("grupos.G8.campos.datas_cultura") : [];
    const tudo = marcos.concat(cult).sort((a, b) => String(a.data).localeCompare(String(b.data))).slice(0, 8);
    const regra = ctx.V("grupos.G9.campos.regra");
    const val = ctx.V("grupos.G9.campos.validade_horas");
    const sem = ctx.C("grupos.G8.campos.marcos") || ctx.C("socios.estrategia.campos.marcos");
    const prox = marcos.map(m => ({ m, d: diasAte(m.data) })).filter(x => x.d != null && x.d >= 0).sort((a, b) => a.d - b.d)[0];
    const contagem = prox ? `<div class="col-l" style="align-items:center;flex:0 0 auto;margin-bottom:2cqw"><div><div class="num-g">${prox.d} ${prox.d === 1 ? "dia" : "dias"}</div><div class="num-txt">até ${esc(prox.m.o_que || "o próximo marco")} (${esc(dataCurta(prox.m.data))})</div><div class="num-fonte">${seloHtml(sem)}conta a partir de hoje</div></div>
      <div>${blocoCampo(ctx, "grupos.G9.campos.politica", "Política", { cls: "campo-p" })}${blocoCampo(ctx, "grupos.G9.campos.fontes_vigiar", "Fontes que os agentes vigiam", { cls: "campo-p" })}</div></div>` : "";
    return `${tituloPag(ctx, "Até o próximo marco")}
      ${tudo.length ? `<div class="linha-tempo">${tudo.map(m => `<div class="marco${m.forte ? " forte" : ""}"><b>${esc(dataCurta(m.data))}</b>${esc(m.o_que || "")}${m.regra ? `<br><span class="regra r-${esc(m.regra)}">${esc(({ participa: "participa", so_informa: "só informa", nunca: "nunca" })[m.regra] || m.regra)}</span>` : ""}</div>`).join("")}</div>` : `<p>${texto(ctx.V("grupos.G8.campos.marcos"))}</p>`}
      <div class="num-fonte" style="margin-top:-.8cqw;margin-bottom:2cqw">${seloHtml(sem)}marcos dos sócios · ${ctx.S("grupos.G8.campos.datas_cultura")}datas do setor e da cultura</div>
      ${contagem}
      <div class="g3" style="margin-top:auto">
        ${regra && typeof regra === "object" ? `<div class="sem v" style="border-top-width:.6cqw"><div class="rot">${ctx.S("grupos.G9.campos.regra")}Assunto do momento entra quando</div><p>${esc(regra.entra || "—")}</p></div><div class="sem a" style="border-top-width:.6cqw"><div class="rot">Adapta</div><p>${esc(regra.adapta || "—")}</p></div><div class="sem r" style="border-top-width:.6cqw"><div class="rot">Nunca</div><p>${esc(regra.nunca || "—")}</p></div>`
          : `${blocoCampo(ctx, "grupos.G9.campos.temas_da_noticia_util", "Notícia útil")}${blocoCampo(ctx, "grupos.G9.campos.fontes_vigiar", "Fontes a vigiar", { lista: true })}${blocoCampo(ctx, "grupos.G9.campos.politica", "Política")}`}
      </div>
      <p class="num-fonte" style="margin-top:1cqw">${ctx.S("grupos.G9.campos.validade_horas")}notícia vale por ${val != null ? esc(val) + " h" : "— (falta)"}${prox ? "" : " · fontes vigiadas: " + texto(ctx.V("grupos.G9.campos.fontes_vigiar"))}</p>`;
  },

  /* 9 · semáforo de riscos */
  semaforo(ctx) {
    const proib = listaDe(ctx.V("grupos.G10.campos.proibidos"));
    const gat = listaDe(ctx.V("grupos.G10.campos.gatilhos_pausa"));
    const verde = [ctx.V("grupos.G10.campos.direitos_imagem_audio"), ctx.V("grupos.G9.campos.politica")].filter(Boolean);
    const amarelo = [ctx.V("grupos.G10.campos.marcas_terceiros"), ctx.V("grupos.G10.campos.quando_falha")].filter(Boolean);
    const riscos = listaDe(ctx.V("grupos.G10.campos.riscos_do_lancamento"));
    const sinc = ctx.C("grupos.G10.campos.sendo_sincero") || ctx.C("grupos.G3.campos.sendo_sincero");
    return `${tituloPag(ctx, "Na dúvida, pausa")}
      <div class="semaforo">
        <div class="sem v"><h4>Pode, com cuidado</h4>${lista(verde.length ? verde : null)}</div>
        <div class="sem a"><h4>Pausa e pergunta ${ctx.S("grupos.G10.campos.gatilhos_pausa")}</h4>${lista(gat.length ? gat : (riscos.length ? riscos : amarelo.length ? amarelo : null))}${gat.length && amarelo.length ? `<p class="num-fonte" style="margin-top:.6cqw">${amarelo.map(esc).join(" · ")}</p>` : ""}</div>
        <div class="sem r"><h4>Nunca ${ctx.S("grupos.G10.campos.proibidos")}</h4>${lista(proib.length ? proib : null)}</div>
      </div>
      ${sinc ? caixa("Sendo sincero", texto(sinc.valor), "sincero", sinc) : ""}`;
  },

  /* 10 · roda de pilares e mix */
  roda_pilares(ctx) {
    const pil = Array.isArray(ctx.V("grupos.G7.campos.pilares")) ? ctx.V("grupos.G7.campos.pilares") : [];
    const semPct = pil.length && pil.every(p => p.percentual == null);
    const itens = pil.map(p => ({ nome: p.nome || p.pilar, pct: p.percentual != null ? +p.percentual : 100 / pil.length, o_que: p.o_que }));
    const cores = [cssVar("--acc"), cssVar("--ink"), misturar(cssVar("--acc"), cssVar("--ink"), .5), cssVar("--muted"), cssVar("--line"), misturar(cssVar("--acc"), cssVar("--bg"), .5)];
    let ang = -90; const R = 90, r0 = 54;
    const arcos = itens.map((it, i) => {
      const a0 = ang, a1 = ang + it.pct * 3.6; ang = a1;
      const p = (a, rr) => [100 + rr * Math.cos(a * Math.PI / 180), 100 + rr * Math.sin(a * Math.PI / 180)];
      const [x0, y0] = p(a0, R), [x1, y1] = p(a1 - .6, R), [x2, y2] = p(a1 - .6, r0), [x3, y3] = p(a0, r0); const big = a1 - a0 > 180 ? 1 : 0;
      return `<path d="M${x0},${y0} A${R},${R} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${big} 0 ${x3},${y3} Z" fill="${cores[i % cores.length]}"/>`;
    }).join("");
    const ppd = ctx.V("socios.tipos_post.campos.posts_por_dia");
    let mix = ctx.V("socios.tipos_post.campos.percentual_por_formato");
    const mixLin = mix && typeof mix === "object" ? Object.entries(mix).sort((a, b) => b[1] - a[1]) : [];
    return `${tituloPag(ctx)}
      <div class="roda-wrap"><div>
        <svg class="roda" viewBox="0 0 200 200" role="img" aria-label="Pilares">${arcos}<text x="100" y="98" text-anchor="middle" font-size="30" font-weight="800" fill="${cssVar("--ink")}">${esc(ppd != null ? String(ppd).match(/[\d,.]+/) ? String(ppd).match(/[\d,.]+/)[0] : ppd : "—")}</text><text x="100" y="118" text-anchor="middle" font-size="10" fill="${cssVar("--muted")}">post${ppd == 1 ? "" : "s"} por dia</text></svg>
        <div class="leg-pil">${itens.map((it, i) => `<span><i style="background:${cores[i % cores.length]}"></i>${esc(it.nome)} ${semPct ? "" : Math.round(it.pct) + "%"}</span>`).join("")}</div>
        <p class="num-fonte">${ctx.S("grupos.G7.campos.pilares")}${semPct ? "pilares sem % ainda: a roda divide igual até vocês dizerem" : "pilares do conteúdo"}</p>
      </div><div>
        <div class="rot">${ctx.S("socios.tipos_post.campos.percentual_por_formato")}Mix por formato</div>
        ${mixLin.length ? `<div class="barras">${mixLin.map(([k, v]) => `<div class="b"><span>${esc(NOMES_FORMATO[k] || k)}</span><div class="trilho"><i style="width:${Math.min(100, +v)}%"></i></div><b>${esc(v)}%</b></div>`).join("")}</div>` : `<p>${texto(mix)}</p>`}
        ${itens.some(x => x.o_que) ? `<ul class="lim" style="margin-top:1.4cqw">${itens.map(x => `<li><b>${esc(x.nome)}</b> · ${esc(x.o_que || "")}</li>`).join("")}</ul>` : funilHtml(ctx)}
      </div></div>`;
  },

  /* 11 · aprovação */
  aprovacao(ctx) {
    const partes = partesParaAprovar();
    const ap = INFO_CLIENTE && INFO_CLIENTE.status === "aprovado";
    return `${tituloPag(ctx, "É a nossa cara?")}
      <p class="lead">${MODO === "cliente" || MODO === "nada" ? "Marque cada parte com “É a nossa cara” ou “Quero mudar”. No fim, escreva seu nome e aprove a v1, ou peça mudança." : "O cliente marca cada parte e aprova pelo link secreto (botão “Copiar link do cliente”, no alto)."}</p>
      <div class="aprov-lista">${partes.map(p => { const r = respostas[p.parte]; return `<div class="aprov-item" data-parte-aprov="${esc(p.parte)}"><span class="n">${esc(numParte(p.parte) || "·")}</span><span>${esc(PARTES[p.parte] || p.parte)}</span><span class="resp ${r ? (r.ok ? "ok" : "mud") : ""}">${r ? (r.ok ? "é a nossa cara" : "quer mudar") : ""}</span></div>`; }).join("")}</div>
      <div class="assinatura"><div style="flex:1"><div class="rot">Aprovado por</div><div class="linha" id="ass-nome">${ap ? esc(INFO_CLIENTE.aprovado_por || "") : ""}</div></div><div><div class="rot">Em</div><div class="linha" id="ass-data" style="min-width:10em">${ap && INFO_CLIENTE.aprovado_em ? esc(dataBonita(INFO_CLIENTE.aprovado_em)) : ""}</div></div></div>`;
  },

  /* apêndice: tudo o que a ficha tem, com selo e fonte */
  apendice(ctx) {
    const ap = ctx.pag._ap;
    if (ap.tipo === "faltando") {
      const falt = ap.itens || faltas();
      return `<h2 class="titulo ap">${esc(ctx.pag.titulo)}</h2><div class="ap-col">${falt.map(x => `<div><div class="rot"><i class="selo s-cinza"></i>${esc(x.caminho)}</div><p><b>${esc(x.pergunta)}</b></p>${Array.isArray(x.opcoes) ? `<div class="soa">${x.opcoes.map(o => `<span>${esc(o)}</span>`).join("")}</div>` : ""}</div>`).join("") || "<p>Nada faltando.</p>"}</div>`;
    }
    const linhas = ap.itens.map(x => { ctx.usados.includes(x.caminho) || ctx.usados.push(x.caminho); return `<tr><td>${seloHtml(x.campo)} ${esc(rotulo(x.c))}</td><td>${resumirValor(x.campo.valor)}</td><td>${esc(x.campo.fonte || "—")}</td></tr>`; }).join("");
    return `<h2 class="titulo ap">${esc(ctx.pag.titulo)}</h2><table class="ap-tab"><tbody>${linhas}</tbody></table>`;
  },

  /* qualquer modelo desconhecido: título + campos das fontes */
  _generico(ctx) {
    const cams = []; (ctx.pag.fontes || []).forEach(fo => camposDaFonte(F, fo).forEach(c => cams.push(c)));
    return `${tituloPag(ctx, PARTES[ctx.pag.parte])}<div class="g3" style="flex:1;align-content:start">${cams.slice(0, 9).map(c => blocoCampo(ctx, c, rotulo(c.split(".").pop()), { cls: "campo-p" })).join("") || '<p class="falta">Sem conteúdo nesta página ainda.</p>'}</div>`;
  }
};
MODELOS.capa = MODELOS.capa_parte;

/* resumo em uma linha (texto puro) para o apêndice */
function planoTexto(v) {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) return v.map(x => x && typeof x === "object" ? Object.values(x).filter(y => y != null && typeof y !== "object").slice(0, 2).join(" — ") : String(x)).join(" · ");
  return Object.entries(v).map(([k, x]) => `${rotulo(k)}: ${x && typeof x === "object" ? planoTexto(x) : (x == null ? "—" : x)}`).join(" · ");
}
function resumirValor(v) {
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) return `<span class="falta">falta</span>`;
  const s = planoTexto(v);
  const pre = Array.isArray(v) && v.length > 1 && typeof v[0] === "object" ? `<b>${v.length} itens:</b> ` : "";
  return pre + esc(s.length > 260 ? s.slice(0, 260) + "…" : s);
}
function nomeDoTipo(id) {
  const tipos = valor(F, "socios.tipos_post.campos.lista");
  const t = Array.isArray(tipos) && tipos.find(x => x.id === id);
  return t ? t.nome : rotulo(id);
}
/* dias até a data (aceita AAAA-MM-DD e DD/MM) */
function diasAte(d) {
  let alvo; const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) alvo = new Date(+m[1], +m[2] - 1, +m[3]);
  else if ((m = String(d || "").match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/))) {
    alvo = new Date(m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : hoje.getFullYear(), +m[2] - 1, +m[1]);
    if (!m[3] && alvo < hoje) alvo.setFullYear(alvo.getFullYear() + 1);
  } else return null;
  return Math.round((alvo - hoje) / 86400000);
}
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#000"; }

function funilHtml(ctx) {
  const c = ctx.C("grupos.G7.campos.funil"); const v = c && c.valor;
  if (!v || typeof v !== "object" || Array.isArray(v)) return blocoCampo(ctx, "grupos.G7.campos.funil", "Funil", { cls: "campo-p" });
  return `<div class="campo-p" style="margin-top:1.4cqw"><div class="rot">${seloHtml(c)}Funil: que tipo faz o quê</div><ul class="lim">${Object.entries(v).map(([k, ids]) => `<li><b>${esc(rotulo(k))}</b> · ${esc((Array.isArray(ids) ? ids : [ids]).map(nomeDoTipo).join(", "))}</li>`).join("")}</ul></div>`;
}

/* ---------- páginas especiais do modelo frase_numero ---------- */
function paginaPedido(ctx) {
  const metaC = ctx.C("grupos.G11.campos.meta"); const meta = metaC && metaC.valor;
  const nd = ctx.pag.numero_destaque;
  const numero = (nd && nd.valor) || (meta && typeof meta === "object" ? meta.valor : extrairNumero(meta)) || extrairNumero(ctx.V("socios.estrategia.campos.objetivo_90_dias"));
  const unidade = meta && typeof meta === "object" ? `${meta.unidade || ""} até ${dataBonita(meta.data)}` : (typeof meta === "string" ? meta.replace(numero || "", "").replace(/^\s*[\s.]/, "").trim() : "");
  const marcos = ctx.V("socios.estrategia.campos.marcos");
  return `${tituloPag(ctx, textoMeta(meta))}
    <div class="col-l"><div>${numero ? numeroComFonte(numero, unidade, (nd && nd.fonte) || (metaC && metaC.fonte), metaC) : `<p class="falta">meta sem número ainda</p>`}</div>
    <div>${blocoCampo(ctx, "socios.estrategia.campos.objetivo_90_dias", "Objetivo em 90 dias", { cls: "campo-p" })}
      ${blocoCampo(ctx, "socios.modelo_negocio.campos.o_que_o_post_move", "O que o post precisa mover", { cls: "campo-p" })}
      ${ctx.C("socios.estrategia.campos.frase_da_estrategia") ? blocoCampo(ctx, "socios.estrategia.campos.frase_da_estrategia", "A estratégia em uma frase", { cls: "campo-p" }) : blocoCampo(ctx, "socios.estrategia.campos.proporcao_marca_venda", "Marca × venda", { cls: "campo-p" })}</div></div>
    ${Array.isArray(marcos) && marcos.length ? `<div class="linha-tempo" style="margin-bottom:0">${marcos.slice(0, 7).map((m, i) => `<div class="marco${i === marcos.length - 1 ? " forte" : ""}"><b>${esc(dataCurta(m.data))}</b>${esc(m.o_que)}</div>`).join("")}</div><div class="num-fonte">${ctx.S("socios.estrategia.campos.marcos")}marcos combinados</div>` : ""}`;
}
function paginaQuemE(ctx) {
  const nd = ctx.pag.numero_destaque;
  const ndC = ctx.C("grupos.G1.campos.numero_destaque"); const ndv = ndC && ndC.valor;
  const nums = ctx.V("grupos.G1.campos.numeros");
  const jornada = listaDe(ctx.V("socios.como_funciona.campos.jornada"));
  if (Array.isArray(nums) && nums.length) {
    // estilo "o cenário": 3 números grandes, cada um com a fonte
    return `${tituloPag(ctx)}
      <div class="g3" style="margin-top:auto;align-items:end">${nums.slice(0, 3).map(n => `<div><div class="num-m">${esc(n.numero)}</div><div class="num-txt" style="font-size:max(13px,1.3cqw)">${esc(n.o_que || "")}</div><div class="num-fonte">${ctx.S("grupos.G1.campos.numeros")}fonte: ${esc(n.fonte_do_numero || pegar(F, "grupos.G1.campos.numeros.fonte") || "—")}</div></div>`).join("")}</div>
      <div class="g2" style="margin-top:2.4cqw">${blocoCampo(ctx, "grupos.G1.campos.receita_simples", "Como ganha dinheiro", { cls: "campo-p" })}${blocoCampo(ctx, "grupos.G1.campos.metrica_que_o_post_move", "O que o post move", { cls: "campo-p" })}</div>`;
  }
  const numero = (nd && nd.valor) || (ndv && ndv.valor);
  return `${tituloPag(ctx)}
    <div class="col-l"><div>${numero ? numeroComFonte(numero, ndv && ndv.texto, (nd && nd.fonte) || (ndv && ndv.fonte), ndC) : blocoCampo(ctx, "socios.quem_e.campos.uma_frase", "Em uma frase")}</div>
    <div>${blocoCampo(ctx, "socios.quem_e.campos.uma_frase", "Em uma frase", { cls: "campo-p" })}${blocoCampo(ctx, "grupos.G1.campos.receita_simples", "Como ganha dinheiro", { cls: "campo-p" })}${blocoCampo(ctx, "grupos.G1.campos.produto_heroi", "Produto que o post precisa mover", { cls: "campo-p" })}</div></div>
    ${jornada.length ? `<div class="rot" style="margin-top:1.6cqw">${ctx.S("socios.como_funciona.campos.jornada")}Do post até a compra</div><div class="linha-tempo" style="margin-top:.6cqw;margin-bottom:0">${jornada.slice(0, 6).map((j, i) => `<div class="marco${i === jornada.length - 1 ? " forte" : ""}"><b>${i + 1}</b>${esc(j)}</div>`).join("")}</div>` : ""}`;
}
function paginaPosicionamento(ctx) {
  const fraseC = ctx.C("grupos.G4.campos.frase");
  const troca = ctx.C("grupos.G4.campos.teste_de_troca");
  const pp = ctx.V("grupos.G4.campos.promessa_prova");
  const vilao = ctx.C("grupos.G4.campos.vilao");
  let ad = "";
  if (pp && !Array.isArray(pp) && pp.antes) ad = `<div class="antes-depois" style="margin-top:1.6cqw"><div class="ad"><div class="rot">Antes</div><b>${esc(pp.antes)}</b></div><div class="seta">→</div><div class="ad depois"><div class="rot">Depois</div><b>${esc(pp.depois)}</b></div></div>${pp.promessa ? `<p class="num-fonte">${ctx.S("grupos.G4.campos.promessa_prova")}a promessa: “${esc(pp.promessa)}”</p>` : ""}`;
  else if (Array.isArray(pp) && pp.length) ad = `<div class="antes-depois" style="margin-top:1.6cqw"><div class="ad"><div class="rot">${ctx.S("grupos.G4.campos.promessa_prova")}A promessa</div><b>${esc(pp[0].promessa)}</b></div><div class="seta">→</div><div class="ad depois"><div class="rot">A prova</div><b>${esc(pp[0].prova)}</b></div></div>`;
  return `<div class="rot">${seloHtml(fraseC)}A frase que posiciona</div>
    <h2 class="titulo g" style="max-width:24ch">${esc((fraseC && fraseC.valor) || ctx.pag.titulo || "")}</h2>
    ${troca ? caixa("Teste de troca", texto(troca.valor), "", troca) : ""}
    ${ad}
    ${vilao ? `<p class="num-fonte" style="margin-top:1.2cqw">${seloHtml(vilao)}o vilão: ${esc(vilao.valor)}</p>` : ""}`;
}
function paginaPerfil(ctx) {
  const bio = ctx.V("grupos.G15.campos.bio") || ctx.V("grupos.G15.campos.frase_base_da_bio");
  const nome = ctx.V("grupos.G15.campos.nome_busca") || F.marca.nome;
  const dest = listaDe(ctx.V("grupos.G15.campos.destaques"));
  const fix = listaDe(ctx.V("grupos.G15.campos.fixados"));
  const handle = ctx.V("socios.quem_e.campos.handle") || F.marca.handle || "";
  const cel = `<div class="cel"><div class="tela"><div class="ilha"></div>
    <div style="padding:2.8cqw 1cqw 1cqw;font-size:max(8.5px,.8cqw)">
      <div style="font-weight:700;font-size:max(10px,.95cqw);margin-bottom:.8cqw">${esc(handle)}</div>
      <div style="display:flex;gap:1cqw;align-items:center"><div style="width:4.6cqw;height:4.6cqw;min-width:38px;min-height:38px;border-radius:50%;background:var(--dark);display:grid;place-items:center;color:var(--acc-on-dark);font:800 max(14px,1.6cqw)/1 var(--f-tit)">${esc((F.marca.nome || "?").charAt(0))}</div>
      <div style="display:flex;gap:1.2cqw;text-align:center;flex:1;justify-content:space-around"><div><b>—</b><br>posts</div><div><b>—</b><br>seguidores</div><div><b>—</b><br>seguindo</div></div></div>
      <div style="font-weight:700;margin-top:.8cqw">${esc(nome)}</div><div style="white-space:pre-wrap">${esc(bio || "bio: falta")}</div>
      <div style="display:flex;gap:.8cqw;margin-top:1cqw;overflow:hidden">${(dest.length ? dest : ["—", "—", "—"]).slice(0, 4).map(d => `<div style="text-align:center;width:3.6cqw;min-width:30px"><div style="aspect-ratio:1;border-radius:50%;border:1.5px solid #ccc;background:var(--sup)"></div><div style="font-size:max(7px,.65cqw);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d)}</div></div>`).join("")}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-top:1cqw">${[0, 1, 2, 3, 4, 5].map(i => `<div style="aspect-ratio:4/5;background:${i % 3 === 0 ? "var(--dark)" : i % 3 === 1 ? "var(--acc)" : "var(--sup)"}"></div>`).join("")}</div>
    </div></div></div>`;
  return `${tituloPag(ctx)}
    <div class="tipo-corpo"><div>
      ${blocoCampo(ctx, ctx.C("grupos.G15.campos.bio") ? "grupos.G15.campos.bio" : "grupos.G15.campos.frase_base_da_bio", "Bio", { cls: "campo-p" })}
      ${blocoCampo(ctx, "grupos.G15.campos.nome_busca", "Nome que aparece na busca", { cls: "campo-p" })}
      <div class="g2">${blocoCampo(ctx, "grupos.G15.campos.destaques", "Destaques", { cls: "campo-p", lista: true })}${blocoCampo(ctx, "grupos.G15.campos.fixados", "Posts fixados", { cls: "campo-p", lista: true })}</div>
      ${blocoCampo(ctx, "grupos.G15.campos.link", "Link", { cls: "campo-p" })}
    </div><div class="celulares">${cel}</div></div>`;
}
function paginaVisual(ctx) {
  const T = TEMA; const cores = T.P.cores;
  ctx.C("grupos.G6.campos.paleta");
  const fo = ctx.C("grupos.G6.campos.fontes");
  const moldes = ctx.V("grupos.G6.campos.moldes_por_formato");
  const contr = ctx.C("grupos.G6.campos.contraste");
  return `${tituloPag(ctx)}
    <div class="rot">${ctx.S("grupos.G6.campos.paleta")}Paleta</div>
    <div class="paleta">${cores.slice(0, 7).map(c => `<div class="cor"><div class="am" style="background:${esc(c.hex)}"></div><div class="nm">${esc(c.nome || "")}</div><div class="hx">${esc(c.hex)}${c.papel ? " · " + esc(c.papel) : ""}</div></div>`).join("") || '<span class="falta">falta</span>'}</div>
    <div class="g3" style="margin-top:2cqw">
      <div class="campo-p"><div class="rot">${seloHtml(fo)}Títulos · ${esc(T.tit || "padrão")}</div><div class="especime">Aa</div></div>
      <div class="campo-p"><div class="rot">Texto · ${esc(T.txt || "padrão")}</div><div class="especime t">Aa</div><div class="num-fonte">${esc(typeof (fo && fo.valor && fo.valor.substituta_gratis) === "string" ? fo.valor.substituta_gratis : (fo && fo.valor && fo.valor.substituta_gratis ? "fonte substituta grátis em uso" : ""))}</div></div>
      <div class="campo-p"><div class="rot">${seloHtml(contr)}Contraste</div><p>${texto(contr ? contr.valor : null)}</p>${moldes ? `<div class="rot" style="margin-top:.8cqw">${ctx.S("grupos.G6.campos.moldes_por_formato")}Moldes por formato</div><p style="font-size:max(11px,1.05cqw)">${Object.entries(moldes).map(([k, v]) => `<b>${esc(NOMES_FORMATO[k] || k)}:</b> ${esc(typeof v === "string" ? v : Object.values(v).flat().join(", "))}`).join("<br>")}</p>` : ""}</div>
    </div>`;
}
function paginaOperacao(ctx) {
  const ritmo = ctx.C("grupos.G11.campos.ritmo_necessario");
  const nd = ctx.pag.numero_destaque;
  const numero = (nd && nd.valor) || extrairNumero(ritmo && ritmo.valor);
  const falt = faltas().slice(0, 3);
  return `${tituloPag(ctx)}
    <div class="col-l"><div>${numero ? numeroComFonte(numero, ritmo && typeof ritmo.valor === "string" ? ritmo.valor : "", (nd && nd.fonte) || (ritmo && ritmo.fonte), ritmo) : ""}
      <div class="g2" style="margin-top:1.6cqw">${blocoCampo(ctx, "grupos.G12.campos.quem_aprova", "Quem aprova", { cls: "campo-p" })}${blocoCampo(ctx, "grupos.G12.campos.quem_posta", "Quem posta", { cls: "campo-p" })}${blocoCampo(ctx, "grupos.G12.campos.gravacao_humana", "O que precisa de gente gravando", { cls: "campo-p", lista: true })}${blocoCampo(ctx, "grupos.G11.campos.revisao_mix", "Revisão do mix", { cls: "campo-p" })}</div></div>
    <div><div class="rot"><i class="selo s-cinza"></i>O que ainda falta (marque uma opção)</div>
      ${falt.length ? falt.map(x => `<div class="campo-p" style="margin-bottom:1cqw"><p style="margin-bottom:.4cqw"><b>${esc(x.pergunta)}</b></p><div class="soa">${(x.opcoes || []).map(o => `<span>${esc(o)}</span>`).join("")}</div></div>`).join("") : "<p>Nada faltando nesta versão.</p>"}
      ${faltas().length > 3 ? `<p class="num-fonte">e mais ${faltas().length - 3} no apêndice</p>` : ""}
    </div></div>`;
}

/* ---------- exemplos de post em moldura de celular (HTML, sem gasto) ---------- */
const NOMES_FORMATO = { carrossel: "Carrossel", meme: "Meme", noticia: "Notícia útil", enquete: "Enquete (story)", story_peca: "Story de peça", reels: "Reels" };
function formatoProvavel(t) {
  const s = `${t.nome} ${t.o_que_e || ""}`.toLowerCase();
  if (/reels|vídeo|video|pov/.test(s)) return "reels"; if (/meme/.test(s)) return "meme"; if (/notícia|noticia/.test(s)) return "noticia";
  if (/enquete/.test(s)) return "enquete"; if (/peça|peca/.test(s)) return "story_peca"; return "carrossel";
}
function ganchos() {
  const g = valor(F, "grupos.G7.campos.banco_ganchos");
  const lst = Array.isArray(g) ? g.map(x => x.texto || x).filter(Boolean) : [];
  if (!lst.length) { const pares = valor(F, "grupos.G5.campos.pares"); if (Array.isArray(pares)) pares.forEach(p => lst.push(p.fala_assim)); }
  return lst.length ? lst : [valor(F, "grupos.G4.campos.frase") || F.marca.nome];
}
function celular(midia, legenda, vertical) {
  const handle = (valor(F, "socios.quem_e.campos.handle") || F.marca.handle || F.marca.slug || F.marca.nome || "marca").replace(/^@?/, "").toLowerCase().replace(/\s+/g, "");
  return `<div class="cel"><div class="tela"><div class="ilha"></div>
    <div class="ig-top"><span class="av"></span>${esc(handle)}</div>
    <div class="midia${vertical ? " vert" : ""}">${midia}</div>
    ${vertical ? "" : `<div class="ig-acoes">♡ ◯ ➤ <span style="margin-left:auto">⌑</span></div>`}
    ${legenda ? `<div class="ig-leg"><b>${esc(handle)}</b> ${esc(legenda)}</div>` : `<div style="height:.8cqw"></div>`}
  </div></div>`;
}
function exemplosDoTipo(ctx, t, formato) {
  const G = ganchos(); const i0 = (ctx.ordem * 2) % G.length;
  const g1 = G[i0], g2 = G[(i0 + 1) % G.length];
  const cta = valor(F, "grupos.G7.campos.cta_padrao") || "";
  const handle = valor(F, "socios.quem_e.campos.handle") || F.marca.handle || "";
  const foto = txt => `<div class="foto">${esc(txt || "foto real (dos anexos da marca)")}</div>`;
  const leg = `${g1} ${cta}`.trim();
  if (formato === "reels") {
    const r = valor(F, "grupos.G16.campos.reels") || {};
    const quadros = [
      ["0–3 s", r.gancho_3s || r.gancho_dos_3_segundos || g1, "gancho"],
      ["3–8 s", t.o_que_copiar || t.o_que_e || "mostra a situação", "situação"],
      ["8–15 s", g2, "virada"],
      ["fim", cta || "segue para mais", "pedido"]
    ];
    const capa = `<div class="post" style="background:var(--dark);color:var(--on-dark)"><span class="chip">Reels</span>${foto("quadro do vídeo")}<div class="p-tit" style="color:var(--acc-on-dark)">${esc(g1)}</div><div class="p-handle">${esc(handle)} · capa 9:16 · ${esc(r.duracao_s || "15–30")} s</div></div>`;
    return `<div class="celulares">${celular(capa, "", true)}<div class="quadros"><div class="rot">Roteiro em quadros</div>${quadros.map(q => `<div class="quadro"><b>${esc(q[0])}</b><div><div class="q-tela">${esc(q[1])}</div><div class="num-fonte" style="margin:0">${esc(q[2])}${r.audio ? " · áudio " + esc(r.audio) : ""}</div></div></div>`).join("")}</div></div>`;
  }
  let a, b;
  if (formato === "meme") {
    a = `<div class="post" style="background:#fff;color:#111;padding:0"><div style="padding:1cqw 1.2cqw;font:700 max(10px,1.1cqw)/1.25 var(--f-txt)">${esc(g1)}</div>${foto("imagem da situação")}<div class="p-handle" style="padding:.6cqw 1.2cqw">${esc(handle)}</div></div>`;
    b = `<div class="post" style="background:var(--acc);color:var(--ink)"><div class="p-tit">${esc(g2)}</div>${foto("reação")}<div class="p-handle">${esc(handle)}</div></div>`;
  } else if (formato === "noticia") {
    const val = valor(F, "grupos.G9.campos.validade_horas");
    a = `<div class="post" style="background:var(--bg);color:var(--ink)"><span class="chip">Notícia útil</span><div class="p-tit">${esc(g1)}</div><div class="p-tx">O que muda para você, em 1 frase.</div><div class="p-handle">fonte: link oficial · ${val ? "vale " + esc(val) + " h" : "validade: falta"}</div></div>`;
    b = `<div class="post" style="background:var(--dark);color:var(--on-dark)"><div class="p-tit" style="color:var(--acc-on-dark)">O que fazer</div><div class="p-tx">1. ${esc(g2)}<br>2. ${esc(cta || "Salva para lembrar")}</div><div class="p-handle">${esc(handle)}</div></div>`;
  } else if (formato === "enquete" || formato === "story_peca") {
    const enq = valor(F, "grupos.G13.campos.enquetes_fixas"); const pergunta = Array.isArray(enq) && enq[ctx.ordem % enq.length] || g1;
    const ops = String(pergunta).split(/ ou |\?/).filter(Boolean);
    a = `<div class="post" style="background:var(--dark);color:var(--on-dark);justify-content:center"><div class="p-tit" style="text-align:center;color:var(--acc-on-dark)">${esc(pergunta)}</div><div class="opc">${esc(ops[0] || "Sim")}</div><div class="opc">${esc(ops[1] || "Não")}</div></div>`;
    b = `<div class="post" style="background:var(--bg);color:var(--ink)">${foto(formato === "story_peca" ? "foto real da peça" : "resultado da enquete")}<div class="p-tit">${esc(g2)}</div></div>`;
    return `<div class="celulares">${celular(a, "", true)}${celular(b, "", true)}</div>`;
  } else {
    a = `<div class="post" style="background:var(--bg);color:var(--ink)">${foto()}<div class="p-tit">${esc(g1)}</div><div class="p-handle">${esc(handle)} · 1/6</div></div>`;
    b = `<div class="post" style="background:var(--dark);color:var(--on-dark)"><div class="p-tit" style="color:var(--acc-on-dark)">${esc(g2)}</div><div class="p-tx">${esc(t.o_que_copiar || t.o_que_e || "")}</div><div class="p-handle">${esc(cta)}</div></div>`;
  }
  return `<div class="celulares">${celular(a, leg)}${celular(b, "")}</div>`;
}

/* ---------- apêndice automático ---------- */
function apendicePaginas() {
  const out = []; const all = todosCampos(F);
  const add = (titulo, ap) => out.push({ parte: "apendice", modelo: "apendice", titulo, fontes: [], feito_por: "editor", conferido_por: "critico", _ap: ap });
  const fl = faltas();
  for (let i = 0; i < fl.length; i += 10) add(`O que falta: perguntas de múltipla escolha${fl.length > 10 ? ` (${i / 10 + 1}/${Math.ceil(fl.length / 10)})` : ""}`, { tipo: "faltando", itens: fl.slice(i, i + 10) });
  const porPagina = 14;
  const secs = [["socios", "O que vocês contaram"], ["grupos", "O que os agentes estudaram"]];
  secs.forEach(([sec, nome]) => {
    const itens = all.filter(x => x.sec === sec);
    // divide por tamanho do texto (cada página cabe numa folha A4 deitada)
    const pedacos = []; let atual = [], peso = 0;
    itens.forEach(x => {
      const p = 1 + Math.ceil(Math.min(262, planoTexto(x.campo.valor).length) / 95);
      if (atual.length && (peso + p > 22 || atual.length >= porPagina)) { pedacos.push(atual); atual = []; peso = 0; }
      atual.push(x); peso += p;
    });
    if (atual.length) pedacos.push(atual);
    pedacos.forEach(pedaco => {
      const blocos = [...new Set(pedaco.map(x => x.bloco.titulo || x.k))];
      add(`${nome}: ${blocos.slice(0, 3).join(", ")}${blocos.length > 3 ? "…" : ""}`, { tipo: "campos", itens: pedaco });
    });
  });
  return out;
}

/* o que falta: a lista "faltando" da ficha ou, se vazia, os campos cinza */
function faltas() {
  if ((F.faltando || []).length) return F.faltando;
  return todosCampos(F).filter(x => selo(x.campo) === "cinza").map(x => ({ caminho: x.caminho, pergunta: `${x.bloco.titulo || x.k}: ${rotulo(x.c)}?`, opcoes: ["Vou responder", "Não se aplica", "Não sei: usar proposta"] }));
}
function partesParaAprovar() {
  const vistas = []; F.documento.paginas.forEach(p => { if (!["capa", "aprovacao", "apendice"].includes(String(p.parte)) && !vistas.some(v => v.parte === String(p.parte))) vistas.push({ parte: String(p.parte) }); });
  return vistas;
}

/* ============================== botões de cada página ============================== */
function ligarPaginas() {
  document.querySelectorAll(".pg").forEach(pg => {
    const box = pg.querySelector(".pg-acoes"); const parte = pg.dataset.parte;
    const caminhos = JSON.parse(pg.dataset.caminhos || "[]");
    if (MODO === "demo" || MODO === "dono") {
      if (caminhos.length) { const b = document.createElement("button"); b.className = "bt pequeno"; b.textContent = "corrigir"; b.onclick = () => abrirChat(pg); box.appendChild(b); }
    } else if (MODO === "cliente") {
      if (["capa", "aprovacao", "apendice"].includes(parte) || pg.querySelector(".parte-tit")) return;
      const r = respostas[parte];
      const sim = document.createElement("button"); sim.className = "bt pequeno" + (r && r.ok ? " sim" : ""); sim.textContent = "É a nossa cara";
      const nao = document.createElement("button"); nao.className = "bt pequeno" + (r && !r.ok ? " nao" : ""); nao.textContent = "Quero mudar";
      if (INFO_CLIENTE && INFO_CLIENTE.status === "aprovado") { sim.disabled = nao.disabled = true; }
      sim.onclick = () => { respostas[parte] = { ok: true, texto: "" }; atualizarCliente(); };
      nao.onclick = () => abrirNotaCliente(pg, parte);
      box.append(sim, nao);
    }
  });
}
function abrirNotaCliente(pg, parte) {
  document.querySelectorAll(".nota-cliente").forEach(n => n.remove());
  const d = document.createElement("div"); d.className = "nota-cliente";
  d.innerHTML = `<b>O que vocês querem mudar em “${esc(PARTES[parte] || parte)}”?</b><textarea maxlength="1000" placeholder="Ex.: a gente não fala assim, prefere…">${esc((respostas[parte] && respostas[parte].texto) || "")}</textarea><div style="display:flex;gap:6px;justify-content:flex-end"><button class="bt pequeno" data-x>Cancelar</button><button class="bt pequeno forte" data-ok>Guardar</button></div>`;
  pg.appendChild(d); const ta = d.querySelector("textarea"); ta.focus();
  d.querySelector("[data-x]").onclick = () => d.remove();
  d.querySelector("[data-ok]").onclick = () => { respostas[parte] = { ok: false, texto: ta.value.trim() }; d.remove(); atualizarCliente(); };
}
function atualizarCliente() {
  // redesenha só os botões e a página de aprovação
  document.querySelectorAll(".pg").forEach(pg => {
    const r = respostas[pg.dataset.parte]; const bs = pg.querySelectorAll(".pg-acoes .bt");
    if (bs.length === 2) { bs[0].classList.toggle("sim", !!(r && r.ok)); bs[1].classList.toggle("nao", !!(r && !r.ok)); }
  });
  document.querySelectorAll("[data-parte-aprov]").forEach(el => {
    const r = respostas[el.dataset.parteAprov]; const s = el.querySelector(".resp");
    s.className = "resp " + (r ? (r.ok ? "ok" : "mud") : ""); s.textContent = r ? (r.ok ? "é a nossa cara" : "quer mudar") : "";
  });
  const tot = partesParaAprovar().length, feitas = Object.keys(respostas).length, mud = Object.values(respostas).filter(r => !r.ok).length;
  $("#cl-st").textContent = `${feitas} de ${tot} partes marcadas${mud ? ` · ${mud} com pedido de mudança` : ""}`;
  const txt = Object.entries(respostas).filter(([, r]) => !r.ok).map(([p, r]) => `${PARTES[p] || p}: ${r.texto || "quer mudar"}`).join("\n");
  if (txt && !$("#cl-texto").dataset.mexido) $("#cl-texto").value = txt;
}

/* ============================== chat preso no trecho ============================== */
let CHAT = null; // { pg, caminho, ultimo: {versao_id, antes, depois, caminho} }
function abrirChat(pg) {
  document.querySelectorAll(".pg.foco").forEach(p => p.classList.remove("foco")); pg.classList.add("foco");
  const caminhos = JSON.parse(pg.dataset.caminhos || "[]");
  CHAT = { pg, caminho: caminhos[0], ultimo: null };
  $("#chat").hidden = false; document.body.classList.add("chat-aberto");
  $("#c-tit").textContent = `Corrigir · pág. ${pg.dataset.n}`;
  $("#c-sub").textContent = pg.dataset.titulo || "";
  const corpo = $("#c-corpo");
  corpo.innerHTML = `
    <div><label for="c-cam">Qual trecho</label><select id="c-cam">${caminhos.map(c => { const cp = pegar(F, c); const b = pegar(F, c.split(".").slice(0, 2).join(".")); return `<option value="${esc(c)}">${esc((b && (b.titulo || b.nome)) || "")} · ${esc(rotulo(c.split(".").pop()))} (${SELO_TXT[selo(cp)]})</option>`; }).join("")}</select></div>
    <div><label>Como está agora</label><div class="valor" id="c-valor"></div><div class="custo" id="c-meta"></div></div>
    <div><label for="c-pedido">O que mudar</label><textarea id="c-pedido" placeholder="Ex.: mais curto; tira a palavra premium; troca o 2º exemplo"></textarea></div>
    <details id="c-manual-box"><summary style="cursor:pointer;font-size:13px;font-weight:600">Prefiro escrever o texto novo eu mesmo (grátis)</summary><textarea id="c-manual" style="margin-top:6px;min-height:120px"></textarea></details>
    <div id="c-msgs" style="display:flex;flex-direction:column;gap:8px"></div>
    <div id="c-hist"></div>`;
  $("#c-cam").onchange = e => { CHAT.caminho = e.target.value; mostrarValorChat(); };
  mostrarValorChat();
  $("#c-pe").innerHTML = `<button class="bt" id="c-man">Trocar pelo meu texto</button><button class="bt forte" id="c-ag">Pedir ao agente</button><div class="custo" style="flex-basis:100%">Pedir ao agente: ~US$ ${CUSTO_TRECHO_REAL.toFixed(2).replace(".", ",")} (real), só depois da sua confirmação. Marca em ensaio não gasta: só registra quanto teria custado.</div>`;
  $("#c-man").onclick = () => corrigir(true);
  $("#c-ag").onclick = () => corrigir(false);
  desenharHistorico();
}
function valorComoTexto(v) { return typeof v === "string" ? v : JSON.stringify(v, null, 2); }
function mostrarValorChat() {
  const c = pegar(F, CHAT.caminho);
  $("#c-valor").textContent = c ? (c.valor == null ? "(vazio: falta)" : valorComoTexto(c.valor)) : "—";
  $("#c-meta").innerHTML = c ? `${seloHtml(c, true)} · origem: ${esc(c.origem || "—")} · fonte: ${esc(c.fonte || "—")}` : "";
  $("#c-manual").value = c && c.valor != null ? valorComoTexto(c.valor) : "";
}
function lerManual(antes) {
  const t = $("#c-manual").value;
  if (typeof antes === "string" || antes == null) {
    if (antes == null && /^\s*[[{]/.test(t)) { try { return JSON.parse(t); } catch (e) { /* segue como texto */ } }
    return t.trim();
  }
  try { return JSON.parse(t); } catch (e) { throw new Error("O texto novo precisa manter o mesmo formato (lista ou campos). Confira as aspas e vírgulas."); }
}
function msgChat(cls, html) { const d = document.createElement("div"); d.className = "msg " + cls; d.innerHTML = html; $("#c-msgs").appendChild(d); d.scrollIntoView({ block: "nearest" }); return d; }

async function corrigir(manual) {
  const caminho = CHAT.caminho; const c = pegar(F, caminho); if (!c) return;
  const pedido = $("#c-pedido").value.trim();
  let novo;
  if (manual) {
    try { novo = lerManual(c.valor); } catch (e) { aviso(e.message, 6000); return; }
    if (JSON.stringify(novo) === JSON.stringify(c.valor)) { aviso("O texto novo está igual ao de agora."); return; }
  } else {
    if (!pedido) { aviso("Escreva o que mudar antes de pedir ao agente."); $("#c-pedido").focus(); return; }
    const ok = confirm(`O agente vai reescrever só este trecho:\n“${rotulo(caminho.split(".").pop())}”\n\nCusto estimado: US$ ${CUSTO_TRECHO_REAL.toFixed(2).replace(".", ",")} (real).\nCom a marca em ensaio, nada é gasto: só fica registrado quanto teria custado.\n\nPosso pedir?`);
    if (!ok) return;
  }
  msgChat("eu", esc(manual ? "Trocar pelo meu texto" : pedido));
  const espera = msgChat("ag", "Corrigindo só este trecho…");
  let r;
  try {
    if (MODO === "demo") {
      await new Promise(res => setTimeout(res, 450));
      const depois = manual ? novo : simularReescrita(c.valor, pedido);
      r = { ok: true, versao_id: "demo-" + (historico.length + 1), antes: clone(c.valor), depois, modo: manual ? "manual" : "ensaio" };
      c.valor = clone(depois); c.origem = manual ? "socio" : "agente"; if (manual) c.certeza = "alta";
    } else {
      const corpo = { acao: "corrigir_trecho", ambiente_id: AMB, caminho, pedido: pedido || "troca manual", confirmar: true };
      if (manual) corpo.novo_valor = novo;
      r = await chamarMarca(corpo);
      await recarregarFicha();
    }
  } catch (e) { espera.innerHTML = `Não deu certo: ${esc(e.message)}`; return; }
  historico.unshift({ versao_id: r.versao_id, caminho, antes: r.antes, depois: r.depois, pedido: pedido || "troca manual", status: "aplicado", modo: r.modo });
  CHAT.ultimo = historico[0];
  espera.innerHTML = `${r.modo === "ensaio" ? "<b>Ensaio:</b> resposta de exemplo; nada foi gasto (teria custado ~US$ " + CUSTO_TRECHO_REAL.toFixed(2).replace(".", ",") + ")." : r.modo === "manual" ? "Trocado pelo seu texto." : "Reescrito pelo agente."}${MODO === "demo" ? " <i>Modo demonstração: nada foi salvo.</i>" : ""}
    <div class="ad-chat"><div class="a"><b>Antes</b>${esc(valorComoTexto(r.antes))}</div><div class="d"><b>Depois</b>${esc(valorComoTexto(r.depois))}</div></div>
    <div style="display:flex;gap:6px;margin-top:8px"><button class="bt pequeno forte" data-aceitar>Aceitar</button><button class="bt pequeno" data-desfazer>Desfazer</button></div>`;
  espera.querySelector("[data-aceitar]").onclick = ev => { ev.target.closest("div").innerHTML = `<span class="custo">Aceito. Fica assim no documento.</span>`; };
  espera.querySelector("[data-desfazer]").onclick = ev => desfazer(historico[0], ev.target.closest("div"));
  redesenharPagina(CHAT.pg); mostrarValorChat(); desenharHistorico();
}
async function desfazer(h, alvo) {
  if (!h || h.status === "desfeito") return;
  try {
    if (MODO === "demo") { const c = pegar(F, h.caminho); c.valor = clone(h.antes); }
    else { await chamarMarca({ acao: "desfazer_trecho", ambiente_id: AMB, versao_id: h.versao_id }); await recarregarFicha(); }
  } catch (e) { aviso("Não deu para desfazer: " + e.message, 6000); return; }
  h.status = "desfeito";
  if (alvo) alvo.innerHTML = `<span class="custo">Desfeito: voltou o texto de antes.${MODO === "demo" ? " (modo demonstração)" : ""}</span>`;
  const pg = CHAT && CHAT.pg; if (pg) { redesenharPagina(pg); mostrarValorChat(); }
  desenharHistorico();
}
function desenharHistorico() {
  const el = $("#c-hist"); if (!el) return;
  const hs = historico.filter(h => CHAT && JSON.parse(CHAT.pg.dataset.caminhos || "[]").includes(h.caminho));
  el.innerHTML = hs.length ? `<label>Correções nesta página</label>${hs.map((h, i) => `<div class="custo" style="display:flex;gap:6px;align-items:center;padding:4px 0;border-top:1px solid var(--ui-line)"><span style="flex:1">${esc(rotulo(h.caminho.split(".").pop()))} · ${esc(h.pedido)} · <b>${h.status === "desfeito" ? "desfeito" : "aplicado"}</b></span>${h.status === "desfeito" ? "" : `<button class="bt pequeno" data-h="${i}">Desfazer</button>`}</div>`).join("")}` : "";
  el.querySelectorAll("[data-h]").forEach(b => { b.onclick = () => desfazer(hs[+b.dataset.h], null); });
}
/* ensaio local (?demo=1): imita uma reescrita curta, sem IA */
function simularReescrita(v, pedido) {
  const curto = s => { s = String(s); const m = s.match(/^[^.!?;:]+[.!?]?/); return (m ? m[0] : s).trim(); };
  if (typeof v === "string") {
    const c = curto(v); if (c !== v.trim()) return c;
    const i = v.lastIndexOf(","); return i > 8 ? v.slice(0, i).trim() + "." : v.trim() + " (ajustado)";
  }
  if (Array.isArray(v)) return v.length > 3 ? v.slice(0, Math.ceil(v.length * 2 / 3)) : v.map(x => typeof x === "string" ? curto(x) : x);
  if (v && typeof v === "object") { const o = clone(v); const k = Object.keys(o).find(k => typeof o[k] === "string"); if (k) o[k] = curto(o[k]) + " (ajustado)"; return o; }
  return v;
}
function redesenharPagina(pg) {
  const idx = +pg.dataset.idx; const n = +pg.dataset.n;
  // reconstrói a lista de páginas igual ao montarDocumento para achar o mesmo objeto
  const paginas = F.documento.paginas.slice().sort((a, b) => (a.n || 0) - (b.n || 0));
  const todas = []; const atosFeitos = new Set();
  const temCapaParte = new Set(paginas.filter(p => p.modelo === "capa_parte" && p.parte !== "capa").map(p => p.parte));
  paginas.forEach(p => { const ato = ATOS.find(a => a.antes === String(p.parte)); if (ato && !atosFeitos.has(ato.antes) && !temCapaParte.has(p.parte)) { atosFeitos.add(ato.antes); todas.push({ _ato: ato, parte: p.parte, modelo: "capa_parte" }); } todas.push(p); });
  if (!paginas.some(p => p.parte === "apendice")) apendicePaginas().forEach(p => todas.push(p));
  const tmp = document.createElement("div"); tmp.innerHTML = montarPagina(todas[idx], n, idx, todas);
  const novo = tmp.firstElementChild; pg.replaceWith(novo); novo.classList.add("foco"); if (CHAT) CHAT.pg = novo;
  novo.scrollIntoView({ block: "start" }); window.scrollBy(0, -70);
  const box = novo.querySelector(".pg-acoes"); const b = document.createElement("button"); b.className = "bt pequeno"; b.textContent = "corrigir"; b.onclick = () => abrirChat(novo); box.appendChild(b);
}
$("#c-fechar").onclick = () => { $("#chat").hidden = true; document.body.classList.remove("chat-aberto"); document.querySelectorAll(".pg.foco").forEach(p => p.classList.remove("foco")); CHAT = null; };

/* ============================== servidor ============================== */
function carregarScript(src) { return new Promise((ok, erro) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => erro(new Error("não carregou " + src)); document.head.appendChild(s); }); }
async function chamarMarca(body) {
  const { data, error } = await sb.functions.invoke("marca", { body });
  if (error) {
    let msg = error.message; try { const j = await error.context.json(); msg = j.erro || msg; } catch (e) { /* sem corpo */ }
    throw new Error(msg);
  }
  if (!data || data.ok === false) throw new Error((data && data.erro) || "resposta vazia");
  return data;
}
async function chamarAprovacao(body) {
  const r = await fetch(`${SB_URL}/functions/v1/aprovacao`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }, body: JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch (e) { /* sem json */ }
  if (!r.ok || !j || j.ok === false) throw new Error((j && j.erro) || "link inválido ou vencido");
  return j;
}
async function recarregarFicha() {
  const v = q.get("versao") ? parseInt(q.get("versao"), 10) : null;
  const r = await chamarMarca({ acao: "ficha", ambiente_id: AMB, versao: v });
  VERSAO = r.versao || 1; F = normalizar(r.ficha || {});
  historico.length = 0; (r.historico || []).forEach(h => historico.push({ versao_id: h.id, caminho: h.caminho, antes: h.antes, depois: h.depois, pedido: h.pedido || "", status: h.status, modo: "" }));
}

/* ============================== cliente: responder ============================== */
async function responder(tipo) {
  const nome = $("#cl-nome").value.trim();
  if (nome.length < 2 || nome.length > 80) { aviso("Escreva seu nome (de 2 a 80 letras)."); $("#cl-nome").focus(); return; }
  const texto_ = $("#cl-texto").value.trim();
  if (tipo === "mudanca" && !texto_) { aviso("Conte o que vocês querem mudar (ou marque “Quero mudar” nas partes)."); $("#cl-texto").focus(); return; }
  if (tipo === "aprova") {
    const mud = Object.values(respostas).filter(r => !r.ok).length;
    if (mud && !confirm(`Vocês marcaram ${mud} parte(s) com “Quero mudar”. Aprovar a v1 mesmo assim?`)) return;
    if (!confirm(`Confirmar: “${nome}” aprova a v1 do documento de ${F.marca.nome}? Depois de aprovado, este link não muda mais.`)) return;
  }
  try {
    if (DEMO) {
      aviso("Modo demonstração: nada foi salvo.", 4500);
    } else {
      await chamarAprovacao({ acao: "responder", codigo: CLIENTE, resposta: tipo, nome, texto: texto_ });
    }
  } catch (e) { aviso("Não deu certo: " + e.message, 6000); return; }
  if (tipo === "aprova") {
    INFO_CLIENTE = Object.assign(INFO_CLIENTE || {}, { status: "aprovado", aprovado_por: nome, aprovado_em: new Date().toISOString().slice(0, 10) });
    $("#ass-nome") && ($("#ass-nome").textContent = nome); $("#ass-data") && ($("#ass-data").textContent = dataBonita(INFO_CLIENTE.aprovado_em));
    travarCliente(`Aprovado por ${nome}. Obrigado!${DEMO ? " (demonstração)" : ""}`);
  } else {
    $("#cl-st").textContent = `Pedido de mudança enviado por ${nome}${DEMO ? " (demonstração: nada foi salvo)" : ". A gente volta com uma versão nova."}`;
    if (!DEMO) INFO_CLIENTE.status = "mudanca";
  }
}
function travarCliente(msg) {
  ["#cl-nome", "#cl-texto", "#cl-mudar", "#cl-aprovar"].forEach(s => { $(s).disabled = true; });
  document.querySelectorAll(".pg-acoes .bt").forEach(b => { b.disabled = true; });
  $("#cl-st").textContent = msg;
}

/* ============================== início ============================== */
let TEMA = null;
function desenhar() {
  TEMA = aplicarTema(F);
  document.title = `${F.marca.nome || "Marca"} · documento v${VERSAO}`;
  const st = MODO === "cliente" ? "para aprovar" : (MODO === "demo" ? "demonstração" : `v${VERSAO} · ${F.status || ""}`);
  $("#b-nome").innerHTML = `${esc(F.marca.nome || "Documento")}<small>${esc(st)}</small>`;
  montarDocumento();
  // depois que as fontes chegam, já deixa o encaixe de impressão calculado (o PDF sai certo mesmo sem o evento de imprimir)
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(ajustarImpressao, 50));
  if (TEMA.temCor === false) aviso("Esta marca ainda não tem cores na ficha: usando o tema neutro.", 5000);
}
async function iniciar() {
  $("#b-pdf").onclick = () => window.print();
  try {
    if (DEMO) {
      $("#faixa").hidden = false;
      $("#b-ficha").hidden = !!CLIENTE;
      $("#b-ficha").onclick = () => $("#in-ficha").click();
      $("#in-ficha").onchange = async e => {
        const arq = e.target.files[0]; if (!arq) return;
        try { F = normalizar(JSON.parse(await arq.text())); VERSAO = F.versao || 1; $("#faixa").textContent = `Modo demonstração · ficha aberta do computador (${arq.name}) · nada é salvo nem enviado`; desenhar(); }
        catch (err) { aviso("Não consegui ler esse arquivo: " + err.message, 6000); }
      };
      const url = q.get("ficha") || "exemplos/ficha_demo.json";
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`não achei a ficha (${url})`);
      F = normalizar(await r.json()); VERSAO = F.versao || 1;
      if (q.get("ficha")) $("#faixa").textContent = "Modo demonstração · ficha local (não está no site) · nada é salvo";
      if (CLIENTE) { INFO_CLIENTE = { status: "aberto" }; tirarInternos(F); }
      else {
        $("#b-link").hidden = false;
        $("#b-link").onclick = () => aviso("Modo demonstração: o link do cliente só existe com uma marca de verdade. Para ver como o cliente vê, abra documento.html?demo=1&cliente=demo", 6000);
      }
    } else if (CLIENTE) {
      INFO_CLIENTE = await chamarAprovacao({ acao: "ver", codigo: CLIENTE });
      if (!INFO_CLIENTE.ficha || typeof INFO_CLIENTE.ficha !== "object") throw new Error("link inválido ou vencido");
      F = normalizar(Object.assign({}, INFO_CLIENTE.ficha || {}, { marca: Object.assign({}, (INFO_CLIENTE.ficha || {}).marca, INFO_CLIENTE.marca) }));
      VERSAO = INFO_CLIENTE.versao || 1; tirarInternos(F);
    } else if (AMB) {
      if (AMB === 1 || AMB === 4) throw new Error("Este documento é só para marcas novas (v4).");
      await carregarScript(SB_LIB);
      sb = window.supabase.createClient(SB_URL, SB_KEY);
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { estado(`<h1>Entre primeiro</h1><p>Só o dono vê o documento por aqui. Entre pela <a href="index.html">fábrica</a> e depois volte para esta página.</p><p>Para ver um exemplo sem entrar: <a href="documento.html?demo=1">documento de demonstração</a>.</p>`); return; }
      await recarregarFicha();
      $("#b-link").hidden = false;
      $("#b-link").onclick = gerarLink;
    } else {
      estado(`<h1>Qual documento?</h1><p>Abra pela lista de marcas da fábrica, ou veja o exemplo:</p><p><a href="documento.html?demo=1">Documento de demonstração</a> · <a href="documento.html?demo=1&cliente=demo">Como o cliente vê</a></p>`);
      return;
    }
  } catch (e) {
    const tit = MODO === "cliente" ? "Link inválido ou vencido" : "Não deu para abrir o documento";
    estado(`<h1>${tit}</h1>${e.message.toLowerCase() === tit.toLowerCase() ? "" : `<p>${esc(e.message)}</p>`}${MODO === "cliente" ? "<p>Peça um link novo para quem mandou este.</p>" : ""}`);
    return;
  }
  desenhar();
  if (MODO === "cliente") {
    $("#barra-cliente").hidden = false;
    $("#cl-texto").addEventListener("input", () => { $("#cl-texto").dataset.mexido = "1"; });
    $("#cl-aprovar").onclick = () => responder("aprova");
    $("#cl-mudar").onclick = () => responder("mudanca");
    if (INFO_CLIENTE.status === "aprovado") travarCliente(`Aprovado por ${INFO_CLIENTE.aprovado_por || "—"} em ${dataBonita(INFO_CLIENTE.aprovado_em) || "—"}.`);
    else if (INFO_CLIENTE.status === "mudanca") $("#cl-st").textContent = "Vocês já pediram mudança nesta versão. Pode pedir de novo ou aprovar.";
    else atualizarCliente();
  }
}
/* o cliente não vê custo nem conflitos internos (contrato C.2); o servidor já tira, aqui é a segunda trava */
function tirarInternos(f) {
  f.conflitos = [];
  Object.values(f.grupos || {}).forEach(g => { delete g.gasto_usd; if (g.campos) { delete g.campos.custo_mes; } });
}
async function gerarLink() {
  try {
    const r = await chamarMarca({ acao: "gerar_link", ambiente_id: AMB, versao: VERSAO });
    try { await navigator.clipboard.writeText(r.url); aviso("Link do cliente copiado. O link anterior (se havia) deixou de valer.", 6000); }
    catch (e) { prompt("Copie o link do cliente:", r.url); }
  } catch (e) { aviso("Não deu para gerar o link: " + e.message, 6000); }
}

/* encaixe para imprimir: mede cada página no tamanho A4 deitado e, se o conteúdo passar, reduz só aquela página */
function ajustarImpressao() {
  const pgs = [...document.querySelectorAll(".pg")]; if (!pgs.length) return [];
  pgs.forEach(p => p.style.removeProperty("--z"));
  document.body.classList.add("medir");
  const ajustes = [];
  pgs.forEach(p => {
    const c = p.querySelector(".pg-corpo"); if (!c) return;
    const sobra = c.scrollHeight - c.clientHeight;
    if (sobra > 1) { const z = Math.max(0.6, Math.floor(c.clientHeight / c.scrollHeight * 100) / 100); p.style.setProperty("--z", z); ajustes.push({ n: p.dataset.n, z }); }
  });
  document.body.classList.remove("medir");
  return ajustes;
}
window.addEventListener("beforeprint", ajustarImpressao);

/* ganchos para teste no console (sem efeito no servidor) */
window.__doc = { ajustarImpressao, normalizar, selo, contraste, legivel, planoPadrao, ficha: () => F, modo: MODO };
iniciar();
})();
