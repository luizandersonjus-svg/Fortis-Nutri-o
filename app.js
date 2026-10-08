/* ================= FORTIS PWA — lógica do app (100% local/offline) ================= */
(function(){
"use strict";
const D = window.FORTIS;
const C = window.FORTIS_CORE;
const VERSION = "1.6";
const $ = (s, r) => (r||document).querySelector(s);
const $$ = (s, r) => Array.from((r||document).querySelectorAll(s));

/* ---------- helpers ---------- */
const esc=(s)=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const num=C.num;
const fi=(n)=>n==null||!isFinite(n)?"—":Math.round(n).toLocaleString("pt-BR");
const f1=(n)=>n==null||!isFinite(n)?"—":Number(n).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1});
const f2=(n)=>n==null||!isFinite(n)?"—":Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=(n,d)=>n==null||!isFinite(n)?"—":(n*100).toLocaleString("pt-BR",{minimumFractionDigits:d||0,maximumFractionDigits:d||0})+"%";
const dataBR=(iso)=>{ if(!iso) return "—"; const p=String(iso).split("-"); return esc(p.length===3?`${p[2]}/${p[1]}/${p[0]}`:iso); };
const todayISO=()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const saudacao=()=>{ const h=new Date().getHours(); return h<12?"Bom dia":h<18?"Boa tarde":"Boa noite"; };

/* ---------- storage seguro ---------- */
const store = {
  mem:{},
  get(k,fb){ try{ const v=localStorage.getItem(k); if(v!=null) return JSON.parse(v); }catch(e){} return (k in this.mem)?this.mem[k]:fb; },
  set(k,v){ this.mem[k]=v; try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } }
};
const KEY="fortis_pwa_v1";
let S=C.sanitizeState(store.get(KEY,{}),uid);   // valida/migra o que estiver salvo (inclusive dados da v1.1)
let _memo=null;                                  // cache de derivados; invalidado a cada save()
let _warnedStorage=false;
/* banco base = alimentos do FORTIS (com medidas caseiras) + TACO 4ª ed. completa (taco.js) */
const BASE=[...D.FOODS,...(D.TACO||[])];
const TACO_CATS=[...new Set((D.TACO||[]).map(f=>f[9]))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
const memo=()=>_memo||(_memo={foods:C.foodMap(BASE,S.customFoods),start:C.firstDate(S.diary)});
const save=()=>{ _memo=null; const ok=store.set(KEY,S);
  if(!ok&&!_warnedStorage){ _warnedStorage=true; toast("⚠ Não foi possível salvar no aparelho (modo privado ou armazenamento cheio). Exporte um backup."); }
  return ok; };

/* ---------- alimentos ---------- */
const foodMap=()=>memo().foods;
const norm=s=>String(s==null?"":s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
/* busca por partes do nome, sem acento e em qualquer ordem ("frango peito" acha "Peito de frango grelhado");
   quem começa com o texto digitado vem primeiro */
function searchFoods(q,limit){ const nq=norm(q); if(!nq) return []; const toks=nq.split(/\s+/), m=foodMap();
  return Object.keys(m).map(n=>{ const nn=norm(n); if(!toks.every(t=>nn.includes(t))) return null;
    const r=nn.startsWith(nq)?0:nn.split(/[\s(),\/-]+/).some(w=>w.startsWith(toks[0]))?1:2;
    const o=m[n].custom?0:m[n].cat?2:1; return {n,r,o}; })
   .filter(Boolean).sort((a,b)=>a.r-b.r||a.o-b.o||a.n.localeCompare(b.n,"pt-BR")).slice(0,limit||30).map(x=>x.n); }
/* texto digitado → nome do banco: igual (ignorando acento/maiúsculas) ou, com loose, o único resultado da busca */
function resolveFood(txt,loose){ const t=String(txt||"").trim(), m=foodMap(); if(!t) return ""; if(m[t]) return t;
  const nt=norm(t), hit=Object.keys(m).find(n=>norm(n)===nt); if(hit) return hit;
  if(!loose) return ""; const r=searchFoods(t,2); return r.length===1?r[0]:""; }
const measures=(name)=>C.measuresOf(name,foodMap()[name],D.UNITS);
const fmtN=(n)=>Number(num(n)||0).toLocaleString("pt-BR",{maximumFractionDigits:2});
/* texto da quantidade de um item: "2 × unidade (100 g)" ou "150 g" */
const qtyText=(it)=>it.u?`${fmtN(it.n)} × ${esc(it.u)} (${fmtN(it.q)} g)`:`${fmtN(it.q)} g`;
const isBaseFood=(n)=>BASE.some(f=>f[0].toLowerCase()===n.toLowerCase());

/* ---------- cálculos (espelham a planilha; ver core.js) ---------- */
const calcPerfil=()=>C.calcPerfil(S.profile,D.ACTS,D.GOALS);
const calcMacros=()=>C.calcMacros(S.profile,S.macros,D.ACTS,D.GOALS);
const planTotals=()=>C.sumItems(S.plan,foodMap());
const mealSub=(meal)=>C.sumItems(S.plan,foodMap(),it=>it.m===meal);
const weekOf=(iso)=>C.weekNumber(memo().start,iso);
const diarySorted=()=>[...S.diary].sort((a,b)=>a.data<b.data?-1:a.data>b.data?1:0);
function pesoAtual(){ const s=diarySorted().filter(r=>num(r.peso)!=null); return s.length?num(s[s.length-1].peso):num(S.profile.peso); }

/* ---------- gráficos SVG ---------- */
function pieSVG(parts){ const R=54,Cc=2*Math.PI*R; let acc=0;
  const ps=parts.map(s=>({...s,v:Math.max(0,s.v||0)})), tot=ps.reduce((a,b)=>a+b.v,0);
  const segs=ps.map(s=>{ const frac=tot>0?s.v/tot:0; const dash=frac*Cc, off=-acc*Cc; acc+=frac;
    return `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${s.color}" stroke-width="26" stroke-dasharray="${dash.toFixed(1)} ${(Cc-dash).toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 70 70)"/>`; }).join("");
  const label=ps.map(s=>`${s.label} ${fi(s.v)} kcal`).join(", ");
  return `<svg class="chart" viewBox="0 0 140 140" role="img" aria-label="Distribuição de calorias: ${esc(label)}">${segs}<circle cx="70" cy="70" r="34" fill="#101010"/><text x="70" y="66" text-anchor="middle" fill="#E8BE4E" font-size="15" font-weight="bold">${fi(tot)}</text><text x="70" y="82" text-anchor="middle" fill="#B8B8B8" font-size="10">kcal</text></svg>`;
}
/* weeks = nº real de cada semana (o eixo X respeita semanas sem registro); meta = linha tracejada opcional */
function lineSVG(title,weeks,vals,color,dec,meta){ const W=480,H=200,P=34;
  const vv=vals.filter(v=>v!=null);
  if(!vv.length) return `<div class="muted small">Sem dados suficientes ainda.</div>`;
  const all=meta!=null?[...vv,meta]:vv;
  let mn=Math.min(...all),mx=Math.max(...all); if(mn===mx){mn-=1;mx+=1;} const pad=(mx-mn)*0.15; mn-=pad; mx+=pad;
  const w0=Math.min(...weeks),w1=Math.max(...weeks), X=w=>w1>w0?P+(w-w0)*(W-2*P)/(w1-w0):W/2, Y=v=>H-P-(v-mn)*(H-2*P)/(mx-mn);
  const nf=(v,d)=>Number(v).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
  const ticks=[0,1,2,3].map(g=>mn+(mx-mn)*g/3);
  let td=dec; while(td<3&&new Set(ticks.map(v=>nf(v,td))).size<ticks.length) td++;   // casas suficientes p/ não repetir rótulo
  let grid=""; ticks.forEach(v=>{ const y=Y(v);
    grid+=`<line x1="${P}" y1="${y.toFixed(1)}" x2="${W-8}" y2="${y.toFixed(1)}" stroke="#2a2a2a" stroke-width="1"/><text x="2" y="${(y+4).toFixed(1)}" fill="#9a9a9a" font-size="11">${nf(v,td)}</text>`; });
  let pts=[],dots="",xl="",desc=[];
  vals.forEach((v,i)=>{ if(v==null) return; const x=X(weeks[i]); pts.push(`${x.toFixed(1)},${Y(v).toFixed(1)}`); desc.push(`S${weeks[i]}: ${nf(v,dec)}`);
    dots+=`<circle cx="${x.toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4.5" fill="${color}" stroke="#0B0B0B" stroke-width="2"/>`; });
  weeks.forEach(w=>{ xl+=`<text x="${X(w).toFixed(1)}" y="${H-8}" text-anchor="middle" fill="#9a9a9a" font-size="11">S${w}</text>`; });
  const line=pts.length>1?`<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`:"";
  const ml=meta==null?"":`<line x1="${P}" y1="${Y(meta).toFixed(1)}" x2="${W-8}" y2="${Y(meta).toFixed(1)}" stroke="#E8E8E8" stroke-width="1.5" stroke-dasharray="6 5" opacity=".7"/><text x="${P+6}" y="${(Y(meta)-6).toFixed(1)}" fill="#E8E8E8" font-size="11" paint-order="stroke" stroke="#151515" stroke-width="3">meta ${nf(meta,0)}</text>`;
  if(meta!=null) desc.push(`meta: ${nf(meta,0)}`);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title+" — "+desc.join("; "))}">${grid}${ml}${line}${dots}${xl}</svg>`;
}

