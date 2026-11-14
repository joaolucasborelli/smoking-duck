/* socios.js — a marca nova DENTRO da fábrica (index.html), como UMA CONVERSA com o pato (15/11).
   Usa as variáveis globais do index: sb, DEMO, DEMO_EST, ACC, AMBS, APROV, GASTO,
   acc, aberto, tab, novoAmb, render, carregarAmbientes, carregarAprovacoes, perguntar, fdt, ambAtual, V4_ESPERA, toast.
   - Botão "+" → "Novo ambiente": uma conversa. O pato 🦆 pergunta 1 coisa por vez (11 temas + "mais alguma coisa"),
     o sócio responde com texto, anexo, link, áudio ou print — e pode falar de QUALQUER coisa, a qualquer hora.
     No fim: "Contei X de 11 temas. Faltou: …" → [Responder o que faltou] [Criar ambiente — não gasta nada].
     Criar = marca.criar (rascunho + ensaio) + anexos (balde "anexos", amb_<id>/...) + marca.anexar
     + cada mensagem numa linha de salvar_variaveis (bloco entrada_livre, campo m_<aaaammdd_hhmmss_mmm_iii>,
       valor {texto, pergunta:{numero,tema,titulo}|"livre", anexos:[ids], data}). NÃO dispara estudo.
     Se fechar sem querer, a conversa volta ao reabrir (memória da página + localStorage, sem os arquivos).
   - Aba da marca v4 (rascunho · estudando_v4 · em_aprovacao): a MESMA conversa (histórico + campo para mandar mais;
     o pato reabre o que foi pulado) e, embaixo, 1 linha de andamento "Vocês → Agentes → Identidade → Documento",
     "Rodar estudo" (custo antes do sim), "Abrir documento", "Copiar link do cliente", "Ativar" e "ver agentes" (recolhido).
   Nada aqui chama IA. "Rodar estudo" só pede ao servidor depois do "Sim" do dono. */
