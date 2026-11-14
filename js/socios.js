/* socios.js — o fluxo da marca nova DENTRO da fábrica (index.html), no visual da fábrica.
   Portado de marca-socios.html (14/11). Usa as variáveis globais do index: sb, DEMO, DEMO_EST, ACC, AMBS, APROV, GASTO,
   acc, aberto, tab, novoAmb, render, carregarAmbientes, carregarAprovacoes, perguntar, fdt, ambAtual, V4_ESPERA, toast.
   - Botão "+" → modal "Novo ambiente": nome + campo único (texto, anexos, link, áudio, prints) + guia "O que contar aqui".
     "Criar ambiente" chama marca.criar (rascunho + ensaio), sobe anexos (balde "anexos", amb_<id>/...) + marca.anexar,
     grava o texto (salvar_variaveis, bloco entrada_livre, campo m_<aaaammdd_hhmmss>). NÃO dispara estudo.
   - Aba da marca v4 (rascunho · estudando_v4 · em_aprovacao): histórico + campo para mandar mais, as 3 etapas,
     "Rodar estudo" com a estimativa antes do sim, lista ao vivo dos 18 grupos (a cada 10 s), ficha e link do cliente.
   Nada aqui chama IA. "Rodar estudo" só pede ao servidor depois do "Sim" do dono. */