/* ---------- navegação ---------- */
const ui={tab:"inicio",view:"inicio",segPlano:"plano",segDiario:"registro",segEstr:0,foodQ:"",foodCat:"",ob:{},obStep:0};
const ICO={
 home:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z"/></svg>',
 plan:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 2v20M4 2v6a3 3 0 006 0V2M17 2c-2 0-3 3-3 7v4h3v9M17 2v20"/></svg>',
 cal:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
 chart:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
 more:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'};
const TABS=[["inicio","Início","home"],["plano","Plano","plan"],["diario","Diário","cal"],["progresso","Progresso","chart"],["mais","Mais","more"]];
const TITLES={inicio:"Início",perfil:"Perfil e Metas",macros:"Macronutrientes",plano:"Plano Alimentar",diario:"Diário",progresso:"Progresso",mais:"Mais",compras:"Lista de Compras",suple:"Suplementação",sobre:"Sobre o Método",backup:"Backup e Dados"};
const BACK=["perfil","macros","compras","suple","sobre","backup"];
const BRAND=`<b>FORTIS</b><span>Nutrição • Saúde • Suplementação</span>`;

/* ---------- acessibilidade: associa cada <label class="f"> ao campo seguinte ---------- */
function linkLabels(root){ $$("label.f",root).forEach(l=>{ if(l.htmlFor) return;
  let el=l.parentElement.classList.contains("lblrow")?l.parentElement.nextElementSibling:l.nextElementSibling; if(el&&!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el=null;
  if(el){ if(!el.id) el.id="fld_"+uid(); l.htmlFor=el.id; } }); }

/* ---------- toast (substitui alert) ---------- */
let _toastT=null;
function toast(msg){ const t=$("#toast"); if(!t){ return; } t.textContent=msg; t.classList.add("show");
  clearTimeout(_toastT); _toastT=setTimeout(()=>t.classList.remove("show"),3800); }

/* ---------- modal ---------- */
let _lastFocus=null;
function openSheet(html){ _lastFocus=document.activeElement; const sh=$("#sheet"); sh.innerHTML=html; linkLabels(sh);
  $("#modal").classList.add("open");
  const first=sh.querySelector("input:not([type=hidden]),select,textarea,button"); if(first) first.focus(); }
function closeSheet(){ ui.planDraft=null; const m=$("#modal"); if(!m.classList.contains("open")) return; m.classList.remove("open"); $("#sheet").innerHTML="";
  if(_lastFocus&&document.contains(_lastFocus)) _lastFocus.focus(); _lastFocus=null; }
let _confirmCb=null;
/* msg é HTML: nomes digitados pela pessoa devem chegar já com esc() */
function mConfirm(msg,cb,okLabel,okClass){ _confirmCb=cb; openSheet(`<h2 id="sheetTitle">Confirmar</h2><p>${msg}</p><div class="rowbtns"><button class="btn btn-ghost" onclick="App.close()">Cancelar</button><button id="btnConfirmYes" class="btn ${okClass||"btn-gold"}" onclick="App.confirmYes()">${esc(okLabel||"Confirmar")}</button></div>`); }
/* devolve o foco a um elemento recriado pelo render (teclado/leitor de tela não volta ao topo) */
const refocus=(id)=>{ const el=document.getElementById(id); if(el) el.focus({preventScroll:true}); };
const menuRow=(v,label,sub,ic)=>`<button class="menurow" onclick="App.go('${v}')"><span class="ic" aria-hidden="true">${ic}</span><span style="flex:1">${label}<small>${sub}</small></span><span class="chev" aria-hidden="true">›</span></button>`;

/* ---------- linguagem simples: glossário e opções explicadas ---------- */
const GLOSS={
 kcal:["Calorias por dia","É quanto você deve comer por dia, somando todas as refeições, para chegar ao seu objetivo. É uma estimativa inicial: acompanhe seu peso por 2 a 3 semanas e ajuste se precisar."],
 tmb:["Gasto em repouso (TMB)","Energia que seu corpo gasta só para funcionar — respirar, bater o coração, manter a temperatura — mesmo se ficasse deitado o dia todo. Calculado com seu sexo, idade, peso e altura (fórmula de Mifflin-St Jeor)."],
 get:["Gasto total do dia (GET)","É o gasto em repouso somado a tudo o que você gasta se movimentando e treinando. Se comer exatamente isso, seu peso tende a ficar igual."],
 superavit:["Por que comer a mais?","Para construir músculo, o corpo precisa de energia extra: comer um pouco mais do que gasta. Essa “sobra” se chama superávit calórico. Sobra pequena = ganho mais lento e com menos gordura. Sobra grande = ganho mais rápido, mas com mais gordura."],
 macros:["Proteína, carboidrato e gordura","São os três grupos de nutrientes que têm calorias.<br><br><b>Proteína</b> (carnes, ovos, leite, feijão): constrói e recupera o músculo.<br><b>Carboidrato</b> (arroz, pão, batata, frutas): dá energia para treinar.<br><b>Gordura</b> (azeite, castanhas, ovos): essencial para os hormônios.<br><br>O app calcula quantos gramas de cada um você deve comer por dia."],
 fibra:["Fibras","Meta de <b>14 g para cada 1.000 kcal</b> que você come (referência das diretrizes alimentares). Vêm de feijão, lentilha, aveia, frutas, verduras e grãos integrais.<br><br>Ajudam o intestino e a saciedade. Passar um pouco da meta não é problema; aumente aos poucos e beba água."],
 gkg:["g/kg (gramas por quilo)","Quantidade por quilo do seu peso. Exemplo: 2 g/kg de proteína para quem pesa 70 kg = 140 g de proteína por dia.<br><br>Se não tiver certeza, deixe os valores sugeridos (proteína 2,0 e gordura 1,0)."],
 aderencia:["Seguiu o plano?","De 0 a 100%, o quanto você seguiu o plano no dia. Seguiu quase tudo = 90%. Fez metade das refeições = 50%.<br><br>Serve para saber se o resultado (ou a falta dele) vem do plano ou do dia a dia."],
 cintura:["Por que medir a cintura?","O peso sozinho não mostra se você ganhou músculo ou gordura. Se o peso sobe e a cintura quase não muda, é ótimo sinal.<br><br>Meça sempre no mesmo lugar (na altura do umbigo), de manhã, antes de comer."],
 dkcal:["Calorias que você comeu","Anote o total de calorias que você <b>realmente comeu</b> nesse dia — não a meta.<br><br>Seguiu o plano? Toque em <b>Usar valores do meu plano</b>. Comeu diferente? Ajuste o número (uma estimativa já basta).<br><br>Na tela <b>Progresso</b>, o app faz a média da semana e mostra ao lado do peso. Assim você descobre se não está ganhando peso porque está comendo menos que a meta, ou se ganhou rápido demais porque comeu além."],
 dprot:["Proteína que você comeu","Anote quantos gramas de proteína você <b>realmente comeu</b> nesse dia.<br><br>A proteína é o que mais importa para ganhar músculo. Com a média semanal em <b>Progresso</b>, você vê se está chegando perto da sua meta de proteína ou ficando abaixo dela.<br><br>Campo opcional: se não souber, deixe em branco."],
 ritmo:["Ganho esperado por semana","Para iniciantes, ganhar de 0,25% a 0,5% do peso por semana costuma significar mais músculo e pouca gordura. Ganhou mais rápido que isso? Observe a cintura. Não ganhou nada em 2 a 3 semanas? Aumente 100 a 150 kcal por dia."]
};
const helpBtn=(k)=>`<button type="button" class="help" onclick="App.help('${k}',this)" aria-label="Saiba mais: ${esc(GLOSS[k][0])}">?</button>`;
const SEXOS=[["Masculino","Homem"],["Feminino","Mulher"]];
const actInfo=(k)=>(D.ACT_INFO&&D.ACT_INFO[k])||{label:k,desc:""};
const goalInfo=(k)=>(D.GOAL_INFO&&D.GOAL_INFO[k])||{label:k,desc:""};
/* lista de opções em cartões (radio) com título e explicação */
function optCards(group,items,val,action){
  return `<div class="opts" role="radiogroup" aria-label="${esc(group)}">${items.map((it,i)=>{ const on=it.v===val;
    return `<button type="button" role="radio" aria-checked="${on}" class="opt${on?" on":""}" onclick="${action}(${i})"><span class="ot">${esc(it.label)}${it.tag?` <span class="pill p-ok">${esc(it.tag)}</span>`:""}</span>${it.desc?`<span class="od">${esc(it.desc)}</span>`:""}</button>`; }).join("")}</div>`; }
const actItems=()=>D.ACTS.map(a=>({v:a[0],...actInfo(a[0])}));
const goalItems=()=>D.GOALS.map(g=>({v:g[0],...goalInfo(g[0])}));
const sexItems=()=>SEXOS.map(s=>({v:s[0],label:s[1]}));
const labelHelp=(text,k)=>`<div class="lblrow"><label class="f">${text}</label>${helpBtn(k)}</div>`;
/* frase explicando a meta de calorias */
function kcalExplica(pf){ if(!pf) return "";
  const extra=Math.round(pf.alvo)-Math.round(pf.get);
  return extra>1?`Seu corpo gasta cerca de <b>${fi(pf.get)} kcal</b> por dia. Comendo <b>${fi(extra)} kcal a mais</b>, ele tem energia extra para construir músculo.`
    :`Seu corpo gasta cerca de <b>${fi(pf.get)} kcal</b> por dia. Comendo isso, seu peso tende a se manter.`; }

/* ---------- backup: lembrete, envio em 1 toque e armazenamento persistente ---------- */
const backupJSON=()=>JSON.stringify({...S,app:"FORTIS",exportadoEm:new Date().toISOString(),versaoApp:VERSION},null,1);
const quandoFoi=(dias)=>dias==null?"":dias<=0?"hoje":dias===1?"ontem":`há ${dias} dias`;
function pedirPersistencia(){ try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persisted().then(p=>{ if(!p) navigator.storage.persist(); }).catch(()=>{}); }catch(e){} }
function marcarBackup(){ S.meta.lastBackup=new Date().toISOString(); S.meta.editsSinceBackup=0; S.meta.snoozeUntil=null; save(); pedirPersistencia(); }
const contarEdicao=()=>{ S.meta.editsSinceBackup=(S.meta.editsSinceBackup||0)+1; };
function avisoBackup(){ const b=C.backupStatus(S); if(!b.due) return "";
  const msg=b.reason==="never"?"Seus dados ficam <b>só neste celular</b>. Se você trocar, perder ou formatar o aparelho sem backup, perde todo o histórico. Leva 30 segundos."
    :b.reason==="old"?`Seu último backup foi <b>${quandoFoi(b.days)}</b>. Faça um novo para guardar seus registros recentes.`
    :`Você fez <b>${b.edits} registros</b> desde o último backup. Faça um novo para não perdê-los.`;
  return `<div class="card backupcard" role="region" aria-label="Lembrete de backup"><h2>💾 Proteja seus dados</h2><p class="small" style="margin:0">${msg}</p>
   <div class="rowbtns"><button class="btn btn-ghost btn-sm" onclick="App.snoozeBackup()">Agora não</button><button class="btn btn-gold btn-sm" onclick="App.shareBackup()">Fazer backup</button></div></div>`; }

/* ================= VIEWS ================= */
function proximosPassos(){ const hoje=todayISO();
  const passos=[
    [!!calcPerfil(),"Complete seu perfil","Para calcular quanto você deve comer","App.go('perfil')"],
    [S.plan.length>0,"Monte seu plano alimentar","Escolha o que comer em cada refeição","App.goSeg('plano','plano')"],
    [S.diary.some(r=>r.data===hoje),"Registre seu peso de hoje","Pese-se de manhã, antes de comer","App.mDiary()"]
  ];
  if(passos.every(p=>p[0])) return "";
  return `<div class="card"><h2>Seus próximos passos</h2>${passos.map((p,i)=>`<button class="menurow step${p[0]?" done":""}" onclick="${p[3]}"><span class="ic stepn" aria-hidden="true">${p[0]?"✓":i+1}</span><span style="flex:1">${p[1]}${p[0]?' <span class="sr">(feito)</span>':""}<small>${p[2]}</small></span><span class="chev" aria-hidden="true">›</span></button>`).join("")}</div>`;
}
function vInicio(){ const pf=calcPerfil(),mc=calcMacros();
  const first=S.profile.nome?esc(S.profile.nome.split(" ")[0]):"Guerreiro";
  let h=`<div class="card gold"><div class="muted">${saudacao()},</div><h2 style="font-size:20px;margin:2px 0 6px">${first} 🛡️</h2><div class="brushbar"></div>`;
  if(!pf){ h+=`<p class="small">Complete seu perfil e o app calcula <b>quanto você deve comer por dia</b> para ganhar massa.</p><button class="btn btn-gold" onclick="App.go('perfil')">Montar meu perfil</button>`; }
  else{ const pa=pesoAtual();
    h+=`<div class="kpis"><div class="kpi big"><div class="l">Coma por dia ${helpBtn("kcal")}</div><div class="v">${fi(mc?mc.alvo:pf.alvo)} <em>kcal</em></div><div class="sub">${kcalExplica(pf)}</div></div>
    <div class="kpi"><div class="l">Proteína</div><div class="v">${mc?fi(mc.protG):"—"} <em>g/dia</em></div></div>
    <div class="kpi"><div class="l">Carboidratos</div><div class="v">${mc?fi(mc.carbsG):"—"} <em>g/dia</em></div>${mc&&mc.insuficiente?`<div class="sub"><a href="#" class="lnk" onclick="App.go('macros');return false">⚠ revise os macros</a></div>`:""}</div>
    <div class="kpi"><div class="l">Gorduras</div><div class="v">${mc?fi(mc.gordG):"—"} <em>g/dia</em></div></div>
    <div class="kpi"><div class="l">Peso atual</div><div class="v">${pa!=null?f1(pa)+" <em>kg</em>":"—"}</div></div></div>
    <p class="small muted" style="margin:8px 0 0">O que é proteína, carboidrato e gordura? ${helpBtn("macros")}</p>`;
    let cw=null; S.diary.forEach(r=>{ const w=weekOf(r.data); if(w!=null&&(cw==null||w>cw)) cw=w; });
    if(cw){ const rows=S.diary.filter(r=>weekOf(r.data)===cw);
      const ad=rows.map(r=>num(r.aderencia)).filter(x=>x!=null);
      const tr=rows.filter(r=>r.treinou==="Sim").length;
      h+=`<div class="hr"></div><div class="grid2"><div class="kpi"><div class="l">Treinos na semana ${cw}</div><div class="v">${tr}</div></div><div class="kpi"><div class="l">Seguiu o plano</div><div class="v">${ad.length?fi(ad.reduce((a,b)=>a+b,0)/ad.length)+" <em>%</em>":"—"}</div></div></div>`;
    }
    h+=`<div class="rowbtns" style="margin-top:12px"><button class="btn btn-gold" onclick="App.mDiary()">Registrar hoje</button></div>`;
  }
  h+=`</div>`;
  h+=avisoBackup();
  h+=proximosPassos();
  h+=`<div class="card"><h2>Atalhos</h2>${menuRow("perfil","Perfil e metas","Seus dados e quanto comer por dia","👤")}${menuRow("macros","Proteína, carbo e gordura","Quantos gramas de cada por dia","🥩")}</div>`;
  const segRow=(seg,label,sub,ic)=>`<button class="menurow" onclick="App.goSeg('plano','${seg}')"><span class="ic" aria-hidden="true">${ic}</span><span style="flex:1">${label}<small>${sub}</small></span><span class="chev" aria-hidden="true">›</span></button>`;
  h+=`<div class="card"><h2>Alimentação</h2>${segRow("plano","Meu plano","Monte as refeições do dia","🍽️")}${segRow("estruturas","Cardápios-modelo","Exemplos de 2.200 • 2.800 • 3.400 kcal","🏛️")}${segRow("alimentos","Banco de alimentos",`${BASE.length} alimentos + seus itens`,"🔍")}</div>`;
  h+=`<div class="card"><h2>Rotina</h2>${menuRow("compras","Lista de compras","Mercado e organização","🛒")}${menuRow("suple","Suplementação","Referências educacionais","💊")}</div>`;
  h+=`<footer class="appfoot"><b>FORTIS</b> • Disciplina, constância e fortaleza</footer>`;
  return h;
}

function selOpts(list,val){ return `<option value="">— Selecionar —</option>`+list.map(o=>{ const v=Array.isArray(o)?o[0]:o; return `<option value="${esc(v)}"${v===val?" selected":""}>${esc(v)}</option>`; }).join(""); }
function vPerfil(){ const p=S.profile;
  return `<div class="card"><h2>Seus dados</h2>
   <label class="f">Nome</label><input id="pf_nome" value="${esc(p.nome)}" placeholder="Seu nome" autocomplete="given-name" maxlength="80" onchange="App.pfSave()">
   <div class="f">Sexo</div>${optCards("Sexo",sexItems(),p.sexo,"App.pfPick_sexo").replace('class="opts"','class="opts two"')}
   <div class="grid3"><div><label class="f">Idade</label><input id="pf_idade" oninput="App.pfSave()" type="number" inputmode="numeric" min="10" max="100" value="${esc(p.idade)}" placeholder="anos" onchange="App.pfSave()"></div>
   <div><label class="f">Peso (kg)</label><input id="pf_peso" oninput="App.pfSave()" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${esc(p.peso)}" placeholder="kg" onchange="App.pfSave()"></div>
   <div><label class="f">Altura (cm)</label><input id="pf_altura" oninput="App.pfSave()" type="number" inputmode="numeric" min="100" max="250" value="${esc(p.altura)}" placeholder="cm" onchange="App.pfSave()"></div></div></div>
   <div class="card"><h2>Quanto você se movimenta?</h2>${optCards("Nível de atividade",actItems(),p.atividade,"App.pfPick_atividade")}</div>
   <div class="card"><h2>Qual é o seu objetivo? ${helpBtn("superavit")}</h2>${optCards("Objetivo",goalItems(),p.objetivo,"App.pfPick_objetivo")}</div>
   <div id="pfResult" aria-live="polite">${vPerfilResult()}</div>`;
}
function resultKpis(pf){ return `<div class="kpis">
    <div class="kpi big"><div class="l">Coma por dia ${helpBtn("kcal")}</div><div class="v">${fi(pf.alvo)} <em>kcal</em></div><div class="sub">${kcalExplica(pf)}</div></div>
    <div class="kpi"><div class="l">Gasto em repouso ${helpBtn("tmb")}</div><div class="v">${fi(pf.tmb)} <em>kcal</em></div></div>
    <div class="kpi"><div class="l">Gasto total do dia ${helpBtn("get")}</div><div class="v">${fi(pf.get)} <em>kcal</em></div></div></div>
    ${pf.ajuste>0?`<p class="small" style="margin:10px 0 0">📈 Ganho de referência: <b>${fi(pf.ritmoMin)} a ${fi(pf.ritmoMax)} g por semana</b> ${helpBtn("ritmo")}</p>`:""}`; }
function vPerfilResult(){ const pf=calcPerfil();
  if(!pf){ const errs=C.perfilErros(S.profile,D.ACTS,D.GOALS).map(e=>e.msg);
    return `<div class="card"><span class="pill p-warn">⚠ Confira: ${esc(errs.join(", "))}</span></div>`; }
  const pa=pesoAtual(), novoPeso=pa!=null&&Math.abs(pa-pf.peso)>=1;
  return `<div class="card gold"><h2>Seu resultado</h2>${resultKpis(pf)}
    ${novoPeso?`<div class="goldbox small" style="margin-top:10px">⚖️ Seu último peso no diário é <b>${f1(pa)} kg</b>, mas as metas usam <b>${f1(pf.peso)} kg</b>. <button type="button" class="linkbtn" onclick="App.pfUsePeso()">Usar ${f1(pa)} kg no cálculo</button></div>`:""}
    <p class="small" style="margin:10px 0 0"><span class="pill p-ok">✓ Perfil completo!</span> <a href="#" onclick="App.go('macros');return false" class="lnk">Ver proteína, carboidratos e gordura ›</a></p></div>`;
}

function vMacros(){ const pf=calcPerfil();
  if(!pf) return `<div class="card"><span class="pill p-warn">⚠ Preencha o Perfil primeiro</span><div class="rowbtns"><button class="btn btn-gold" onclick="App.go('perfil')">Ir para o perfil</button></div></div>`;
  return `<div id="mcResult" aria-live="polite">${vMacrosResult()}</div>
   <div class="card"><h2>Ajuste fino (opcional) ${helpBtn("gkg")}</h2><p class="small muted">Gramas por quilo do seu peso. Se não tiver certeza, deixe proteína <b>2,0</b> e gordura <b>1,0</b>. O carboidrato é calculado com as calorias que sobram.</p><div class="grid2">
   <div><label class="f">Proteína (g/kg, 1,6 a 2,2)</label><input id="mc_p" type="number" inputmode="decimal" step="0.1" min="0" max="5" placeholder="2,0" value="${esc(S.macros.protKg)}" onchange="App.mcSave()"></div>
   <div><label class="f">Gordura (g/kg, ≈1,0)</label><input id="mc_g" type="number" inputmode="decimal" step="0.1" min="0" max="5" placeholder="1,0" value="${esc(S.macros.gordKg)}" onchange="App.mcSave()"></div></div></div>`;
}
function vMacrosResult(){ const mc=calcMacros(); if(!mc) return "";
  const row=(l,v,u)=>`<div class="kpi"><div class="l">${l}</div><div class="v">${v}${u?` <em>${u}</em>`:""}</div></div>`;
  let h=`<div class="card gold"><h2>Quanto comer por dia ${helpBtn("macros")}</h2><div class="kpis">
   ${row("🥩 Proteína",fi(mc.protG),"g")}${row("🍚 Carboidratos",fi(Math.max(0,mc.carbsG)),"g")}${row("🥑 Gordura",fi(mc.gordG),"g")}${row(`🥦 Fibras ${helpBtn("fibra")}`,fi(mc.fibra),"g")}</div>
   <p class="small">🍽️ Em cada refeição, procure comer <b>${fi(mc.protMin)} a ${fi(mc.protMax)} g de proteína</b>.</p>
   <p class="small">Proteína: ${mc.alertaP==="ok"?'<span class="pill p-ok">Na faixa recomendada</span>':mc.alertaP==="low"?'<span class="pill p-warn">Abaixo do recomendado</span>':'<span class="pill p-bad">Acima do recomendado</span>'}
   • Gordura: ${mc.alertaG==="ok"?'<span class="pill p-ok">Adequada</span>':mc.alertaG==="high"?'<span class="pill p-warn">Alta: acima de 35% das calorias</span>':'<span class="pill p-bad">Baixa: avalie com um profissional</span>'}</p>
   ${mc.insuficiente?'<div class="warnbox">⚠ As calorias não são suficientes para essa quantidade de proteína e gordura. Diminua os valores do ajuste fino.</div>':""}</div>`;
  h+=`<div class="card"><h2>De onde vêm suas calorias</h2>${pieSVG([{label:"Proteína",v:mc.kP,color:"#C99A2E"},{label:"Gordura",v:mc.kG,color:"#4CAF50"},{label:"Carboidratos",v:mc.carbsG*4,color:"#5C6BC0"}])}
   <div class="legend"><span><i style="background:#C99A2E"></i>Proteína ${pct(mc.pctP)}</span><span><i style="background:#4CAF50"></i>Gordura ${pct(mc.pctG)}</span><span><i style="background:#5C6BC0"></i>Carboidratos ${pct(mc.pctC)}</span></div></div>`;
  return h;
}

/* ----- plano ----- */
function segBar(label,segs,cur,fn){ return `<div class="seg" role="group" aria-label="${esc(label)}">${segs.map(s=>`<button class="${s[0]===cur?"on":""}" aria-pressed="${s[0]===cur}" onclick="${fn}('${s[0]}')">${s[1]}</button>`).join("")}</div>`; }
function vPlano(){ return segBar("Seções do plano",[["plano","Meu plano"],["estruturas","Modelos"],["alimentos","Alimentos"]],ui.segPlano,"App.segPlano")
  + (ui.segPlano==="plano"?vPlanoDia():ui.segPlano==="estruturas"?vEstruturas():vAlimentos()); }
function vPlanoDia(){ const t=planTotals(),pf=calcPerfil(),mc=calcMacros();
  const metas=[["Kcal",t.k,pf?pf.alvo:null],["Proteína (g)",t.p,mc?mc.protG:null],["Carboidratos (g)",t.c,mc?mc.carbsG:null],["Gorduras (g)",t.g,mc?mc.gordG:null],["Fibras (g)",t.f,mc?mc.fibra:null]];
  let h=`<div class="card gold"><h2>Resumo do dia</h2><div class="tblwrap"><table><tr><th scope="col"><span class="sr">Item</span></th><th scope="col">Real</th><th scope="col">Meta</th><th scope="col">Status</th></tr>`;
  metas.forEach(m=>{ const st=m[0].startsWith("Fibras")&&m[2]>0&&m[1]>=m[2]?["Meta atingida","p-ok"]:C.statusOf(m[1],m[2]); h+=`<tr><td class="l">${m[0]}</td><td>${fi(m[1])}</td><td>${m[2]==null?"—":fi(m[2])}</td><td>${st[0]?`<span class="pill ${st[1]}">${st[0]}</span>`:"—"}</td></tr>`; });
  h+=`</table></div><p class="muted small">“Dentro de ±5%” = você está perto da meta. Pese os alimentos e não esqueça azeite, molhos e pastas.</p></div>`;
  h+=`<button class="btn btn-gold" onclick="App.mPlanItem()">＋ Adicionar alimento</button><div style="height:10px"></div>`;
  const m=foodMap();
  const meals=[...D.MEALS8,...new Set(S.plan.map(it=>it.m).filter(x=>!D.MEALS8.includes(x)))];
  meals.forEach(meal=>{ const idxs=[]; S.plan.forEach((it,i)=>{ if(it.m===meal) idxs.push(i); });
    if(!idxs.length) return; const s=mealSub(meal);
    h+=`<div class="mealhead"><b>${esc(meal||"Sem refeição")}</b><span>${fi(s.k)} kcal • P ${fi(s.p)}g</span></div>`;
    idxs.forEach(i=>{ const it=S.plan[i],f=m[it.f]; const q=num(it.q)||0;
      h+=`<div class="item"><div class="grow"><div class="t">${esc(it.f)}</div><div class="s">${it.u?`<b class="qtxt">${qtyText(it)}</b><br>`:""}${f?`${fi(f.k*q/100)} kcal • P ${f1(f.p*q/100)} • C ${f1(f.c*q/100)} • G ${f1(f.f*q/100)}`:'<span class="pill p-warn">Alimento não encontrado no banco</span>'}</div></div>
      ${it.u?`<input id="pq${i}" type="number" inputmode="decimal" min="0" step="any" value="${esc(it.n)}" onchange="App.planCount(${i},this.value)" aria-label="Quantidade (${esc(it.u)}) de ${esc(it.f)}"><span class="unit" aria-hidden="true">${esc(it.u)}</span>`
        :`<input id="pq${i}" type="number" inputmode="numeric" min="0" step="1" value="${esc(it.q)}" onchange="App.planQty(${i},this.value)" aria-label="Gramas de ${esc(it.f)}"><span class="unit" aria-hidden="true">g</span>`}
      <button class="iconbtn danger" onclick="App.planDel(${i})" aria-label="Remover ${esc(it.f)}">🗑</button></div>`; });
  });
  if(!S.plan.length) h+=`<div class="card"><p class="muted">Nenhum item ainda. Toque em <b>＋ Adicionar alimento</b> e monte seu dia.</p></div>`;
  else h+=`<div class="rowbtns"><button class="btn btn-ghost btn-sm" onclick="App.planClear()">Limpar plano</button></div>`;
  return h;
}
function vEstruturas(){ const i=ui.segEstr, st=D.STRUCTS[i], m=foodMap(), sels=S.estr[i]||[];
  let h=`<div class="goldbox" style="margin-bottom:10px"><b>🏛️ Cardápios-modelo</b> — mostram como dividir as refeições em cada faixa de calorias. Escolha o alimento e a quantidade de cada item para ver o total.</div>`;
  h+=segBar("Estrutura",[["0","≈2.200"],["1","≈2.800"],["2","≈3.400"]],String(i),"App.segEstr");
  let lastMeal="";
  st.rows.forEach((r,j)=>{ const sel=sels[j]||{f:"",q:""}; const unknown=sel.f&&!m[sel.f];
    if(r[0]!==lastMeal){ lastMeal=r[0]; h+=`<div class="mealhead"><b>${esc(r[0])}</b><span></span></div>`; }
    h+=`<div class="item"><div class="grow"><div class="s">${esc(r[1])}${unknown?' <span class="pill p-warn">não encontrado</span>':""}</div><input id="ef${j}" data-foodac autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" value="${esc(sel.f)}" placeholder="Escolher alimento…" aria-label="Alimento para ${esc(r[0]+" — "+r[1])}" onchange="App.estrFood(${i},${j},this.value)" style="margin-top:4px"></div><input id="eq${j}" type="number" inputmode="numeric" min="0" step="1" value="${esc(sel.q)}" aria-label="Gramas" onchange="App.estrQty(${i},${j},this.value)"><span class="muted small" aria-hidden="true">g</span></div>`;
  });
  const t=C.sumItems(sels.slice(0,st.rows.length),m), diff=t.k-st.kcal;
  h+=`<div class="card gold" id="estrTotal"><h2>Total do cardápio</h2><div class="kpis"><div class="kpi big"><div class="l">Total</div><div class="v">${fi(t.k)} <em>kcal</em></div></div>
   <div class="kpi"><div class="l">Proteína</div><div class="v">${fi(t.p)} <em>g</em></div></div><div class="kpi"><div class="l">Carbos</div><div class="v">${fi(t.c)} <em>g</em></div></div></div>
   <p class="small">Diferença vs alvo: <b>${diff>=0?"+":""}${fi(diff)} kcal</b> (alvo aprox. ${st.kcal.toLocaleString("pt-BR")} kcal)</p>
   <p class="muted small">Os valores finais dependem das quantidades, marcas e preparo. Não constitui prescrição individual.</p></div>`;
  return h;
}
function foodListHTML(){ const q=ui.foodQ.trim().toLowerCase(), cat=ui.foodCat;
  const all=[...BASE.map(f=>({n:f[0],k:f[1],p:f[2],c:f[3],f:f[4],fib:f[5],e:f[6],src:f[7],v:f[8],cat:f[9],custom:false})),
    ...S.customFoods.map((f,ix)=>({...f,custom:true,ix}))];
  const inCat=f=>!cat||(cat==="meus"?f.custom:cat==="fortis"?!f.custom&&!f.cat:f.cat===cat);
  const toks=norm(q).split(/\s+/).filter(Boolean), list=all.filter(f=>inCat(f)&&toks.every(t=>norm(f.n).includes(t)));
  let h=""; list.slice(0,150).forEach(f=>{ h+=`<div class="item"><div class="grow"><div class="t">${esc(f.n)} ${f.v==="WARN"?'<span class="pill p-warn">conferir</span>':""} ${f.custom?'<span class="pill p-info">meu</span>':""}</div>
    <div class="s">${fi(f.k)} kcal • P ${f1(f.p)} • C ${f1(f.c)} • G ${f1(f.f)} • Fib ${f1(f.fib)} • ${esc(f.e)}${f.custom?"":" • "+esc(f.src)}${f.cat?" • "+esc(f.cat):""}${(()=>{ const u=C.measuresOf(f.n,f,D.UNITS).find(x=>x.label!=="ml"); return u?`<br>📏 1 ${esc(u.label)} ≈ ${fmtN(u.g)} g`:""; })()}</div></div>
    ${f.custom?`<button class="iconbtn" onclick="App.mFood(${f.ix})" aria-label="Editar ${esc(f.n)}">✎</button><button class="iconbtn danger" onclick="App.foodDel(${f.ix})" aria-label="Excluir ${esc(f.n)}">🗑</button>`:""}</div>`; });
  if(!list.length) h=`<div class="card"><p class="muted">Nenhum alimento encontrado. Cadastre o seu!</p></div>`;
  if(list.length>150) h+=`<p class="muted small">Mostrando 150 de ${list.length}. Busque pelo nome ou escolha uma categoria para ver os demais.</p>`;
  return {html:h,count:`${list.length} de ${all.length} alimentos • Valores aproximados. Confira o rótulo.`};
}
function vAlimentos(){ const r=foodListHTML();
  return `<div class="card"><h2>Banco de alimentos (por 100 g)</h2>
   <input id="foodSearch" type="search" placeholder="🔍 Buscar alimento…" aria-label="Buscar alimento" value="${esc(ui.foodQ)}" oninput="App.foodQ(this.value)">
   <select id="foodCat" aria-label="Categoria" onchange="App.foodCat(this.value)" style="margin-top:8px">${[["","Todas as categorias"],["fortis","Básicos do FORTIS (com medidas caseiras)"],["meus","Meus alimentos"],...TACO_CATS.map(c=>[c,"TACO — "+c])].map(o=>`<option value="${esc(o[0])}"${o[0]===ui.foodCat?" selected":""}>${esc(o[1])}</option>`).join("")}</select>
   <p class="muted small" id="foodCount" aria-live="polite">${r.count}</p>
   <button class="btn btn-ghost btn-sm" onclick="App.mFood()">＋ Cadastrar alimento</button></div><div id="foodlist">${r.html}</div>`;
}

/* ----- diário ----- */
function vDiario(){ return segBar("Seções do diário",[["registro","Registro"],["treino","Treino"]],ui.segDiario,"App.segDiario")
  +(ui.segDiario==="registro"?vRegistro():vTreino()); }
function vRegistro(){ const rows=diarySorted().reverse();
  let h=`<button class="btn btn-gold" onclick="App.mDiary()">＋ Registrar dia</button><div style="height:10px"></div>`;
  if(!rows.length) h+=`<div class="card"><p class="muted">Nenhum registro. Toque acima para lançar peso, cintura, calorias, proteína, sono, treino e aderência.</p></div>`;
  const kv=(l,val)=>`<div class="kpi"><div class="l">${l}</div><div class="v" style="font-size:17px">${val}</div></div>`;
  rows.forEach(r=>{ const w=weekOf(r.data),ad=num(r.aderencia);
    const fmt=(v,f,u)=>num(v)==null?"—":f(num(v))+(u?` <em>${u}</em>`:"");
    h+=`<div class="card" style="padding:12px"><div style="display:flex;justify-content:space-between;align-items:center"><b>${dataBR(r.data)}</b><span class="pill p-info">Semana ${w==null?"—":w}</span></div>
    <div class="grid3" style="margin-top:8px">${kv("Peso",fmt(r.peso,f1,"kg"))}${kv("Cintura",fmt(r.cintura,f1,"cm"))}${kv("Sono",fmt(r.sono,f1,"h"))}</div>
    <div class="grid3" style="margin-top:8px">${kv("Kcal",fmt(r.kcal,fi))}${kv("Proteína",fmt(r.prot,fi,"g"))}${kv("Treino",r.treinou==="Sim"?'<span aria-label="Sim">✅</span>':r.treinou==="Não"?'<span aria-label="Não">⬜</span>':"—")}</div>
    ${ad!=null?`<div class="small" style="margin-top:8px">Seguiu o plano: ${fi(ad)}%</div><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(ad)}"><i style="width:${Math.min(100,Math.max(0,ad))}%"></i></div>`:""}
    <div class="rowbtns"><button class="btn btn-ghost btn-sm" onclick="App.mDiary('${r.id}')">Editar</button><button class="btn btn-danger btn-sm" onclick="App.diaryDel('${r.id}')">Excluir</button></div></div>`;
  });
  return h;
}
function vTreino(){ let h=`<div class="card"><h2>Séries por grupo (soma)</h2><div class="tblwrap"><table><tr><th scope="col">Grupo</th><th scope="col">Séries</th><th scope="col">Referência</th></tr>`;
  D.GROUPS.forEach(g=>{ const v=C.seriesByGroup(S.treino,g),b=C.groupBadge(v); h+=`<tr><td class="l">${g}</td><td><b>${v}</b></td><td><span class="pill ${b[1]}">${b[0]}</span></td></tr>`; });
  h+=`</table></div><p class="muted small">Ebook: iniciante 6–10 séries/semana por grupo • intermediário 10–16. A soma considera todos os treinos registrados.</p></div>`;
  h+=`<button class="btn btn-gold" onclick="App.mTreino()">＋ Registrar treino</button><div style="height:10px"></div>`;
  const rows=[...S.treino].sort((a,b)=>a.data<b.data?1:a.data>b.data?-1:0);
  if(!rows.length) h+=`<div class="card"><p class="muted">Nenhum treino registrado.</p></div>`;
  rows.forEach(t=>{ const nome=t.exercicio||"Treino";
    h+=`<div class="item"><div class="grow"><div class="t">${esc(nome)} ${t.grupo?`<span class="pill p-info">${esc(t.grupo)}</span>`:""}</div>
    <div class="s">${dataBR(t.data)} • ${esc(t.series||"—")} séries • ${esc(t.reps||"—")} reps • ${esc(t.carga||"—")} kg${t.obs?" • "+esc(t.obs):""}</div></div>
    <button class="iconbtn" onclick="App.mTreino('${t.id}')" aria-label="Editar ${esc(nome)}">✎</button><button class="iconbtn danger" onclick="App.treinoDel('${t.id}')" aria-label="Excluir ${esc(nome)}">🗑</button></div>`; });
  return h;
}

/* ----- progresso ----- */
/* valor médio da semana com selo de status vs. meta (mesmos critérios do plano: ±5%) */
function vsMeta(v,meta,fmt){ if(v==null) return "—"; const st=C.statusOf(v,meta);
  return st[0]?`${fmt(v)}<br><span class="pill ${st[1]} pill-xs">${st[0]==="Dentro de ±5%"?"ok":st[0].toLowerCase()}</span>`:fmt(v); }
function vProgresso(){ const pf=calcPerfil(), mc=calcMacros();
  const pd=C.progressData(S.diary,{hoje:todayISO(),objetivo:S.profile.objetivo}); const withN=pd.filter(w=>w.n>0);
  const mK=pf?pf.alvo:null, mP=mc?mc.protG:null;
  let h=`<div class="goldbox"><b>📊 Médias semanais</b> calculadas do seu Registro. Analise tendências de 2–3 semanas — oscilações diárias não representam necessariamente ganho ou perda de tecido.</div><div style="height:10px"></div>`;
  if(!withN.length) return h+`<div class="card"><p class="muted">Registre dias na aba Diário para ver seu progresso aqui.</p></div>`;
  const ult=withN[withN.length-1];
  if(ult.incompleta) h+=`<div class="card"><p class="small" style="margin:0">⏳ <b>Semana ${ult.w} em andamento</b> — ${ult.nPeso} ${ult.nPeso===1?"pesagem":"pesagens"} até agora. A variação e a leitura aparecem com ${C.MIN_PESAGENS} ou mais pesagens, para um dia isolado não distorcer a média.</p></div>`;
  h+=`<div class="card"><h2>Tabela semanal</h2>${mK!=null||mP!=null?`<p class="small" style="margin:0 0 8px">Sua meta: <b>${mK==null?"—":fi(mK)} kcal</b> • <b>${mP==null?"—":fi(mP)} g</b> de proteína por dia</p>`:""}
   <div class="tblwrap"><table><tr><th scope="col">Sem</th><th scope="col">Peso</th><th scope="col">Var</th><th scope="col">Kcal</th><th scope="col">Prot</th><th scope="col">Cint</th><th scope="col">Tr</th><th scope="col">Plano</th><th scope="col">Sono</th></tr>`;
  withN.forEach(w=>{ h+=`<tr><td><b>${w.w}</b></td><td>${w.peso==null?"—":f1(w.peso)}</td><td>${w.incompleta?'<span class="muted" title="Semana em andamento">⏳</span>':w.var==null?"—":(w.var>0?"+":"")+pct(w.var,1)}</td><td>${vsMeta(w.kcal,mK,fi)}</td><td>${vsMeta(w.prot,mP,fi)}</td><td>${w.cint==null?"—":f1(w.cint)}</td><td>${w.treinos}</td><td>${w.ader==null?"—":fi(w.ader)+"%"}</td><td>${w.sono==null?"—":f1(w.sono)}</td></tr>`; });
  h+=`</table></div><p class="muted small">Var = variação média semanal do peso vs. a semana anterior com pesagem (referência para ganho de massa: +0,25% a +0,5%). Kcal e Prot = média do que você anotou, comparada com a meta (ok = dentro de ±5%). Tr = treinos. Arraste a tabela para o lado para ver todas as colunas.</p></div>`;
  const wk=withN.map(w=>w.w);
  h+=`<div class="card"><h2>Peso médio (kg)</h2>${lineSVG("Peso médio (kg)",wk,withN.map(w=>w.peso),"#C99A2E",1)}</div>`;
  h+=`<div class="card"><h2>Calorias médias × meta</h2>${lineSVG("Calorias médias por dia",wk,withN.map(w=>w.kcal),"#E05353",0,mK)}</div>`;
  h+=`<div class="card"><h2>Proteína média × meta (g)</h2>${lineSVG("Proteína média por dia (g)",wk,withN.map(w=>w.prot),"#4FC3F7",0,mP)}</div>`;
  h+=`<div class="card"><h2>Cintura média (cm)</h2>${lineSVG("Cintura média (cm)",wk,withN.map(w=>w.cint),"#4CAF50",1)}</div>`;
  h+=`<div class="card"><h2>Seguiu o plano — média (%)</h2>${lineSVG("Seguiu o plano — média (%)",wk,withN.map(w=>w.ader),"#5C6BC0",0)}</div>`;
  h+=`<div class="card"><h2>Sono médio (h)</h2>${lineSVG("Sono médio (h)",wk,withN.map(w=>w.sono),"#E8BE4E",1)}</div>`;
  const leituras=withN.filter(w=>w.leitura);
  h+=`<div class="card"><h2>Leituras</h2>`;
  if(!leituras.length) h+=`<p class="muted small">As leituras aparecem a partir da segunda semana com pesagem.</p>`;
  leituras.forEach(w=>{ h+=`<p class="small"><b>Semana ${w.w}:</b> ${esc(w.leitura)}</p>`; });
  return h+`</div>`;
}

/* ----- mais ----- */
function vMais(){
  return `<div class="card"><h2>Ajustes e conteúdo</h2>${menuRow("perfil","Perfil e metas","Seus dados e calorias-alvo","👤")}${menuRow("macros","Macronutrientes","Metas de proteína, gordura e carbos","🥩")}${menuRow("compras","Lista de compras","Mercado e organização","🛒")}${menuRow("suple","Suplementação","Referências educacionais","💊")}${menuRow("sobre","Sobre o método","Como usar + avisos","🛡️")}${menuRow("backup","Backup e dados",S.meta.lastBackup?`Último backup: ${quandoFoi(C.backupStatus(S).days)}`:"⚠ Nenhum backup ainda","💾")}</div>
  <div class="card"><h2>Instalar o app</h2><p class="small muted">No Android (Chrome): menu ⋮ → <b>Instalar app / Adicionar à tela inicial</b>. No iPhone: <b>Compartilhar → Adicionar à Tela de Início</b>. Depois funciona offline.</p><div class="rowbtns"><button class="btn btn-ghost btn-sm" id="btnInstall" style="display:none" onclick="App.install()">📲 Instalar agora</button><a class="btn btn-ghost btn-sm" href="instalar.html">🔗 Página de instalação (QR)</a></div></div>
  <footer class="appfoot"><b>FORTIS</b> v${VERSION} • Disciplina, constância e fortaleza</footer>`;
}
function shopFlat(){ const items=[];
  D.SHOPPING.forEach(s=>{ const st=S.shop[s[1]]||{}; items.push({cat:s[0],n:s[1],custom:false,...st}); });
  S.shopCustom.forEach((c,ix)=>items.push({...c,custom:true,ix}));
  return items;
}
function vCompras(){ const items=shopFlat(); const done=items.filter(i=>i.marcado).length;
  let h=`<div class="card gold"><h2>${done} de ${items.length} itens comprados</h2><div class="bar" role="progressbar" aria-label="Itens comprados" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${done}"><i style="width:${items.length?done/items.length*100:0}%"></i></div>
  <div class="rowbtns"><button id="btnShopAdd" class="btn btn-ghost btn-sm" onclick="App.mShopItem()">＋ Adicionar item</button><button class="btn btn-ghost btn-sm" onclick="App.shopReset()">Desmarcar todos</button></div></div>`;
  const cats=[...D.SHOP_CATS,...new Set(S.shopCustom.map(c=>c.cat).filter(c=>!D.SHOP_CATS.includes(c)))];
  cats.forEach(cat=>{ const rows=items.map((it,ix)=>({it,ix})).filter(x=>x.it.cat===cat); if(!rows.length) return;
    h+=`<div class="mealhead"><b>${esc(cat||"Outros")}</b><span>${rows.filter(x=>x.it.marcado).length}/${rows.length}</span></div>`;
    rows.forEach(({it,ix})=>{ h+=`<div class="item${it.marcado?" done":""}"><button id="shk_${ix}" class="shopcheck${it.marcado?" on":""}" role="checkbox" aria-checked="${!!it.marcado}" aria-label="${esc(it.n)}" onclick="App.shopToggle(${ix})">✔</button>
     <div class="grow"><div class="t">${esc(it.n)}</div></div>
     <input type="text" inputmode="decimal" value="${esc(it.qtd||"")}" placeholder="Qtd" aria-label="Quantidade de ${esc(it.n)}" maxlength="20" onchange="App.shopQ(${ix},this.value)" style="width:64px;padding:8px;text-align:center">
     <input type="text" value="${esc(it.unid||"")}" placeholder="Un." aria-label="Unidade de ${esc(it.n)}" maxlength="20" onchange="App.shopU(${ix},this.value)" style="width:58px;padding:8px;text-align:center">
     ${it.custom?`<button class="iconbtn danger" onclick="App.shopDel(${ix})" aria-label="Excluir ${esc(it.n)}">🗑</button>`:""}</div>`; });
  });
  return h;
}
function vSuple(){ const seg=(key,val,nome)=>`<div class="seg" role="group" aria-label="Uso de ${esc(nome)}" style="margin:8px 0 0"><button id="sg_${key}_1" class="${val==="Sim"?"on":""}" aria-pressed="${val==="Sim"}" onclick="App.supleSet('${key}',1)">Uso</button><button id="sg_${key}_0" class="${val==="Não"?"on":""}" aria-pressed="${val==="Não"}" onclick="App.supleSet('${key}',0)">Não uso</button></div>`;
  let h=`<div class="goldbox" style="margin-bottom:10px">Suplementos <b>não são obrigatórios</b> e não substituem a alimentação. Conteúdo educacional, não é prescrição: doses individuais devem ser definidas por nutricionista ou médico.</div>`;
  D.SUPLE.forEach((s,i)=>{ const v=S.supleUsa["b"+i]||"";
    h+=`<div class="card"><h2>${esc(s.n)}</h2><p class="small"><b>Finalidade:</b> ${esc(s.f)}<br><b>Dose de referência:</b> ${esc(s.d)}<br><b>Horário:</b> ${esc(s.h)}<br><span class="muted">${esc(s.o)}</span></p>${seg("b"+i,v,s.n)}</div>`; });
  S.supleCustom.forEach(s=>{ const key="c_"+s.id;
    h+=`<div class="card"><h2>${esc(s.n)} <span class="pill p-info">meu</span></h2><p class="small">${s.f?`<b>Finalidade:</b> ${esc(s.f)}<br>`:""}${s.d?`<b>Dose:</b> ${esc(s.d)}<br>`:""}${s.h?`<b>Horário:</b> ${esc(s.h)}<br>`:""}${s.o?`<span class="muted">${esc(s.o)}</span>`:""}</p>${seg(key,S.supleUsa[key]||"",s.n)}<div class="rowbtns"><button class="btn btn-danger btn-sm" onclick="App.supleDel('${s.id}')">Excluir</button></div></div>`; });
  h+=`<button class="btn btn-ghost" onclick="App.mSuple()">＋ Adicionar suplemento</button>`;
  h+=`<div style="height:10px"></div><div class="warnbox">Gestantes, lactantes, menores de 18 anos, pessoas com doença renal, hepática ou cardíaca, hipertensão ou uso contínuo de medicamentos devem buscar orientação de médico ou nutricionista antes de iniciar qualquer suplemento. Prefira produtos regularizados na Anvisa e com análise de terceiros.</div>`;
  return h;
}
function vSobre(){ return `<div class="hero"><img src="assets/cover.jpg" width="768" height="1152" alt="Capa do guia FORTIS: Guia completo para ganhar massa magra sem passar fome"></div>
  <div class="card gold"><h2>Guia completo para ganhar massa magra</h2>
  <div class="badges5">${D.BADGES5.map(b=>`<div><b aria-hidden="true">✓</b>${esc(b)}</div>`).join("")}</div>
  <p class="small" style="text-align:center"><b>Resultados reais, sem complicação.</b></p></div>
  <div class="card"><h2>Como usar — 5 passos</h2>
  <div class="steps5">${[["1 • Perfil","Seus dados (informados no início) geram o gasto do corpo e as calorias-alvo. Ajuste em Mais → Perfil e metas."],["2 • Macros","Confira as metas de proteína, gordura, carboidratos e fibras em Mais → Macronutrientes."],["3 • Plano",`Monte as refeições na aba Plano com ${BASE.length} alimentos (básicos do FORTIS + tabela TACO completa).`],["4 • Diário","Registre peso, medidas, o que comeu, sono, treino e aderência na aba Diário."],["5 • Progresso","Compare as médias semanais com as suas metas na aba Progresso."]].map(s=>`<div class="checkrow"><b>${s[0]}</b><span>${esc(s[1])}</span></div>`).join("")}</div></div>
  <div class="card"><h2>Regras</h2>
  <div class="checkrow"><b aria-hidden="true">▸</b><span>Analise tendências de 2–3 semanas antes de alterar o plano.</span></div>
  <div class="checkrow"><b aria-hidden="true">▸</b><span>Pese os alimentos; considere azeite, molhos e pastas.</span></div>
  <div class="checkrow"><b aria-hidden="true">▸</b><span>Oscilações diárias de peso são normais.</span></div></div>
  <div class="warnbox">Esta ferramenta tem finalidade educacional, <b>não constitui prescrição</b> e <b>não substitui</b> avaliação individual com nutricionista, médico ou outro profissional habilitado. Os resultados são estimativas. Menores de 18 anos, gestantes, lactantes, pessoas com doenças, em uso contínuo de medicamentos ou com histórico de transtornos alimentares só devem usar com acompanhamento profissional.</div>
  <footer class="appfoot"><b>FORTIS</b> v${VERSION} • Nutrição, saúde e suplementação<br>Funciona offline • Seus dados ficam só neste aparelho<br>Disciplina, constância e fortaleza</footer>`;
}
function vBackup(){ const b=C.backupStatus(S);
  const status=S.meta.lastBackup?`<span class="pill ${b.due?"p-warn":"p-ok"}">${b.due?"⚠":"✓"} Último backup: ${quandoFoi(b.days)}</span>`
    :`<span class="pill p-warn">⚠ Você ainda não fez nenhum backup</span>`;
  return `<div class="card gold"><h2>💾 Backup dos seus dados</h2>${status}
  <p class="small" style="margin:10px 0">Tudo fica salvo <b>só neste celular</b> (privado, sem conta). O backup é um arquivo com todos os seus dados — guarde-o no WhatsApp, e-mail ou Drive.</p>
  <button class="btn btn-gold" onclick="App.shareBackup()">📤 Enviar backup (WhatsApp, e-mail, Drive)</button>
  <button class="btn btn-ghost" onclick="App.exportJSON()">⬇ Baixar arquivo de backup</button></div>
  <div class="card"><h2>📱 Trocou de celular?</h2>
  <div class="checkrow"><b>1</b><span>No celular <b>antigo</b>: toque em <b>Enviar backup</b> e mande o arquivo para você mesmo.</span></div>
  <div class="checkrow"><b>2</b><span>No celular <b>novo</b>: instale o FORTIS, toque em <b>“Só quero explorar o app”</b> e venha até esta tela.</span></div>
  <div class="checkrow"><b>3</b><span>Toque em <b>Importar backup</b> e escolha o arquivo. Pronto: tudo volta como estava.</span></div>
  <button class="btn btn-ghost" onclick="document.getElementById('impFile').click()">⬆ Importar backup</button>
  <input type="file" id="impFile" accept=".json,.txt,application/json,text/plain" style="display:none" onchange="App.importFile(this)"></div>
  <div class="card"><h2>Outras opções</h2>
  <button class="btn btn-ghost" onclick="App.exportCSV()">📄 Exportar registro diário (planilha CSV)</button>
  <button class="btn btn-danger" onclick="App.resetAll()">🗑 Apagar todos os dados</button></div>
  <div class="card"><h2>Sobre</h2><p class="small muted">FORTIS PWA v${VERSION} • Funciona offline após a primeira abertura • Português (Brasil)</p></div>`;
}
const VIEWS={inicio:vInicio,perfil:vPerfil,macros:vMacros,plano:vPlano,diario:vDiario,progresso:vProgresso,mais:vMais,compras:vCompras,suple:vSuple,sobre:vSobre,backup:vBackup};

/* ================= render ================= */
function render(){
  if(!S.onboarded){ renderOnboarding(); return; }
  document.title="FORTIS — "+(TITLES[ui.view]||"");
  $("#brandTitle").innerHTML=BRAND;
  $("#viewtitle").innerHTML=(BACK.includes(ui.view)?`<button class="backbtn" onclick="App.go('mais')" aria-label="Voltar">‹</button>`:"")+`<h1>${TITLES[ui.view]||""}</h1>`;
  const view=$("#view"); view.innerHTML=(VIEWS[ui.view]||vInicio)(); linkLabels(view);
  $("#tabbar").innerHTML=TABS.map(t=>`<button class="${ui.tab===t[0]?"on":""}"${ui.tab===t[0]?' aria-current="page"':""} onclick="App.go('${t[0]}')">${ICO[t[2]]}${t[1]}</button>`).join("");
  const bi=$("#btnInstall"); if(bi&&deferredPrompt) bi.style.display="inline-block";
}
/* re-renderiza depois que o foco já foi para o próximo campo e o devolve a ele (campos com id estável) */
function renderKeepFocus(){ setTimeout(()=>{ const a=document.activeElement, id=a&&a.id, y=window.scrollY;
  render(); window.scrollTo(0,y); if(id){ const el=document.getElementById(id); if(el&&el!==document.activeElement) el.focus(); } },0); }
function renderOnboarding(){ document.title="FORTIS — Bem-vindo";
  $("#brandTitle").innerHTML=BRAND; $("#viewtitle").innerHTML=ui.obStep?`<h1>Primeiros passos</h1>`:"";
  const view=$("#view"); view.innerHTML=vOnboarding(); linkLabels(view); $("#tabbar").innerHTML=""; }

/* ---------- autocomplete de alimentos ----------
   Substitui o <datalist>: no celular ele só aparece como sugestões acima do teclado e
   o texto digitado precisava ser idêntico ao nome do banco. */
const isAC=(el)=>!!(el&&el.dataset&&el.dataset.foodac!=null);
function acBox(el){ let b=el.nextElementSibling;
  if(!b||!b.classList.contains("acbox")){ b=document.createElement("div"); b.className="acbox"; b.id=el.id+"_ac"; b.setAttribute("role","listbox"); b.hidden=true; el.after(b); el.setAttribute("aria-controls",b.id); }
  return b; }
function acShow(el){ const q=el.value.trim(), b=acBox(el), items=q?searchFoods(q,8):[];
  if(!q||(items.length===1&&items[0]===q)){ acHide(el); return; }
  let h=items.map(n=>`<button type="button" role="option" class="acopt" data-n="${esc(n)}">${esc(n)}</button>`).join("");
  if(el.dataset.foodac==="new"&&!resolveFood(q)) h+=`<button type="button" class="acopt acnew" data-new="1">＋ Cadastrar “${esc(q)}”</button>`;
  else if(!items.length) h=`<div class="acempty">Nenhum alimento encontrado.</div>`;
  b.innerHTML=h; b.hidden=false; el.setAttribute("aria-expanded","true"); }
function acHide(el){ const b=el&&el.nextElementSibling; if(b&&b.classList.contains("acbox")&&!b.hidden){ b.hidden=true; b.innerHTML=""; }
  if(el) el.setAttribute("aria-expanded","false"); }
function acPick(el,name){ el.value=name; acHide(el); el.dispatchEvent(new Event("change",{bubbles:true})); }
function acKey(e){ const el=e.target; if(!isAC(el)) return; const b=el.nextElementSibling;
  if(!b||!b.classList.contains("acbox")||b.hidden) return;
  const opts=$$(".acopt",b), cur=opts.findIndex(o=>o.classList.contains("on"));
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){ e.preventDefault(); if(!opts.length) return;
    const nx=(cur+(e.key==="ArrowDown"?1:-1)+opts.length)%opts.length;
    opts.forEach((o,i)=>o.classList.toggle("on",i===nx)); opts[nx].scrollIntoView({block:"nearest"}); }
  else if(e.key==="Enter"&&opts.length){ e.preventDefault(); (opts[cur]||opts[0]).click(); }
  else if(e.key==="Escape"){ e.stopPropagation(); acHide(el); } }

/* ================= modais de edição ================= */
const actions=(ok)=>`<div class="rowbtns"><button type="button" class="btn btn-ghost" onclick="App.close()">Cancelar</button><button class="btn btn-gold" type="submit">${ok}</button></div>`;
/* pre = {m, f, n}: reabre o modal preenchido (ex.: ao voltar do cadastro de um alimento novo) */
function mPlanItem(pre){ pre=pre||{}; const meal=pre.m||ui.lastMeal;
  openSheet(`<h2 id="sheetTitle">Adicionar alimento</h2>
  <form onsubmit="return App.savePlan(event)"><label class="f">Refeição</label><select id="m_m">${D.MEALS8.map(m=>`<option${m===meal?" selected":""}>${esc(m)}</option>`).join("")}</select>
  <label class="f">Alimento</label><input id="m_f" data-foodac="new" role="combobox" aria-autocomplete="list" aria-expanded="false" placeholder="Digite parte do nome (ex.: frango)" value="${esc(pre.f||"")}" autocomplete="off" required oninput="App.mpFood()" onchange="App.mpFood()">
  <button type="button" class="linkbtn" onclick="App.newFoodFromPlan()">＋ Não achou? Cadastrar novo alimento</button>
  <div class="grid2"><div><label class="f">Quantidade</label><input id="m_n" type="number" inputmode="decimal" min="0" step="any" placeholder="Ex.: 2" value="${esc(pre.n||"")}" required oninput="App.mpCalc()"></div>
  <div><label class="f">Medida</label><select id="m_u" onchange="App.mpCalc()"><option value="">gramas (g)</option></select></div></div>
  <div id="m_prev" class="prevbox" aria-live="polite">Escolha o alimento para ver as medidas (unidade, colher, copo…).</div>
  ${actions("Adicionar")}</form>`);
  if(pre.f){ App.mpFood(); setTimeout(()=>{ const n=$("#m_n"); if(n) n.focus(); },40); } }
function mDiary(id){ const r=id?S.diary.find(x=>x.id===id):null;
  const v=k=>r?esc(r[k]||""):"";
  openSheet(`<h2 id="sheetTitle">${r?"Editar":"Registrar"} dia</h2><form onsubmit="return App.saveDiary(event,'${r?r.id:""}')">
  <div class="grid2"><div><label class="f">Data</label><input id="d_data" type="date" value="${r?esc(r.data):todayISO()}" max="${todayISO()}" required></div>
  <div><label class="f">Treinou?</label><select id="d_treino"><option value="">—</option><option${r&&r.treinou==="Sim"?" selected":""}>Sim</option><option${r&&r.treinou==="Não"?" selected":""}>Não</option></select></div></div>
  <div class="grid2"><div><label class="f">Peso (kg)</label><input id="d_peso" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${v("peso")}"></div>
  <div>${labelHelp("Cintura (cm)","cintura")}<input id="d_cint" type="number" inputmode="decimal" step="0.1" min="40" max="250" value="${v("cintura")}"></div></div>
  <div class="grid2"><div>${labelHelp("Calorias comidas","dkcal")}<input id="d_kcal" type="number" inputmode="numeric" min="0" max="15000" placeholder="opcional" value="${v("kcal")}"></div>
  <div>${labelHelp("Proteína comida (g)","dprot")}<input id="d_prot" type="number" inputmode="numeric" min="0" max="1000" placeholder="opcional" value="${v("prot")}"></div></div>
  ${S.plan.length?(()=>{ const t=planTotals(); return `<button type="button" class="linkbtn" onclick="App.diaryFromPlan()">↧ Usar valores do meu plano (${fi(t.k)} kcal • ${fi(t.p)} g de proteína)</button>`; })():""}
  <div class="grid2"><div><label class="f">Sono (h)</label><input id="d_sono" type="number" inputmode="decimal" step="0.5" min="0" max="24" value="${v("sono")}"></div>
  <div>${labelHelp("Seguiu o plano? (%)","aderencia")}<input id="d_ader" type="number" inputmode="numeric" min="0" max="100" value="${v("aderencia")}"></div></div>
  ${actions("Salvar")}</form>`); }
function mTreino(id){ const r=id?S.treino.find(x=>x.id===id):null; const v=k=>r?esc(r[k]||""):"";
  openSheet(`<h2 id="sheetTitle">${r?"Editar":"Registrar"} treino</h2><form onsubmit="return App.saveTreino(event,'${r?r.id:""}')">
  <div class="grid2"><div><label class="f">Data</label><input id="t_data" type="date" value="${r?esc(r.data):todayISO()}" required></div>
  <div><label class="f">Grupo</label><select id="t_grupo" required>${selOpts(D.GROUPS,r?r.grupo:"")}</select></div></div>
  <label class="f">Exercício</label><input id="t_ex" value="${v("exercicio")}" placeholder="Ex.: Supino reto" maxlength="120">
  <div class="grid3"><div><label class="f">Séries</label><input id="t_ser" type="number" inputmode="numeric" min="0" max="50" value="${v("series")}"></div>
  <div><label class="f">Reps</label><input id="t_rep" value="${v("reps")}" placeholder="8–12" maxlength="20"></div>
  <div><label class="f">Carga kg</label><input id="t_car" type="number" inputmode="decimal" step="0.5" min="0" max="1000" value="${v("carga")}"></div></div>
  <label class="f">Observações</label><input id="t_obs" value="${v("obs")}" maxlength="300">
  ${actions("Salvar")}</form>`); }
function mFood(ix,preName){ const f=ix!=null?S.customFoods[ix]:null; const v=k=>f?esc(f[k]??""):(k==="n"&&preName?esc(preName):"");
  openSheet(`<h2 id="sheetTitle">${f?"Editar":"Cadastrar"} alimento</h2><p class="muted small">Valores por 100 g — copie da tabela nutricional do rótulo.</p><form onsubmit="return App.saveFood(event,${ix==null?"null":ix})">
  <label class="f">Nome</label><input id="f_n" value="${v("n")}" maxlength="120" required>
  <div class="grid3"><div><label class="f">Kcal</label><input id="f_k" type="number" inputmode="decimal" step="0.1" min="0" max="900" value="${v("k")}" required></div>
  <div><label class="f">Prot</label><input id="f_p" type="number" inputmode="decimal" step="0.1" min="0" max="100" value="${v("p")}"></div>
  <div><label class="f">Carb</label><input id="f_c" type="number" inputmode="decimal" step="0.1" min="0" max="100" value="${v("c")}"></div></div>
  <div class="grid3"><div><label class="f">Gord</label><input id="f_f" type="number" inputmode="decimal" step="0.1" min="0" max="100" value="${v("f")}"></div>
  <div><label class="f">Fibra</label><input id="f_fib" type="number" inputmode="decimal" step="0.1" min="0" max="100" value="${v("fib")}"></div>
  <div><label class="f">Estado</label><select id="f_e">${["cru","cozido","pronto"].map(e=>`<option${v("e")===e?" selected":""}>${e}</option>`).join("")}</select></div></div>
  <p class="muted small" style="margin:12px 0 0">📏 <b>Medida caseira (opcional)</b> — para adicionar por unidade, fatia, pote…</p>
  <div class="grid2"><div><label class="f">Nome da medida</label><input id="f_un" value="${v("un")}" maxlength="40" placeholder="ex.: fatia, pote"></div>
  <div><label class="f">Gramas por medida</label><input id="f_ug" type="number" inputmode="decimal" step="0.1" min="0" max="2000" value="${v("ug")}" placeholder="ex.: 30"></div></div>
  ${ui.planDraft?`<div class="rowbtns"><button type="button" class="btn btn-ghost" onclick="App.backToPlan()">Voltar</button><button class="btn btn-gold" type="submit">Salvar e usar</button></div>`:actions("Salvar")}</form>`); }
function mShopItem(){ openSheet(`<h2 id="sheetTitle">Novo item</h2><form onsubmit="return App.saveShop(event)">
  <label class="f">Categoria</label><select id="s_cat">${D.SHOP_CATS.map(c=>`<option>${esc(c)}</option>`).join("")}</select>
  <label class="f">Alimento/produto</label><input id="s_n" maxlength="120" required>
  ${actions("Adicionar")}</form>`); }
function mSuple(){ openSheet(`<h2 id="sheetTitle">Novo suplemento</h2><form onsubmit="return App.saveSuple(event)">
  <label class="f">Nome</label><input id="u_n" maxlength="120" required><label class="f">Finalidade</label><input id="u_f" maxlength="200">
  <div class="grid2"><div><label class="f">Dose</label><input id="u_d" maxlength="120"></div><div><label class="f">Horário</label><input id="u_h" maxlength="120"></div></div>
  <label class="f">Observações</label><input id="u_o" maxlength="300">
  ${actions("Adicionar")}</form>`); }

/* ================= onboarding ================= */
/* passos: 0 boas-vindas • 1 sobre você • 2 rotina • 3 objetivo • 4 resultado */
const OB_LAST=4;
function vOnboarding(){ const s=ui.obStep, ob=ui.ob;
  const head=(t,sub)=>`<div class="obhead"><div class="obstep">Passo ${s} de ${OB_LAST}</div><div class="steps" role="progressbar" aria-label="Passo ${s} de ${OB_LAST}" aria-valuemin="1" aria-valuemax="${OB_LAST}" aria-valuenow="${s}">${[1,2,3,4].map(i=>`<i class="${i<=s?"on":""}"></i>`).join("")}</div><h2>${t}</h2>${sub?`<p class="small muted">${sub}</p>`:""}</div>`;
  const nav=(next)=>`<div class="rowbtns"><button class="btn btn-ghost" onclick="App.obBack()">Voltar</button><button class="btn btn-gold" onclick="App.obNext()">${next||"Continuar"}</button></div>`;
  if(s===0) return `<div class="welcome">
    <img class="wlogo" src="assets/emblema.png" width="180" height="186" alt="Emblema FORTIS">
    <h2 class="wtitle">Ganhe massa magra<span>sem passar fome</span></h2>
    <div class="brushbar"></div>
    <p class="wlead">Em 2 minutos o FORTIS calcula <b>quanto você deve comer por dia</b> e te ajuda a acompanhar sua evolução.</p>
    <ul class="wlist">
      <li><span aria-hidden="true">🔥</span><div><b>Quanto comer</b><small>Calorias e proteína certas para o seu corpo</small></div></li>
      <li><span aria-hidden="true">🍽️</span><div><b>O que comer</b><small>Monte refeições com ${BASE.length} alimentos (tabela TACO completa)</small></div></li>
      <li><span aria-hidden="true">📈</span><div><b>Sua evolução</b><small>Registre peso e treino e veja gráficos semanais</small></div></li>
    </ul>
    <button class="btn btn-gold" onclick="App.obNext()">Começar</button>
    <button class="linkbtn" onclick="App.obSkip()">Só quero explorar o app</button>
    <button class="linkbtn" onclick="App.obRestore()">Já tenho um backup — restaurar meus dados</button>
    <p class="wpriv">🔒 Sem cadastro e sem internet: seus dados ficam só no seu celular.<br>💾 Trocou de aparelho? Leve tudo pelo backup, em <b>Mais → Backup e dados</b>.</p></div>`;
  if(s===1) return `<div class="card">${head("Sobre você","Usamos esses dados para estimar quanto seu corpo gasta por dia.")}
   <label class="f">Como podemos te chamar?</label><input id="ob_nome" value="${esc(ob.nome||"")}" placeholder="Seu nome (opcional)" autocomplete="given-name" maxlength="80">
   <div class="f">Sexo</div>${optCards("Sexo",sexItems(),ob.sexo||"","App.obPick_sexo").replace('class="opts"','class="opts two"')}
   <div class="grid3"><div><label class="f">Idade</label><input id="ob_idade" type="number" inputmode="numeric" min="10" max="100" placeholder="anos" value="${esc(ob.idade||"")}"></div>
   <div><label class="f">Peso</label><input id="ob_peso" type="number" inputmode="decimal" step="0.1" min="30" max="300" placeholder="kg" value="${esc(ob.peso||"")}"></div>
   <div><label class="f">Altura</label><input id="ob_alt" type="number" inputmode="numeric" min="100" max="250" placeholder="cm" value="${esc(ob.altura||"")}"></div></div>
   ${nav()}</div>`;
  if(s===2) return `<div class="card">${head("Quanto você se movimenta?","Pense numa semana normal, contando treino e trabalho.")}
   ${optCards("Nível de atividade",actItems(),ob.atividade||"","App.obPick_atividade")}${nav()}</div>`;
  if(s===3) return `<div class="card">${head("Qual é o seu objetivo?","")}
   <div class="goldbox small" style="margin-bottom:10px">💡 Para ganhar músculo, o corpo precisa de <b>um pouco mais de comida do que gasta</b>. Quanto mais você come a mais, mais rápido ganha peso — mas também mais gordura. ${helpBtn("superavit")}</div>
   ${optCards("Objetivo",goalItems(),ob.objetivo||"","App.obPick_objetivo")}${nav("Ver meu resultado")}</div>`;
  const pf=C.calcPerfil(ob,D.ACTS,D.GOALS), mc=C.calcMacros(ob,{protKg:2,gordKg:1},D.ACTS,D.GOALS);
  if(!pf||!mc) return `<div class="card">${head("Quase lá","")}<p class="small">Faltam alguns dados para calcular. Volte e preencha sexo, idade, peso, altura, rotina e objetivo.</p>${nav("Começar mesmo assim")}</div>`;
  return `<div class="card gold">${head(`Pronto${ob.nome?", "+esc(ob.nome.split(" ")[0]):""}! 💪`,"Este é o seu ponto de partida:")}
   ${resultKpis(pf)}
   <h3>Divididos assim ${helpBtn("macros")}</h3>
   <div class="kpis"><div class="kpi"><div class="l">🥩 Proteína</div><div class="v">${fi(mc.protG)} <em>g</em></div></div>
   <div class="kpi"><div class="l">🍚 Carboidratos</div><div class="v">${fi(Math.max(0,mc.carbsG))} <em>g</em></div></div>
   <div class="kpi"><div class="l">🥑 Gordura</div><div class="v">${fi(mc.gordG)} <em>g</em></div></div>
   <div class="kpi"><div class="l">🥦 Fibras</div><div class="v">${mc.fibra} <em>g</em></div></div></div>
   ${num(ob.idade)<18?'<div class="warnbox" style="margin-top:10px">⚠ Para menores de 18 anos estas fórmulas não são adequadas. Procure um nutricionista.</div>':""}
   <p class="small muted" style="margin:10px 0 0">Você pode mudar tudo isso depois em <b>Mais → Perfil e metas</b>.</p>
   <p class="small muted" style="margin:6px 0 0">Estimativa educacional, não é prescrição. Gestantes, lactantes ou pessoas com condições de saúde devem seguir orientação de nutricionista ou médico.</p>
   <div class="rowbtns"><button class="btn btn-ghost" onclick="App.obBack()">Voltar</button><button class="btn btn-gold" onclick="App.obNext()">Começar a usar</button></div></div>`;
}
/* lê os campos digitáveis do passo atual para ui.ob (assim "Voltar" não perde nada) */
function obCollect(){ const o=ui.ob, val=id=>{ const el=$(id); return el?el.value.trim():undefined; };
  const set=(k,v)=>{ if(v!==undefined) o[k]=v; };
  set("nome",val("#ob_nome")); set("idade",val("#ob_idade")); set("peso",val("#ob_peso")); set("altura",val("#ob_alt")); }
function obValidate(step){ const o=ui.ob;
  if(step===1){ const i=num(o.idade),p=num(o.peso),a=num(o.altura);
    if(!o.sexo) return "Escolha Homem ou Mulher (o cálculo muda conforme o sexo).";
    if(i==null||i<10||i>100) return "Informe sua idade (entre 10 e 100 anos).";
    if(p==null||p<30||p>300) return "Informe seu peso em kg (entre 30 e 300).";
    if(a==null||a<100||a>250) return "Informe sua altura em centímetros (ex.: 175).";
  }
  if(step===2&&!o.atividade) return "Escolha a opção que mais combina com a sua rotina.";
  if(step===3&&!o.objetivo) return "Escolha um objetivo.";
  return ""; }
function obFinish(){ const o=ui.ob;
  S.profile={nome:o.nome||"",sexo:o.sexo||"",idade:o.idade||"",peso:o.peso||"",altura:o.altura||"",atividade:o.atividade||"",objetivo:o.objetivo||""};
  S.macros={protKg:2,gordKg:1};
  S.onboarded=true; save(); ui.ob={}; ui.obStep=0; ui.view=calcPerfil()?"inicio":"perfil"; ui.tab=ui.view==="inicio"?"inicio":"mais";
  render(); window.scrollTo(0,0);
  if(ui.view==="perfil") toast("Complete os campos que faltam para calcular suas metas."); }
const PICK={sexo:()=>SEXOS.map(s=>s[0]),atividade:()=>D.ACTS.map(a=>a[0]),objetivo:()=>D.GOALS.map(g=>g[0])};

/* ================= API pública ================= */
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); deferredPrompt=e; const b=$("#btnInstall"); if(b) b.style.display="inline-block"; });
window.addEventListener("appinstalled",()=>{ deferredPrompt=null; const b=$("#btnInstall"); if(b) b.style.display="none"; toast("App instalado! 🛡️"); });
const inRange=(v,a,b)=>v===""||(num(v)!=null&&num(v)>=a&&num(v)<=b);
function download(blob,name){ const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500); }
function renameFoodRefs(oldN,newN){ if(!oldN||oldN===newN) return;
  S.plan.forEach(it=>{ if(it.f===oldN) it.f=newN; });
  Object.keys(S.estr).forEach(k=>(S.estr[k]||[]).forEach(x=>{ if(x&&x.f===oldN) x.f=newN; })); }

window.App={
 go(v){ ui.view=VIEWS[v]?v:"inicio"; ui.tab=TABS.some(t=>t[0]===ui.view)?ui.view:"mais"; closeSheet(); render(); window.scrollTo(0,0); },
 goSeg(v,seg){ if(v==="plano") ui.segPlano=seg; ui.view=v; ui.tab=v; render(); window.scrollTo(0,0); },
 segPlano(s){ ui.segPlano=s; render(); }, segDiario(s){ ui.segDiario=s; render(); }, segEstr(s){ ui.segEstr=+s||0; render(); },
 close:closeSheet, confirmYes(){ const f=_confirmCb; _confirmCb=null; closeSheet(); if(f) f(); },
 install(){ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt.userChoice.finally(()=>{ deferredPrompt=null; render(); }); } },
 /* atualiza só o bloco de resultados: re-renderizar a tela inteira tiraria o foco do campo seguinte */
 pfSave(){ const p=S.profile;
   S.profile={...p,nome:$("#pf_nome").value.trim(),idade:$("#pf_idade").value,peso:$("#pf_peso").value,altura:$("#pf_altura").value};
   save(); const errs=C.perfilErros(S.profile,D.ACTS,D.GOALS).map(e=>e.campo);
   [["idade","#pf_idade"],["peso","#pf_peso"],["altura","#pf_altura"]].forEach(([c,id])=>{ const el=$(id); if(el) el.setAttribute("aria-invalid",String(errs.includes(c)&&el.value!=="")); });
   const h=vPerfilResult(), box=$("#pfResult"); if(box&&box._h!==h){ box._h=h; box.innerHTML=h; } },
 /* usa o último peso do diário no cálculo das metas */
 pfUsePeso(){ const pa=pesoAtual(); if(pa==null) return; S.profile.peso=String(pa); save(); render(); toast("Metas recalculadas com "+f1(pa)+" kg."); },
 mcSave(){ const p=num($("#mc_p").value),g=num($("#mc_g").value), ok=v=>v!=null&&v>=0&&v<=5;
   S.macros={protKg:ok(p)?p:S.macros.protKg,gordKg:ok(g)?g:S.macros.gordKg}; save();
   // valor recusado: o campo volta a mostrar o que está valendo
   if(!ok(p)||!ok(g)){ $("#mc_p").value=S.macros.protKg; $("#mc_g").value=S.macros.gordKg; toast("Use valores entre 0 e 5 g por kg."); }
   $("#mcResult").innerHTML=vMacrosResult(); },
 help(k,btn){ const g=GLOSS[k]; if(!g) return;
   if(btn&&btn.closest("#sheet")){ const row=btn.closest(".grid2,.grid3")||btn.closest(".lblrow"), id="hb_"+k, old=$("#"+id);
     $$(".helpbox",$("#sheet")).forEach(b=>b.remove()); if(old) return;
     row.insertAdjacentHTML("afterend",`<div class="helpbox" id="${id}" role="note"><b>${g[0]}</b><br>${g[1]}</div>`); return; }
   openSheet(`<h2 id="sheetTitle">${g[0]}</h2><p class="small" style="line-height:1.6">${g[1]}</p><div class="rowbtns"><button class="btn btn-gold" onclick="App.close()">Entendi</button></div>`); },
 mPlanItem, mDiary, mTreino, mFood, mShopItem, mSuple,
 /* modal "Adicionar alimento": ao escolher o alimento, oferece as medidas caseiras dele */
 mpFood(){ const f=resolveFood($("#m_f").value), sel=$("#m_u"); if(!sel) return;
   if(sel.dataset.food===f) return App.mpCalc(); sel.dataset.food=f;
   const ms=foodMap()[f]?measures(f):[];
   sel.innerHTML=ms.map((u,k)=>`<option value="${k}">${esc(u.label)}${u.label==="ml"?"":` (${fmtN(u.g)} g)`}</option>`).join("")+`<option value="">gramas (g)</option>`;
   sel.value=ms.length?"0":""; App.mpCalc(); },
 mpCalc(){ const txt=$("#m_f").value.trim(), f=resolveFood(txt), food=foodMap()[f], box=$("#m_prev"), nEl=$("#m_n"); if(!box) return;
   const k=$("#m_u").value, ms=food?measures(f):[], u=k===""?null:ms[+k];
   nEl.placeholder=u?(u.label==="ml"?"Ex.: 200":"Ex.: 2"):"Ex.: 150";
   if(!food){ box.innerHTML=txt?"Toque em um alimento da lista acima — ou cadastre um novo.":"Escolha o alimento para ver as medidas (unidade, colher, copo…)."; return; }
   const n=num(nEl.value); if(!(n>0)){ box.innerHTML=u?`1 ${esc(u.label)} ≈ <b>${fmtN(u.g)} g</b>`:"Informe a quantidade em gramas."; return; }
   const g=u?C.gramsFor(n,u.g):n;
   box.innerHTML=`= <b>${fmtN(g)} g</b> • <b>${fi(food.k*g/100)} kcal</b> • P ${f1(food.p*g/100)} g • C ${f1(food.c*g/100)} g • G ${f1(food.f*g/100)} g`; },
 savePlan(e){ e.preventDefault(); const txt=$("#m_f").value.trim(), f=resolveFood(txt,true),n=num($("#m_n").value),k=$("#m_u").value;
   if(!f){ toast(txt&&searchFoods(txt,2).length>1?"Mais de um alimento combina. Toque no certo na lista.":"Alimento não encontrado. Escolha na lista ou cadastre um novo."); $("#m_f").focus(); acShow($("#m_f")); return false; }
   /* completou um nome parcial: mostra as medidas do alimento escolhido antes de salvar */
   if(!resolveFood(txt)){ $("#m_f").value=f; App.mpFood(); toast(`Selecionado: ${f}. Confira a medida e toque em Adicionar.`); return false; }
   if(!(n>0)){ toast("Informe a quantidade."); $("#m_n").focus(); return false; }
   const u=k===""?null:measures(f)[+k];
   const item=u?{f,q:String(C.gramsFor(n,u.g)),u:u.label,n:String(n)}:{f,q:String(n)};
   if(num(item.q)>5000){ toast("Quantidade muito grande. Confira o valor."); return false; }
   ui.lastMeal=$("#m_m").value; S.plan.push({m:ui.lastMeal,...item}); contarEdicao(); save(); closeSheet(); render(); return false; },
 /* muda a quantidade de medidas (ex.: 2 → 3 ovos) e recalcula as gramas */
 planCount(i,v){ const it=S.plan[i]; if(!it||!it.u) return; const n=num(v); if(n==null||n<=0){ toast("Para tirar o alimento, use a lixeira."); return renderKeepFocus(); }
   const u=measures(it.f).find(x=>x.label===it.u), g=u?u.g:(num(it.q)||0)/(num(it.n)||1);
   it.n=String(n); it.q=String(C.gramsFor(n,g)); save(); renderKeepFocus(); },
 planQty(i,v){ if(!S.plan[i]) return; S.plan[i].q=num(v)!=null&&num(v)>=0?String(num(v)):""; save(); renderKeepFocus(); },
 planDel(i){ mConfirm("Remover este item do plano?",()=>{ S.plan.splice(i,1); save(); render(); }); },
 planClear(){ mConfirm("Remover todos os itens do plano?",()=>{ S.plan=[]; save(); render(); }); },
 estrRow(i,j){ if(!S.estr[i]) S.estr[i]=[]; for(let k=0;k<=j;k++) if(!S.estr[i][k]) S.estr[i][k]={f:"",q:""}; return S.estr[i][j]; },
 estrFood(i,j,v){ App.estrRow(i,j); S.estr[i][j].f=resolveFood(v,true)||v.trim(); save(); renderKeepFocus(); },
 estrQty(i,j,v){ App.estrRow(i,j); S.estr[i][j].q=num(v)!=null&&num(v)>=0?String(num(v)):""; save(); renderKeepFocus(); },
 foodQ(v){ ui.foodQ=v; const r=foodListHTML(); $("#foodlist").innerHTML=r.html; $("#foodCount").textContent=r.count; },
 foodCat(v){ ui.foodCat=v; App.foodQ(ui.foodQ); },
 saveFood(e,ix){ e.preventDefault(); const g=id=>$(id).value.trim();
   const f={n:g("#f_n").replace(/\s+/g," "),k:num(g("#f_k"))||0,p:num(g("#f_p"))||0,c:num(g("#f_c"))||0,f:num(g("#f_f"))||0,fib:num(g("#f_fib"))||0,e:$("#f_e").value,src:"Meu cadastro",v:"OK"};
   const un=g("#f_un"), ug=num(g("#f_ug"));
   if(un&&ug>0){ f.un=un.slice(0,40); f.ug=ug; } else if(un||g("#f_ug")){ toast("Para a medida caseira, preencha o nome e as gramas (ou deixe os dois vazios)."); return false; }
   if(!f.n){ toast("Informe o nome do alimento."); return false; }
   const low=f.n.toLowerCase();
   if(isBaseFood(f.n)&&!(ix!=null&&S.customFoods[ix].n.toLowerCase()===low)){ toast("Já existe um alimento com esse nome no banco. Use outro nome (ex.: “"+f.n+" (marca)”)."); return false; }
   if(S.customFoods.some((x,i)=>i!==ix&&x.n.toLowerCase()===low)){ toast("Você já cadastrou um alimento com esse nome."); return false; }
   if(f.p*4+f.c*4+f.f*9>f.k*1.25+20) toast("Atenção: os macros somam bem mais que as kcal informadas. Confira o rótulo.");
   if(ix==null) S.customFoods.push(f); else { renameFoodRefs(S.customFoods[ix].n,f.n); S.customFoods[ix]=f; }
   const draft=ui.planDraft; contarEdicao(); save();
   if(draft){ ui.planDraft=null; render(); mPlanItem({...draft,f:f.n}); toast("Alimento cadastrado."); return false; }
   closeSheet(); render(); return false; },
 /* cadastro de alimento a partir do modal "Adicionar alimento", guardando o que já foi preenchido */
 newFoodFromPlan(name){ const fe=$("#m_f"); if(!fe) return; const txt=name!=null?name:fe.value.trim();
   ui.planDraft={m:$("#m_m").value,n:$("#m_n").value};
   mFood(null,resolveFood(txt)?"":txt); },
 backToPlan(){ const d=ui.planDraft; ui.planDraft=null; mPlanItem(d||{}); },
 foodDel(ix){ const f=S.customFoods[ix]; if(!f) return;
   const uses=S.plan.filter(it=>it.f===f.n).length;
   mConfirm(`Excluir “${esc(f.n)}”?${uses?` Ele está em ${uses} item(ns) do seu plano.`:""}`,()=>{ S.customFoods.splice(ix,1); save(); render(); }); },
 /* preenche calorias/proteína do registro com os totais do plano alimentar */
 diaryFromPlan(){ const t=planTotals(); $("#d_kcal").value=Math.round(t.k); $("#d_prot").value=Math.round(t.p);
   toast("Preenchido com o seu plano. Ajuste se comeu diferente."); },
 saveDiary(e,id){ e.preventDefault(); const g=x=>$(x).value.trim();
   const r={id:id||uid(),data:g("#d_data"),peso:g("#d_peso"),cintura:g("#d_cint"),kcal:g("#d_kcal"),prot:g("#d_prot"),sono:g("#d_sono"),treinou:g("#d_treino"),aderencia:g("#d_ader")};
   if(!C.isISODate(r.data)){ toast("Informe uma data válida."); return false; }
   if(!inRange(r.peso,30,300)||!inRange(r.cintura,40,250)||!inRange(r.kcal,0,15000)||!inRange(r.prot,0,1000)||!inRange(r.sono,0,24)||!inRange(r.aderencia,0,100)){
     toast("Confira os intervalos: peso 30–300, cintura 40–250, kcal 0–15.000, proteína 0–1.000, sono 0–24, aderência 0–100."); return false; }
   ["peso","cintura","kcal","prot","sono","aderencia"].forEach(k=>{ if(r[k]!=="") r[k]=String(num(r[k])); });
   const commit=(replaceId)=>{ S.diary=S.diary.filter(x=>x.id!==r.id&&x.id!==replaceId); S.diary.push(r); contarEdicao(); save(); pedirPersistencia(); closeSheet(); render(); };
   const dup=S.diary.find(x=>x.data===r.data&&x.id!==r.id);
   if(dup){ mConfirm(`Já existe um registro em ${dataBR(r.data)}. Substituir pelo novo?`,()=>commit(dup.id),"Substituir"); return false; }
   commit(null); return false; },
 diaryDel(id){ mConfirm("Excluir este registro?",()=>{ contarEdicao(); S.diary=S.diary.filter(x=>x.id!==id); save(); render(); }); },
 saveTreino(e,id){ e.preventDefault(); const g=x=>$(x).value.trim();
   const r={id:id||uid(),data:g("#t_data"),grupo:g("#t_grupo"),exercicio:g("#t_ex"),series:g("#t_ser"),reps:g("#t_rep"),carga:g("#t_car"),obs:g("#t_obs")};
   if(!C.isISODate(r.data)){ toast("Informe uma data válida."); return false; }
   if(!inRange(r.series,0,50)||!inRange(r.carga,0,1000)){ toast("Confira séries (0–50) e carga (0–1.000 kg)."); return false; }
   const i=S.treino.findIndex(x=>x.id===r.id); if(i>=0) S.treino[i]=r; else S.treino.push(r); contarEdicao();
   save(); closeSheet(); render(); return false; },
 treinoDel(id){ mConfirm("Excluir este treino?",()=>{ contarEdicao(); S.treino=S.treino.filter(x=>x.id!==id); save(); render(); }); },
 saveShop(e){ e.preventDefault(); const n=$("#s_n").value.trim().replace(/\s+/g," ");
   if(!n){ toast("Informe o nome do item."); $("#s_n").focus(); return false; }
   if(shopFlat().some(i=>norm(i.n)===norm(n))){ toast("Esse item já está na lista."); $("#s_n").focus(); return false; }
   S.shopCustom.push({cat:$("#s_cat").value,n,qtd:"",unid:"",marcado:false}); save(); closeSheet(); render(); refocus("shk_"+(shopFlat().length-1)); return false; },
 shopToggle(ix){ const it=shopFlat()[ix]; if(!it) return;
   if(it.custom){ const c=S.shopCustom[it.ix]; c.marcado=!c.marcado; } else { const st=S.shop[it.n]||{}; st.marcado=!st.marcado; S.shop[it.n]=st; }
   save(); const y=window.scrollY; render(); window.scrollTo(0,y); refocus("shk_"+ix); },
 shopQ(ix,v){ const it=shopFlat()[ix]; if(!it) return;
   if(it.custom) S.shopCustom[it.ix].qtd=v.trim(); else { const st=S.shop[it.n]||{}; st.qtd=v.trim(); S.shop[it.n]=st; } save(); },
 shopU(ix,v){ const it=shopFlat()[ix]; if(!it) return;
   if(it.custom) S.shopCustom[it.ix].unid=v.trim(); else { const st=S.shop[it.n]||{}; st.unid=v.trim(); S.shop[it.n]=st; } save(); },
 shopDel(ix){ const it=shopFlat()[ix]; if(!it||!it.custom) return;
   mConfirm(`Excluir <b>${esc(it.n)}</b> da lista?`,()=>{ S.shopCustom.splice(it.ix,1); save(); render(); refocus("btnShopAdd"); },"Excluir","btn-danger"); },
 shopReset(){ if(!shopFlat().some(i=>i.marcado)){ toast("Nenhum item marcado."); return; }
   mConfirm("Desmarcar todos os itens da lista?",()=>{ Object.keys(S.shop).forEach(k=>{S.shop[k].marcado=false;}); S.shopCustom.forEach(c=>c.marcado=false); save(); render(); },"Desmarcar"); },
 /* tocar de novo na opção já marcada limpa a resposta */
 supleSet(key,sim){ const v=sim?"Sim":"Não"; if(S.supleUsa[key]===v) delete S.supleUsa[key]; else S.supleUsa[key]=v;
   save(); const y=window.scrollY; render(); window.scrollTo(0,y); refocus(`sg_${key}_${sim?1:0}`); },
 saveSuple(e){ e.preventDefault(); const g=x=>$(x).value.trim();
   if(!g("#u_n")){ toast("Informe o nome do suplemento."); $("#u_n").focus(); return false; }
   if([...D.SUPLE,...S.supleCustom].some(x=>norm(x.n)===norm(g("#u_n")))){ toast("Esse suplemento já está na lista."); $("#u_n").focus(); return false; }
   S.supleCustom.push({id:uid(),n:g("#u_n"),f:g("#u_f"),d:g("#u_d"),h:g("#u_h"),o:g("#u_o")}); save(); closeSheet(); render(); return false; },
 supleDel(id){ const s0=S.supleCustom.find(x=>x.id===id); mConfirm(`Excluir <b>${esc(s0?s0.n:"este suplemento")}</b>?`,()=>{ S.supleCustom=S.supleCustom.filter(s=>s.id!==id); delete S.supleUsa["c_"+id]; save(); render(); },"Excluir","btn-danger"); },
 exportJSON(){ download(new Blob([backupJSON()],{type:"application/json"}),`fortis-backup-${todayISO()}.json`);
   marcarBackup(); toast("Backup baixado. Guarde o arquivo fora do celular (WhatsApp, e-mail ou Drive)."); render(); },
 /* abre a folha de compartilhamento do celular com o arquivo; sem suporte, baixa o arquivo */
 async shareBackup(){ const json=backupJSON(), base=`fortis-backup-${todayISO()}`;
   // Chrome/Android não compartilha .json; .txt é aceito e o Importar lê os dois
   const files=[new File([json],base+".json",{type:"application/json"}),new File([json],base+".txt",{type:"text/plain"})];
   const file=navigator.canShare?files.find(f=>{ try{ return navigator.canShare({files:[f]}); }catch(e){ return false; } }):null;
   if(file&&navigator.share){
     try{ await navigator.share({files:[file],title:"Backup FORTIS",text:"Backup dos meus dados do app FORTIS. Guarde este arquivo para restaurar em outro celular."});
       marcarBackup(); toast("Backup enviado ✓"); render(); return; }
     catch(e){ if(e&&e.name==="AbortError") return; }   // a pessoa cancelou
   }
   App.exportJSON(); },
 snoozeBackup(){ S.meta.snoozeUntil=new Date(Date.now()+3*864e5).toISOString(); save(); render();
   toast("Ok! Vamos lembrar de novo em 3 dias. O backup fica em Mais → Backup e dados."); },
 importFile(inp){ const f=inp.files[0]; inp.value=""; if(!f) return;
   if(f.size>5e6){ toast("Arquivo grande demais para ser um backup do FORTIS."); return; }
   const rd=new FileReader();
   rd.onload=()=>{ let d; try{ d=JSON.parse(rd.result); }catch(e){ toast("Arquivo inválido: escolha o arquivo fortis-backup."); return; }
     // precisa ter cara de backup do FORTIS (um JSON qualquer com "profile" apagaria tudo)
     if(!C.isObj(d)||!C.isObj(d.profile)||!(d.app==="FORTIS"||Array.isArray(d.diary)||Array.isArray(d.plan))){ toast("Arquivo inválido: não parece um backup do FORTIS."); return; }
     const clean=C.sanitizeState(d,uid);
     const nShop=Object.values(clean.shop).filter(x=>x.marcado).length+clean.shopCustom.length;
     const resumo=`${clean.diary.length} registro(s) diário(s), ${clean.treino.length} treino(s), ${clean.plan.length} item(ns) no plano, ${clean.customFoods.length} alimento(s) próprio(s) e ${nShop} item(ns) na lista de compras`;
     const vazio=!clean.diary.length&&!clean.treino.length&&!clean.plan.length&&!clean.customFoods.length&&!clean.profile.nome;
     const deQuando=typeof d.exportadoEm==="string"&&C.isISODate(d.exportadoEm.slice(0,10))?`Backup de ${dataBR(d.exportadoEm.slice(0,10))}${clean.profile.nome?` (${esc(clean.profile.nome)})`:""}. `:"";
     mConfirm(`${vazio?"<b>Este backup está vazio.</b> Substituir mesmo assim?":"Substituir TODOS os dados atuais pelo backup?"}<br><span class="muted small">${deQuando}${esc(resumo)}.</span>`,()=>{ const antes=S;
       S=clean; S.onboarded=true; S.meta.lastBackup=new Date().toISOString(); S.meta.editsSinceBackup=0; S.meta.snoozeUntil=null; if(!S.meta.createdAt) S.meta.createdAt=S.meta.lastBackup;
       if(!save()){ S=antes; toast("⚠ Não foi possível salvar o backup neste aparelho (armazenamento cheio ou modo privado)."); return; }
       ui.view="inicio"; ui.tab="inicio"; render(); toast("Backup importado."); },"Importar"); };
   rd.onerror=()=>toast("Não foi possível ler o arquivo.");
   rd.readAsText(f); },
 exportCSV(){ if(!S.diary.length){ toast("Ainda não há registros no diário para exportar."); return; }
   const dec=v=>v===""||v==null?"":String(v).replace(".",",");   // Excel pt-BR: “;” separa colunas, “,” é decimal
   // aspas quando preciso; texto começando com = + - @ não vira fórmula no Excel
   const cell=v=>{ let s=String(v==null?"":v); if(/^[=+\-@\t\r]/.test(s)&&isNaN(Number(s.replace(",",".")))) s="'"+s; return /[;"\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; };
   const rows=[["Data","Semana","Peso (kg)","Cintura (cm)","Calorias (kcal)","Proteína (g)","Sono (h)","Treinou","Seguiu o plano (%)"]];
   diarySorted().forEach(r=>rows.push([r.data,weekOf(r.data)||"",dec(r.peso),dec(r.cintura),dec(r.kcal),dec(r.prot),dec(r.sono),r.treinou,dec(r.aderencia)]));
   const csv=rows.map(r=>r.map(cell).join(";")).join("\r\n");
   download(new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"}),`fortis-registro-${todayISO()}.csv`);
   toast("Planilha baixada. Abra no Excel ou no Google Planilhas."); },
 resetAll(){ mConfirm("Apagar TODOS os dados do app? Isso não pode ser desfeito. <b>Faça um backup antes</b> se quiser guardar seu histórico.",()=>{ S=C.defState(); S.meta.createdAt=new Date().toISOString(); save(); ui.view="inicio"; ui.tab="inicio"; ui.ob={}; ui.obStep=0; render(); window.scrollTo(0,0); },"Apagar tudo","btn-danger"); },
 /* onboarding */
 obNext(){ obCollect(); const err=obValidate(ui.obStep); if(err){ toast(err); return; }
   if(ui.obStep>=OB_LAST){ obFinish(); return; }
   ui.obStep++; render(); window.scrollTo(0,0); },
 obBack(){ obCollect(); ui.obStep=Math.max(0,ui.obStep-1); render(); window.scrollTo(0,0); },
 obRestore(){ S.onboarded=true; save(); App.go("backup"); toast("Toque em Importar backup e escolha o arquivo fortis-backup."); },
 obSkip(){ obCollect(); S.onboarded=true; save(); ui.view="inicio"; ui.tab="inicio"; render(); window.scrollTo(0,0); }
};

Object.keys(PICK).forEach(f=>{
  App["obPick_"+f]=(i)=>{ obCollect(); const v=PICK[f]()[i]; if(v!=null) ui.ob[f]=v; render(); };
  App["pfPick_"+f]=(i)=>{ const v=PICK[f]()[i]; if(v==null) return; S.profile[f]=v; save(); const y=window.scrollY; render(); window.scrollTo(0,y); };
});

/* ---------- init ---------- */
const modal=document.getElementById("modal");
modal.addEventListener("click",e=>{ if(e.target.id==="modal") closeSheet(); });
document.getElementById("toast").addEventListener("click",e=>e.currentTarget.classList.remove("show"));
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&modal.classList.contains("open")) closeSheet(); });
document.addEventListener("input",e=>{ if(isAC(e.target)) acShow(e.target); });
document.addEventListener("focusin",e=>{ const el=e.target; if(isAC(el)&&el.value.trim()&&!resolveFood(el.value)) acShow(el); });
document.addEventListener("keydown",acKey,true);   // captura: Esc fecha a lista antes de fechar o modal
/* tocar na opção não pode tirar o foco do campo (senão o teclado fecha e a lista some antes do clique) */
document.addEventListener("pointerdown",e=>{ if(e.target.closest(".acbox")){ e.preventDefault(); return; }
  $$("[data-foodac]").forEach(el=>{ if(el!==e.target) acHide(el); }); });
document.addEventListener("focusout",e=>{ const el=e.target; if(!isAC(el)) return; const b=el.nextElementSibling;
  if(e.relatedTarget&&!(b&&b.contains(e.relatedTarget))) acHide(el); });
document.addEventListener("click",e=>{ const o=e.target.closest(".acopt"); if(!o) return; const el=o.parentElement.previousElementSibling;
  if(o.dataset.new) App.newFoodFromPlan(el.value.trim()); else acPick(el,o.dataset.n); });
if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)){
  try{ navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).catch(()=>{}); }catch(e){}
}
if(!S.meta.createdAt) S.meta.createdAt=new Date().toISOString();
save();     // persiste a migração/validação feita na carga
render();
})();