(function(){
"use strict";
const LIMITE_MB=50;
const NADA_SALVO="Modo demonstração: nada foi salvo.";
const LS_NOVO="sd-novo-ambiente-v1";
const e_=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const z2=n=>String(n).padStart(2,"0");
const DIAS_S=["dom","seg","ter","qua","qui","sex","sáb"];
const quandoS=d=>`${z2(d.getDate())}/${z2(d.getMonth()+1)} · ${DIAS_S[d.getDay()]} · ${z2(d.getHours())}:${z2(d.getMinutes())}`;
const horaS=d=>d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
const usdS=n=>"US$ "+(Number(n)||0).toFixed(2).replace(".",",");
function carimbo(d=new Date()){return`${d.getFullYear()}${z2(d.getMonth()+1)}${z2(d.getDate())}-${z2(d.getHours())}${z2(d.getMinutes())}${z2(d.getSeconds())}`}
/* campo único por mensagem: data com milissegundos + índice (nunca repete, mesmo com 2 mensagens no mesmo segundo) */
function campoMsg(d,i){return "m_"+carimbo(d).replace("-","_")+"_"+String(d.getMilliseconds()).padStart(3,"0")+"_"+String(i).padStart(3,"0")}
function nomeLimpo(n){const m=String(n).match(/^(.*?)(\.[a-z0-9]{1,6})?$/i);const base=(m[1]||"arquivo").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"arquivo";return base+((m[2]||"").toLowerCase())}
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

/* ---------- o roteiro do pato (só um roteiro: o sócio pode falar de tudo, a qualquer hora) ---------- */
const PERGUNTAS=[
 {n:1,tema:"nome",titulo:"Nome da empresa",q:"Qual é o nome da empresa? Se tiver, mande junto o @ do Instagram e o site.",ex:"Cafeteria do Bairro · @cafedobairro · cafedobairro.com.br"},
 {n:2,tema:"quem_e",titulo:"Quem ela é",q:"Quem é a empresa? O que faz, há quanto tempo existe, quem fundou e por quê. Pode mandar o documento de apresentação ou gravar um áudio.",ex:"Somos uma cafeteria de bairro aberta há 3 anos por dois amigos que largaram o escritório."},
 {n:3,tema:"modelo_negocio",titulo:"Modelo de negócio",q:"Como ela ganha dinheiro e onde vende?",ex:"Balcão (uns R$ 15 por visita) + assinatura de café de R$ 69 por mês, vendida pelo link da bio."},
 {n:4,tema:"como_funciona",titulo:"Como ela funciona",q:"Como é o caminho do cliente, do primeiro contato até voltar a comprar? E o que ele mais pergunta?",ex:"Vê o post → abre o link → prova na loja → assina → recebe em casa todo mês."},
 {n:5,tema:"estrategia",titulo:"Estratégia",q:"Qual é a estratégia: a meta (com número e data), as datas importantes e o tom da marca?",ex:"300 assinantes até 15/02. Natal é forte. Tom acolhedor, humor leve, nunca sarcástico."},
 {n:6,tema:"tipos_post",titulo:"Tipos de post",q:"Que tipos de post vocês querem, e quanto de cada um (em %)?",ex:"Café da semana em carrossel 30%, meme do balcão 25%, notícia do bairro 15%, enquete de sábado 10%."},
 {n:7,tema:"referencias",titulo:"Referências",q:"Quais perfis vocês admiram? Mandem prints de posts que amam e de posts que odeiam, e digam por quê.",ex:"@perfilx: amo as fotos de perto; odeio texto longo na capa. (+ prints anexados)"},
 {n:8,tema:"limites",titulo:"Limites e aprovação",q:"O que não pode de jeito nenhum? Quem aprova os posts? A IA pode mexer na foto do produto?",ex:"Nunca preço na capa. A Ana aprova em até 24 h. A IA não pode alterar o produto."},
 {n:9,tema:"ativos_3d",titulo:"3D",q:"Vocês têm o produto em 3D (render do Blender)? Se tiver, anexe e diga onde pode usar.",ex:"Anexei o render do pacote de café. Pode usar em capa e story."},
 {n:10,tema:"estoque",titulo:"Estoque",q:"Vocês vendem peça única (brechó, arte, usado)? Se sim, como funciona o estoque? Se não, é só pular.",ex:"Cada peça é única; quando vende, o post sai do ar."},
 {n:11,tema:"vendido",titulo:"O que foi vendido ao cliente",q:"O que foi vendido ao cliente? Posts por mês, formatos, vídeo, data de início e quantas correções estão incluídas.",ex:"20 posts por mês (carrossel e meme), 2 reels, começa em 01/12, 2 rodadas de correção."}
];
const FINAL={n:12,tema:"livre",titulo:"Mais alguma coisa",q:"Quer contar mais alguma coisa? Tudo o que vocês falarem entra no estudo.",ex:"Uma história de cliente, uma ideia de série, algo que não pode faltar…"};
const perg=n=>n===12?FINAL:PERGUNTAS.find(p=>p.n===n);
const tagDe=n=>n>=1&&n<=11?{numero:n,tema:perg(n).tema,titulo:perg(n).titulo}:"livre";
const numDe=t=>t&&typeof t==="object"?Number(t.numero)||0:(typeof t==="number"?t:0);
const INTRO="Oi! Eu sou o pato da fábrica. Vou fazer 11 perguntas curtas para conhecer a empresa, uma de cada vez. Dá para responder escrevendo, mandando documento, print, link ou áudio — e mandar várias mensagens na mesma pergunta.\n\nPode falar à vontade, até coisas que eu não perguntar — tudo entra no estudo. Não sabe alguma? É só pular.";

/* ---------- blocos e grupos (contrato B.3) ---------- */
const GRUPOS=[["G1","Negócio"],["G2","Público"],["G3","Concorrência e brechas"],["G4","Posicionamento"],["G5","Voz"],["G6","Visual"],["G7","Conteúdo"],["G8","Calendário"],["G9","Assuntos do momento"],["G10","Riscos e Pausa"],["G11","Metas"],["G12","Operação"],["G13","Comunidade"],["G14","Ativos especiais e 3D"],["G15","Perfil e vitrine"],["G16","Mecânica do formato"],["G17","Distribuição"],["G18","Estoque"]];
const PAPEIS=[["leitor_anexos","Leitor de anexos","organiza a conversa e lê os anexos"],["melhorador","Melhorador","devolve antes e depois do que vocês disseram"],["critico","Crítico","confere cada grupo e a fonte citada"],["estrategista","Estrategista","junta tudo numa ficha"],["editor","Editor","escreve o título e o número de cada página"],["cetico","Cético final","lê como se fosse o cliente"]];
const ESTADO_T={esperando:["Esperando","st-draft"],rodando:["Rodando","st-wait"],feito:["Feito","st-ok"],devolvido:["Devolvido","st-rej"]};
const COM_BUSCA=["G2","G3","G8","G9","G10","G15","G16","G17"];
/* estimativa pelas regras de preço do contrato (seção F) — só quando o servidor não devolve a dele */
function estimativaLocal(gr){const g=gr&&gr.length?gr:GRUPOS.map(x=>x[0]);let m=0;g.forEach(x=>{m+=COM_BUSCA.includes(x)?0.15:0.05;m+=0.02});m+=0.05+0.10+0.10+0.05;return{medidor_usd:+m.toFixed(2),real_usd:+(m*1.4).toFixed(2)}}

/* ---------- anexos ---------- */
const PAPEL_T={oficial:"Oficial",rascunho:"Rascunho",inspiracao:"Só inspiração"};
const PAPEL_TIP="Oficial: vale como regra da marca · Rascunho: ideia em andamento, usar com cuidado · Só inspiração: referência de gosto, nunca regra";
function tipoT(t){t=t||"";if(t==="link")return"Link";if(/^image\//.test(t))return"Imagem";if(/^audio\//.test(t))return"Áudio";if(/pdf/.test(t))return"PDF";if(/presentation|powerpoint|keynote/.test(t))return"Apresentação";if(/sheet|excel|csv/.test(t))return"Planilha";if(/word|document|text/.test(t))return"Documento";return"Arquivo"}
function tam(b){if(!b)return"";return b>1048576?(b/1048576).toFixed(1).replace(".",",")+" MB":Math.max(1,Math.round(b/1024))+" KB"}
const papelPadrao=f=>/^image\//.test(f.type||"")?"inspiracao":"oficial";
const seletorPapel=(attr,papel)=>`<select class="soc-papel p-${e_(papel)}" ${attr} title="${e_(PAPEL_TIP)}" aria-label="Isso é oficial, rascunho ou só inspiração?">${Object.entries(PAPEL_T).map(([k,t])=>`<option value="${k}"${k===papel?" selected":""}>${t}</option>`).join("")}</select>`;
const linkDe=a=>/^https?:\/\//.test(a.caminho||"")?a.caminho:/^https?:\/\//.test(a.nome||"")?a.nome:/^https?:\/\//.test(a.url||"")?a.url:"";

/* ---------- estado ---------- */
const S={};          // por marca: S[id] = {msgs, anexos, linhas, ficha, perg, ...}
function est(id){return S[id]||(S[id]={carregado:false,carregando:false,erro:"",msgs:[],anexos:[],linhas:[],ficha:null,pend:[],draft:"",estimativa:null,ultima:null,proxima:0,lendoFicha:false,enviando:false,demoPasso:0,perg:null,verAgentes:false})}
let ID=0;            // marca aberta na aba
let DEMO_FICHA=null;
let timer=null,tick=null,timerId=null;
let guardadoNovo=null; // a conversa nova fechada sem criar (volta ao abrir o "+" de novo, com os arquivos)
const LIVRE={novo:false,aba:false}; // "assunto livre": a próxima mensagem não responde à pergunta da vez
const leituraMs=()=>DEMO?2500:10000;
const pendDe=w=>w==="novo"?(novoAmb?novoAmb.pend:[]):est(ID).pend;
const $id=id=>document.getElementById(id);

/* ======================= a conversa (desenho comum ao "Novo ambiente" e à aba) ======================= */
const pato=(corpo,extra="")=>`<div class="m ag soc-b"><span class="from">🦆 Pato da fábrica</span>${corpo}${extra}</div>`;
const tx=t=>`<div class="tx">${e_(t)}</div>`;
function perguntaHTML(n,botoes){
  const P=perg(n);
  return pato(`<span class="soc-qn">${n<=11?`Pergunta ${n} de 11 · `:""}${e_(P.titulo)}</span>${tx(P.q)}<div class="soc-ex">Exemplo: ${e_(P.ex)}</div>`,botoes?`<div class="soc-qb">${botoes}</div>`:"");
}
function anexoChip(a){
  const lk=linkDe(a);const nome=a.tipo==="link"?(lk||a.nome||"").replace(/^https?:\/\//,""):a.nome;
  const abrir=a.tipo==="link"&&lk?` · <a href="${e_(lk)}" target="_blank" rel="noopener">abrir</a>`:a.id&&a.caminho&&!/^https?:/.test(a.caminho)&&!DEMO?` · <button type="button" class="soc-lnk" data-soc="abrir" data-soc-id="${e_(a.id)}">abrir</button>`:"";
  return `<span class="soc-axm" data-soc-ic="${e_(a.id||"")}"><b>${e_(tipoT(a.tipo))}</b> ${e_(nome)}${a.perdido?" · <i>precisa anexar de novo</i>":""}${a.tamanho_bytes?" · "+tam(a.tamanho_bytes):""}${a.papel?" · "+e_(PAPEL_T[a.papel]||a.papel):""}${abrir}</span>`;
}
function socioHTML(m,anexos){
  const d=new Date(m.data);const livre=!numDe(m.pergunta);
  return `<div class="m me soc-b"><span class="from">Vocês${isNaN(d)?"":" · "+e_(quandoS(d))}${livre?" · assunto livre":""}${m.demo?" · não salvo (demonstração)":""}</span>${m.texto?tx(m.texto):""}${anexos.length?`<div class="soc-axs">${anexos.map(anexoChip).join("")}</div>`:""}</div>`;
}
const nota=t=>`<div class="soc-nota">${e_(t)}</div>`;

/* ---------- campo de mensagem (mesmo desenho do chat da fábrica) ---------- */
let gravador=null,gravW=null,pedacos=[],gravouEm=0;
function caixaHTML(w,texto,dis){
  return `<div class="soc-caixa" data-soc-caixa="${w}">
    <div class="soc-pend" id="soc-pend-${w}">${pendHTML(w)}</div>
    <textarea id="soc-ta-${w}" class="soc-ta soc-ta-chat" data-soc-ta="${w}" rows="2" maxlength="20000" aria-label="Mensagem para o pato"${dis?" disabled":""}
      placeholder="Escreva aqui. Pode colar prints (Ctrl+V), arrastar arquivos e falar de qualquer assunto.">${e_(texto||"")}</textarea>
    <div class="soc-linklinha" id="soc-link-${w}" hidden>
      <input type="url" id="soc-url-${w}" data-soc-url="${w}" placeholder="Cole o link (vídeo, perfil, pasta, site): https://" maxlength="1000" aria-label="Link">
      <button type="button" class="btn" data-soc="link-por" data-soc-w="${w}">Pôr</button><button type="button" class="btn" data-soc="link-fechar" data-soc-w="${w}">Fechar</button>
    </div>
    <div class="crow soc-crow">
      <button type="button" class="ib txt" data-soc="anexar" data-soc-w="${w}" title="PDF, imagem, print, áudio, documento, apresentação (até ${LIMITE_MB} MB cada)"${dis?" disabled":""}>${IC.clip}Anexar</button>
      <button type="button" class="ib txt" data-soc="link" data-soc-w="${w}"${dis?" disabled":""}>${IC.link}Link</button>
      <button type="button" class="ib txt${gravW===w?" rec":""}" data-soc="gravar" data-soc-w="${w}"${dis?" disabled":""}>${IC.mic}<span>${gravW===w?"Parar":"Áudio"}</span></button>
      <button type="button" class="ib txt soc-livre" data-soc="livre" data-soc-w="${w}" aria-pressed="${LIVRE[w]}" title="A próxima mensagem é sobre outro assunto (não responde à pergunta da vez). Também entra no estudo.">Assunto livre</button>
      <span class="sp"></span>
      <button type="button" class="send" data-soc="enviar" data-soc-w="${w}" aria-label="Enviar"${dis?" disabled":""}>${IC.up}</button>
    </div>
  </div>`;
}
function pendHTML(w){
  return pendDe(w).map((p,i)=>`<div class="soc-ax">
    <span class="ic">${p.prev?`<img src="${e_(p.prev)}" alt="">`:e_(p.tipo==="link"?"link":(p.nome.match(/\.([a-z0-9]{1,5})$/i)||[,"arq"])[1])}</span>
    <div class="info"><div class="nm" title="${e_(p.nome)}">${e_(p.tipo==="link"?p.url.replace(/^https?:\/\//,""):p.nome)}</div>
      <div class="ds">${e_(p.tipo==="link"?"Link":tipoT(p.file.type))}${p.file?" · "+tam(p.file.size):""} · <button type="button" class="soc-lnk" data-soc="tirar" data-soc-w="${w}" data-soc-i="${i}">tirar</button></div></div>
    ${seletorPapel(`data-soc-papel-pend="${w}:${i}"`,p.papel)}
  </div>`).join("");
}
function pintarPend(w){const el=$id("soc-pend-"+w);if(el)el.innerHTML=pendHTML(w)}
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
function botaoGravar(w,on){const b=document.querySelector(`[data-soc="gravar"][data-soc-w="${w}"]`);if(!b)return;b.classList.toggle("rec",on);b.querySelector("span").textContent=on?"Parar":"Áudio"}

/* sobe anexos: arquivo → balde "anexos" (amb_<id>/...) + marca.anexar; link → marca.anexar (tipo link) */
async function subirPendentes(id,pend,agora,prog){
  const ids=[],erros=[];let n=0;
  for(const p of pend){n++;prog&&prog(`Enviando anexo ${n} de ${pend.length}…`);
    if(p.tipo==="link"){const r=await chamar("anexar",{ambiente_id:id,tipo:"link",url:p.url,caminho:p.url,nome:p.url,papel:p.papel,descricao:`Link da conversa de ${quandoS(agora)}`});
      if(r.ok&&r.anexo){ids.push(r.anexo.id);p.anexoId=r.anexo.id}else erros.push(`${p.url}: ${r.erro||"não registrou"}`);continue}
    if(!p.file){erros.push(`${p.nome}: o arquivo se perdeu quando a página fechou (anexe de novo)`);continue}
    const f=p.file;const caminho=`amb_${id}/${carimbo()}-${z2(n)}_${nomeLimpo(p.nome)}`;
    const up=await sb.storage.from("anexos").upload(caminho,f,{contentType:f.type||"application/octet-stream",upsert:false});
    if(up.error){erros.push(`${p.nome}: não subiu (${up.error.message})`);continue}
    const r=await chamar("anexar",{ambiente_id:id,caminho,nome:p.nome,tipo:f.type||"application/octet-stream",papel:p.papel,descricao:`Enviado na conversa de ${quandoS(agora)}`,tamanho_bytes:f.size});
    if(r.ok&&r.anexo){ids.push(r.anexo.id);p.anexoId=r.anexo.id}else erros.push(`${p.nome}: subiu, mas não registrou (${r.erro||"erro sem texto"})`);
  }
  return{ids,erros};
}
/* 1 mensagem = 1 linha de marca_variaveis (bloco entrada_livre) */
function linhaMensagem(m,i,ids){
  const d=new Date(m.data);const t=numDe(m.pergunta);
  return{bloco:"entrada_livre",campo:campoMsg(isNaN(d)?new Date():d,i),
    valor:{texto:m.texto||"",pergunta:m.pergunta||"livre",anexos:ids||[],data:isNaN(d)?new Date().toISOString():d.toISOString()},
    origem:"socio",fonte:`conversa com o pato · ${t?`pergunta ${t} (${perg(t).titulo})`:"assunto livre"} · ${isNaN(d)?"":d.toLocaleDateString("pt-BR")}`.trim(),certeza:"alta"};
}
async function salvarLinhas(id,linhas){
  for(let i=0;i<linhas.length;i+=400){const r=await chamar("salvar_variaveis",{ambiente_id:id,variaveis:linhas.slice(i,i+400)});if(!r.ok)return r}
  return{ok:true,salvas:linhas.length};
}

/* ======================= "NOVO AMBIENTE" = a conversa ======================= */
function conversaNova(){return{v:1,nome:"",itens:[{tipo:"pato",fala:"intro"},{tipo:"pato",fala:"pergunta",n:1}],atual:1,fila:[2,3,4,5,6,7,8,9,10,11,12],fim:false,draft:"",pend:[],criadoId:null}}
const msgsNovo=N=>N.itens.filter(x=>x.tipo==="socio");
function respondidas(msgs,nome){const r=new Set(msgs.map(m=>numDe(m.pergunta)).filter(n=>n>=1&&n<=11));if(nome)r.add(1);return r}
const faltando=r=>PERGUNTAS.filter(P=>!r.has(P.n)).map(P=>P.n);
function salvarLocal(){
  if(DEMO||!novoAmb)return;
  try{const N=novoAmb;const leve={...N,pend:[],itens:N.itens.map(x=>x.tipo!=="socio"?x:{...x,anexos:(x.anexos||[]).map(a=>({tipo:a.tipo,nome:a.nome,url:a.url,papel:a.papel,ids:a.ids,subido:a.subido,perdido:a.tipo!=="link"&&!a.subido}))})};
    localStorage.setItem(LS_NOVO,JSON.stringify(leve))}catch(_){}
}
function lerLocal(){if(DEMO)return null;try{const t=localStorage.getItem(LS_NOVO);if(!t)return null;const N=JSON.parse(t);if(!N||N.v!==1||!Array.isArray(N.itens))return null;N.pend=[];N.draft=N.draft||"";return N}catch(_){return null}}
function limparLocal(){try{localStorage.removeItem(LS_NOVO)}catch(_){}}
function estadoNovo(){const g=guardadoNovo;guardadoNovo=null;return g||lerLocal()||conversaNova()}
function temAlgo(N){return!!N&&(msgsNovo(N).length||N.draft.trim()||N.pend.length)}
function guardarNovo(){if(temAlgo(novoAmb)){guardadoNovo=novoAmb;salvarLocal()}}

function conversaNovoHTML(N){
  const msgs=msgsNovo(N);const r=respondidas(msgs,N.nome);
  const ultimaPerg=[...N.itens].reverse().find(x=>x.tipo==="pato"&&x.fala==="pergunta");
  let h="";
  N.itens.forEach(x=>{
    if(x.tipo==="socio"){h+=socioHTML(x,x.anexos||[]);return}
    if(x.fala==="intro"){h+=pato(tx(INTRO));return}
    if(x.fala==="pulou"){h+=nota(`Pulou: ${perg(x.n).titulo}. Dá para voltar depois.`);return}
    if(x.fala==="pergunta"){
      let bt="";
      if(!N.fim&&x===ultimaPerg&&x.n===N.atual){
        const resp=x.n===12?msgs.some(m=>m.depoisDe===12):r.has(x.n);
        if(x.n===12)bt=`<button type="button" class="pri" data-soc="terminar">Terminar</button>`;
        else if(x.n===1)bt=resp?`<button type="button" class="pri" data-soc="proxima">Próxima</button>`:"";
        else bt=resp?`<button type="button" class="pri" data-soc="proxima">Próxima</button>`:`<button type="button" data-soc="pular">Pular</button>`;
      }
      h+=perguntaHTML(x.n,bt);
    }
  });
  if(N.fim){
    const f=faltando(r);
    h+=pato(`${tx(`Contei ${r.size} de 11 temas.${f.length?` Faltou: ${f.map(n=>`${n} ${perg(n).titulo}`).join(", ")}.`:" Não faltou nenhum."}`)}<div class="soc-ex">${msgs.length} mensage${msgs.length===1?"m":"ns"} guardada${msgs.length===1?"":"s"}, com ${msgs.reduce((a,m)=>a+(m.anexos||[]).length,0)} anexo(s). Tudo vai para os agentes, inclusive o que foi assunto livre. Ainda dá para escrever mais aqui embaixo.</div>`,
      `<div class="soc-qb">${f.length?`<button type="button" data-soc="faltou">Responder o que faltou</button>`:""}<button type="button" class="pri" data-soc="criar">Criar ambiente — não gasta nada</button></div>`);
  }
  return h;
}
function pintarNovo(rolar=true){
  const c=$id("soc-conv-novo");if(!c||!novoAmb)return;c.innerHTML=conversaNovoHTML(novoAmb);
  const nm=$id("soc-novo-nome");if(nm)nm.textContent=novoAmb.nome?`· ${novoAmb.nome}`:"";
  if(rolar)c.scrollTop=c.scrollHeight;
}
function drawNovo(){
  const N=novoAmb,L=$id("layer");
  if(L.querySelector(".soc-chatmodal")){pintarNovo();return}
  L.innerHTML=`<div class="shade" data-mclose></div><div class="modal soc-chatmodal" role="dialog" aria-modal="true" aria-label="Novo ambiente">
   <div class="soc-cm-head"><div><h3>Novo ambiente <span class="soc-small" id="soc-novo-nome"></span></h3><p class="soc-small">Conversa com o pato. Criar não gasta nada: a marca nasce em rascunho e ensaio.</p></div>
     <span class="sp"></span><button type="button" class="btn soc-mini" data-soc="recomecar" title="Apagar esta conversa e começar outra">Recomeçar</button><button type="button" class="btn soc-mini" data-mclose aria-label="Fechar (a conversa fica guardada)">Fechar</button></div>
   <div class="soc-conv" id="soc-conv-novo" aria-live="polite"></div>
   <p class="soc-small soc-cm-msg" id="soc-novo-msg" role="status"></p>
   ${caixaHTML("novo",N.draft,false)}</div>`;
  pintarNovo();
  const ta=$id("soc-ta-novo");if(ta&&!matchMedia("(pointer:coarse)").matches)ta.focus();
}
function seguirNovo(){
  const N=novoAmb;
  if(N.fila.length){N.atual=N.fila.shift();N.itens.push({tipo:"pato",fala:"pergunta",n:N.atual})}
  else{N.fim=true;N.atual=0}
  salvarLocal();pintarNovo();
}
function enviarNovo(){
  const N=novoAmb;if(!N)return;
  const ta=$id("soc-ta-novo");const texto=(ta.value||"").trim();
  if(!texto&&!N.pend.length){toast("Escreva algo ou anexe um arquivo.");ta.focus();return}
  if(gravador){toast("Pare a gravação antes de enviar.");return}
  const livre=LIVRE.novo||N.fim||N.atual===12;
  const m={tipo:"socio",texto,pergunta:livre?"livre":tagDe(N.atual),anexos:N.pend.slice(),data:new Date().toISOString(),depoisDe:N.atual||null};
  N.itens.push(m);N.pend=[];N.draft="";ta.value="";LIVRE.novo=false;
  const bl=document.querySelector('[data-soc="livre"][data-soc-w="novo"]');if(bl)bl.setAttribute("aria-pressed","false");
  pintarPend("novo");
  if(!livre&&N.atual===1&&!N.nome&&texto){N.nome=texto.split("\n")[0].replace(/\s+·.*$/,"").replace(/[,;].*$/,"").replace(/\s@\S+.*$/,"").trim().slice(0,80);seguirNovo();return}
  salvarLocal();pintarNovo();
}
function irFaltou(){
  const N=novoAmb;const f=faltando(respondidas(msgsNovo(N),N.nome));if(!f.length)return;
  N.fim=false;N.fila=f.slice(1);N.atual=f[0];N.itens.push({tipo:"pato",fala:"pergunta",n:N.atual});salvarLocal();pintarNovo();
}
async function criar(btn){
  const N=novoAmb;if(!N)return;const msg=$id("soc-novo-msg");
  const nome=(N.nome||"").trim();
  if(nome.length<2){msg.textContent="Falta o nome da empresa (pergunta 1).";return}
  if(gravador){msg.textContent="Pare a gravação antes de criar.";return}
  if(N.draft.trim()||N.pend.length){msg.textContent="Tem uma mensagem escrita que não foi enviada: envie (seta) ou apague antes de criar.";return}
  const msgs=msgsNovo(N);
  if(DEMO){msgs.forEach(m=>(m.anexos||[]).forEach(p=>p.prev&&URL.revokeObjectURL(p.prev)));novoAmb=null;guardadoNovo=null;const k=Object.keys(ACC).find(x=>x!=="a1");if(k)acc=k;aberto=null;render();
    toast(NADA_SALVO+` “${nome}” não foi criada (${msgs.length} mensagens ficariam guardadas); abri a Marca Exemplo.`);return}
  btn.disabled=true;btn.textContent="Criando…";
  const todos=msgs.map(m=>m.texto).join("\n");
  const handle=(todos.match(/(^|[\s(])(@[a-z0-9_.]{2,30})/i)||[])[2]||"";
  const site=(todos.match(/https?:\/\/[^\s,;)]+/gi)||[]).find(u=>!/instagram\.com|tiktok\.com|youtu|facebook\.com|wa\.me/i.test(u))||"";
  let id=N.criadoId;
  if(!id){msg.textContent="Criando a marca (rascunho, ensaio)…";
    const r=await chamar("criar",{nome,handle,site});
    if(!r.ok||!r.ambiente){btn.disabled=false;btn.textContent="Criar ambiente — não gasta nada";msg.textContent="Não criou: "+(r.erro||"erro sem texto");return}
    id=N.criadoId=r.ambiente.id;salvarLocal()}
  const erros=[];
  for(const m of msgs){                                  // anexos de cada mensagem (só os que ainda não subiram)
    const falta=(m.anexos||[]).filter(a=>!a.subido);if(!falta.length)continue;
    const {erros:er}=await subirPendentes(id,falta,new Date(m.data),t=>{msg.textContent=t});
    falta.forEach(a=>{if(a.anexoId){a.subido=true;a.ids=[a.anexoId]}});
    erros.push(...er);salvarLocal();
  }
  msg.textContent=`Guardando ${msgs.length} mensage${msgs.length===1?"m":"ns"}…`;
  const linhas=msgs.map((m,i)=>linhaMensagem(m,i,(m.anexos||[]).flatMap(a=>a.ids||[])));
  const r2=linhas.length?await salvarLinhas(id,linhas):{ok:true};
  if(!r2.ok){btn.disabled=false;btn.textContent="Tentar guardar de novo";msg.textContent=`A marca foi criada, mas a conversa não foi guardada (${r2.erro||"erro sem texto"}). Ela continua aqui; clique de novo para tentar.`;return}
  msgs.forEach(m=>(m.anexos||[]).forEach(p=>p.prev&&URL.revokeObjectURL(p.prev)));
  novoAmb=null;guardadoNovo=null;limparLocal();
  await carregarAmbientes();acc="a"+id;aberto=null;tab="posts";render();
  toast(erros.length?`${nome} foi criada, mas: ${erros.join(" · ")}`:`${nome} criada em rascunho e ensaio, com ${msgs.length} mensagens guardadas. Nada foi gasto.`);
}

/* ======================= ABA DA MARCA (v4) ======================= */
function montarDe(s,rows){
  s.msgs=[];
  (rows||[]).forEach(r=>{
    if(r.bloco!=="entrada_livre")return;
    const v=r.valor&&typeof r.valor==="object"?r.valor:{texto:String(r.valor??"")};
    s.msgs.push({campo:r.campo,texto:String(v.texto||""),pergunta:v.pergunta||"livre",anexos:Array.isArray(v.anexos)?v.anexos:[],data:v.data||v.enviado_em||r.atualizado_em||null});
  });
  s.msgs.sort((a,b)=>String(a.campo).localeCompare(String(b.campo)));
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
  s.ficha=r.ok&&r.ficha?{versao:r.versao,status:r.status,ficha:r.ficha}:null;
}
/* conversa de exemplo da Marca Exemplo (fictícia; nada vem do servidor) */
function mensagensDemo(){
  const d=(dia,h,m)=>new Date(2026,10,dia,h,m).toISOString();const t=n=>tagDe(n);
  const extras=[{id:91,nome:"https://exemplo.invalid/reels-favorito",caminho:"https://exemplo.invalid/reels-favorito",tipo:"link",papel:"inspiracao"},
               {id:92,nome:"audio-reuniao-12-11.webm",caminho:null,tipo:"audio/webm",papel:"oficial",tamanho_bytes:3400000,descricao:"Áudio da reunião"}];
  return{anexos:[...(DEMO_FICHA.anexos||[]).map(a=>({...a,caminho:null,tamanho_bytes:a.tipo==="application/pdf"?2300000:640000})),...extras],
    msgs:[
      {campo:"m_1",data:d(12,10,0),pergunta:t(1),anexos:[],texto:"Marca Exemplo · @marcaexemplo"},
      {campo:"m_2",data:d(12,10,2),pergunta:t(2),anexos:[1,92],texto:"Somos uma cafeteria de bairro que torra o próprio café. Abrimos há 3 anos, dois amigos que largaram o escritório. Segue o manual da marca e o áudio da reunião."},
      {campo:"m_3",data:d(12,10,9),pergunta:t(3),anexos:[],texto:"Ganhamos dinheiro no balcão (uns R$ 15 por visita) e com a assinatura de café em grão, R$ 69 por mês, vendida pelo link da bio."},
      {campo:"m_4",data:d(12,10,14),pergunta:t(4),anexos:[],texto:"O cliente vê o post do café da semana, abre o link ou passa na loja, prova e assina. Recebe em casa todo mês."},
      {campo:"m_5",data:d(12,10,24),pergunta:t(5),anexos:[3],texto:"Meta: 300 assinantes até 15/02. Natal é forte. Tom acolhedor, humor leve, nunca sarcástico. O plano do trimestre está no anexo."},
      {campo:"m_6",data:d(12,10,31),pergunta:"livre",anexos:[],texto:"Uma coisa que vocês não perguntaram: aos domingos tem feira na rua e muita gente passa na loja depois. Dá para usar isso nos posts."},
      {campo:"m_7",data:d(13,9,15),pergunta:t(6),anexos:[],texto:"Café da semana em carrossel (30%), meme do balcão (25%), notícia útil do bairro (15%), enquete de sábado (10%)."},
      {campo:"m_8",data:d(13,9,20),pergunta:t(7),anexos:[2,91],texto:"Prints dos posts que amamos no anexo; o reels do link é o nosso favorito. Odiamos capa com muito texto."},
      {campo:"m_9",data:d(13,18,40),pergunta:t(8),anexos:[],texto:"Nunca preço na capa, não pode zoar cliente. Quem aprova é a sócia Ana, em até 24 h. A IA não pode alterar o produto nas fotos."},
      {campo:"m_10",data:d(13,18,52),pergunta:t(11),anexos:[],texto:"Vendemos 20 posts por mês (carrossel e meme), 2 reels, começo em 01/12 e 2 rodadas de correção por mês."}
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
  if(s.linhas.every(l=>l.estado==="feito")){A.status="em_aprovacao";DEMO_EST.v="em_aprovacao";s.ficha={versao:DEMO_FICHA.versao||1,status:DEMO_FICHA.status||"rascunho",ficha:DEMO_FICHA}}
}
async function carregar(A){
  const s=est(A.id);s.carregando=true;s.erro="";
  try{
    if(DEMO){
      if(!DEMO_FICHA)DEMO_FICHA=await (await fetch("exemplos/ficha_demo.json")).json();
      const x=mensagensDemo();s.msgs=x.msgs;s.anexos=x.anexos;
      if(A.status==="em_aprovacao"||A.status==="ativa"){s.linhas=linhasDemo("feito");s.ficha={versao:DEMO_FICHA.versao||1,status:DEMO_EST.v==="aprovada"?"aprovada":(DEMO_FICHA.status||"rascunho"),ficha:DEMO_FICHA}}
      else if(A.status==="estudando_v4"){s.linhas=linhasDemo("esperando");s.demoPasso=0}
      else s.linhas=[];
    }else{
      try{await carregarVariaveis(A.id)}catch(e){s.erro="Não li a conversa: "+e.message;montarDe(s,[])}
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
  if(A.status!==antes){render();return}   // mudou de etapa: redesenha a aba (o rascunho da caixa fica guardado)
  pintarDinamico(A);
}
function ligarLeitura(A){
  if(timerId===A.id&&timer)return;
  pararLeitura();timerId=A.id;
  timer=setInterval(()=>{const B=ambAtual();if(B.id!==A.id||!V4_ESPERA.includes(B.status)||!$id("soc-aba")){pararLeitura();return}if(!document.hidden)lerProgresso(B)},leituraMs());
  tick=setInterval(pintarLeitura,1000);
}
function pararLeitura(){clearInterval(timer);clearInterval(tick);timer=null;tick=null;timerId=null}

/* ---------- a conversa salva (aba) ---------- */
function conversaAbaHTML(A){
  const s=est(A.id);
  if(!s.carregado)return nota("Carregando a conversa…");
  let h="",ant=null;
  const ref=new Set();s.msgs.forEach(m=>(m.anexos||[]).forEach(id=>ref.add(String(id))));
  const soltos=s.anexos.filter(a=>!ref.has(String(a.id)));
  if(!s.msgs.length&&!soltos.length)h+=pato(tx(INTRO));
  s.msgs.forEach(m=>{
    const n=numDe(m.pergunta);
    if(n&&n!==ant)h+=perguntaHTML(n,"");
    if(n)ant=n;
    h+=socioHTML(m,(m.anexos||[]).map(id=>s.anexos.find(a=>String(a.id)===String(id))).filter(Boolean));
  });
  if(soltos.length)h+=socioHTML({texto:"Arquivos enviados sem mensagem:",pergunta:"livre",data:null},soltos);
  const r=respondidas(s.msgs,A.nome);const f=faltando(r);
  if(s.perg){
    const resp=s.msgs.some(m=>numDe(m.pergunta)===s.perg&&m.nova);
    const ult=s.msgs[s.msgs.length-1];
    if(resp&&ult&&numDe(ult.pergunta)===s.perg)h+=pato(tx(`Anotado em “${perg(s.perg).titulo}”. Pode mandar mais sobre isso ou seguir.`),`<div class="soc-qb"><button type="button" class="pri" data-soc="aba-proxima">Próxima</button></div>`);
    else h+=perguntaHTML(s.perg,resp?`<button type="button" class="pri" data-soc="aba-proxima">Próxima</button>`:`<button type="button" data-soc="aba-pular">Pular</button>`);
  }else{
    h+=pato(tx(`Contei ${r.size} de 11 temas.${f.length?` Faltou: ${f.map(n=>`${n} ${perg(n).titulo}`).join(", ")}.`:" Não faltou nenhum."} Pode mandar mais a qualquer momento, sobre qualquer assunto: tudo entra no estudo.`),
      f.length?`<div class="soc-qb">${f.map(n=>`<button type="button" data-soc="reabrir" data-soc-n="${n}">Responder ${n} · ${e_(perg(n).titulo)}</button>`).join("")}</div>`:"");
  }
  return h;
}
function pintarConversa(A,rolar=true){const c=$id("soc-conv-aba");if(!c)return;c.innerHTML=conversaAbaHTML(A);if(rolar)c.scrollTop=c.scrollHeight;if(!DEMO)miniaturas(A.id)}
async function miniaturas(id){
  const s=est(id);const imgs=s.anexos.filter(a=>a.caminho&&!/^https?:/.test(a.caminho)&&/^image\//.test(a.tipo||""));if(!imgs.length)return;
  try{const {data}=await sb.storage.from("anexos").createSignedUrls(imgs.map(a=>a.caminho),3600);
    (data||[]).forEach((d,i)=>{if(!d||!d.signedUrl)return;document.querySelectorAll(`[data-soc-ic="${imgs[i].id}"]`).forEach(el=>{if(!el.querySelector("img"))el.insertAdjacentHTML("afterbegin",`<img src="${e_(d.signedUrl)}" alt="" loading="lazy">`)})})}catch(_){}
}

/* ---------- andamento (1 linha) + botões + agentes recolhidos ---------- */
function etapas(A){
  const s=est(A.id),ap=APROV[A.id]||null;
  const G=s.linhas.filter(l=>/^G\d+$/.test(l.grupo));const todasFeitas=s.linhas.length&&s.linhas.every(l=>l.estado==="feito");
  return[
    ["Vocês",s.msgs.length||s.anexos.length?"ok":"nada",`${s.msgs.length} mensage${s.msgs.length===1?"m":"ns"}`],
    ["Agentes",!s.linhas.length?"nada":todasFeitas?"ok":"anda",G.length?`${G.filter(l=>l.estado==="feito").length} de ${G.length} grupos`:""],
    ["Identidade",s.ficha?"ok":A.status==="estudando_v4"?"anda":"nada",s.ficha?`ficha v${s.ficha.versao??"?"}`:""],
    ["Documento",ap&&ap.status==="aprovado"?"ok":s.ficha?"anda":"nada",ap&&ap.status==="aprovado"?"aprovado":ap&&ap.status==="mudanca"?"cliente pediu mudança":ap?"com o cliente":s.ficha?"pronto para mandar":""]];
}
const MARCA_T={ok:"✓",anda:"em andamento",nada:"—"};
function agentesHTML(A){
  const s=est(A.id);const por={};s.linhas.forEach(l=>por[l.grupo]=l);
  const docHref=DEMO?"documento.html?demo=1":`documento.html?amb=${A.id}`;
  const linha=(id,nome,sub,papel)=>{const l=por[id];const st=l&&ESTADO_T[l.estado]||null;
    return `<div class="soc-g"><span class="id">${papel?"·":e_(id)}</span><div class="t"><b>${e_(nome)}</b><span>${e_(l?.resumo||sub||(l?"":"ainda não pedido"))}</span></div>
      ${st?`<span class="st ${st[1]}">${st[0]}</span>`:`<span class="st st-draft" style="opacity:.5">—</span>`}
      <span class="u">${l?usdS(l.gasto_usd):""}${l&&l.ensaio?"<small>ensaio</small>":""}${l&&l.estado==="feito"&&!papel?`<small><a href="${docHref}#${id}">ler</a></small>`:""}</span></div>`};
  return `<p class="soc-small" id="soc-leitura">${leituraTxt(A)}</p>${PAPEIS.slice(0,2).map(([p,n,sb_])=>linha(p,n,sb_,true)).join("")}${GRUPOS.map(([g,t])=>linha(g,t,"")).join("")}${PAPEIS.slice(2).map(([p,n,sb_])=>linha(p,n,sb_,true)).join("")}`;
}
function andamentoHTML(A){
  const s=est(A.id),ap=APROV[A.id]||null,st=ap&&ap.status;
  const ensaio=A.ensaio!==false||DEMO;const rodando=A.status==="estudando_v4"&&s.linhas.some(l=>l.estado==="rodando"||l.estado==="esperando");
  const e=s.estimativa||estimativaLocal();
  const docHref=DEMO?"documento.html?demo=1":`documento.html?amb=${A.id}`;
  const feitos=s.linhas.filter(l=>l.estado==="feito").length;
  const linha=etapas(A).map(([t,c,d],i)=>`${i?'<span class="soc-seta" aria-hidden="true">→</span>':""}<span class="soc-et ${c}"><b>${t}</b> <i>${MARCA_T[c]}</i>${d?`<small>${e_(d)}</small>`:""}</span>`).join("");
  const sit=!s.ficha?"":!ap?"O link do cliente ainda não foi criado.":st==="aprovado"?`Aprovado por ${ap.aprovado_por||"cliente"}${ap.aprovado_em?` em ${fdt(new Date(ap.aprovado_em))}`:""}.`
    :st==="mudanca"?`O cliente pediu mudança${ap.pedido_mudanca?`: “${ap.pedido_mudanca}”`:""}. Corrija no documento e crie um link novo.`:"Link enviado. O cliente ainda não respondeu.";
  const pode=A.status==="em_aprovacao"&&st==="aprovado";
  return `<div class="soc-linha" aria-label="Andamento">${linha}</div>
    <div class="prow soc-acoes">
      <button class="btn${s.ficha?"":" primary"}" data-soc="rodar"${rodando?" disabled":""}>${rodando?"Estudo em andamento":s.ficha?"Rodar estudo de novo":"Rodar estudo"}<small class="soc-custo">${rodando?"":ensaio?` · ensaio, US$ 0 (teria ~${usdS(e.real_usd)})`:` · ~${usdS(e.real_usd)}`}</small></button>
      ${s.ficha?`<a class="btn primary" href="${docHref}">Abrir documento</a><button class="btn" data-soc="link-cliente">Copiar link do cliente</button>`:""}
      ${pode?`<button class="btn primary" data-ativar="${A.id}" title="Liga a ficha aprovada na fábrica. Não gasta, não liga o vigia, não desliga o ensaio.">Ativar</button>`:""}
    </div>
    ${sit?`<p class="soc-small">${e_(sit)}</p>`:""}
    <details class="soc-agentes" id="soc-agentes"${s.verAgentes?" open":""}><summary>ver agentes <span class="soc-small">(${s.linhas.length?`${feitos} de ${s.linhas.length} prontos`:"o estudo ainda não rodou"})</span></summary><div id="soc-agentes-lista">${agentesHTML(A)}</div></details>`;
}
function leituraTxt(A){const s=est(A.id);if(!s.ultima)return"";const seg=Math.max(0,Math.ceil((s.proxima-Date.now())/1000));
  return `<span class="soc-ponto"></span>Lido às ${horaS(s.ultima)} · próxima leitura em ${seg} s${DEMO?" (demonstração: a cada 2,5 s; no real, a cada 10 s)":""}`}
function pintarLeitura(){const A=ambAtual();const el=$id("soc-leitura");if(el&&A.id===ID)el.innerHTML=leituraTxt(A)}
function pintarDinamico(A){if(A.id!==ID||!$id("soc-aba"))return;const el=$id("soc-and");if(el)el.innerHTML=andamentoHTML(A)}

/* a aba inteira (chamada por renderV4 do index) */
function aba(A){
  ID=A.id;const s=est(A.id);
  const CH={rascunho:["Rascunho","st-draft"],estudando_v4:["Estudando","st-wait"],em_aprovacao:["Com o cliente","st-sched"]}[A.status]||[A.status,"st-draft"];
  return `<div class="v4card soc-aba" id="soc-aba">
    <div class="soc-cab"><h2>${e_(A.nome)}</h2><span class="st ${CH[1]}">${e_(CH[0])}</span>${A.handle?`<span class="soc-small">${e_(A.handle)}</span>`:""}${A.ensaio||DEMO?`<span class="soc-small">· modo ensaio: nada gasta</span>`:""}</div>
    ${s.erro?`<p class="warn" style="margin:0">${e_(s.erro)}</p>`:""}
    <div class="soc-chat"><div class="soc-conv" id="soc-conv-aba" aria-live="polite">${conversaAbaHTML(A)}</div>
      <p class="soc-small soc-cm-msg" id="soc-msg-aba" role="status"></p>${caixaHTML("aba",s.draft,s.enviando)}</div>
    <div class="soc-and" id="soc-and">${andamentoHTML(A)}</div>
  </div>`;
}
/* depois que a aba entrou na tela: carrega (1 vez), liga a leitura de 10 s, miniaturas */
function depois(A){
  ID=A.id;const s=est(A.id);
  const c=$id("soc-conv-aba");if(c)c.scrollTop=c.scrollHeight;
  if(!s.carregado&&!s.carregando)carregar(A).then(()=>{const B=ambAtual();if(B.id!==A.id||!$id("soc-aba"))return;
    if(B.status!==A.status||s.erro)return render();
    pintarConversa(A);pintarDinamico(A)});
  else if(s.carregado&&!DEMO)miniaturas(A.id);
  ligarLeitura(A);
}

/* ---------- mandar mais pela aba (grava na hora) ---------- */
async function enviarAba(){
  const A=ambAtual();if(A.id!==ID)return;const s=est(A.id);if(s.enviando)return;
  const ta=$id("soc-ta-aba"),msg=$id("soc-msg-aba");const texto=(ta.value||"").trim();
  if(!texto&&!s.pend.length){toast("Escreva algo ou anexe um arquivo.");ta.focus();return}
  if(gravador){toast("Pare a gravação antes de enviar.");return}
  const pergunta=s.perg&&!LIVRE.aba?tagDe(s.perg):"livre";
  LIVRE.aba=false;const bl=document.querySelector('[data-soc="livre"][data-soc-w="aba"]');if(bl)bl.setAttribute("aria-pressed","false");
  const agora=new Date();
  if(DEMO){
    const ids=s.pend.map((p,i)=>{const id=-(Date.now()+i);s.anexos.push({id,nome:p.nome,tipo:p.tipo==="link"?"link":(p.file&&p.file.type)||"",caminho:p.tipo==="link"?p.url:null,papel:p.papel,tamanho_bytes:p.file?p.file.size:null});return id});
    s.msgs.push({campo:"demo_"+s.msgs.length,texto,pergunta,anexos:ids,data:agora.toISOString(),demo:true,nova:true});
    s.pend=[];s.draft="";ta.value="";pintarPend("aba");pintarConversa(A);pintarDinamico(A);msg.textContent=NADA_SALVO;toast(NADA_SALVO);return}
  s.enviando=true;const bt=document.querySelector('[data-soc="enviar"][data-soc-w="aba"]');if(bt)bt.disabled=true;
  const {ids,erros}=await subirPendentes(A.id,s.pend,agora,t=>{msg.textContent=t});
  if(!texto&&!ids.length){s.enviando=false;if(bt)bt.disabled=false;msg.textContent="Nada foi enviado. "+erros.join(" · ");toast("Os anexos não foram.");return}
  msg.textContent="Guardando a mensagem…";
  const r=await salvarLinhas(A.id,[linhaMensagem({texto,pergunta,data:agora.toISOString()},s.msgs.length,ids)]);
  s.enviando=false;
  s.pend.forEach(p=>p.prev&&URL.revokeObjectURL(p.prev));s.pend=[];
  if(r.ok){s.draft="";ta.value=""}
  try{await carregarVariaveis(A.id)}catch(e){toast("Não li de volta: "+e.message)}   // lê de volta do banco: a prova de que gravou
  if(r.ok&&numDe(pergunta)){const m=s.msgs.find(x=>numDe(x.pergunta)===numDe(pergunta)&&Math.abs(new Date(x.data)-agora)<2000);if(m)m.nova=true}
  pintarPend("aba");pintarConversa(A);pintarDinamico(A);const b2=document.querySelector('[data-soc="enviar"][data-soc-w="aba"]');if(b2)b2.disabled=false;
  if(!r.ok){msg.textContent=`O texto não foi guardado: ${r.erro||"erro sem texto"}.${ids.length?` Os ${ids.length} anexo(s) foram guardados.`:""} Seu texto continua na caixa.`;return}
  msg.textContent=`Guardada e lida de volta às ${horaS(new Date())}${ids.length?` · ${ids.length} anexo${ids.length>1?"s":""}`:""}.${erros.length?" Não foram: "+erros.join(" · "):""}`;
}
function proximaAba(A){
  const s=est(A.id);const f=faltando(respondidas(s.msgs,A.nome)).filter(n=>n!==s.perg);
  const depois_=f.find(n=>n>s.perg)||null;s.perg=depois_;pintarConversa(A);
}

/* ---------- rodar estudo: estimativa real antes do "sim" ---------- */
async function pedirEstimativa(A,grupos){
  if(DEMO)return{est:estimativaLocal(grupos),origem:"Estimativa de exemplo (demonstração)."};
  // sem confirmar:true o servidor só devolve a estimativa e não muda nada
  const r=await chamar("estudar",{ambiente_id:A.id,confirmar:false,grupos:grupos&&grupos.length?grupos:undefined});
  if(r.estimativa&&r.estimativa.real_usd!=null)return{est:r.estimativa,origem:`Estimativa do servidor (${(r.grupos||[]).length||(grupos&&grupos.length)||18} grupos; nada foi pedido ainda).`,erro:r.ok||r.erro==="precisa confirmar"?null:r.erro};
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
    <ul style="margin:0 0 8px;padding-left:20px;font-size:.9rem"><li>Leitor: organiza a conversa inteira (${s.msgs.length} mensage${s.msgs.length===1?"m":"ns"}, inclusive os assuntos livres) e os ${s.anexos.length} anexo${s.anexos.length===1?"":"s"}; Melhorador</li><li><b>${lista.length} grupo${lista.length>1?"s":""}</b> de pesquisa: ${lista.join(", ")}</li><li>Crítico em cada grupo, Estrategista junta, Editor e Cético final</li></ul>
    <table class="custo-tab"><tbody><tr><td>Custo real estimado</td><td><b>~${usdS(r.est.real_usd)}</b></td></tr><tr><td>No medidor da fábrica</td><td>${usdS(r.est.medidor_usd)}</td></tr></tbody></table>
    ${G?`<p class="sub" style="margin:8px 0 0">Hoje a fábrica já gastou ${usdS(G.usd)} de ${usdS(G.teto)} (teto do dia, no medidor).</p>`:""}
    ${ensaio?`<p class="okbox" style="margin:8px 0 0">Modo ensaio ligado: nada é chamado na IA. Custo: US$ 0 (teria custado ~${usdS(r.est.real_usd)}).</p>`
      :`<p class="warn" style="margin:8px 0 0">Gasta de verdade. O robô trabalha sozinho e "ver agentes" mostra cada grupo. A fábrica para sozinha ao bater o teto do dia.</p>`}
    <p class="soc-small" style="margin-top:6px">${e_(r.origem)}</p>`;
  const m=$id("soc-est-msg");if(m)m.textContent=r.erro?"Aviso do servidor: "+r.erro:"";
  const b=document.querySelector('[data-soc="est-sim"]');if(b){b.disabled=false;b.textContent=ensaio?"Sim, rodar em ensaio (US$ 0)":`Sim, gastar ~${usdS(r.est.real_usd)}`}
  pintarDinamico(A);
}
async function confirmarEstudo(A,b){
  const L=$id("layer2"),s=est(A.id);
  if(DEMO){L.innerHTML="";toast(NADA_SALVO+" A lista simula o estudo.");s.ficha=null;s.linhas=linhasDemo("esperando");s.demoPasso=0;A.status="estudando_v4";DEMO_EST.v="estudando_v4";render();return}
  b.disabled=true;$id("soc-est-msg").textContent="Pedindo…";
  const g=gruposMarcados();const r=await chamar("estudar",{ambiente_id:A.id,confirmar:true,grupos:g.length?g:undefined});
  if(!r.ok){$id("soc-est-msg").textContent="Não rodou: "+(r.erro||"erro sem texto");b.disabled=false;return}
  L.innerHTML="";A.status="estudando_v4";s.ficha=null;
  toast(`Estudo pedido (modo ${r.modo==="real"?"real":"ensaio"}). O andamento atualiza a cada 10 s.`);
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
  const b=e.target.closest("[data-soc]");if(!b)return;
  const a=b.dataset.soc,w=b.dataset.socW;
  if(a==="anexar"){const i=seletorArquivo();i.dataset.w=w;i.click();return}
  if(a==="link"){const l=$id("soc-link-"+w);l.hidden=false;$id("soc-url-"+w).focus();return}
  if(a==="link-por"){porLink(w);return}
  if(a==="link-fechar"){$id("soc-link-"+w).hidden=true;$id("soc-url-"+w).value="";return}
  if(a==="gravar"){gravar(w);return}
  if(a==="livre"){LIVRE[w]=!LIVRE[w];b.setAttribute("aria-pressed",String(LIVRE[w]));if(LIVRE[w])toast("A próxima mensagem vai como assunto livre (também entra no estudo).");return}
  if(a==="tirar"){const L=pendDe(w);const p=L.splice(+b.dataset.socI,1)[0];if(p&&p.prev)URL.revokeObjectURL(p.prev);pintarPend(w);return}
  if(a==="enviar"){w==="novo"?enviarNovo():enviarAba();return}
  if(a==="proxima"||a==="terminar"){if(novoAmb)seguirNovo();return}
  if(a==="pular"){if(!novoAmb)return;novoAmb.pulados=[...(novoAmb.pulados||[]),novoAmb.atual];novoAmb.itens.push({tipo:"pato",fala:"pulou",n:novoAmb.atual});seguirNovo();return}
  if(a==="faltou"){irFaltou();return}
  if(a==="criar"){criar(b);return}
  if(a==="recomecar"){if(temAlgo(novoAmb)&&!(await perguntar("Recomeçar a conversa?","O que foi escrito aqui (e ainda não virou ambiente) some.","Recomeçar")))return;
    (novoAmb?msgsNovo(novoAmb):[]).forEach(m=>(m.anexos||[]).forEach(p=>p.prev&&URL.revokeObjectURL(p.prev)));limparLocal();novoAmb=conversaNova();$id("layer").innerHTML="";drawNovo();return}
  if(a==="reabrir"){const A=ambAtual();est(A.id).perg=+b.dataset.socN;pintarConversa(A);$id("soc-ta-aba")?.focus();return}
  if(a==="aba-pular"){const A=ambAtual();proximaAba(A);return}
  if(a==="aba-proxima"){const A=ambAtual();proximaAba(A);return}
  if(a==="rodar"){abrirEstudo(ambAtual());return}
  if(a==="est-nao"||a==="fechar2"){$id("layer2").innerHTML="";return}
  if(a==="est-sim"){confirmarEstudo(ambAtual(),b);return}
  if(a==="link-cliente"){linkCliente(ambAtual(),b);return}
  if(a==="abrir"){const s=est(ID);const x=s.anexos.find(y=>String(y.id)===b.dataset.socId);if(!x||DEMO)return;
    const {data,error}=await sb.storage.from("anexos").createSignedUrl(x.caminho,3600);if(error){toast("Não abriu: "+error.message);return}window.open(data.signedUrl,"_blank","noopener");return}
});
document.addEventListener("toggle",e=>{if(e.target&&e.target.id==="soc-agentes")est(ID).verAgentes=e.target.open},true);
let salvarT=0;
document.addEventListener("input",e=>{
  const t=e.target;const w=t.dataset&&t.dataset.socTa;if(!w)return;
  if(w==="novo"){if(novoAmb){novoAmb.draft=t.value;clearTimeout(salvarT);salvarT=setTimeout(salvarLocal,400)}}else est(ID).draft=t.value;
});
document.addEventListener("change",async e=>{
  const t=e.target;
  if(t.closest&&t.closest("#soc-est-grupos")){atualizarCorpo(ambAtual());return}
  if(t.dataset&&t.dataset.socPapelPend){const [w,i]=t.dataset.socPapelPend.split(":");const p=pendDe(w)[+i];if(p)p.papel=t.value;t.className="soc-papel p-"+t.value;return}
});
document.addEventListener("keydown",e=>{
  const w=e.target.dataset&&e.target.dataset.socTa;
  if(w&&e.key==="Enter"&&(e.ctrlKey||e.metaKey||(!e.shiftKey&&!matchMedia("(pointer:coarse)").matches))){e.preventDefault();w==="novo"?enviarNovo():enviarAba();return}
  const u=e.target.dataset&&e.target.dataset.socUrl;if(u&&e.key==="Enter"){e.preventDefault();porLink(u)}
});
document.addEventListener("paste",e=>{const c=e.target.closest&&e.target.closest("[data-soc-caixa]");if(!c)return;const fs=[...(e.clipboardData?.files||[])];if(!fs.length)return;e.preventDefault();porArquivos(c.dataset.socCaixa,fs)});
["dragenter","dragover"].forEach(ev=>document.addEventListener(ev,e=>{const c=e.target.closest&&e.target.closest("[data-soc-caixa]");if(!c)return;if([...(e.dataTransfer?.types||[])].includes("Files")){e.preventDefault();c.classList.add("sobre")}}));
["dragleave","drop"].forEach(ev=>document.addEventListener(ev,e=>{const c=e.target.closest&&e.target.closest("[data-soc-caixa]");if(!c)return;e.preventDefault();c.classList.remove("sobre");if(ev==="drop"&&e.dataTransfer?.files?.length)porArquivos(c.dataset.socCaixa,e.dataTransfer.files)}));
window.addEventListener("beforeunload",e=>{if(DEMO)return;salvarLocal();const algo=(novoAmb&&novoAmb.pend.length)||Object.values(S).some(s=>s.draft.trim()||s.pend.length);if(algo){e.preventDefault();e.returnValue=""}});

window.SOC={aba,depois,drawNovo,criar,estadoNovo,guardarNovo,pararLeitura};
})();