(function(){
"use strict";
const LIMITE_MB=50;
const NADA_SALVO="Modo demonstração: nada foi salvo.";
const e_=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const z2=n=>String(n).padStart(2,"0");
const DIAS_S=["dom","seg","ter","qua","qui","sex","sáb"];
const quandoS=d=>`${z2(d.getDate())}/${z2(d.getMonth()+1)} · ${DIAS_S[d.getDay()]} · ${z2(d.getHours())}:${z2(d.getMinutes())}`;
const horaS=d=>d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
const usdS=n=>"US$ "+(Number(n)||0).toFixed(2).replace(".",",");
const semAcento=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const vazio=v=>v==null||v===""||(Array.isArray(v)&&!v.length)||(typeof v==="object"&&!Array.isArray(v)&&!Object.keys(v).length);
function carimbo(d=new Date()){return`${d.getFullYear()}${z2(d.getMonth()+1)}${z2(d.getDate())}-${z2(d.getHours())}${z2(d.getMinutes())}${z2(d.getSeconds())}`}
function nomeLimpo(n){const m=String(n).match(/^(.*?)(\.[a-z0-9]{1,6})?$/i);const base=(m[1]||"arquivo").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"arquivo";return base+((m[2]||"").toLowerCase())}
const IC={
 clip:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.6 8.6a2 2 0 0 1-2.8-2.8l7.9-7.9"/></svg>',
 link:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.1-1.1"/></svg>',
 mic:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
 up:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'};

/* ---------- servidor ---------- */
async function chamar(acao,corpo={}){
  const {data,error}=await sb.functions.invoke("marca",{body:{acao,...corpo}});
  if(error){try{const j=await error.context.json();if(j&&typeof j==="object")return j}catch(_){}return{ok:false,erro:"Não falou com o servidor: "+error.message}}
  if(data&&data.versao==="v4-vazia")return{ok:false,vazia:true,erro:"a função do servidor ainda não tem esta ação (está vazia)"};
  return data||{ok:false,erro:"O servidor não respondeu."};
}

/* ---------- o guia "O que contar aqui" (10 temas; ficam verdes por palavra-chave) ---------- */
const TEMAS=[
 {id:"quem",t:"Quem é a empresa",d:"O que ela é em uma frase, há quanto tempo existe, quem fundou e por quê, onde atua.",ex:"“Somos uma cafeteria de bairro aberta há 3 anos por dois amigos.”",
  p:/\b(somos|quem somos|fundad|fundamos|nascemos|abrimos|nossa historia|historia da|a empresa (e|nasceu)|existe ha|ha \d+ anos)/},
 {id:"modelo",t:"Modelo de negócio",d:"Como ganha dinheiro, onde a venda acontece, quanto o cliente gasta e com que frequência.",ex:"“Balcão (R$ 15 por visita) + assinatura de R$ 69 por mês, vendida pelo link da bio.”",
  p:/\b(ganha(mos)? dinheiro|faturamento|receita|vend(e|emos|a|as)\b|loja|e-?commerce|assinatura|ticket|preco|margem|r\$)/},
 {id:"jornada",t:"Como funciona (jornada do cliente)",d:"Os passos do cliente: como descobre, compra, recebe e volta. As perguntas que ele mais faz.",ex:"“Vê o post → abre o link → prova → assina → recebe em casa todo mês.”",
  p:/\b(jornada|como funciona|cliente (chega|compra|ve|descobre|recebe)|passo a passo|funil|entrega|perguntas frequentes|duvidas? (do|dos) cliente)/},
 {id:"estrategia",t:"Estratégia",d:"A meta com número e data, as datas importantes, quanto é marca × venda, o tom e o humor.",ex:"“300 assinantes até 15/02. Natal é forte. 70% marca, 30% venda. Tom acolhedor.”",
  p:/\b(meta|objetivo|estrategia|posicionamento|lancamento|campanha|black friday|natal|trimestre|\btom\b|humor|\d+ ?% marca)/},
 {id:"tipos",t:"Tipos de post que vocês querem (com %)",d:"Quais posts (carrossel, meme, notícia, enquete, story, reels), quanto de cada um e quantos por dia.",ex:"“Café da semana em carrossel 30%, meme do balcão 25%, enquete de sábado 10%.”",
  p:/\b(tipos? de post|carross|meme|reels?|stor(y|ies)|enquete|noticia|posts? por dia)/},
 {id:"referencias",t:"Referências",d:"Perfis que vocês admiram (o que pegar e o que não pegar) e prints de 10 posts que amam ou odeiam, dizendo por quê.",ex:"“@perfilx: pegar as fotos de perto; não pegar o texto longo.” + 10 prints anexados.",
  p:/(@[a-z0-9_.]{2,}|\breferencia|\binspiracao|\bperfis?\b|\bamamos\b|\bodiamos\b|\bodeio\b|\bprints?\b|instagram\.com)/},
 {id:"limites",t:"Limites e aprovação",d:"O que não pode de jeito nenhum, quem aprova e em quanto tempo, e se a IA pode mexer na foto do produto.",ex:"“Nunca preço na capa. A Ana aprova em 24 h. A IA não pode alterar o produto.”",
  p:/\b(nao pode|proibid|nunca|jamais|evitar|aprova|limite|ia (pode|nao)|mexer no produto|alterar o produto)/},
 {id:"3d",t:"3D",d:"Se o produto tem modelo 3D ou render do Blender, anexe e diga onde pode usar.",ex:"“Anexei o render do pacote (Blender). Pode usar em capa e story.”",
  p:/(\b3d\b|blender|\brender|\.blend\b|\.glb\b|\.gltf\b|\.obj\b|\.fbx\b)/},
 {id:"estoque",t:"Estoque (se vende peça única)",d:"Se cada peça é única (brechó, arte, usado), conte como funciona o estoque e como avisar que vendeu.",ex:"“Cada peça é única; quando vende, o post sai do ar.” Ou: “Não usamos estoque.”",
  p:/\b(estoque|peca unica|pecas unicas|brecho|garimp|exemplar unico)/},
 {id:"reuniao",t:"Tudo o que a empresa mandou na reunião",d:"Documentos, apresentações, manual da marca, planilhas, áudio da reunião. Anexe do jeito que veio.",ex:"Manual da marca em PDF, apresentação, áudio de 20 min da reunião.",
  p:/\b(reuniao|apresentacao|manual|briefing|documento|planilha|gravacao|ata)\b|\.(pdf|pptx?|key|docx?|xlsx?|odt|webm|m4a|mp3|ogg|wav)\b/}
];
const TEMA_BLOCO={quem:"quem_e",modelo:"modelo_negocio",jornada:"como_funciona",estrategia:"estrategia",tipos:"tipos_post",referencias:"referencias",limites:"limites","3d":"ativos_3d",estoque:"estoque"};

/* ---------- blocos e grupos (contrato B.2 e B.3) ---------- */
const FORMATO_T={carrossel:"Carrossel",meme:"Meme",noticia:"Notícia útil",enquete:"Enquete",story_peca:"Story de peça",reels:"Reels"};
const BLOCOS=[
 {id:"quem_e",titulo:"Quem ela é",campos:{nome:"Nome",handle:"@",site:"Site",uma_frase:"Em 1 frase",fase:"Fase",fundadores_historia:"Fundadores e história",onde_atua:"Onde atua",nao_e_foco:"Não é foco"}},
 {id:"modelo_negocio",titulo:"Modelo de negócio",campos:{como_ganha:"Como ganha dinheiro",onde_vende:"Onde vende",ticket_frequencia:"Ticket e frequência",o_que_o_post_move:"O que o post move",tensoes:"Tensões"}},
 {id:"como_funciona",titulo:"Como a empresa funciona",campos:{jornada:"Jornada do cliente",prova_central:"Prova central",perguntas_frequentes:"Perguntas frequentes"}},
 {id:"estrategia",titulo:"Estratégia",campos:{objetivo_90_dias:"Objetivo de 90 dias",marcos:"Marcos",proporcao_marca_venda:"Marca × venda",posicionamento:"Posicionamento",tom_humor:"Tom do humor",ativos_distintivos:"Ativos distintivos"}},
 {id:"tipos_post",titulo:"Tipos de post",campos:{lista:"Tipos",posts_por_dia:"Posts por dia",percentual_por_formato:"% por formato"}},
 {id:"referencias",titulo:"Referências",campos:{perfis:"Perfis",posts_amados_odiados:"Posts amados e odiados"}},
 {id:"limites",titulo:"Limites e aprovação",campos:{proibidos:"Proibidos",quem_aprova:"Quem aprova",ia_altera_produto:"A IA pode alterar o produto?"}},
 {id:"ativos_3d",titulo:"3D e ativos especiais",campos:{tem_3d:"Tem 3D?",arquivos:"Arquivos do 3D",onde_usar:"Onde usar"}},
 {id:"estoque",titulo:"Estoque",campos:{usa_estoque:"Usa estoque?",observacao:"Observação"}}
];
const GRUPOS=[["G1","Negócio"],["G2","Público"],["G3","Concorrência e brechas"],["G4","Posicionamento"],["G5","Voz"],["G6","Visual"],["G7","Conteúdo"],["G8","Calendário"],["G9","Assuntos do momento"],["G10","Riscos e Pausa"],["G11","Metas"],["G12","Operação"],["G13","Comunidade"],["G14","Ativos especiais e 3D"],["G15","Perfil e vitrine"],["G16","Mecânica do formato"],["G17","Distribuição"],["G18","Estoque"]];
const PAPEIS=[["leitor_anexos","Leitor de anexos","lê os anexos e cita a página"],["melhorador","Melhorador","devolve antes e depois do que os sócios escreveram"],["critico","Crítico","confere cada grupo e a fonte citada"],["estrategista","Estrategista","junta tudo numa ficha"],["editor","Editor","escreve o título e o número de cada página"],["cetico","Cético final","lê como se fosse o cliente"]];
const ESTADO_T={esperando:["Esperando","st-draft"],rodando:["Rodando","st-wait"],feito:["Feito","st-ok"],devolvido:["Devolvido","st-rej"]};
const COM_BUSCA=["G2","G3","G8","G9","G10","G15","G16","G17"];
/* estimativa pelas regras de preço do contrato (seção F) — só quando o servidor não devolve a dele */
function estimativaLocal(gr){const g=gr&&gr.length?gr:GRUPOS.map(x=>x[0]);let m=0;g.forEach(x=>{m+=COM_BUSCA.includes(x)?0.15:0.05;m+=0.02});m+=0.05+0.10+0.10+0.05;return{medidor_usd:+m.toFixed(2),real_usd:+(m*1.4).toFixed(2)}}
const STATUS_FICHA={rascunho:"Rascunho (esperando aprovação)",aprovada:"Aprovada pelo cliente",ativa:"Ativa na fábrica"};

/* ---------- anexos ---------- */
const PAPEL_T={oficial:"Oficial",rascunho:"Rascunho",inspiracao:"Só inspiração"};
const PAPEL_TIP="Oficial: vale como regra da marca · Rascunho: ideia em andamento, usar com cuidado · Só inspiração: referência de gosto, nunca regra";
function ext(a){if(a.tipo==="link")return"link";const m=(a.nome||"").match(/\.([a-z0-9]{1,5})$/i);return m?m[1]:(a.tipo||"").split("/")[1]||"?"}
function tipoT(a){const t=a.tipo||"";if(t==="link")return"Link";if(/^image\//.test(t))return"Imagem";if(/^audio\//.test(t))return"Áudio";if(/pdf/.test(t))return"PDF";if(/presentation|powerpoint|keynote/.test(t))return"Apresentação";if(/sheet|excel|csv/.test(t))return"Planilha";if(/word|document|text/.test(t))return"Documento";return"Arquivo"}
function tam(b){if(!b)return"";return b>1048576?(b/1048576).toFixed(1).replace(".",",")+" MB":Math.max(1,Math.round(b/1024))+" KB"}
const papelPadrao=f=>/^image\//.test(f.type||"")?"inspiracao":"oficial";
const seletorPapel=(attr,papel,dis)=>`<select class="soc-papel p-${e_(papel)}" ${attr} title="${e_(PAPEL_TIP)}" aria-label="Isso é oficial, rascunho ou só inspiração?"${dis?" disabled":""}>${Object.entries(PAPEL_T).map(([k,t])=>`<option value="${k}"${k===papel?" selected":""}>${t}</option>`).join("")}</select>`;
const linkDe=a=>/^https?:\/\//.test(a.caminho||"")?a.caminho:/^https?:\/\//.test(a.nome||"")?a.nome:"";
const MINI_DEMO="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#F3E2D3"/><rect x="4" y="5" width="15" height="14" rx="2" fill="#E07A2E"/><rect x="21" y="5" width="15" height="14" rx="2" fill="#2347D6"/><rect x="4" y="21" width="15" height="14" rx="2" fill="#1B1E22"/><rect x="21" y="21" width="15" height="14" rx="2" fill="#7A5600"/></svg>');

/* ---------- estado ---------- */
const S={};          // por marca: S[id] = {msgs, anexos, lidos, linhas, ficha, ...}
function est(id){return S[id]||(S[id]={carregado:false,carregando:false,erro:"",msgs:[],anexos:[],lidos:{},linhas:[],ficha:null,melhorias:[],pend:[],draft:"",estimativa:null,ultima:null,proxima:0,lendoFicha:false,enviando:false,demoPasso:0})}
let ID=0;            // marca aberta na aba
let DEMO_FICHA=null;
let timer=null,tick=null,timerId=null;
let guardadoNovo=null; // o que foi escrito no modal e fechado sem criar (volta ao abrir o "+" de novo)
const leituraMs=()=>DEMO?2500:10000;
const pendDe=w=>w==="novo"?(novoAmb?novoAmb.pend:[]):est(ID).pend;
const $id=id=>document.getElementById(id);

/* ---------- campo único (mesmo desenho do campo do chat da fábrica) ---------- */
let gravador=null,gravW=null,pedacos=[],gravouEm=0;
function caixaHTML(w,texto,dis){
  const novo=w==="novo";
  return `<div class="soc-caixa" data-soc-caixa="${w}">
    <textarea id="soc-ta-${w}" class="soc-ta" data-soc-ta="${w}" rows="${novo?8:4}" maxlength="20000" aria-label="${novo?"Tudo sobre a empresa":"Mandar mais sobre a marca"}"${dis?" disabled":""}
      placeholder="${novo?"Escreva do jeito que falaria numa reunião: o que a empresa é, como ganha dinheiro, a meta, os posts que querem, o que não pode, quem aprova… Cole o @, o site, o texto que o cliente mandou.":"Mandar mais: escreva, cole um print, anexe um arquivo ou grave um áudio. Ctrl+Enter envia."}">${e_(texto||"")}</textarea>
    <div class="soc-pend" id="soc-pend-${w}">${pendHTML(w)}</div>
    <div class="soc-linklinha" id="soc-link-${w}" hidden>
      <input type="url" id="soc-url-${w}" data-soc-url="${w}" placeholder="Cole o link (vídeo, perfil, pasta, site): https://" maxlength="1000" aria-label="Link">
      <button type="button" class="btn" data-soc="link-por" data-soc-w="${w}">Pôr</button><button type="button" class="btn" data-soc="link-fechar" data-soc-w="${w}">Fechar</button>
    </div>
    <div class="crow soc-crow">
      <button type="button" class="ib txt" data-soc="anexar" data-soc-w="${w}" title="PDF, imagem, print, áudio, documento, apresentação (até ${LIMITE_MB} MB cada)"${dis?" disabled":""}>${IC.clip}Anexar</button>
      <button type="button" class="ib txt" data-soc="link" data-soc-w="${w}"${dis?" disabled":""}>${IC.link}Link</button>
      <button type="button" class="ib txt${gravW===w?" rec":""}" data-soc="gravar" data-soc-w="${w}"${dis?" disabled":""}>${IC.mic}<span>${gravW===w?"Parar gravação":"Gravar áudio"}</span></button>
      <span class="sp"></span>
      ${novo?"":`<button type="button" class="send" data-soc="enviar" aria-label="Enviar"${dis?" disabled":""}>${IC.up}</button>`}
    </div>
    <p class="soc-small" id="soc-msg-${w}" role="status">Arraste arquivos para cá ou cole prints com Ctrl+V. Vídeo não sobe: mande o link.</p>
  </div>`;
}
function pendHTML(w){
  return pendDe(w).map((p,i)=>`<div class="soc-ax">
    <span class="ic">${p.prev?`<img src="${e_(p.prev)}" alt="">`:e_(p.tipo==="link"?"link":(p.nome.match(/\.([a-z0-9]{1,5})$/i)||[,"arq"])[1])}</span>
    <div class="info"><div class="nm" title="${e_(p.nome)}">${e_(p.tipo==="link"?p.url.replace(/^https?:\/\//,""):p.nome)}</div>
      <div class="ds">${e_(p.tipo==="link"?"Link":tipoT({tipo:p.file.type}))}${p.file?" · "+tam(p.file.size):""} · <button type="button" class="soc-lnk" data-soc="tirar" data-soc-w="${w}" data-soc-i="${i}">tirar</button></div></div>
    ${seletorPapel(`data-soc-papel-pend="${w}:${i}"`,p.papel,false)}
  </div>`).join("");
}
function pintarPend(w){const el=$id("soc-pend-"+w);if(el)el.innerHTML=pendHTML(w);pintarGuia(w)}
function porArquivos(w,files){
  const fora=[],L=pendDe(w);
  [...files].forEach(f=>{
    if(/^video\//.test(f.type)){fora.push(`${f.name}: vídeo não sobe, mande o link`);return}
    if(f.size>LIMITE_MB*1048576){fora.push(`${f.name}: mais de ${LIMITE_MB} MB`);return}
    const nome=f.name||`print-${carimbo()}.png`;
    L.push({tipo:"arquivo",file:f,nome,papel:papelPadrao(f),prev:/^image\//.test(f.type)?URL.createObjectURL(f):null});
  });
  pintarPend(w);
  if(fora.length)toast(fora.join(" · "));
}
function porLink(w){const inp=$id("soc-url-"+w);const url=(inp&&inp.value||"").trim();
  if(!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(url)){toast("Cole um endereço que comece com https://");return}
  pendDe(w).push({tipo:"link",url,nome:url,papel:"inspiracao"});inp.value="";$id("soc-link-"+w).hidden=true;pintarPend(w)}
function seletorArquivo(){let i=$id("soc-arq");if(!i){i=document.createElement("input");i.type="file";i.id="soc-arq";i.multiple=true;i.hidden=true;document.body.append(i);
  i.addEventListener("change",()=>{porArquivos(i.dataset.w||"novo",i.files);i.value=""})}return i}
async function gravar(w){
  if(gravador){gravador.stop();return}
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){toast("Este navegador não grava áudio. Anexe o arquivo de áudio.");return}
  try{const st=await navigator.mediaDevices.getUserMedia({audio:true});pedacos=[];gravouEm=Date.now();gravW=w;
    gravador=new MediaRecorder(st);gravador.ondataavailable=e=>pedacos.push(e.data);
    gravador.onstop=()=>{st.getTracks().forEach(t=>t.stop());const s=Math.round((Date.now()-gravouEm)/1000);const tipo=(gravador.mimeType||"audio/webm").split(";")[0];
      const f=new File(pedacos,`audio-${s}s-${carimbo()}.webm`,{type:tipo});pendDe(gravW).push({tipo:"arquivo",file:f,nome:f.name,papel:"oficial"});
      const ww=gravW;gravador=null;gravW=null;botaoGravar(ww,false);pintarPend(ww)};
    gravador.start();botaoGravar(w,true)}
  catch(e){gravador=null;gravW=null;toast("Não consegui usar o microfone: "+e.message)}
}
function botaoGravar(w,on){const b=document.querySelector(`[data-soc="gravar"][data-soc-w="${w}"]`);if(!b)return;b.classList.toggle("rec",on);b.querySelector("span").textContent=on?"Parar gravação":"Gravar áudio"}

/* sobe os anexos pendentes: arquivo → balde "anexos" (amb_<id>/...) + marca.anexar; link → marca.anexar (tipo link) */
async function subirPendentes(id,pend,agora,prog){
  const ids=[],erros=[];let n=0;
  for(const p of pend){n++;prog&&prog(`Enviando anexo ${n} de ${pend.length}…`);
    if(p.tipo==="link"){const r=await chamar("anexar",{ambiente_id:id,tipo:"link",url:p.url,caminho:p.url,nome:p.url,papel:p.papel,descricao:`Link da mensagem de ${quandoS(agora)}`});
      if(r.ok&&r.anexo)ids.push(r.anexo.id);else erros.push(`${p.url}: ${r.erro||"não registrou"}`);continue}
    const f=p.file;const caminho=`amb_${id}/${carimbo()}_${nomeLimpo(p.nome)}`;
    const up=await sb.storage.from("anexos").upload(caminho,f,{contentType:f.type||"application/octet-stream",upsert:false});
    if(up.error){erros.push(`${p.nome}: não subiu (${up.error.message})`);continue}
    const r=await chamar("anexar",{ambiente_id:id,caminho,nome:p.nome,tipo:f.type||"application/octet-stream",papel:p.papel,descricao:`Enviado na mensagem de ${quandoS(agora)}`,tamanho_bytes:f.size});
    if(r.ok&&r.anexo)ids.push(r.anexo.id);else erros.push(`${p.nome}: subiu, mas não registrou (${r.erro||"erro sem texto"})`);
  }
  return{ids,erros};
}
/* grava 1 mensagem do campo único: bloco entrada_livre, campo m_<aaaammdd_hhmmss> */
function salvarMensagem(id,texto,ids,agora){
  const campo="m_"+carimbo(agora).replace("-","_");
  return chamar("salvar_variaveis",{ambiente_id:id,variaveis:[{bloco:"entrada_livre",campo,valor:{texto,anexos:ids,enviado_em:agora.toISOString()},origem:"socio",
    fonte:`campo aberto dos sócios ${agora.toLocaleDateString("pt-BR")} ${z2(agora.getHours())}:${z2(agora.getMinutes())}`,certeza:"alta"}]});
}

/* ---------- guia ---------- */
function textoDe(w){
  if(w==="novo"){const N=novoAmb||{};return semAcento([N.nome,N.texto,...(N.pend||[]).map(p=>p.nome)].join("\n"))}
  const s=est(ID);return semAcento([...s.msgs.map(m=>m.texto),...s.anexos.map(a=>`${a.nome} ${a.descricao||""}`),s.draft,...s.pend.map(p=>p.nome)].join("\n"));
}
function temasHTML(w){
  const t=textoDe(w),curto=w==="novo";let n=0;
  const li=TEMAS.map(T=>{const ok=T.p.test(t);if(ok)n++;
    return `<li class="${ok?"ok":""}"><span class="mk" aria-hidden="true">${ok?"✓":""}</span><div><b>${e_(T.t)}</b>${ok?'<span class="vh"> (já aparece)</span>':""}<p>${e_(T.d)}</p>${curto?"":`<p class="ex">${e_(T.ex)}</p>`}</div></li>`}).join("");
  return{li,n};
}
function guiaHTML(w){
  const {li,n}=temasHTML(w);
  return `<div class="soc-guia" id="soc-guia-${w}"><div class="soc-guia-h"><b>O que contar aqui</b><span class="soc-small" id="soc-guia-n-${w}">${n} de ${TEMAS.length} já aparecem</span></div>
    <ol class="soc-temas" id="soc-temas-${w}">${li}</ol>
    <p class="soc-small">Não precisa seguir a ordem nem responder tudo. Fica verde o que já aparece no que foi escrito ou anexado (a tela procura palavras; não entende o texto).</p></div>`;
}
function pintarGuia(w){const ol=$id("soc-temas-"+w);if(!ol)return;const {li,n}=temasHTML(w);ol.innerHTML=li;const c=$id("soc-guia-n-"+w);if(c)c.textContent=`${n} de ${TEMAS.length} já aparecem`;if(w==="aba")pintarTrilho()}

/* ======================= MODAL "NOVO AMBIENTE" ======================= */
function estadoNovo(){const g=guardadoNovo;guardadoNovo=null;return g||{nome:"",texto:"",pend:[]}}
function guardarNovo(){if(novoAmb&&(novoAmb.nome.trim()||novoAmb.texto.trim()||novoAmb.pend.length))guardadoNovo=novoAmb}
function drawNovo(){
  const N=novoAmb,L=$id("layer"),primeira=!L.querySelector(".soc-modal");
  L.innerHTML=`<div class="shade" data-mclose></div><div class="modal soc-modal" role="dialog" aria-modal="true" aria-label="Novo ambiente" style="width:min(760px,calc(100% - 32px))">
   <h3>Novo ambiente</h3><p class="sub" style="margin:0">Cada empresa ganha uma fábrica própria, sem misturar com as outras. Conte tudo o que você sabe dela num campo só: escreva, anexe, cole prints, mande link ou áudio. Criar não gasta nada: a marca nasce em rascunho e em modo ensaio. O estudo só roda depois, quando você pedir e confirmar o custo.</p>
   <label class="gl">Nome da empresa<input id="na-nome" value="${e_(N.nome)}" maxlength="80" autocomplete="off" placeholder="ex.: Cafeteria do Bairro"></label>
   <div class="gl soc-gl"><span>Tudo sobre a empresa</span>${caixaHTML("novo",N.texto,false)}</div>
   ${guiaHTML("novo")}
   <p class="soc-small" id="soc-novo-msg" role="status"></p>
   <div class="prow" style="justify-content:flex-end"><button class="btn" data-mclose>Cancelar</button><button class="btn primary" data-soc="criar">Criar ambiente (não gasta nada)</button></div></div>`;
  if(primeira)$id("na-nome").focus();
}
async function criar(btn){
  const N=novoAmb;if(!N)return;const msg=$id("soc-novo-msg");
  const nome=N.nome.trim(),texto=N.texto.trim();
  if(nome.length<2){msg.textContent="Escreva o nome da empresa.";$id("na-nome").focus();return}
  if(gravador){msg.textContent="Pare a gravação antes de criar.";return}
  if(DEMO){N.pend.forEach(p=>p.prev&&URL.revokeObjectURL(p.prev));novoAmb=null;const k=Object.keys(ACC).find(x=>x!=="a1");if(k)acc=k;aberto=null;render();
    toast(NADA_SALVO+` A marca “${nome}” não foi criada; abri a Marca Exemplo.`);return}
  btn.disabled=true;btn.textContent="Criando…";msg.textContent="Criando a marca (rascunho, ensaio)…";
  const handle=(texto.match(/(^|[\s(])(@[a-z0-9_.]{2,30})/i)||[])[2]||"";
  const site=(texto.match(/https?:\/\/[^\s,;)]+/gi)||[]).find(u=>!/instagram\.com|tiktok\.com|youtu|facebook\.com|wa\.me/i.test(u))||"";
  const r=await chamar("criar",{nome,handle,site});
  if(!r.ok||!r.ambiente){btn.disabled=false;btn.textContent="Criar ambiente (não gasta nada)";msg.textContent="Não criou: "+(r.erro||"erro sem texto");return}
  const id=r.ambiente.id,agora=new Date();
  const {ids,erros}=await subirPendentes(id,N.pend,agora,t=>{msg.textContent=t});
  const s=est(id);
  if(texto||ids.length){msg.textContent="Guardando o texto…";const r2=await salvarMensagem(id,texto,ids,agora);if(!r2.ok){erros.push("o texto não foi guardado ("+(r2.erro||"erro sem texto")+"); ele ficou na caixa da aba para enviar de novo");s.draft=texto}}
  N.pend.forEach(p=>p.prev&&URL.revokeObjectURL(p.prev));
  novoAmb=null;guardadoNovo=null;
  await carregarAmbientes();acc="a"+id;aberto=null;tab="posts";render();
  toast(erros.length?`${nome} foi criada, mas: ${erros.join(" · ")}`:`${nome} criada em rascunho e ensaio. Nada foi gasto.`);
}

/* ======================= ABA DA MARCA (v4) ======================= */
function montarDe(s,rows){
  s.msgs=[];s.lidos={};
  rows.forEach(r=>{
    if(r.bloco==="entrada_livre"){const v=r.valor&&typeof r.valor==="object"?r.valor:{texto:String(r.valor??"")};
      s.msgs.push({campo:r.campo,texto:String(v.texto||""),anexos:Array.isArray(v.anexos)?v.anexos:[],enviado_em:v.enviado_em||r.atualizado_em||null});return}
    (s.lidos[r.bloco]||(s.lidos[r.bloco]={}))[r.campo]={valor:r.valor??null,origem:r.origem,fonte:r.fonte,certeza:r.certeza};
  });
  s.msgs.sort((a,b)=>String(a.enviado_em||a.campo).localeCompare(String(b.enviado_em||b.campo)));
}
const lidosDaFicha=f=>{const L={};Object.entries((f&&f.socios)||{}).forEach(([b,B])=>{L[b]={};Object.entries(B.campos||{}).forEach(([c,C])=>{L[b][c]=C})});return L};
function melhoriasDe(ficha,res){
  const out=[];
  ((res&&res.melhorias)||[]).forEach(m=>{const e=m.antes??m.socios_disseram??m.escreveram,p=m.depois??m.proposta??m.propomos;if(e!=null&&p!=null)out.push({escreveram:typeof e==="string"?e:JSON.stringify(e),propomos:typeof p==="string"?p:JSON.stringify(p),porque:m.porque||m.por_que||""})});
  ((ficha&&ficha.conflitos)||[]).forEach(c=>out.push({escreveram:c.socios_disseram||"",propomos:c.pesquisa_indica||"",porque:c.porque||""}));
  return out;
}
async function carregarVariaveis(id){
  const s=est(id);
  const r=await chamar("variaveis",{ambiente_id:id});
  if(r.ok&&Array.isArray(r.variaveis)){montarDe(s,r.variaveis);s.anexos=r.anexos||[];return}
  const [v,a]=await Promise.all([
    sb.from("marca_variaveis").select("bloco,campo,valor,origem,fonte,certeza,atualizado_em").eq("ambiente_id",id),
    sb.from("marca_anexos").select("id,caminho,nome,tipo,papel,descricao,tamanho_bytes,criado_em").eq("ambiente_id",id)]);
  if(v.error||a.error)throw new Error((v.error||a.error).message);
  montarDe(s,v.data||[]);s.anexos=a.data||[];
}
async function carregarFicha(id){
  const s=est(id);
  const r=await chamar("ficha",{ambiente_id:id,versao:null});
  if(!r.ok||!r.ficha){s.ficha=null;return}
  s.ficha={versao:r.versao,status:r.status,ficha:r.ficha};s.lidos=lidosDaFicha(r.ficha);
  let res=null;try{const {data}=await sb.from("estudo_progresso").select("resultado").eq("ambiente_id",id).eq("grupo","melhorador").maybeSingle();res=data?.resultado||null}catch(_){}
  s.melhorias=melhoriasDe(r.ficha,res);
}
/* mensagens de exemplo da Marca Exemplo (fictícia; nada vem do servidor) */
function mensagensDemo(){
  const d=(dia,h,m)=>new Date(2026,10,dia,h,m).toISOString();
  const extras=[{id:91,nome:"https://exemplo.invalid/reels-favorito",caminho:"https://exemplo.invalid/reels-favorito",tipo:"link",papel:"inspiracao"},
               {id:92,nome:"audio-reuniao-12-11.webm",caminho:null,tipo:"audio/webm",papel:"oficial",tamanho_bytes:3400000,descricao:"Áudio da reunião"}];
  return{anexos:[...(DEMO_FICHA.anexos||[]).map(a=>({...a,caminho:null,tamanho_bytes:a.tipo==="application/pdf"?2300000:640000})),...extras],
    msgs:[
      {campo:"m_1",enviado_em:d(12,10,2),anexos:[1,92],texto:"Somos a Marca Exemplo, uma cafeteria de bairro que torra o próprio café. Abrimos há 3 anos, dois amigos que largaram o escritório. Ganhamos dinheiro no balcão (uns R$ 15 por visita) e com a assinatura de café em grão, R$ 69 por mês, vendida pelo link da bio. Segue o manual da marca e o áudio da reunião."},
      {campo:"m_2",enviado_em:d(12,10,24),anexos:[3],texto:"Como funciona: o cliente vê o post do café da semana, abre o link ou passa na loja, prova e assina. Recebe em casa todo mês. Meta: 300 assinantes até 15/02. Natal é forte. Tom acolhedor, humor leve, nunca sarcástico."},
      {campo:"m_3",enviado_em:d(13,9,15),anexos:[2,91],texto:"Tipos de post que queremos: café da semana em carrossel (30%), meme do balcão (25%), notícia útil do bairro (15%), enquete de sábado (10%). Prints dos posts que amamos estão no anexo; o reels do link é o nosso favorito."},
      {campo:"m_4",enviado_em:d(13,18,40),anexos:[],texto:"Limites: nunca preço na capa, não pode zoar cliente. Quem aprova é a sócia Ana, em até 24 h. A IA não pode alterar o produto nas fotos."}
    ]};
}
function linhasDemo(estado){return[...GRUPOS.map(([g])=>({grupo:g,estado,gasto_usd:0,ensaio:true,resumo:estado==="feito"?(DEMO_FICHA?.grupos?.[g]?.resumo||""):""})),...PAPEIS.map(([p,,r])=>({grupo:p,estado,gasto_usd:0,ensaio:true,resumo:estado==="feito"?r:""}))]}
function passoDemo(A){
  const s=est(A.id);if(!s.linhas.length)return;s.demoPasso++;const k=s.demoPasso;
  const ordem=["leitor_anexos","melhorador",...GRUPOS.map(x=>x[0]),"critico","estrategista","editor","cetico"];
  ordem.forEach((g,i)=>{const l=s.linhas.find(x=>x.grupo===g);if(!l)return;const ini=Math.floor(i/3),fim=ini+2+(g==="G5"?2:0);
    if(k<=ini)l.estado="esperando";else if(g==="G5"&&k===ini+2)l.estado="devolvido";else if(k<fim)l.estado="rodando";
    else{l.estado="feito";l.resumo=DEMO_FICHA?.grupos?.[g]?.resumo||(PAPEIS.find(p=>p[0]===g)?.[2]||"")}
    if(l.estado==="devolvido")l.resumo="o crítico pediu outra fonte para os pares de voz";});
  if(s.linhas.every(l=>l.estado==="feito")){A.status="em_aprovacao";DEMO_EST.v="em_aprovacao";
    s.ficha={versao:DEMO_FICHA.versao||1,status:DEMO_FICHA.status||"rascunho",ficha:DEMO_FICHA};s.lidos=lidosDaFicha(DEMO_FICHA);s.melhorias=melhoriasDe(DEMO_FICHA,null)}
}
async function carregar(A){
  const s=est(A.id);s.carregando=true;s.erro="";
  try{
    if(DEMO){
      if(!DEMO_FICHA)DEMO_FICHA=await (await fetch("exemplos/ficha_demo.json")).json();
      const x=mensagensDemo();s.msgs=x.msgs;s.anexos=x.anexos;s.lidos={};
      if(A.status==="em_aprovacao"||A.status==="ativa"){s.linhas=linhasDemo("feito");s.ficha={versao:DEMO_FICHA.versao||1,status:DEMO_EST.v==="aprovada"?"aprovada":(DEMO_FICHA.status||"rascunho"),ficha:DEMO_FICHA};s.lidos=lidosDaFicha(DEMO_FICHA);s.melhorias=melhoriasDe(DEMO_FICHA,null)}
      else if(A.status==="estudando_v4"){s.linhas=linhasDemo("esperando");s.demoPasso=0}
      else s.linhas=[];
    }else{
      try{await carregarVariaveis(A.id)}catch(e){s.erro="Não li o que já foi enviado: "+e.message;montarDe(s,[])}
      if(["em_aprovacao","ativa"].includes(A.status))await carregarFicha(A.id);
      await lerProgresso(A,true);
    }
  }catch(e){s.erro=DEMO?"Não li exemplos/ficha_demo.json (abra pelo servidor local).":"Erro ao carregar: "+e.message}
  s.carregado=true;s.carregando=false;s.ultima=new Date();s.proxima=Date.now()+leituraMs();
}
async function lerProgresso(A,silencioso){
  const s=est(A.id);const antes=A.status;
  if(DEMO){if(A.status==="estudando_v4")passoDemo(A)}
  else{
    const r=await chamar("progresso",{ambiente_id:A.id});
    if(r.ok&&Array.isArray(r.linhas)){s.linhas=r.linhas;if(r.status)A.status=r.status}
    else{const {data,error}=await sb.from("estudo_progresso").select("grupo,estado,gasto_usd,ensaio,resumo,atualizado_em").eq("ambiente_id",A.id);if(!error)s.linhas=data||[]}
    if(!s.ficha&&!s.lendoFicha&&["em_aprovacao","ativa"].includes(A.status)){s.lendoFicha=true;try{await carregarFicha(A.id)}finally{s.lendoFicha=false}}
  }
  s.ultima=new Date();s.proxima=Date.now()+leituraMs();
  if(silencioso)return;
  if(A.status!==antes){render();return}   // mudou de etapa: redesenha a aba inteira (o rascunho da caixa fica guardado)
  pintarDinamico(A);
}
function ligarLeitura(A){
  if(timerId===A.id&&timer)return;
  pararLeitura();timerId=A.id;
  timer=setInterval(()=>{const B=ambAtual();if(B.id!==A.id||!V4_ESPERA.includes(B.status)||!$id("soc-aba")){pararLeitura();return}if(!document.hidden)lerProgresso(B)},leituraMs());
  tick=setInterval(pintarLeitura,1000);
}
function pararLeitura(){clearInterval(timer);clearInterval(tick);timer=null;tick=null;timerId=null}

/* ---------- pedaços da aba ---------- */
function cartaoAnexo(a){
  const img=/^image\//.test(a.tipo||"");const ic=img&&DEMO?`<img src="${MINI_DEMO}" alt="">`:e_(ext(a));const lk=linkDe(a);
  const abrir=a.tipo==="link"?(lk?`<a class="soc-lnk" href="${e_(lk)}" target="_blank" rel="noopener">abrir</a>`:""):a.caminho?`<button type="button" class="soc-lnk" data-soc="abrir" data-soc-id="${e_(a.id)}">abrir</button>`:`<span>exemplo</span>`;
  return `<div class="soc-ax"><span class="ic" data-soc-ic="${e_(a.id)}">${ic}</span>
    <div class="info"><div class="nm" title="${e_(a.nome)}">${e_(a.tipo==="link"?(a.nome||lk).replace(/^https?:\/\//,""):a.nome)}</div>
      <div class="ds">${e_(tipoT(a))}${a.tamanho_bytes?" · "+tam(a.tamanho_bytes):""} · ${abrir}</div></div>
    ${seletorPapel(`data-soc-papel-anexo="${e_(a.id)}"`,a.papel||"rascunho",false)}</div>`;
}
function historicoHTML(s){
  const ref=new Set();s.msgs.forEach(m=>(m.anexos||[]).forEach(id=>ref.add(String(id))));
  const soltos=s.anexos.filter(a=>!ref.has(String(a.id)));
  let h="";
  if(!s.carregado)return `<p class="soc-small">Carregando o que já foi enviado…</p>`;
  if(!s.msgs.length&&!soltos.length)h=`<div class="soc-vazia"><b>Ainda não chegou nada.</b><br>Comecem por onde for mais fácil: colem o texto que a empresa mandou, anexem o manual, gravem um áudio contando a história. O guia mostra o que ajuda.</div>`;
  else h=`<p class="soc-sep">${s.msgs.length} mensage${s.msgs.length===1?"m":"ns"} · ${s.anexos.length} anexo${s.anexos.length===1?"":"s"}</p>`;
  if(soltos.length)h+=`<article class="soc-msg"><header><b>Arquivos enviados antes desta conversa</b></header><div class="soc-pend">${soltos.map(cartaoAnexo).join("")}</div></article>`;
  h+=s.msgs.map(m=>{const d=new Date(m.enviado_em);const ax=(m.anexos||[]).map(id=>s.anexos.find(a=>String(a.id)===String(id))).filter(Boolean);
    return `<article class="soc-msg"><header><b>Sócios</b><span>${isNaN(d)?"":e_(quandoS(d))}</span></header>
      ${m.texto?`<p class="tx">${e_(m.texto)}</p>`:""}${ax.length?`<div class="soc-pend">${ax.map(cartaoAnexo).join("")}</div>`:""}</article>`}).join("");
  return h;
}
function trechoDoTema(s,T){
  for(const m of s.msgs){const fr=(m.texto||"").split(/(?<=[.!?;\n])\s+/);const f=fr.find(x=>T.p.test(semAcento(x)));if(f){const t=f.trim();return{t:t.length>160?t.slice(0,157)+"…":t,d:new Date(m.enviado_em)}}}
  const a=s.anexos.find(a=>T.p.test(semAcento(`${a.nome} ${a.descricao||""}`)));if(a)return{t:"Anexo: "+a.nome,d:null};
  return null;
}
function valorT(v){
  if(v===true)return"Sim";if(v===false)return"Não";
  if(Array.isArray(v))return `<ul>${v.map(x=>`<li>${x&&typeof x==="object"?e_(objT(x)):e_(x)}</li>`).join("")}</ul>`;
  if(v&&typeof v==="object")return e_(objT(v));
  return e_(v);
}
function objT(o){
  if(o.nome&&o.formato)return `${o.nome} · ${FORMATO_T[o.formato]||o.formato}${o.percentual!=null?` · ${o.percentual}%`:""}${o.frequencia?` · ${o.frequencia}`:""}`;
  if(o.data&&o.o_que)return `${String(o.data).split("-").reverse().join("/")}: ${o.o_que}`;
  if(o.perfil)return `${o.perfil}${o.pegar?` · pegar: ${o.pegar}`:""}${o.nao_pegar?` · não pegar: ${o.nao_pegar}`:""}`;
  if("amou" in o)return `Post ${o.post??"?"}: ${o.amou?"amou":"odiou"}${o.porque?` (${o.porque})`:""}`;
  return Object.entries(o).filter(([,x])=>!vazio(x)).map(([k,x])=>`${FORMATO_T[k]||k}: ${typeof x==="object"?JSON.stringify(x):x}${typeof x==="number"&&FORMATO_T[k]?"%":""}`).join(" · ");
}
function seloLido(m){
  if(m.origem==="anexo")return`<span class="st st-sched">Anexo</span>`;
  if(m.origem==="socio"||m.origem==="cliente")return`<span class="st st-ok">Vocês</span>`;
  return`<span class="st st-wait">Proposta do agente</span>`;
}
function varsHTML(s){
  const organizado=!!s.ficha&&BLOCOS.some(B=>Object.keys(B.campos).some(c=>s.lidos[B.id]?.[c]&&!vazio(s.lidos[B.id][c].valor)));
  const sub=organizado?"Organizado pelos agentes a partir do que vocês mandaram. Só leitura: para mudar, mande uma mensagem nova no campo acima."
    :"O que vocês mandaram, separado por tema (procura simples por palavras, sem IA). Quando o estudo rodar, os agentes organizam de verdade e propõem melhorias.";
  if(!organizado)return `<p class="sub">${sub}</p><div class="soc-temas-det">${TEMAS.filter(T=>TEMA_BLOCO[T.id]).map(T=>{const x=trechoDoTema(s,T);
    return `<div class="soc-tdet${x?" ok":""}"><b>${x?"✓ ":""}${e_(T.t)}</b>${x?`<p>“${e_(x.t)}”${x.d&&!isNaN(x.d)?` · ${e_(quandoS(x.d))}`:""}</p>`:`<p>Ainda não apareceu. Os agentes pesquisam se ninguém contar.</p>`}</div>`}).join("")}</div>`;
  const melh=s.melhorias.length?`<div class="soc-melhs"><b>O que os agentes melhoraram</b>${s.melhorias.map(m=>`<div class="soc-melh"><div><small>Vocês escreveram</small><p>${e_(m.escreveram)}</p></div><span aria-hidden="true">→</span><div><small>Propomos</small><p>${e_(m.propomos)}</p></div>${m.porque?`<div class="pq"><small>Por quê</small><p>${e_(m.porque)}</p></div>`:""}</div>`).join("")}</div>`:"";
  return `<p class="sub">${sub}</p>${melh}<div class="soc-blocos">${BLOCOS.map((B,i)=>{const cs=Object.entries(B.campos);const ok=cs.filter(([c])=>s.lidos[B.id]?.[c]&&!vazio(s.lidos[B.id][c].valor));
    return `<details class="soc-bloco"${i===0?" open":""}><summary><b>${i+1} · ${e_(B.titulo)}</b><span class="soc-small">${ok.length} de ${cs.length}</span></summary>
      <dl>${cs.map(([c,r])=>{const m=s.lidos[B.id]?.[c];const v=m&&!vazio(m.valor);return `<div class="${v?"":"falta"}"><dt>${e_(r)} ${v?seloLido(m):'<span class="st st-draft">Falta</span>'}</dt>${v?`<dd>${valorT(m.valor)}</dd>`:""}</div>`}).join("")}</dl></details>`}).join("")}</div>`;
}
function trilhoHTML(A){
  const s=est(A.id);const temas=TEMAS.filter(T=>TEMA_BLOCO[T.id]);const t=textoDe("aba");const n=temas.filter(T=>T.p.test(t)).length;
  const pedidas=s.linhas.filter(l=>/^G\d+$/.test(l.grupo));const feitos=pedidas.filter(l=>l.estado==="feito").length;const rodando=s.linhas.some(l=>l.estado==="rodando");
  const tem=s.msgs.length||s.anexos.length;
  const e1=tem?(s.ficha?"organizado pelos agentes":`${s.msgs.length} mensage${s.msgs.length===1?"m":"ns"} · ${n} de ${temas.length} temas`):"esperando vocês contarem";
  const e2=!pedidas.length?"estudo ainda não rodou":feitos===pedidas.length?`${feitos} de ${pedidas.length} grupos feitos`:`${feitos} de ${pedidas.length} feitos${rodando?" · rodando":""}`;
  const e3=s.ficha?`v${s.ficha.versao??"?"} · ${STATUS_FICHA[s.ficha.status]||s.ficha.status||""}`:"aparece no fim do estudo";
  const c1=s.ficha?"feita":tem?"andando":"",c2=pedidas.length&&feitos===pedidas.length?"feita":pedidas.length?"andando":"",c3=s.ficha?"feita":"";
  return [["Variáveis de vocês",e1,c1,"soc-e1"],["Variáveis dos agentes",e2,c2,"soc-e2"],["Identidade sintética",e3,c3,"soc-e3"]]
    .map(([t,st,c,alvo],i)=>`<li class="${c}"><span class="n">${i+1}</span><b>${t}</b><small>${e_(st)}</small><a class="soc-ir" href="#${alvo}" data-soc-ir="${alvo}" aria-label="Ir para ${t}"></a></li>`).join("");
}
function pintarTrilho(){const A=ambAtual();const el=$id("soc-trilho");if(el&&A.id===ID)el.innerHTML=trilhoHTML(A)}
function estudoHTML(A){
  const s=est(A.id);const por={};s.linhas.forEach(l=>por[l.grupo]=l);
  const pedidas=s.linhas.length,feitos=s.linhas.filter(l=>l.estado==="feito").length,gasto=s.linhas.reduce((a,l)=>a+(Number(l.gasto_usd)||0),0);
  const ensaio=A.ensaio!==false||DEMO;const rodando=A.status==="estudando_v4"&&s.linhas.some(l=>l.estado==="rodando"||l.estado==="esperando");
  const est_=s.estimativa||estimativaLocal();
  const docHref=DEMO?"documento.html?demo=1":`documento.html?amb=${A.id}`;
  const linha=(id,nome,sub,papel)=>{const l=por[id];const st=l&&ESTADO_T[l.estado]||null;
    return `<div class="soc-g"><span class="id">${papel?"·":e_(id)}</span><div class="t"><b>${e_(nome)}</b><span>${e_(l?.resumo||sub||(l?"":"ainda não pedido"))}</span></div>
      ${st?`<span class="st ${st[1]}">${st[0]}</span>`:`<span class="st st-draft" style="opacity:.5">—</span>`}
      <span class="u">${l?usdS(l.gasto_usd):""}${l&&l.ensaio?"<small>ensaio</small>":""}${l&&l.estado==="feito"&&!papel?`<small><a href="${docHref}#${id}">ler</a></small>`:""}</span></div>`};
  const papeis=PAPEIS.filter(([p])=>por[p]);
  return `<div class="soc-est-topo"><div class="soc-num"><div><small>Prontos</small><b>${pedidas?`${feitos} de ${pedidas}`:"–"}</b></div><div><small>Gasto até agora</small><b>${usdS(gasto)}</b></div><div><small>Modo</small><b>${ensaio?"Ensaio":"Real"}</b></div></div>
      <button class="btn primary" data-soc="rodar"${rodando?" disabled":""}>${rodando?"Estudo em andamento":ensaio?"Rodar estudo (ensaio, US$ 0)":`Rodar estudo (~${usdS(est_.real_usd)} real)`}</button></div>
    <div class="soc-barra"><i style="width:${pedidas?Math.round(100*feitos/pedidas):0}%"></i></div>
    <p class="soc-small" id="soc-leitura">${leituraTxt(A)}</p>
    <p class="soc-sep">Os 18 grupos</p>${GRUPOS.map(([g,t])=>linha(g,t,"")).join("")}
    ${papeis.length?`<p class="soc-sep">Quem confere e junta</p>${papeis.map(([p,n,sb_])=>linha(p,n,sb_,true)).join("")}`:""}`;
}
function leituraTxt(A){const s=est(A.id);if(!s.ultima)return"";const seg=Math.max(0,Math.ceil((s.proxima-Date.now())/1000));
  return `<span class="soc-ponto"></span>Lido às ${horaS(s.ultima)} · próxima leitura em ${seg} s${DEMO?" (demonstração: a cada 2,5 s; no real, a cada 10 s)":""}`}
function pintarLeitura(){const A=ambAtual();const el=$id("soc-leitura");if(el&&A.id===ID)el.innerHTML=leituraTxt(A)}
function identHTML(A){
  const s=est(A.id),ap=APROV[A.id]||null,st=ap&&ap.status;
  const docHref=DEMO?"documento.html?demo=1":`documento.html?amb=${A.id}`;
  if(!s.ficha)return `<p class="sub" style="margin:0">Ainda não existe. Aparece quando o estudo juntar as variáveis de vocês com as dos agentes.</p>`;
  const f=s.ficha.ficha||{},g=f.grupos||{},nG=Object.values(g).filter(x=>x&&x.estado==="feito").length;
  const sit=!ap?`<p class="soc-small">O link do cliente ainda não foi criado. Clique em "Copiar link do cliente" e mande para ele.</p>`
    :st==="aprovado"?`<p class="okbox" style="margin:0">Aprovado por <b>${e_(ap.aprovado_por||"cliente")}</b>${ap.aprovado_em?` em ${e_(fdt(new Date(ap.aprovado_em)))}`:""}${ap.versao?` (versão ${e_(ap.versao)})`:""}.</p>`
    :st==="mudanca"?`<p class="warn" style="margin:0">O cliente pediu mudança${ap.pedido_mudanca?`: "${e_(ap.pedido_mudanca)}"`:""}. Corrija no documento e crie um link novo.</p>`
    :`<p class="soc-small">Link enviado. O cliente ainda não respondeu.</p>`;
  const pode=A.status==="em_aprovacao"&&st==="aprovado";
  return `<div class="soc-num"><div><small>Versão</small><b>v${e_(s.ficha.versao??"?")}</b></div><div><small>Status</small><b>${e_(STATUS_FICHA[s.ficha.status]||s.ficha.status||"?")}</b></div><div><small>Junta</small><b>9 temas + ${nG||Object.keys(g).length} grupos</b></div></div>
    ${(f.faltando||[]).length?`<p class="soc-small">${f.faltando.length} pergunta${f.faltando.length>1?"s":""} ainda em aberto para o cliente responder no documento.</p>`:""}
    <div class="prow"><a class="btn primary" href="${docHref}">Abrir documento visual</a><button class="btn" data-soc="link-cliente">Copiar link do cliente</button></div>
    ${sit}
    ${pode?`<p class="soc-small">Ativar liga a ficha aprovada na fábrica (descrição, voz, tipos de post, personas, ganchos). Não gasta nada, não liga o vigia e não desliga o modo ensaio.</p><div class="prow"><button class="btn primary" data-ativar="${A.id}">Ativar ${e_(A.nome)}</button></div>`
      :`<p class="soc-small">O botão "Ativar" aparece aqui quando o cliente clicar em "Aprovo a v1".</p>`}`;
}
function pintarDinamico(A){
  if(A.id!==ID||!$id("soc-aba"))return;const s=est(A.id);
  const put=(id,h)=>{const el=$id(id);if(el)el.innerHTML=h};
  put("soc-estudo",estudoHTML(A));put("soc-trilho",trilhoHTML(A));put("soc-vars",varsHTML(s));put("soc-ident",identHTML(A));
}
function pintarConversa(A){const s=est(A.id);const h=$id("soc-hist");if(h)h.innerHTML=historicoHTML(s);pintarGuia("aba");if(!DEMO)miniaturas(A.id)}
async function miniaturas(id){
  const s=est(id);const imgs=s.anexos.filter(a=>a.caminho&&!/^https?:/.test(a.caminho)&&/^image\//.test(a.tipo||""));if(!imgs.length)return;
  try{const {data}=await sb.storage.from("anexos").createSignedUrls(imgs.map(a=>a.caminho),3600);
    (data||[]).forEach((d,i)=>{if(!d||!d.signedUrl)return;document.querySelectorAll(`[data-soc-ic="${imgs[i].id}"]`).forEach(el=>{el.innerHTML=`<img src="${e_(d.signedUrl)}" alt="" loading="lazy">`})})}catch(_){}
}

/* a aba inteira (chamada por renderV4 do index) */
function aba(A){
  ID=A.id;const s=est(A.id);
  const ordem=["rascunho","estudando_v4","em_aprovacao","ativa"],i=ordem.indexOf(A.status);
  const passos=`<ol class="v4passos">${[["rascunho","1 · Sócios contam"],["estudando_v4","2 · Estudo"],["em_aprovacao","3 · Cliente aprova"],["ativa","4 · Fábrica ligada"]].map(([,l],k)=>`<li class="${k<i?"feito":k===i?"agora":""}">${l}</li>`).join("")}</ol>`;
  const ens=A.ensaio||DEMO?`<p class="faixa-ensaio" style="margin:0">Modo ensaio ligado nesta marca: nenhum botão gera nada de verdade nem gasta. Só o dono desliga.</p>`:"";
  const CH={rascunho:["Rascunho","st-draft"],estudando_v4:["Estudando","st-wait"],em_aprovacao:["Com o cliente","st-sched"]}[A.status]||[A.status,"st-draft"];
  return `<div class="v4card soc-aba" id="soc-aba">${passos}${ens}
    <div class="soc-cab"><h2>${e_(A.nome)}</h2><span class="st ${CH[1]}">${e_(CH[0])}</span>${A.handle?`<span class="soc-small">${e_(A.handle)}</span>`:""}</div>
    ${s.erro?`<p class="warn" style="margin:0">${e_(s.erro)}</p>`:""}
    <section class="soc-sec" id="soc-conversa"><h3>1 · Tudo o que vocês contaram</h3>
      <p class="sub">Um campo só. Escrevam do jeito que falariam numa reunião, anexem o que tiverem e enviem. Pode mandar quantas vezes quiser, ao longo de dias: tudo fica guardado aqui, em ordem. Os agentes leem e organizam depois.</p>
      <div class="soc-papo-grid"><div class="soc-papo"><div class="soc-hist" id="soc-hist" aria-live="polite">${historicoHTML(s)}</div>${caixaHTML("aba",s.draft,s.enviando)}</div>${guiaHTML("aba")}</div>
    </section>
    <section class="soc-sec" id="soc-caminho"><h3>2 · Das variáveis ao documento</h3>
      <p class="soc-formula"><b>Variáveis de vocês</b> <span>+</span> <b>variáveis dos agentes</b> <span>=</span> <b>identidade sintética</b> <span>→</span> <b>documento visual</b></p>
      <ol class="soc-trilho" id="soc-trilho" aria-label="As 3 etapas">${trilhoHTML(A)}</ol>
      <div class="soc-etapa" id="soc-e1"><h4>1 · Variáveis de vocês</h4><div id="soc-vars">${varsHTML(s)}</div></div>
      <div class="soc-etapa" id="soc-e2"><h4>2 · Variáveis dos agentes</h4><p class="sub">Os 18 grupos de pesquisa. O robô lê tudo o que foi contado e anexado, cada grupo pesquisa uma parte, o crítico confere e o estrategista junta. A lista é lida do banco a cada 10 segundos.</p><div id="soc-estudo">${estudoHTML(A)}</div></div>
      <div class="soc-etapa" id="soc-e3"><h4>3 · Identidade sintética</h4><p class="sub">A junção das variáveis de vocês com as dos agentes, numa ficha só. É ela que vira o documento visual que o cliente aprova.</p><div id="soc-ident">${identHTML(A)}</div></div>
    </section></div>`;
}
/* depois que a aba entrou na tela: carrega (1 vez), liga a leitura de 10 s, miniaturas */
function depois(A){
  ID=A.id;const s=est(A.id);
  if(!s.carregado&&!s.carregando)carregar(A).then(()=>{const B=ambAtual();if(B.id!==A.id||!$id("soc-aba"))return;
    if(B.status!==A.status)return render();
    const er=$id("soc-aba");if(s.erro&&er&&!er.querySelector(".warn"))render();else{pintarConversa(A);pintarDinamico(A)}});
  else if(s.carregado&&!DEMO)miniaturas(A.id);
  ligarLeitura(A);
}

/* ---------- enviar mais pela aba ---------- */
async function enviar(){
  const A=ambAtual();if(A.id!==ID)return;const s=est(A.id);if(s.enviando)return;
  const ta=$id("soc-ta-aba"),msg=$id("soc-msg-aba");const texto=(ta.value||"").trim();
  if(!texto&&!s.pend.length){toast("Escreva algo ou anexe um arquivo.");ta.focus();return}
  if(gravador){toast("Pare a gravação antes de enviar.");return}
  if(DEMO){toast(NADA_SALVO);msg.textContent=NADA_SALVO+" (a mensagem não entrou no histórico)";return}
  s.enviando=true;document.querySelector('[data-soc="enviar"]').disabled=true;
  const agora=new Date();const {ids,erros}=await subirPendentes(A.id,s.pend,agora,t=>{msg.textContent=t});
  if(!texto&&!ids.length){s.enviando=false;document.querySelector('[data-soc="enviar"]').disabled=false;msg.textContent="Nada foi enviado. "+erros.join(" · ");toast("Os anexos não foram.");return}
  msg.textContent="Guardando a mensagem…";
  const r=await salvarMensagem(A.id,texto,ids,agora);
  s.enviando=false;
  s.pend.forEach(p=>p.prev&&URL.revokeObjectURL(p.prev));s.pend=[];
  if(r.ok){s.draft="";ta.value=""}
  try{await carregarVariaveis(A.id)}catch(e){toast("Não li de volta: "+e.message)}   // lê de volta do banco: a prova de que gravou
  pintarPend("aba");pintarConversa(A);pintarTrilho();const bt=document.querySelector('[data-soc="enviar"]');if(bt)bt.disabled=false;
  if(!r.ok){msg.textContent=`O texto não foi guardado: ${r.erro||"erro sem texto"}.${ids.length?` Os ${ids.length} anexo(s) foram guardados.`:""} Seu texto continua na caixa.`;return}
  msg.textContent=`Mensagem guardada e lida de volta às ${horaS(new Date())}${ids.length?` · ${ids.length} anexo${ids.length>1?"s":""}`:""}.${erros.length?" Não foram: "+erros.join(" · "):""}`;
  toast(erros.length?"Mensagem guardada; alguns anexos não foram.":"Mensagem guardada.");
  const h=$id("soc-hist");if(h)h.scrollTop=h.scrollHeight;
}

/* ---------- rodar estudo: estimativa real antes do "sim" ---------- */
async function pedirEstimativa(A,grupos){
  if(DEMO)return{est:estimativaLocal(grupos),origem:"Estimativa de exemplo (demonstração)."};
  // sem confirmar:true o servidor só devolve a estimativa e não muda nada
  const r=await chamar("estudar",{ambiente_id:A.id,confirmar:false,grupos:grupos&&grupos.length?grupos:undefined});
  if(r.estimativa&&r.estimativa.real_usd!=null)return{est:r.estimativa,origem:`Estimativa do servidor (${(r.estimativa.grupos||r.grupos||[]).length||(grupos&&grupos.length)||18} grupos; nada foi pedido ainda).`,erro:r.ok||r.erro==="precisa confirmar"?null:r.erro};
  return{est:estimativaLocal(grupos),origem:"Estimativa da tela (pelas regras de preço): o servidor não devolveu a dele"+(r.erro?` (${r.erro})`:"")+".",erro:r.erro&&r.erro!=="precisa confirmar"?r.erro:null};
}
const gruposMarcados=()=>[...document.querySelectorAll("#soc-est-grupos input:checked")].map(x=>x.value);
async function abrirEstudo(A){
  const L=$id("layer2");
  L.innerHTML=`<div class="shade" data-soc="est-nao"></div><div class="modal" role="dialog" aria-modal="true" aria-label="Rodar o estudo" style="width:min(560px,calc(100% - 32px))">
    <h3>Rodar o estudo de ${e_(A.nome)}?</h3><div id="soc-est-corpo"><p class="sub" style="margin:0">Calculando o custo…</p></div>
    <details><summary style="cursor:pointer;font-weight:700;font-size:.88rem">Refazer só alguns grupos</summary><p class="soc-small" style="margin:6px 0">Sem marcar nada, roda tudo.</p>
      <div class="soc-grupos" id="soc-est-grupos">${GRUPOS.map(([g,t])=>`<label title="${e_(t)}"><input type="checkbox" value="${g}"> ${g}</label>`).join("")}</div></details>
    <p class="soc-small" id="soc-est-msg" role="status"></p>
    <div class="prow" style="justify-content:flex-end"><button class="btn" data-soc="est-nao">Cancelar</button><button class="btn primary" data-soc="est-sim" disabled>Calculando…</button></div></div>`;
  await atualizarCorpo(A);
}
async function atualizarCorpo(A){
  const g=gruposMarcados();const r=await pedirEstimativa(A,g);const s=est(A.id);s.estimativa=r.est;
  const corpo=$id("soc-est-corpo");if(!corpo)return;
  const ensaio=A.ensaio!==false||DEMO;const lista=g.length?g:GRUPOS.map(x=>x[0]);const G=GASTO;
  corpo.innerHTML=`<p style="margin:0 0 4px"><b>O que vai rodar:</b></p>
    <ul style="margin:0 0 8px;padding-left:20px;font-size:.9rem"><li>Leitor de tudo o que foi contado (${s.msgs.length} mensage${s.msgs.length===1?"m":"ns"}, ${s.anexos.length} anexo${s.anexos.length===1?"":"s"}) e Melhorador</li><li><b>${lista.length} grupo${lista.length>1?"s":""}</b> de pesquisa: ${lista.join(", ")}</li><li>Crítico em cada grupo, Estrategista junta, Editor e Cético final</li></ul>
    <table class="custo-tab"><tbody><tr><td>Custo real estimado</td><td><b>~${usdS(r.est.real_usd)}</b></td></tr><tr><td>No medidor da fábrica</td><td>${usdS(r.est.medidor_usd)}</td></tr></tbody></table>
    ${G?`<p class="sub" style="margin:8px 0 0">Hoje a fábrica já gastou ${usdS(G.usd)} de ${usdS(G.teto)} (teto do dia, no medidor).</p>`:""}
    ${ensaio?`<p class="okbox" style="margin:8px 0 0">Modo ensaio ligado: nada é chamado na IA. Custo: US$ 0 (teria custado ~${usdS(r.est.real_usd)}).</p>`
      :`<p class="warn" style="margin:8px 0 0">Gasta de verdade. O robô trabalha sozinho e a lista mostra cada grupo. A fábrica para sozinha ao bater o teto do dia.</p>`}
    <p class="soc-small" style="margin-top:6px">${e_(r.origem)}</p>`;
  const m=$id("soc-est-msg");if(m)m.textContent=r.erro?"Aviso do servidor: "+r.erro:"";
  const b=document.querySelector('[data-soc="est-sim"]');if(b){b.disabled=false;b.textContent=ensaio?"Sim, rodar em ensaio (US$ 0)":`Sim, gastar ~${usdS(r.est.real_usd)}`}
}
async function confirmarEstudo(A,b){
  const L=$id("layer2"),s=est(A.id);
  if(DEMO){L.innerHTML="";toast(NADA_SALVO+" A lista simula o estudo.");s.ficha=null;s.lidos={};s.melhorias=[];s.linhas=linhasDemo("esperando");s.demoPasso=0;A.status="estudando_v4";DEMO_EST.v="estudando_v4";render();return}
  b.disabled=true;$id("soc-est-msg").textContent="Pedindo…";
  const g=gruposMarcados();const r=await chamar("estudar",{ambiente_id:A.id,confirmar:true,grupos:g.length?g:undefined});
  if(!r.ok){$id("soc-est-msg").textContent="Não rodou: "+(r.erro||"erro sem texto");b.disabled=false;return}
  L.innerHTML="";A.status="estudando_v4";s.ficha=null;
  toast(`Estudo pedido (modo ${r.modo==="real"?"real":"ensaio"}). A lista atualiza a cada 10 s.`);
  await lerProgresso(A,true);render();
}

/* ---------- link do cliente ---------- */
async function copiar(url){
  try{await navigator.clipboard.writeText(url);return true}catch(_){}
  const L=$id("layer2");
  L.innerHTML=`<div class="shade" data-soc="fechar2"></div><div class="modal" role="dialog" aria-modal="true" aria-label="Link do cliente"><h3>Link do cliente</h3><p class="sub" style="margin:0">Não consegui copiar sozinho. Selecione e copie:</p><input id="soc-url-copia" readonly value="${e_(url)}"><div class="prow" style="justify-content:flex-end"><button class="btn primary" data-soc="fechar2">Fechar</button></div></div>`;
  const i=$id("soc-url-copia");i.focus();i.select();return false;
}
async function linkCliente(A,b){
  const s=est(A.id);
  if(DEMO){const url=new URL("documento.html?demo=1&cliente=demo",location.href).href;const ok=await copiar(url);toast("Modo demonstração: nenhum link novo foi criado."+(ok?" Copiei o link de exemplo.":""));return}
  const ap=APROV[A.id];
  if(ap&&ap.status==="aberto"&&!(await perguntar("Criar um link novo?","O link que o cliente já tem deixa de valer. O novo é copiado para você mandar a ele.","Criar e copiar")))return;
  if(ap&&ap.status==="aprovado"&&!(await perguntar("O cliente já aprovou","Um link novo pede outra aprovação e o botão Ativar some até ele responder.","Criar mesmo assim")))return;
  b.disabled=true;b.textContent="Criando o link…";
  const r=await chamar("gerar_link",{ambiente_id:A.id,versao:s.ficha?s.ficha.versao:null});
  b.disabled=false;b.textContent="Copiar link do cliente";
  if(!r.ok||!r.url){toast("Não criou o link: "+(r.erro||"erro sem texto"));return}
  const ok=await copiar(r.url);
  await carregarAprovacoes();A.status="em_aprovacao";render();
  toast(ok?"Link do cliente copiado. Mande para ele: abre sem login e mostra só esta marca.":"Link criado.");
}

/* ---------- eventos (delegados; só reagem aos elementos desta parte) ---------- */
document.addEventListener("click",async e=>{
  const ir=e.target.closest("[data-soc-ir]");if(ir){e.preventDefault();$id(ir.dataset.socIr)?.scrollIntoView({behavior:"smooth",block:"start"});return}
  const b=e.target.closest("[data-soc]");if(!b)return;
  const a=b.dataset.soc,w=b.dataset.socW;
  if(a==="anexar"){const i=seletorArquivo();i.dataset.w=w;i.click();return}
  if(a==="link"){const l=$id("soc-link-"+w);l.hidden=false;$id("soc-url-"+w).focus();return}
  if(a==="link-por"){porLink(w);return}
  if(a==="link-fechar"){$id("soc-link-"+w).hidden=true;$id("soc-url-"+w).value="";return}
  if(a==="gravar"){gravar(w);return}
  if(a==="tirar"){const L=pendDe(w);const p=L.splice(+b.dataset.socI,1)[0];if(p&&p.prev)URL.revokeObjectURL(p.prev);pintarPend(w);return}
  if(a==="criar"){criar(b);return}
  if(a==="enviar"){enviar();return}
  if(a==="rodar"){abrirEstudo(ambAtual());return}
  if(a==="est-nao"||a==="fechar2"){$id("layer2").innerHTML="";return}
  if(a==="est-sim"){confirmarEstudo(ambAtual(),b);return}
  if(a==="link-cliente"){linkCliente(ambAtual(),b);return}
  if(a==="abrir"){const s=est(ID);const x=s.anexos.find(y=>String(y.id)===b.dataset.socId);if(!x||DEMO)return;
    const {data,error}=await sb.storage.from("anexos").createSignedUrl(x.caminho,3600);if(error){toast("Não abriu: "+error.message);return}window.open(data.signedUrl,"_blank","noopener");return}
});
let guiaT=0;
document.addEventListener("input",e=>{
  const t=e.target;
  if(t.id==="na-nome"&&novoAmb){novoAmb.nome=t.value;clearTimeout(guiaT);guiaT=setTimeout(()=>pintarGuia("novo"),250);return}
  const w=t.dataset&&t.dataset.socTa;if(!w)return;
  if(w==="novo"){if(novoAmb)novoAmb.texto=t.value}else est(ID).draft=t.value;
  clearTimeout(guiaT);guiaT=setTimeout(()=>pintarGuia(w),250);
});
document.addEventListener("change",async e=>{
  const t=e.target;
  if(t.closest&&t.closest("#soc-est-grupos")){atualizarCorpo(ambAtual());return}
  if(t.dataset&&t.dataset.socPapelPend){const [w,i]=t.dataset.socPapelPend.split(":");const p=pendDe(w)[+i];if(p)p.papel=t.value;t.className="soc-papel p-"+t.value;return}
  if(t.dataset&&t.dataset.socPapelAnexo){
    const s=est(ID);const x=s.anexos.find(y=>String(y.id)===t.dataset.socPapelAnexo);if(!x)return;
    const antes=x.papel,papel=t.value;t.className="soc-papel p-"+papel;
    if(DEMO){x.papel=papel;toast(NADA_SALVO);return}
    t.disabled=true;
    let r=await chamar("papel_anexo",{ambiente_id:ID,anexo_id:x.id,papel});
    if(!r.ok&&/desconhecida|vazia/i.test(r.erro||"")){const {error}=await sb.from("marca_anexos").update({papel}).eq("id",x.id).eq("ambiente_id",ID);r=error?{ok:false,erro:error.message}:{ok:true}}
    t.disabled=false;
    if(!r.ok){t.value=antes;t.className="soc-papel p-"+antes;toast("Não mudou: "+(r.erro||"erro sem texto"));return}
    x.papel=papel;toast(`${x.nome}: agora é “${PAPEL_T[papel]}”.`);
  }
});
document.addEventListener("keydown",e=>{
  const w=e.target.dataset&&e.target.dataset.socTa;
  if(w==="aba"&&e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();enviar();return}
  const u=e.target.dataset&&e.target.dataset.socUrl;if(u&&e.key==="Enter"){e.preventDefault();porLink(u)}
});
document.addEventListener("paste",e=>{const c=e.target.closest&&e.target.closest("[data-soc-caixa]");if(!c)return;const fs=[...(e.clipboardData?.files||[])];if(!fs.length)return;e.preventDefault();porArquivos(c.dataset.socCaixa,fs)});
["dragenter","dragover"].forEach(ev=>document.addEventListener(ev,e=>{const c=e.target.closest&&e.target.closest("[data-soc-caixa]");if(!c)return;if([...(e.dataTransfer?.types||[])].includes("Files")){e.preventDefault();c.classList.add("sobre")}}));
["dragleave","drop"].forEach(ev=>document.addEventListener(ev,e=>{const c=e.target.closest&&e.target.closest("[data-soc-caixa]");if(!c)return;e.preventDefault();c.classList.remove("sobre");if(ev==="drop"&&e.dataTransfer?.files?.length)porArquivos(c.dataset.socCaixa,e.dataTransfer.files)}));
window.addEventListener("beforeunload",e=>{if(DEMO)return;const algo=(novoAmb&&(novoAmb.texto.trim()||novoAmb.pend.length))||Object.values(S).some(s=>s.draft.trim()||s.pend.length);if(algo){e.preventDefault();e.returnValue=""}});

window.SOC={aba,depois,drawNovo,criar,estadoNovo,guardarNovo,pararLeitura};
})();
