/* Escritório da fábrica v3 — um prédio em pixel art com 6 salas, corredor e placas.
   Os agentes trabalham, falam em balões e levam a folha de uma sala para outra.
   Uso: const e = Escritorio.criar(container); e.carregar(eventos, aoVivo); e.vivo(evento); e.reanexar(el); e.destruir();
*/
(function () {
  const W = 640, H = 400;
  const AG = {
    planejadora: { nome: "Planejadora", sala: "redacao", cab: "#6b3f22", cam: "#3b82f6", pele: "#e9b48a", cabelo: "coque", papel: "Escolhe o ângulo da história e o post vencedor que serve de base." },
    escritora:   { nome: "Escritora",   sala: "redacao", cab: "#1f1b18", cam: "#eab308", pele: "#c98d63", cabelo: "longo", papel: "Escreve a capa, os slides e a legenda copiando e remodelando o vencedor." },
    plateia:     { nome: "Plateia",     sala: "plateia", cab: "#6b4423", cam: "#ef4444", pele: "#f0c9a0", papel: "4 leitores (Diego, Marcos, Renata e o cético Paulo) dizem se parariam no post." },
    diagramador: { nome: "Diretor de Arte", sala: "diagramacao", cab: "#2b2b2b", cam: "#22c55e", pele: "#d9a37a", cabelo: "curto", papel: "Lê o post e escolhe o formato de cada slide (notícia, cupom, foto, checklist) e de onde vem cada foto: IA, foto real com crédito ou nenhuma. A montagem segue o plano dele." },
    montador:    { nome: "Montador",    sala: "diagramacao", cab: "#111", cam: "#64748b", pele: "#a86f48", cabelo: "careca", papel: "Desenha os slides em 1080×1350 com os moldes do kit." },
    diretor:     { nome: "Diretor de cena", sala: "estudio", cab: "#9a9a9a", cam: "#a855f7", pele: "#e3b089", cabelo: "curto", papel: "Decide o instante exato da foto, os detalhes do texto e quanto da emoção aparece no rosto." },
    fotografo:   { nome: "Fotógrafo",   sala: "estudio", cab: "#3d2314", cam: "#f97316", pele: "#b97a52", cabelo: "bone", papel: "Gera as fotos realistas seguindo a ficha do Diretor, com a mesma pessoa em toda a história." },
    conferente:  { nome: "Conferente",  sala: "conferencia", cab: "#d1d5db", cam: "#14b8a6", pele: "#f1c9a5", cabelo: "curto", papel: "Olha a foto com olho de editor: dá nota, aponta o que falta e o que está exagerado." },
    retocador:   { nome: "Retocador",   sala: "conferencia", cab: "#b5651d", cam: "#ec4899", pele: "#e0ac85", cabelo: "longo", papel: "Corrige só o que o Conferente apontou, mantendo o resto da foto igual." },
    entregador:  { nome: "Entregador",  sala: "expedicao", cab: "#4a2f1d", cam: "#0ea5e9", pele: "#dba57c", cabelo: "curto", papel: "Guarda os slides no banco e entrega na sua tela." },
  };
  const ORDEM = ["planejadora", "escritora", "plateia", "diagramador", "montador", "diretor", "fotografo", "conferente", "retocador", "entregador"];
  // salas: [x, y, w, h], porta (x no corredor), placa
  const SALAS = {
    redacao:     { r: [8, 34, 206, 142],  porta: 182, nome: "Redação" },
    plateia:     { r: [218, 34, 170, 142], porta: 300, nome: "Plateia" },
    estudio:     { r: [392, 34, 240, 142], porta: 418, nome: "Estúdio de foto" },
    diagramacao: { r: [8, 220, 206, 172], porta: 182, nome: "Diagramação e montagem" },
    conferencia: { r: [218, 220, 204, 172], porta: 320, nome: "Conferência" },
    expedicao:   { r: [426, 220, 206, 172], porta: 452, nome: "Expedição" },
  };
  const CORR_Y = 198; // linha do corredor
  const POS = {
    planejadora: [62, 116], escritora: [148, 116], plateia: [303, 124],
    diretor: [482, 112], fotografo: [588, 134],
    diagramador: [62, 300], montador: [148, 300],
    conferente: [276, 300], retocador: [366, 300], entregador: [540, 300],
  };
  const EST = { ocioso: "ocioso", trabalhando: "trabalhando", pronto: "pronto", erro: "erro" };

  const px = (c, x, y, w, h, cor) => { c.fillStyle = cor; c.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, w, h); };
  function tom(hex, f) { const n = parseInt(hex.slice(1), 16); const r = Math.min(255, (n >> 16) * f), g = Math.min(255, ((n >> 8) & 255) * f), b = Math.min(255, (n & 255) * f); return `rgb(${r | 0},${g | 0},${b | 0})`; }

  // ---------- cenário v3: prédio de vidro à noite, salas com neon, madeira, plantas (refs AIOffice/Habblaud) ----------
  const NEON = { redacao: "#60a5fa", plateia: "#fb7185", estudio: "#c084fc", diagramacao: "#4ade80", conferencia: "#2dd4bf", expedicao: "#fbbf24" };
  const FACE = 24;
  function brilho(c, x, y, r, rgb, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  function oval(c, x, y, rx, ry, cor) { c.fillStyle = cor; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); }
  function piso(c, [x, y, w, h], tipo) {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    if (tipo === "madeira" || tipo === "escura") {
      const cs = tipo === "madeira" ? ["#b07a4a", "#a46f40", "#9b673a", "#b9844f"] : ["#7b4f30", "#70472a", "#86583a", "#6a4227"];
      for (let j = y, r = 0; j < y + h; j += 5, r++) { const off = (r % 4) * 9; for (let i = x - off, q = 0; i < x + w; i += 34, q++) { px(c, i, j, 34, 5, cs[(q * 3 + r * 7 + (q % 2) * r) % 4]); px(c, i, j + 4.5, 34, .5, "rgba(0,0,0,.28)"); px(c, i, j, .5, 5, "rgba(0,0,0,.3)"); px(c, i + .5, j, 33, .5, "rgba(255,255,255,.07)"); } }
    } else if (tipo === "carpete") {
      px(c, x, y, w, h, "#3b2440"); for (let j = y; j < y + h; j += 16) for (let i = x; i < x + w; i += 16) { px(c, i, j, 16, 16, ((i + j) / 16) % 2 ? "#40284a" : "#382143"); px(c, i + 4, j + 6, .5, .5, "#5b3d66"); px(c, i + 11, j + 12, .5, .5, "#5b3d66"); }
    } else if (tipo === "concreto") {
      px(c, x, y, w, h, "#3a3f4a"); for (let j = y; j < y + h; j += 24) px(c, x, j, w, .5, "#30343d"); for (let i = x; i < x + w; i += 36) px(c, i, y, .5, h, "#30343d");
      for (let k = 0; k < 40; k++) px(c, x + ((k * 53) % w), y + ((k * 37) % h), .5, .5, "#474c58");
    } else if (tipo === "corredor") {
      px(c, x, y, w, h, "#1d2230"); for (let i = x; i < x + w; i += 20) px(c, i, y, .5, h, "#232a3a");
      px(c, x, y + h / 2 - 1, w, .5, "rgba(45,212,191,.35)"); px(c, x, y + h / 2 + 7, w, .5, "rgba(45,212,191,.18)");
      for (let i = x + 6; i < x + w; i += 40) px(c, i, y + 3, 14, 1, "rgba(255,255,255,.05)");
    }
    c.restore();
  }
  function tapete(c, x, y, w, h, cor, borda, risca) { px(c, x, y, w, h, borda); px(c, x + 2, y + 2, w - 4, h - 4, cor); px(c, x + 5, y + 5, w - 10, .8, risca); px(c, x + 5, y + h - 6, w - 10, .8, risca); px(c, x + 5, y + 5, .8, h - 10, risca); px(c, x + w - 6, y + 5, .8, h - 10, risca); px(c, x, y + h, w, 1, "rgba(0,0,0,.25)"); }
  function planta(c, x, y, g = 1) {
    oval(c, x, y + .5, 6 * g, 2 * g, "rgba(0,0,0,.35)");
    px(c, x - 5 * g, y - 7 * g, 10 * g, 7 * g, "#e7e5e4"); px(c, x - 5 * g, y - 7 * g, 10 * g, 1.5, "#fafaf9"); px(c, x + 3 * g, y - 7 * g, 2 * g, 7 * g, "#a8a29e");
    const v = ["#14532d", "#166534", "#15803d", "#22c55e", "#4ade80"];
    [[-5, -11, 5, 4, 0], [5, -12, 5, 4, 1], [0, -16, 6, 5, 1], [-6, -18, 4, 4, 2], [6, -19, 4, 4, 2], [0, -22, 4, 4, 3], [-2, -14, 3, 3, 3], [3, -20, 2.5, 2.5, 4], [-4, -21, 2, 2, 4]].forEach(([dx, dy, rx, ry, k]) => oval(c, x + dx * g, y + dy * g, rx * g, ry * g, v[k]));
  }
  function palmeira(c, x, y) {
    oval(c, x, y + .5, 7, 2.2, "rgba(0,0,0,.35)"); px(c, x - 6, y - 9, 12, 9, "#44403c"); px(c, x - 6, y - 9, 12, 1.5, "#57534e");
    px(c, x - .5, y - 26, 1.5, 18, "#65a30d");
    c.save(); c.translate(x, y - 26);
    [[-.9, "#15803d"], [-.3, "#16a34a"], [.3, "#22c55e"], [.9, "#15803d"], [2.3, "#166534"], [-2.3, "#166534"], [3.14, "#16a34a"]].forEach(([a, cor]) => { c.save(); c.rotate(a); oval(c, 0, -8, 2.6, 9, cor); c.restore(); });
    c.restore();
  }
  function suculenta(c, x, y) { px(c, x - 2, y - 3, 4, 3, "#f5f5f4"); oval(c, x - 1, y - 4, 1.5, 1.5, "#4ade80"); oval(c, x + 1, y - 4.5, 1.5, 1.5, "#22c55e"); oval(c, x, y - 5.5, 1.2, 1.2, "#86efac"); }
  function estante(c, x, y, w = 26, h = 40) {
    px(c, x, y, w, h, "#5c4033"); px(c, x, y, w, 1.5, "#7a5642"); px(c, x, y + h, w, 1.5, "rgba(0,0,0,.35)");
    const cores = ["#ef4444", "#3b82f6", "#eab308", "#22c55e", "#a855f7", "#f97316", "#e5e7eb", "#14b8a6"];
    const n = Math.floor((h - 4) / 12);
    for (let i = 0; i < n; i++) { px(c, x + 2, y + 3 + i * 12, w - 4, 9, "#2a1d15"); let k = 0; for (let bx = x + 3; bx < x + w - 4; bx += 2.5 + (k % 2)) { const hh = 8 - (k % 3); px(c, bx, y + 4 + i * 12 + (8 - hh), 2, hh, cores[(i * 3 + k) % 8]); k++; } }
  }
  function puff(c, x, y, cor, claro) { oval(c, x, y + 4, 8, 3, "rgba(0,0,0,.3)"); oval(c, x, y, 8, 6, cor); oval(c, x - 2, y - 2, 4, 2.5, claro); }
  function sofa(c, x, y, w, cor, esc, claro) { px(c, x, y + 1, w, 4, "rgba(0,0,0,.25)"); px(c, x, y - 14, w, 8, esc); px(c, x, y - 8, w, 9, cor); px(c, x - 4, y - 12, 5, 13, esc); px(c, x + w - 1, y - 12, 5, 13, esc); for (let i = x + w / 3; i < x + w - 1; i += w / 3) px(c, i, y - 8, .5, 8, esc); px(c, x + 1, y - 13, w - 2, 1, claro); }
  function janelaCidade(c, x, y, w, h) {
    px(c, x - 1.5, y - 1.5, w + 3, h + 3, "#111827"); const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "#1e1b4b"); g.addColorStop(1, "#7c3aed"); c.fillStyle = g; c.fillRect(x, y, w, h);
    for (let i = 0; i < w; i += 5) { const bh = Math.min(h - 2, 4 + ((i * 13) % 9)); px(c, x + i, y + h - bh, Math.min(4.5, w - i), bh, "#0f172a"); for (let k = 0; k < bh - 2; k += 2) if ((i + k) % 3 && i + 2 < w) px(c, x + i + 1, y + h - bh + 1 + k, 1, .7, "#fde68a"); }
    px(c, x + w / 2 - .5, y, 1, h, "#111827"); px(c, x + 2, y + 2, w * .3, .6, "rgba(255,255,255,.25)");
  }
  function quadroBranco(c, x, y, w, h) { px(c, x - 1, y - 1, w + 2, h + 2, "#9ca3af"); px(c, x, y, w, h, "#f8fafc"); const cs = ["#ef4444", "#2563eb", "#16a34a", "#111"]; for (let i = 0; i < 4; i++) px(c, x + 4, y + 3 + i * 3.5, 14 + ((i * 11) % 16), .8, cs[i]); [["#fde047", 0], ["#f9a8d4", 1], ["#86efac", 2]].forEach(([cor, i]) => px(c, x + w - 22 + i * 7, y + 3 + (i % 2) * 5, 5, 5, cor)); px(c, x + 3, y + h, w - 6, 1.5, "#6b7280"); }
  function tela(c, x, y, w, h, linhas) { px(c, x - 1.5, y - 1.5, w + 3, h + 3, "#0b0f19"); px(c, x, y, w, h, "#0f172a"); linhas.forEach(([lx, ly, lw, cor]) => px(c, x + lx, y + ly, lw, 2, cor)); }
  function luminaria(c, x, y) { oval(c, x, y, 3, 1.5, "#fef3c7"); }

  function paredeSala(c, k) {
    const s = SALAS[k], [x, y, w, h] = s.r, neon = NEON[k], emCima = y < 176, p0 = s.porta - 11, p1 = s.porta + 11;
    if (emCima) {
      px(c, x, y, w, FACE, "#262d40"); px(c, x, y, w, 1.5, "#323b54"); px(c, x, y + FACE - 3, w, 3, "#1b2030");
      for (let i = x + 12; i < x + w; i += 26) px(c, i, y + 2, .5, FACE - 5, "rgba(255,255,255,.035)");
      [[x, p0], [p1, x + w]].forEach(([a, b]) => { px(c, a, y + h - 7, b - a, 7, "rgba(170,210,255,.10)"); for (let i = a + 3; i < b - 4; i += 22) { px(c, i, y + h - 7, .5, 7, "rgba(255,255,255,.18)"); px(c, i + 5, y + h - 6, 4, .5, "rgba(255,255,255,.14)"); } });
    } else {
      [[x, p0], [p1, x + w]].forEach(([a, b]) => { px(c, a, y - 10, b - a, 10, "rgba(170,210,255,.10)"); for (let i = a + 3; i < b - 4; i += 22) { px(c, i, y - 10, .5, 10, "rgba(255,255,255,.18)"); px(c, i + 5, y - 8, 5, .5, "rgba(255,255,255,.14)"); } });
    }
    c.save(); c.shadowColor = neon; c.shadowBlur = 5; c.fillStyle = neon;
    const topo = emCima ? y - 1.5 : y - 10, alt = emCima ? h + 3 : h + 11.5;
    c.fillRect(x - 1.5, topo, 1.5, alt); c.fillRect(x + w, topo, 1.5, alt);
    if (emCima) { c.fillRect(x - 1.5, y - 1.5, w + 3, 1.5); c.fillRect(x - 1.5, y + h, p0 - x + 1.5, 1.5); c.fillRect(p1, y + h, x + w + 1.5 - p1, 1.5); c.fillRect(x - 1.5, y + h - 7, p0 - x + 1.5, .8); c.fillRect(p1, y + h - 7, x + w + 1.5 - p1, .8); }
    else { c.fillRect(x - 1.5, y + h, w + 3, 1.5); c.fillRect(x - 1.5, y - 10, p0 - x + 1.5, .8); c.fillRect(p1, y - 10, x + w + 1.5 - p1, .8); c.fillRect(x - 1.5, y, p0 - x + 1.5, 1.5); c.fillRect(p1, y, x + w + 1.5 - p1, 1.5); }
    c.restore();
    const cy = emCima ? y + h + 2 : y - 15;
    px(c, s.porta - 9, emCima ? y + h + 1.5 : y - 4, 18, 3, "#3f3f46");
    px(c, s.porta + 15, cy, 46, 11, "#0b0d12"); c.save(); c.shadowColor = neon; c.shadowBlur = 4; c.strokeStyle = neon; c.lineWidth = .8; c.strokeRect(s.porta + 15.5, cy + .5, 45, 10); c.restore();
  }

  function desenharCenario(c) {
    px(c, 0, 0, W, H, "#0c0f17");
    const g = c.createLinearGradient(0, 0, 0, 34); g.addColorStop(0, "#0b1023"); g.addColorStop(1, "#2a1b4d"); c.fillStyle = g; c.fillRect(0, 0, W, 34);
    for (let i = 0; i < W; i += 7) { const bh = 8 + ((i * 29) % 18); px(c, i, 34 - bh, 6.5, bh, i % 3 ? "#111833" : "#151d3d"); for (let k = 2; k < bh - 2; k += 3) for (let j = 1; j < 6; j += 2) if ((i + k * j) % 5 < 2) px(c, i + j, 34 - bh + k, 1, 1, "#fcd34d"); }
    for (let k = 0; k < 30; k++) px(c, (k * 97) % W, (k * 13) % 14, .5, .5, "#e0e7ff");
    px(c, 0, 31, W, 3, "#1f2433");
    brilho(c, 320, 17, 80, "255,210,31", .35); px(c, 250, 6, 140, 22, "#0b0d12"); c.save(); c.shadowColor = "#FFD21F"; c.shadowBlur = 8; px(c, 252, 8, 136, 18, "#FFD21F"); c.restore();
    piso(c, SALAS.redacao.r, "madeira"); piso(c, SALAS.plateia.r, "carpete"); piso(c, SALAS.estudio.r, "concreto");
    piso(c, SALAS.diagramacao.r, "madeira"); piso(c, SALAS.conferencia.r, "escura"); piso(c, SALAS.expedicao.r, "concreto");
    piso(c, [0, 176, W, 44], "corredor");
    tapete(c, 28, 98, 156, 50, "#1e3a8a", "#172554", "#3b82f6");
    tapete(c, 240, 96, 128, 70, "#9f1239", "#4c0519", "#fb7185");
    tapete(c, 26, 284, 160, 52, "#14532d", "#052e16", "#4ade80");
    tapete(c, 238, 338, 170, 40, "#115e59", "#042f2e", "#2dd4bf");
    for (const k of Object.keys(SALAS)) paredeSala(c, k);
    // ---- Redação
    quadroBranco(c, 22, 37, 66, 17); janelaCidade(c, 98, 37, 44, 16); janelaCidade(c, 150, 37, 30, 16);
    oval(c, 198, 45, 5, 5, "#f8fafc"); px(c, 197.5, 42, .8, 3.5, "#111"); px(c, 198, 45, 2.5, .8, "#111");
    estante(c, 188, 62, 24, 52); palmeira(c, 22, 92); planta(c, 18, 170); puff(c, 42, 160, "#f59e0b", "#fcd34d"); suculenta(c, 196, 126);
    // ---- Plateia
    tela(c, 252, 36, 96, 19, [[6, 4, 26, "#FFD21F"], [36, 4, 40, "#e5e7eb"], [36, 9, 30, "#9ca3af"], [36, 14, 24, "#9ca3af"], [6, 9, 26, "#FFD21F"], [6, 14, 26, "#FFD21F"]]);
    brilho(c, 300, 60, 46, "147,197,253", .12);
    sofa(c, 258, 131, 92, "#b91c1c", "#7f1d1d", "#ef4444");
    px(c, 284, 146, 40, 14, "#5c4033"); px(c, 284, 146, 40, 1.5, "#7a5642"); px(c, 290, 142, 8, 6, "#f8fafc"); px(c, 306, 141, 10, 7, "#f59e0b"); suculenta(c, 320, 146);
    puff(c, 236, 80, "#2563eb", "#60a5fa"); puff(c, 372, 80, "#16a34a", "#4ade80"); planta(c, 228, 172); planta(c, 380, 172); palmeira(c, 372, 112);
    // ---- Estúdio
    px(c, 518, 36, 104, 22, "#f5f5f4"); const gb = c.createLinearGradient(0, 56, 0, 70); gb.addColorStop(0, "#f5f5f4"); gb.addColorStop(1, "#e7e5e4"); c.fillStyle = gb; c.fillRect(518, 56, 104, 60);
    for (const sx of [506, 630]) { px(c, sx, 60, 1.5, 70, "#374151"); px(c, sx - 10, 50, 21, 15, "#f8fafc"); px(c, sx - 10, 50, 21, 2, "#cbd5e1"); px(c, sx - 6, 128, 13, 1.5, "#374151"); brilho(c, sx, 64, 34, "255,255,255", .18); }
    px(c, 398, 37, 48, 18, "#1f2937"); [["#60a5fa", 0], ["#fde047", 1], ["#fb7185", 2], ["#4ade80", 3]].forEach(([cor, i]) => px(c, 401 + i * 11, 40 + (i % 2) * 6, 9, 7, cor));
    janelaCidade(c, 456, 37, 50, 16); px(c, 410, 150, 60, 1, "#111"); px(c, 470, 150, 1, 18, "#111");
    palmeira(c, 402, 96); planta(c, 624, 172); puff(c, 470, 160, "#7c3aed", "#a78bfa");
    // ---- Corredor
    px(c, 262, 178, 18, 15, "#111827"); px(c, 264, 180, 14, 6, "#374151"); px(c, 268, 188, 6, 4, "#f5f5f4"); px(c, 265, 181, 3, 2, "#ef4444");
    px(c, 286, 177, 10, 16, "#93c5fd"); px(c, 287, 179, 8, 6, "#dbeafe"); px(c, 286, 193, 10, 1.5, "#475569");
    px(c, 540, 202, 50, 6, "#78350f"); px(c, 540, 202, 50, 1.5, "#a16207"); px(c, 542, 208, 3, 5, "#451a03"); px(c, 585, 208, 3, 5, "#451a03");
    planta(c, 6, 197, .9); planta(c, 634, 197, .9); planta(c, 400, 196, .9); planta(c, 108, 196, .8); planta(c, 512, 196, .8);
    for (const lx of [60, 160, 240, 360, 470, 600]) brilho(c, lx, 198, 26, "45,212,191", .08);
    // ---- Diagramação
    px(c, 24, 230, 96, 34, "#3f2a1c"); px(c, 26, 232, 92, 30, "#a16207"); for (let i = 0; i < 8; i++) px(c, 29 + (i % 4) * 22, 235 + Math.floor(i / 4) * 13, 18, 11, ["#111", "#f8fafc", "#FFD21F", "#111", "#f8fafc", "#111", "#FFD21F", "#f8fafc"][i]);
    px(c, 176, 244, 26, 16, "#d1d5db"); px(c, 176, 244, 26, 3, "#f3f4f6"); px(c, 180, 256, 18, 4, "#f8fafc"); px(c, 196, 247, 3, 2, "#22c55e");
    px(c, 120, 368, 30, 12, "#f8fafc"); px(c, 122, 364, 26, 4, "#e5e7eb"); planta(c, 18, 388); palmeira(c, 202, 384); puff(c, 100, 370, "#ec4899", "#f9a8d4");
    // ---- Conferência
    tela(c, 226, 230, 76, 30, [[6, 6, 24, "#334155"], [36, 6, 32, "#4ade80"], [36, 13, 24, "#facc15"], [36, 20, 16, "#f87171"], [6, 13, 24, "#334155"], [6, 20, 24, "#334155"]]); px(c, 262, 260, 4, 6, "#1f2937");
    brilho(c, 264, 248, 44, "45,212,191", .14);
    oval(c, 323, 357, 46, 10, "#3b2a1f"); oval(c, 323, 355.5, 46, 9, "#7a5642");
    estante(c, 390, 234, 26, 40); planta(c, 226, 388); planta(c, 414, 388);
    // ---- Expedição
    for (let i = 0; i < 3; i++) { px(c, 588, 236 + i * 40, 38, 2, "#78350f"); for (let k = 0; k < 3; k++) { px(c, 590 + k * 12, 224 + i * 40, 11, 12, ["#b45309", "#a16207", "#92400e"][(i + k) % 3]); px(c, 590 + k * 12, 229 + i * 40, 11, 1, "#fcd34d"); } }
    px(c, 470, 360, 40, 18, "#64748b"); px(c, 470, 360, 40, 1.5, "#94a3b8"); px(c, 472, 352, 16, 10, "#b45309"); px(c, 490, 354, 14, 8, "#a16207"); oval(c, 476, 380, 3, 3, "#111"); oval(c, 504, 380, 3, 3, "#111");
    px(c, 598, 378, 30, 12, "#14532d"); c.save(); c.shadowColor = "#4ade80"; c.shadowBlur = 6; px(c, 600, 380, 26, 3, "#4ade80"); c.restore();
    janelaCidade(c, 440, 252, 40, 18); planta(c, 438, 388); palmeira(c, 560, 386);
    // luz ambiente
    c.save(); c.globalCompositeOperation = "lighter";
    for (const s of Object.values(SALAS)) { const [x, y, w, h] = s.r; for (let i = 1; i <= 2; i++) brilho(c, x + (w * i) / 3, y + h * .55, Math.min(w, h) * .45, "255,214,150", .07); }
    c.restore();
    for (const s of Object.values(SALAS)) { const [x, y, w] = s.r; for (let i = 1; i <= 2; i++) luminaria(c, x + (w * i) / 3, y + (y < 176 ? FACE + 4 : 6)); }
    const v = c.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .65); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.35)"); c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  // ---------- mobília por agente (desenhada por cima de quem está sentado) ----------
  function mesa(c, a, t, ativo) {
    const [x, y] = POS[a];
    if (a === "plateia") return;
    px(c, x - 18, y + 2, 36, 4, "#a06a35"); px(c, x - 18, y + 2, 36, 1, "#bd8148"); px(c, x - 18, y + 6, 36, 9, "#7a4a22"); px(c, x - 16, y + 15, 3, 5, "#4a2f15"); px(c, x + 13, y + 15, 3, 5, "#4a2f15");
    const big = a === "conferente";
    const mw = big ? 16 : 12, mx = x - 17;
    if (ativo) { c.save(); c.globalAlpha = .22; px(c, mx - 3, y - 13, mw + 6, 18, "#4ade80"); c.restore(); }
    px(c, mx, y - 9, mw, 11, "#0f172a"); px(c, mx + 1, y - 8, mw - 2, 8, ativo ? "#0c3b28" : "#1e293b");
    if (ativo) for (let i = 0; i < 3; i++) px(c, mx + 2, y - 7 + i * 3, ((t / 110 + i * 5) % (mw - 5)) + 2, 1, i === 1 ? "#FFD21F" : "#4ade80");
    px(c, mx + mw / 2 - 1, y + 1, 2, 2, "#0f172a");
    px(c, x - 2, y + 3, 9, 1, "#e2e8f0"); px(c, x + 11, y - 1, 3, 3, "#f8fafc");
    if (a === "fotografo") { px(c, x + 20, y - 26, 2, 40, "#374151"); px(c, x + 16, y + 14, 10, 2, "#374151"); px(c, x + 15, y - 31, 12, 7, "#111"); px(c, x + 18, y - 30, 4, 4, ativo && (t / 300 | 0) % 6 === 0 ? "#fff" : "#60a5fa"); }
    if (a === "montador") { px(c, x + 6, y - 7, 11, 7, "#e5e7eb"); px(c, x + 8, y - 9, 7, 2, "#f9fafb"); if (ativo) px(c, x + 8, y, 7, 3, "#f8fafc"); }
    if (a === "entregador") { px(c, x + 4, y - 9, 13, 9, "#b45309"); px(c, x + 5, y - 8, 11, 2, "#facc15"); }
    if (a === "diretor") { px(c, x + 4, y - 6, 8, 6, "#f5f5f5"); px(c, x + 5, y - 5, 6, 1, "#9ca3af"); px(c, x + 5, y - 3, 5, 1, "#9ca3af"); }
    if (a === "retocador") { px(c, x + 5, y - 5, 9, 5, "#1f2937"); px(c, x + 6, y - 4, 7, 3, "#93c5fd"); }
    if (a === "escritora" || a === "planejadora") { px(c, x + 6, y - 4, 7, 4, "#f8fafc"); px(c, x + 7, y - 3, 5, 1, "#94a3b8"); }
  }

  // ---------- boneco: 12×18, com contorno e sombreado ----------
  function boneco(c, ag, x, y, f) {
    const a = AG[ag] || ag; const X = Math.round(x) - 6, Y = Math.round(y) - 18;
    const p = (ux, uy, uw, uh, cor) => px(c, X + ux, Y + uy, uw, uh, cor);
    const linha = "#14161c";
    if (!f.sentado) p(2, 18, 8, 2, "rgba(0,0,0,.28)");
    // contorno
    p(1, -1, 10, 9, linha); p(0, 7, 12, 8, linha); if (!f.sentado) p(2, 14, 8, 4, linha);
    // pernas
    if (!f.sentado) {
      const q = f.quadro % 4, pa = q === 1 ? -1 : q === 3 ? 1 : 0;
      p(3, 14, 3, 3 + (pa < 0 ? -1 : 0), "#1f2937"); p(6, 14, 3, 3 + (pa > 0 ? -1 : 0), "#1f2937");
      p(3, 17 + (pa < 0 ? -1 : 0), 3, 1, "#0b0f14"); p(6, 17 + (pa > 0 ? -1 : 0), 3, 1, "#0b0f14");
    }
    // tronco
    p(1, 8, 10, 6, a.cam); p(9, 8, 2, 6, tom(a.cam, .78)); p(1, 13, 10, 1, tom(a.cam, .65)); p(5, 8, 2, 1, tom(a.cam, 1.25));
    const dg = f.digitando ? f.quadro % 2 : 0;
    if (f.sentado && f.digitando) { p(1, 11 + dg, 2, 2, a.pele); p(9, 12 - dg, 2, 2, a.pele); }
    else { p(0, 9, 1, 4, tom(a.cam, .85)); p(11, 9, 1, 4, tom(a.cam, .85)); p(0, 13, 1, 1, a.pele); p(11, 13, 1, 1, a.pele); }
    if (f.papel) { p(9, 9, 5, 6, "#f8fafc"); p(10, 10, 3, 1, "#94a3b8"); p(10, 12, 3, 1, "#94a3b8"); }
    // cabeça
    p(2, 1, 8, 7, a.pele); p(2, 7, 8, 1, tom(a.pele, .86));
    const cab = a.cab;
    if (a.cabelo !== "careca") { p(2, 0, 8, 2, cab); p(2, 2, 1, 2, cab); p(9, 2, 1, 2, cab); }
    if (a.cabelo === "longo") { p(1, 2, 1, 6, cab); p(10, 2, 1, 6, cab); }
    if (a.cabelo === "coque") { p(4, -2, 4, 2, cab); }
    if (a.cabelo === "bone") { p(2, 0, 8, 2, tom(a.cam, .9)); p(8, 2, 4, 1, tom(a.cam, .7)); }
    if (f.costas) { p(2, 1, 8, 6, cab); }
    else {
      const ox = f.dir === -1 ? -1 : f.dir === 1 ? 1 : 0;
      if ((f.quadro + ag.length * 3) % 37) { p(4 + ox, 4, 1, 1, "#111"); p(7 + ox, 4, 1, 1, "#111"); }
      p(5 + ox, 6, 2, 1, f.feliz ? "#9f1239" : tom(a.pele, .7));
      p(3, 5, 1, 1, "rgba(255,110,110,.25)"); p(8, 5, 1, 1, "rgba(255,110,110,.25)");
    }
  }
  function plateiaGrupo(c, t, ativo) {
    const P = [["#3b82f6", "#5b3a29", "#e8b48c", "curto"], ["#22c55e", "#111", "#c98d63", "curto"], ["#ec4899", "#7c2d12", "#f0c9a0", "longo"], ["#6b7280", "#d1d5db", "#e3b089", "careca"]];
    P.forEach(([cam, cab, pele, cabelo], i) => {
      const x = 271 + i * 21, y = 124 + (ativo && ((t / 260 + i) | 0) % 2 ? -1 : 0);
      boneco(c, { cam, cab, pele, cabelo }, x, y, { sentado: true, quadro: (t / 160) | 0, digitando: false, dir: 0 });
    });
  }

  // ---------- estilo ----------
  const CSS = `
.escr{display:flex;flex-direction:column;height:100%;min-height:0;background:#0f1115;border:1px solid #23262d;border-radius:14px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#e7e7e3}
.escr-topo{display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid #23262d;font-size:13px;flex:none}
.escr-topo b{font-size:14px}.escr-topo .sp{flex:1}
.escr-st{color:#9aa0a8}.escr-st.on{color:#4ade80}
.escr-bt{background:#1b1e24;border:1px solid #2c3038;color:#e7e7e3;border-radius:8px;padding:5px 9px;font:600 12px Inter,sans-serif;cursor:pointer}
.escr-bt:hover{border-color:#FFD21F;color:#FFD21F}
.escr-palco{position:relative;flex:1;min-height:220px;background:#0b0d10;overflow:hidden}
.escr-tela{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
.escr-tela canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges}
.escr-hud{position:absolute;inset:0;pointer-events:none}
.escr-ag{position:absolute;left:0;top:0;width:0;height:0;pointer-events:auto;cursor:pointer}
.escr-bolha{position:absolute;left:0;bottom:6px;transform:translateX(-50%);width:max-content;max-width:200px;background:#fff;color:#111;border-radius:9px;padding:5px 8px;font:500 11px/1.35 Inter,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.45);animation:escrEntra .25s ease-out;z-index:2}
.escr-bolha::after{content:"";position:absolute;left:50%;bottom:-4px;transform:translateX(-50%) rotate(45deg);width:8px;height:8px;background:#fff}
.escr-bolha.pronto,.escr-bolha.pronto::after{background:#ecfdf5}.escr-bolha.erro,.escr-bolha.erro::after{background:#fef2f2}
.escr-ponto{position:absolute;left:0;top:0;width:7px;height:7px;border-radius:50%;transform:translate(-50%,-50%);background:#6b7280;border:1.5px solid #0b0d10}
.escr-ag[data-st=trabalhando] .escr-ponto{background:#4ade80;animation:escrPulso 1.2s infinite}
.escr-ag[data-st=pronto] .escr-ponto{background:#60a5fa}.escr-ag[data-st=erro] .escr-ponto{background:#f87171}
@keyframes escrPulso{0%{box-shadow:0 0 0 0 rgba(74,222,128,.7)}70%{box-shadow:0 0 0 6px rgba(74,222,128,0)}100%{box-shadow:0 0 0 0 rgba(74,222,128,0)}}
@keyframes escrEntra{from{opacity:0;transform:translate(-50%,5px) scale(.96)}to{opacity:1;transform:translate(-50%,0)}}
.escr-plaq{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font:700 9px/1 Inter,sans-serif;color:#111;letter-spacing:.02em;text-transform:uppercase;pointer-events:none}
.escr-nome{position:absolute;transform:translate(-50%,0);white-space:nowrap;background:rgba(10,12,16,.78);border:1px solid #2c3038;color:#e7e7e3;border-radius:5px;padding:1px 5px;font:600 9.5px/1.3 Inter,sans-serif;pointer-events:auto;cursor:pointer}
.escr-nome:hover{border-color:#FFD21F;color:#FFD21F}
.escr-ag[data-st=trabalhando]+.escr-nome,.escr-nome.on{border-color:#4ade80}
.escr-marca{position:absolute;transform:translate(-50%,-50%);font:800 11px/1 'Archivo Black',Inter,sans-serif;color:#111;white-space:nowrap;pointer-events:none}
.escr-ficha{position:absolute;right:10px;top:10px;width:250px;background:rgba(15,17,21,.97);border:1px solid #2c3038;border-radius:12px;padding:12px 14px;font-size:12.5px;line-height:1.45;box-shadow:0 10px 30px rgba(0,0,0,.5);z-index:5}
.escr-ficha h4{margin:0 0 4px;font-size:15px}.escr-ficha h5{margin:10px 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#9aa0a8}
.escr-ficha p{margin:0;color:#cfd2d6}.escr-ficha ul{margin:0;padding-left:16px}.escr-ficha li{margin:3px 0}.escr-ficha li.erro{color:#fca5a5}.escr-ficha li.pronto{color:#a7f3d0}
.escr-ficha .x{position:absolute;right:8px;top:6px;background:none;border:0;color:#9aa0a8;font-size:18px;cursor:pointer}
.escr-feed{flex:none;height:118px;overflow:auto;padding:8px 12px;border-top:1px solid #23262d;font-size:12px;line-height:1.45}
.escr-linha{padding:3px 0;color:#cfd2d6}.escr-linha .h{color:#6b7280;margin-right:6px;font-variant-numeric:tabular-nums}.escr-linha.erro{color:#fca5a5}
`;
  function estilo() { if (document.getElementById("escr-css2")) return; const s = document.createElement("style"); s.id = "escr-css2"; s.textContent = CSS; document.head.appendChild(s); }
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  // ---------- motor ----------
  function criar(container, op = {}) {
    estilo();
    const raiz = document.createElement("div"); raiz.className = "escr"; container.appendChild(raiz);
    raiz.innerHTML = `<div class="escr-topo"><b>Escritório</b><span class="escr-st">—</span><span class="sp"></span>
      <button class="escr-bt" data-escr="rever">▶ Rever como foi feito</button><button class="escr-bt" data-escr="vel" title="Velocidade">1×</button></div>
      <div class="escr-palco"><div class="escr-tela"><canvas class="escr-fundo" width="${W * 2}" height="${H * 2}"></canvas><canvas class="escr-cena" width="${W}" height="${H}"></canvas><div class="escr-hud"></div></div>
      <div class="escr-ficha" hidden></div></div><div class="escr-feed"></div>`;
    const palco = raiz.querySelector(".escr-palco"), tela = raiz.querySelector(".escr-tela");
    const fundo = raiz.querySelector(".escr-fundo"), cena = raiz.querySelector(".escr-cena"), hud = raiz.querySelector(".escr-hud");
    const ficha = raiz.querySelector(".escr-ficha"), feed = raiz.querySelector(".escr-feed"), st = raiz.querySelector(".escr-st");
    { const fc = fundo.getContext("2d"); fc.scale(2, 2); desenharCenario(fc); }
    const c = cena.getContext("2d");
    let s = 1;
    function encaixar() { const cw = palco.clientWidth, ch = palco.clientHeight; if (!cw || !ch) return; s = Math.min(cw / W, ch / H); tela.style.width = W * s + "px"; tela.style.height = H * s + "px"; }
    // placas (salas e marca) — posições em coordenadas do mundo
    const fixos = [];
    const marca = document.createElement("div"); marca.className = "escr-marca"; marca.textContent = "DO OUTRO LADO DA PORTA"; hud.appendChild(marca); fixos.push([marca, 320, 17]);
    for (const sa of Object.values(SALAS)) {
      const el = document.createElement("div"); el.className = "escr-plaq"; el.textContent = sa.nome.length > 14 ? sa.nome.split(" ")[0] : sa.nome; el.style.color = NEON[Object.keys(SALAS).find((k) => SALAS[k] === sa)]; hud.appendChild(el);
      const emCima = sa.r[1] < 176; fixos.push([el, sa.porta + 38, emCima ? sa.r[1] + sa.r[3] + 7.5 : sa.r[1] - 9.5]);
    }
    const S = {}, tags = {}, nomes = {};
    ORDEM.forEach((k) => {
      const [x, y] = POS[k]; S[k] = { x, y, casa: [x, y], estado: "ocioso", fala: "", falaVis: "", falaAte: 0, rota: [], papel: false, log: [], feliz: 0 };
      const d = document.createElement("div"); d.className = "escr-ag"; d.dataset.ag = k; d.innerHTML = `<div class="escr-bolha" hidden></div><div class="escr-ponto"></div>`; hud.appendChild(d); tags[k] = d;
      const n = document.createElement("div"); n.className = "escr-nome"; n.dataset.ag = k; n.textContent = AG[k].nome; hud.appendChild(n); nomes[k] = n;
    });
    let tocando = false, entregaTxt = "", fila = [], ultimoPronto = null, vel = 1, rodando = true, t0 = performance.now(), aoVivo = false, todos = [];

    function portaDe(k) { const sa = SALAS[AG[k].sala]; const emCima = sa.r[1] < 176; return [sa.porta, emCima ? sa.r[1] + sa.r[3] - 8 : sa.r[1] + 8]; }
    function rotaEntre(k, de, para, destino) {
      const [pa, pya] = portaDe(de), [pb, pyb] = portaDe(para);
      const r = [];
      if (AG[de].sala === AG[para].sala) { r.push(destino); return r; }
      r.push([pa, pya], [pa, CORR_Y], [pb, CORR_Y], [pb, pyb], destino);
      return r;
    }
    function andarAte(k, salaDe, salaPara, destino, depois) { S[k].rota = rotaEntre(k, salaDe, salaPara, destino); S[k].depois = depois; }
    function entregar(de, para, depois) {
      const a = S[de]; if (!a || de === para) { depois && depois(); return; }
      a.papel = true; entregaTxt = `${AG[de].nome} levando a folha para ${AG[para].nome}`;
      const [bx, by] = S[para].casa;
      andarAte(de, de, para, [bx + (bx > a.casa[0] ? -16 : 16), by + 8], () => {
        a.papel = false; S[para].papelNaMesa = performance.now(); entregaTxt = "";
        depois && depois();
        setTimeout(() => andarAte(de, para, de, a.casa, null), 450 / vel);
      });
    }
    function falar(k, txt, estado) {
      const a = S[k]; a.estado = estado || "trabalhando"; a.fala = txt; a.falaVis = ""; a.falaAte = performance.now() + ((estado === "pronto" ? 4500 : 9000) + txt.length * 30) / vel;
      if (estado === "pronto") a.feliz = performance.now() + 1500;
      const b = tags[k].querySelector(".escr-bolha"); b.hidden = false; b.className = "escr-bolha " + (estado || "trabalhando");
      tags[k].dataset.st = a.estado; nomes[k].classList.toggle("on", a.estado === "trabalhando");
    }
    function linhaFeed(ev) {
      const k = ev.agente; const l = document.createElement("div"); l.className = "escr-linha " + (ev.estado || "");
      const hora = ev.criado_em ? new Date(ev.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
      l.innerHTML = `<span class="h">${hora}</span><b style="color:${(AG[k] || {}).cam}">${(AG[k] || {}).nome || k}</b> ${esc(ev.fala)}`;
      feed.prepend(l); while (feed.children.length > 40) feed.lastChild.remove();
    }
    function processar(ev) {
      const k = ev.agente; if (!S[k]) return;
      S[k].log.push(ev); linhaFeed(ev);
      const comecar = () => falar(k, ev.fala, ev.estado);
      if (ev.estado === "trabalhando" && ultimoPronto && ultimoPronto !== k && S[ultimoPronto].rota.length === 0 && ultimoPronto !== "plateia" && k !== "plateia") {
        const de = ultimoPronto; ultimoPronto = null; entregar(de, k, comecar);
      } else comecar();
      if (ev.estado === "pronto") ultimoPronto = k;
      ORDEM.forEach((o) => { if (o !== k && S[o].estado === "trabalhando" && ev.estado === "trabalhando") { S[o].estado = "pronto"; tags[o].dataset.st = "pronto"; nomes[o].classList.remove("on"); } });
    }
    function tocarFila() { if (!fila.length) { tocando = false; return; } tocando = true; const ev = fila.shift(); processar(ev); setTimeout(tocarFila, (ev.estado === "pronto" ? 2800 : 3600) / vel); }

    let proxPasseio = performance.now() + 5000;
    function passeios(agora) {
      if (agora < proxPasseio) return; proxPasseio = agora + 6000 + Math.random() * 7000;
      if (ORDEM.some((k) => S[k].estado === "trabalhando" || S[k].rota.length)) return;
      const livres = ORDEM.filter((k) => k !== "plateia"); const k = livres[(Math.random() * livres.length) | 0];
      const destinos = [[271, 202], [291, 202], [565, 214], [150, 204]];
      const d = destinos[(Math.random() * destinos.length) | 0];
      const [pa, pya] = portaDe(k);
      S[k].rota = [[pa, pya], [pa, CORR_Y], d];
      S[k].depois = () => setTimeout(() => { S[k].rota = [[pa, CORR_Y], [pa, pya], S[k].casa]; S[k].depois = null; }, 2200 / vel);
    }

    function quadroAnim(agora) {
      if (!rodando) return;
      encaixar();
      const t = (agora - t0) * vel, q = (t / 160) | 0;
      c.clearRect(0, 0, W, H);
      passeios(agora);
      ORDEM.forEach((k) => {
        const a = S[k]; if (!a.rota.length) return;
        const [tx, ty] = a.rota[0], v = 0.75 * vel, dx = tx - a.x, dy = ty - a.y, dist = Math.hypot(dx, dy);
        if (dist <= v) { a.x = tx; a.y = ty; a.rota.shift(); if (!a.rota.length && a.depois) { const f = a.depois; a.depois = null; f(); } }
        else { a.x += (dx / dist) * v; a.y += (dy / dist) * v; a.dir = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0; a.costas = dy < -0.2 && Math.abs(dy) > Math.abs(dx); }
      });
      const ordem = [...ORDEM].sort((p1, p2) => S[p1].y - S[p2].y);
      const mesas = new Set();
      for (const k of ordem) {
        const a = S[k], sentado = !a.rota.length && Math.abs(a.x - a.casa[0]) < 1 && Math.abs(a.y - a.casa[1]) < 1;
        if (k === "plateia") { plateiaGrupo(c, t, a.estado === "trabalhando"); continue; }
        if (sentado) {
          px(c, a.x - 7, a.y - 9, 14, 12, "#1f2937"); px(c, a.x - 6, a.y - 8, 12, 2, "#374151");
          boneco(c, k, a.x, a.y + 6, { sentado: true, quadro: q, digitando: a.estado === "trabalhando", dir: 0, feliz: agora < a.feliz });
          mesa(c, k, t, a.estado === "trabalhando"); mesas.add(k);
          if (a.papelNaMesa && agora - a.papelNaMesa < 6000) px(c, a.x + 3, a.y + 3, 6, 4, "#f8fafc");
        } else {
          if (!mesas.has(k)) { mesa(c, k, t, false); mesas.add(k); }
          boneco(c, k, a.x, a.y, { quadro: q, dir: a.dir, costas: a.costas, papel: a.papel });
        }
      }
      if (((t / 400) | 0) % 2) px(c, 271, 176 - ((t / 90) % 5), 1, 2, "rgba(255,255,255,.6)");
      // HUD
      for (const [el, wx, wy] of fixos) { el.style.left = wx * s + "px"; el.style.top = wy * s + "px"; el.style.fontSize = Math.max(7, 4.6 * s) + "px"; }
      ORDEM.forEach((k) => {
        const a = S[k], el = tags[k], b = el.querySelector(".escr-bolha"), [cx, cy] = a.casa;
        const topo = k === "plateia" ? a.y - 22 : (a.rota.length ? a.y - 22 : a.y - 14);
        el.style.transform = `translate(${a.x * s}px, ${topo * s}px)`;
        nomes[k].style.left = cx * s + "px"; nomes[k].style.top = (cy + (k === "plateia" ? 16 : 22)) * s + "px";
        if (a.fala) {
          if (a.falaVis.length < a.fala.length) { a.falaVis = a.fala.slice(0, a.falaVis.length + Math.max(1, Math.round(1.6 * vel))); b.textContent = a.falaVis; }
          if (agora > a.falaAte) { a.fala = ""; b.hidden = true; if (a.estado === "pronto") { a.estado = "ocioso"; el.dataset.st = "ocioso"; } }
        }
      });
      const trab = ORDEM.filter((k) => S[k].estado === "trabalhando").map((k) => AG[k].nome);
      st.textContent = entregaTxt ? (aoVivo ? "● ao vivo · " : "") + entregaTxt : trab.length ? `${aoVivo ? "● ao vivo · " : ""}${trab.join(", ")} trabalhando` : (aoVivo ? "● ao vivo · esperando o próximo passo" : "ninguém trabalhando agora");
      st.className = "escr-st" + (trab.length || entregaTxt ? " on" : "");
      requestAnimationFrame(quadroAnim);
    }
    requestAnimationFrame(quadroAnim);

    function abrirFicha(k) {
      const a = AG[k];
      const log = S[k].log.slice(-6).reverse().map((e) => `<li class="${e.estado}">${esc(e.fala)}</li>`).join("") || "<li>Ainda não fez nada neste post.</li>";
      ficha.innerHTML = `<button class="x" aria-label="Fechar">×</button><h4 style="color:${a.cam}">${a.nome}</h4><p><b>Sala:</b> ${SALAS[a.sala].nome}</p><p>${a.papel}</p><h5>O que fez neste post</h5><ul>${log}</ul>`;
      ficha.hidden = false; op.aoClicar && op.aoClicar(k);
    }
    hud.addEventListener("click", (ev) => { const el = ev.target.closest("[data-ag]"); if (el) abrirFicha(el.dataset.ag); });
    ficha.addEventListener("click", (ev) => { if (ev.target.closest(".x")) ficha.hidden = true; });
    raiz.querySelector('[data-escr="vel"]').onclick = (ev) => { vel = vel === 1 ? 2 : vel === 2 ? 4 : 1; ev.target.textContent = vel + "×"; };
    raiz.querySelector('[data-escr="rever"]').onclick = () => {
      ORDEM.forEach((k) => { S[k].log = []; S[k].estado = "ocioso"; S[k].fala = ""; tags[k].querySelector(".escr-bolha").hidden = true; tags[k].dataset.st = "ocioso"; nomes[k].classList.remove("on"); });
      feed.innerHTML = ""; ultimoPronto = null; fila = todos.slice(); tocarFila();
    };

    return {
      carregar(eventos, ehAoVivo) {
        todos = eventos.slice(); aoVivo = !!ehAoVivo; feed.innerHTML = "";
        if (!eventos.length) { feed.innerHTML = '<div class="escr-linha">Ainda não há trabalho registrado neste post. Quando você clicar em "Gerar post e thumbnails", a equipe aparece trabalhando aqui.</div>'; return; }
        eventos.slice(-40).forEach((e) => { S[e.agente] && S[e.agente].log.push(e); linhaFeed(e); });
        const ult = eventos[eventos.length - 1];
        if (aoVivo && ult) falar(ult.agente, ult.fala, ult.estado);
      },
      vivo(ev) { aoVivo = true; todos.push(ev); const u = fila[fila.length - 1]; if (u && u.agente === ev.agente && u.estado === ev.estado) fila[fila.length - 1] = ev; else fila.push(ev); while (fila.length > 6) fila.shift(); if (!tocando) tocarFila(); },
      reanexar(novo) { if (novo && raiz.parentNode !== novo) novo.appendChild(raiz); },
      destruir() { rodando = false; raiz.remove(); },
      el: raiz,
    };
  }
  window.Escritorio = { criar, AGENTES: AG };
})();
