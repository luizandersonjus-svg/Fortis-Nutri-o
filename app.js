/* ================= FORTIS PWA — lógica do app (100% local/offline) ================= */
(function(){
"use strict";
const D = window.FORTIS;
const C = window.FORTIS_CORE;
const VERSION = "1.4";
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
const memo=()=>_memo||(_memo={foods:C.foodMap(D.FOODS,S.customFoods),start:C.firstDate(S.diary)});
const save=()=>{ _memo=null;
  if(!store.set(KEY,S)&&!_warnedStorage){ _warnedStorage=true; toast("⚠ Não foi possível salvar no aparelho (modo privado ou armazenamento cheio). Exporte um backup."); }
  refreshFoodList(); };

/* ---------- alimentos ---------- */
const foodMap=()=>memo().foods;
let _foodSig="";
function refreshFoodList(){ const dl=$("#dlFoods"); if(!dl) return;
  const names=[...D.FOODS.map(f=>f[0]),...S.customFoods.map(f=>f.n)].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const sig=names.join("\n"); if(sig===_foodSig) return; _foodSig=sig;
  dl.innerHTML=names.map(n=>`<option value="${esc(n)}">`).join("");
}
const isBaseFood=(n)=>D.FOODS.some(f=>f[0].toLowerCase()===n.toLowerCase());

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
function lineSVG(title,labels,vals,color,dec){ const W=480,H=200,P=34;
  const vv=vals.filter(v=>v!=null);
  if(!vv.length) return `<div class="muted small">Sem dados suficientes ainda.</div>`;
  let mn=Math.min(...vv),mx=Math.max(...vv); if(mn===mx){mn-=1;mx+=1;} const pad=(mx-mn)*0.15; mn-=pad; mx+=pad;
  const n=labels.length, X=i=>n>1?P+i*(W-2*P)/(n-1):W/2, Y=v=>H-P-(v-mn)*(H-2*P)/(mx-mn);
  let grid=""; for(let g=0;g<=3;g++){ const v=mn+(mx-mn)*g/3,y=Y(v);
    grid+=`<line x1="${P}" y1="${y.toFixed(1)}" x2="${W-8}" y2="${y.toFixed(1)}" stroke="#2a2a2a" stroke-width="1"/><text x="2" y="${(y+4).toFixed(1)}" fill="#9a9a9a" font-size="11">${Number(v).toLocaleString("pt-BR",{maximumFractionDigits:dec})}</text>`; }
  let pts=[],dots="",xl="",desc=[];
  vals.forEach((v,i)=>{ if(v==null) return; pts.push(`${X(i).toFixed(1)},${Y(v).toFixed(1)}`); desc.push(`${labels[i]}: ${Number(v).toLocaleString("pt-BR",{maximumFractionDigits:dec})}`);
    dots+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4.5" fill="${color}" stroke="#0B0B0B" stroke-width="2"/>`; });
  labels.forEach((l,i)=>{ xl+=`<text x="${X(i).toFixed(1)}" y="${H-8}" text-anchor="middle" fill="#9a9a9a" font-size="11">${esc(l)}</text>`; });
  const line=pts.length>1?`<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`:"";
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title+" — "+desc.join("; "))}">${grid}${line}${dots}${xl}</svg>`;
}

/* ---------- navegação ---------- */
const ui={tab:"inicio",view:"inicio",segPlano:"plano",segDiario:"registro",segEstr:0,foodQ:"",ob:{},obStep:0};
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
  const first=sh.querySelector("input:not([type=hidden]),select,textarea,button"); if(first) setTimeout(()=>first.focus(),30); }
function closeSheet(){ const m=$("#modal"); if(!m.classList.contains("open")) return; m.classList.remove("open"); $("#sheet").innerHTML="";
  if(_lastFocus&&document.contains(_lastFocus)) _lastFocus.focus(); _lastFocus=null; }
let _confirmCb=null;
function mConfirm(msg,cb,okLabel){ _confirmCb=cb; openSheet(`<h2 id="sheetTitle">Confirmar</h2><p>${msg}</p><div class="rowbtns"><button class="btn btn-ghost" onclick="App.close()">Cancelar</button><button class="btn btn-gold" onclick="App.confirmYes()">${esc(okLabel||"Confirmar")}</button></div>`); }
const menuRow=(v,label,sub,ic)=>`<button class="menurow" onclick="App.go('${v}')"><span class="ic" aria-hidden="true">${ic}</span><span style="flex:1">${label}<small>${sub}</small></span><span class="chev" aria-hidden="true">›</span></button>`;

/* ---------- linguagem simples: glossário e opções explicadas ---------- */
const GLOSS={
 kcal:["Calorias por dia","É quanto você deve comer por dia, somando todas as refeições, para chegar ao seu objetivo. É uma estimativa inicial: acompanhe seu peso por 2 a 3 semanas e ajuste se precisar."],
 tmb:["Gasto em repouso (TMB)","Energia que seu corpo gasta só para funcionar — respirar, bater o coração, manter a temperatura — mesmo se ficasse deitado o dia todo. Calculado com seu sexo, idade, peso e altura (fórmula de Mifflin-St Jeor)."],
 get:["Gasto total do dia (GET)","É o gasto em repouso somado a tudo o que você gasta se movimentando e treinando. Se comer exatamente isso, seu peso tende a ficar igual."],
 superavit:["Por que comer a mais?","Para construir músculo, o corpo precisa de energia extra: comer um pouco mais do que gasta. Essa “sobra” se chama superávit calórico. Sobra pequena = ganho mais lento e com menos gordura. Sobra grande = ganho mais rápido, mas com mais gordura."],
 macros:["Proteína, carboidrato e gordura","São os três grupos de nutrientes que têm calorias.<br><br><b>Proteína</b> (carnes, ovos, leite, feijão): constrói e recupera o músculo.<br><b>Carboidrato</b> (arroz, pão, batata, frutas): dá energia para treinar.<br><b>Gordura</b> (azeite, castanhas, ovos): essencial para os hormônios.<br><br>O app calcula quantos gramas de cada um você deve comer por dia."],
 gkg:["g/kg (gramas por quilo)","Quantidade por quilo do seu peso. Exemplo: 2 g/kg de proteína para quem pesa 70 kg = 140 g de proteína por dia.<br><br>Se não tiver certeza, deixe os valores sugeridos (proteína 2,0 e gordura 1,0)."],
 aderencia:["Seguiu o plano?","De 0 a 100%, o quanto você seguiu o plano no dia. Seguiu quase tudo = 90%. Fez metade das refeições = 50%.<br><br>Serve para saber se o resultado (ou a falta dele) vem do plano ou do dia a dia."],
 cintura:["Por que medir a cintura?","O peso sozinho não mostra se você ganhou músculo ou gordura. Se o peso sobe e a cintura quase não muda, é ótimo sinal.<br><br>Meça sempre no mesmo lugar (na altura do umbigo), de manhã, antes de comer."],
 ritmo:["Ganho esperado por semana","Para iniciantes, ganhar de 0,25% a 0,5% do peso por semana costuma significar mais músculo e pouca gordura. Ganhou mais rápido que isso? Observe a cintura. Não ganhou nada em 2 a 3 semanas? Aumente 100 a 150 kcal por dia."]
};
const helpBtn=(k)=>`<button type="button" class="help" onclick="App.help('${k}')" aria-label="Saiba mais: ${esc(GLOSS[k][0])}">?</button>`;
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
  const extra=pf.alvo-pf.get;
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
    <div class="kpi"><div class="l">Carboidratos</div><div class="v">${mc?fi(mc.carbsG):"—"} <em>g/dia</em></div></div>
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
  h+=`<div class="card"><h2>Alimentação</h2>${segRow("plano","Meu plano","Monte as refeições do dia","🍽️")}${segRow("estruturas","Cardápios-modelo","Exemplos de 2.200 • 2.800 • 3.400 kcal","🏛️")}${segRow("alimentos","Banco de alimentos",`${D.FOODS.length} alimentos + seus itens`,"🔍")}</div>`;
  h+=`<div class="card"><h2>Rotina</h2>${menuRow("compras","Lista de compras","Mercado e organização","🛒")}${menuRow("suple","Suplementação","Referências educacionais","💊")}</div>`;
  h+=`<footer class="appfoot"><b>FORTIS</b> • Disciplina, constância e fortaleza</footer>`;
  return h;
}

function selOpts(list,val){ return `<option value="">— Selecionar —</option>`+list.map(o=>{ const v=Array.isArray(o)?o[0]:o; return `<option value="${esc(v)}"${v===val?" selected":""}>${esc(v)}</option>`; }).join(""); }
function vPerfil(){ const p=S.profile;
  return `<div class="card"><h2>Seus dados</h2>
   <label class="f">Nome</label><input id="pf_nome" value="${esc(p.nome)}" placeholder="Seu nome" autocomplete="given-name" maxlength="80" onchange="App.pfSave()">
   <div class="f">Sexo</div>${optCards("Sexo",sexItems(),p.sexo,"App.pfPick_sexo").replace('class="opts"','class="opts two"')}
   <div class="grid3"><div><label class="f">Idade</label><input id="pf_idade" type="number" inputmode="numeric" min="10" max="100" value="${esc(p.idade)}" placeholder="anos" onchange="App.pfSave()"></div>
   <div><label class="f">Peso (kg)</label><input id="pf_peso" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${esc(p.peso)}" placeholder="kg" onchange="App.pfSave()"></div>
   <div><label class="f">Altura (cm)</label><input id="pf_altura" type="number" inputmode="numeric" min="100" max="250" value="${esc(p.altura)}" placeholder="cm" onchange="App.pfSave()"></div></div></div>
   <div class="card"><h2>Quanto você se movimenta?</h2>${optCards("Nível de atividade",actItems(),p.atividade,"App.pfPick_atividade")}</div>
   <div class="card"><h2>Qual é o seu objetivo? ${helpBtn("superavit")}</h2>${optCards("Objetivo",goalItems(),p.objetivo,"App.pfPick_objetivo")}</div>
   <div id="pfResult" aria-live="polite">${vPerfilResult()}</div>`;
}
function resultKpis(pf){ return `<div class="kpis">
    <div class="kpi big"><div class="l">Coma por dia ${helpBtn("kcal")}</div><div class="v">${fi(pf.alvo)} <em>kcal</em></div><div class="sub">${kcalExplica(pf)}</div></div>
    <div class="kpi"><div class="l">Gasto em repouso ${helpBtn("tmb")}</div><div class="v">${fi(pf.tmb)} <em>kcal</em></div></div>
    <div class="kpi"><div class="l">Gasto total do dia ${helpBtn("get")}</div><div class="v">${fi(pf.get)} <em>kcal</em></div></div></div>
    ${pf.ajuste>0?`<p class="small" style="margin:10px 0 0">📈 Ganho esperado: <b>${fi(pf.ritmoMin)} a ${fi(pf.ritmoMax)} g por semana</b> ${helpBtn("ritmo")}</p>`:""}`; }
function vPerfilResult(){ const pf=calcPerfil();
  if(!pf){ const p=S.profile, falta=[!p.sexo&&"sexo",!num(p.idade)&&"idade",!num(p.peso)&&"peso",!num(p.altura)&&"altura",!p.atividade&&"quanto se movimenta",!p.objetivo&&"objetivo"].filter(Boolean);
    return `<div class="card"><span class="pill p-warn">⚠ Falta preencher: ${esc(falta.join(", "))}</span></div>`; }
  return `<div class="card gold"><h2>Seu resultado</h2>${resultKpis(pf)}
    <p class="small" style="margin:10px 0 0"><span class="pill p-ok">✓ Perfil completo!</span> <a href="#" onclick="App.go('macros');return false" class="lnk">Ver proteína, carbo e gordura ›</a></p></div>`;
}

function vMacros(){ const pf=calcPerfil();
  if(!pf) return `<div class="card"><span class="pill p-warn">⚠ Preencha o Perfil primeiro</span><div class="rowbtns"><button class="btn btn-gold" onclick="App.go('perfil')">Ir para o perfil</button></div></div>`;
  return `<div id="mcResult" aria-live="polite">${vMacrosResult()}</div>
   <div class="card"><h2>Ajuste fino (opcional) ${helpBtn("gkg")}</h2><p class="small muted">Gramas por quilo do seu peso. Se não tiver certeza, deixe proteína <b>2,0</b> e gordura <b>1,0</b>. O carboidrato é calculado com as calorias que sobram.</p><div class="grid2">
   <div><label class="f">Proteína (1,6 a 2,2)</label><input id="mc_p" type="number" inputmode="decimal" step="0.1" min="0" max="5" value="${esc(S.macros.protKg)}" onchange="App.mcSave()"></div>
   <div><label class="f">Gordura (≈1,0)</label><input id="mc_g" type="number" inputmode="decimal" step="0.1" min="0" max="5" value="${esc(S.macros.gordKg)}" onchange="App.mcSave()"></div></div></div>`;
}
function vMacrosResult(){ const mc=calcMacros(); if(!mc) return "";
  const row=(l,v,u)=>`<div class="kpi"><div class="l">${l}</div><div class="v">${v}${u?` <em>${u}</em>`:""}</div></div>`;
  let h=`<div class="card gold"><h2>Quanto comer por dia ${helpBtn("macros")}</h2><div class="kpis">
   ${row("🥩 Proteína",fi(mc.protG),"g")}${row("🍚 Carboidratos",fi(Math.max(0,mc.carbsG)),"g")}${row("🥑 Gordura",fi(mc.gordG),"g")}${row("🥦 Fibras",mc.fibra==null?"—":mc.fibra,"g")}</div>
   <p class="small">🍽️ Em cada refeição, procure comer <b>${fi(mc.protMin)} a ${fi(mc.protMax)} g de proteína</b>.</p>
   <p class="small">Proteína: ${mc.alertaP==="ok"?'<span class="pill p-ok">Na faixa recomendada</span>':mc.alertaP==="low"?'<span class="pill p-warn">Abaixo do recomendado</span>':'<span class="pill p-bad">Acima do recomendado</span>'}
   • Gordura: ${mc.alertaG==="ok"?'<span class="pill p-ok">Adequada</span>':'<span class="pill p-bad">Baixa: avalie com um profissional</span>'}</p>
   ${mc.kR<0?'<div class="warnbox">⚠ As calorias não são suficientes para essa quantidade de proteína e gordura. Diminua os valores do ajuste fino.</div>':""}</div>`;
  h+=`<div class="card"><h2>De onde vêm suas calorias</h2>${pieSVG([{label:"Proteína",v:mc.kP,color:"#C99A2E"},{label:"Gordura",v:mc.kG,color:"#4CAF50"},{label:"Carboidratos",v:mc.carbsG*4,color:"#5C6BC0"}])}
   <div class="legend"><span><i style="background:#C99A2E"></i>Proteína ${pct(mc.pctP)}</span><span><i style="background:#4CAF50"></i>Gordura ${pct(mc.pctG)}</span><span><i style="background:#5C6BC0"></i>Carbos ${mc.kR<0?"0%":pct(mc.pctC)}</span></div></div>`;
  return h;
}

/* ----- plano ----- */
function segBar(label,segs,cur,fn){ return `<div class="seg" role="group" aria-label="${esc(label)}">${segs.map(s=>`<button class="${s[0]===cur?"on":""}" aria-pressed="${s[0]===cur}" onclick="${fn}('${s[0]}')">${s[1]}</button>`).join("")}</div>`; }
function vPlano(){ return segBar("Seções do plano",[["plano","Meu plano"],["estruturas","Modelos"],["alimentos","Alimentos"]],ui.segPlano,"App.segPlano")
  + (ui.segPlano==="plano"?vPlanoDia():ui.segPlano==="estruturas"?vEstruturas():vAlimentos()); }
function vPlanoDia(){ const t=planTotals(),pf=calcPerfil(),mc=calcMacros();
  const metas=[["Kcal",t.k,pf?pf.alvo:null],["Proteína (g)",t.p,mc?mc.protG:null],["Carboidratos (g)",t.c,mc?mc.carbsG:null],["Gorduras (g)",t.g,mc?mc.gordG:null],["Fibras (g)",t.f,mc?mc.fibra:null]];
  let h=`<div class="card gold"><h2>Resumo do dia</h2><div class="tblwrap"><table><tr><th scope="col"><span class="sr">Item</span></th><th scope="col">Real</th><th scope="col">Meta</th><th scope="col">Status</th></tr>`;
  metas.forEach(m=>{ const st=C.statusOf(m[1],m[2]); h+=`<tr><td class="l">${m[0]}</td><td>${fi(m[1])}</td><td>${m[2]==null?"—":fi(m[2])}</td><td>${st[0]?`<span class="pill ${st[1]}">${st[0]}</span>`:"—"}</td></tr>`; });
  h+=`</table></div><p class="muted small">“Dentro de ±5%” = você está perto da meta. Pese os alimentos e não esqueça azeite, molhos e pastas.</p></div>`;
  h+=`<button class="btn btn-gold" onclick="App.mPlanItem()">＋ Adicionar alimento</button><div style="height:10px"></div>`;
  const m=foodMap();
  const meals=[...D.MEALS8,...new Set(S.plan.map(it=>it.m).filter(x=>!D.MEALS8.includes(x)))];
  meals.forEach(meal=>{ const idxs=[]; S.plan.forEach((it,i)=>{ if(it.m===meal) idxs.push(i); });
    if(!idxs.length) return; const s=mealSub(meal);
    h+=`<div class="mealhead"><b>${esc(meal||"Sem refeição")}</b><span>${fi(s.k)} kcal • P ${fi(s.p)}g</span></div>`;
    idxs.forEach(i=>{ const it=S.plan[i],f=m[it.f]; const q=num(it.q)||0;
      h+=`<div class="item"><div class="grow"><div class="t">${esc(it.f)}</div><div class="s">${f?`${fi(f.k*q/100)} kcal • P ${f1(f.p*q/100)} • C ${f1(f.c*q/100)} • G ${f1(f.f*q/100)}`:'<span class="pill p-warn">Alimento não encontrado no banco</span>'}</div></div>
      <input id="pq${i}" type="number" inputmode="numeric" min="0" step="1" value="${esc(it.q)}" onchange="App.planQty(${i},this.value)" aria-label="Gramas de ${esc(it.f)}"><span class="muted small" aria-hidden="true">g</span>
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
    h+=`<div class="item"><div class="grow"><div class="s">${esc(r[1])}${unknown?' <span class="pill p-warn">não encontrado</span>':""}</div><input id="ef${j}" list="dlFoods" value="${esc(sel.f)}" placeholder="Escolher alimento…" aria-label="Alimento para ${esc(r[0]+" — "+r[1])}" onchange="App.estrFood(${i},${j},this.value)" style="margin-top:4px"></div><input id="eq${j}" type="number" inputmode="numeric" min="0" step="1" value="${esc(sel.q)}" aria-label="Gramas" onchange="App.estrQty(${i},${j},this.value)"><span class="muted small" aria-hidden="true">g</span></div>`;
  });
  const t=C.sumItems(sels.slice(0,st.rows.length),m), diff=t.k-st.kcal;
  h+=`<div class="card gold" id="estrTotal"><h2>Total do cardápio</h2><div class="kpis"><div class="kpi big"><div class="l">Total</div><div class="v">${fi(t.k)} <em>kcal</em></div></div>
   <div class="kpi"><div class="l">Proteína</div><div class="v">${fi(t.p)} <em>g</em></div></div><div class="kpi"><div class="l">Carbos</div><div class="v">${fi(t.c)} <em>g</em></div></div></div>
   <p class="small">Diferença vs alvo: <b>${diff>=0?"+":""}${fi(diff)} kcal</b> (alvo aprox. ${st.kcal.toLocaleString("pt-BR")} kcal)</p>
   <p class="muted small">Os valores finais dependem das quantidades, marcas e preparo. Não constitui prescrição individual.</p></div>`;
  return h;
}
function foodListHTML(){ const q=ui.foodQ.trim().toLowerCase();
  const all=[...D.FOODS.map(f=>({n:f[0],k:f[1],p:f[2],c:f[3],f:f[4],fib:f[5],e:f[6],src:f[7],v:f[8],custom:false})),
    ...S.customFoods.map((f,ix)=>({...f,custom:true,ix}))];
  const norm=s=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  const nq=norm(q), list=q?all.filter(f=>norm(f.n).includes(nq)):all;
  let h=""; list.slice(0,150).forEach(f=>{ h+=`<div class="item"><div class="grow"><div class="t">${esc(f.n)} ${f.v==="WARN"?'<span class="pill p-warn">conferir</span>':""} ${f.custom?'<span class="pill p-info">meu</span>':""}</div>
    <div class="s">${fi(f.k)} kcal • P ${f1(f.p)} • C ${f1(f.c)} • G ${f1(f.f)} • Fib ${f1(f.fib)} • ${esc(f.e)}${f.custom?"":" • "+esc(f.src)}</div></div>
    ${f.custom?`<button class="iconbtn" onclick="App.mFood(${f.ix})" aria-label="Editar ${esc(f.n)}">✎</button><button class="iconbtn danger" onclick="App.foodDel(${f.ix})" aria-label="Excluir ${esc(f.n)}">🗑</button>`:""}</div>`; });
  if(!list.length) h=`<div class="card"><p class="muted">Nenhum alimento encontrado. Cadastre o seu!</p></div>`;
  return {html:h,count:`${list.length} de ${all.length} alimentos • Valores aproximados. Confira o rótulo.`};
}
function vAlimentos(){ const r=foodListHTML();
  return `<div class="card"><h2>Banco de alimentos (por 100 g)</h2>
   <input id="foodSearch" type="search" placeholder="🔍 Buscar alimento…" aria-label="Buscar alimento" value="${esc(ui.foodQ)}" oninput="App.foodQ(this.value)">
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
function vProgresso(){ const pd=C.progressData(S.diary); const withN=pd.filter(w=>w.n>0);
  let h=`<div class="goldbox"><b>📊 Médias semanais</b> calculadas do seu Registro. Analise tendências de 2–3 semanas — oscilações diárias não representam necessariamente ganho ou perda de tecido.</div><div style="height:10px"></div>`;
  if(!withN.length) return h+`<div class="card"><p class="muted">Registre dias na aba Diário para ver seu progresso aqui.</p></div>`;
  h+=`<div class="card"><h2>Tabela semanal</h2><div class="tblwrap"><table><tr><th scope="col">Sem</th><th scope="col">Peso</th><th scope="col">Cint</th><th scope="col">Kcal</th><th scope="col">Prot</th><th scope="col">Sono</th><th scope="col">Tr</th><th scope="col">Plano</th><th scope="col">Var</th></tr>`;
  withN.forEach(w=>{ h+=`<tr><td><b>${w.w}</b></td><td>${w.peso==null?"—":f1(w.peso)}</td><td>${w.cint==null?"—":f1(w.cint)}</td><td>${w.kcal==null?"—":fi(w.kcal)}</td><td>${w.prot==null?"—":fi(w.prot)}</td><td>${w.sono==null?"—":f1(w.sono)}</td><td>${w.treinos}</td><td>${w.ader==null?"—":fi(w.ader)+"%"}</td><td>${w.var==null?"—":pct(w.var,1)}</td></tr>`; });
  h+=`</table></div><p class="muted small">Var = variação média semanal do peso em relação à semana anterior com pesagem.</p></div>`;
  const lb=withN.map(w=>"S"+w.w);
  h+=`<div class="card"><h2>Peso médio (kg)</h2>${lineSVG("Peso médio (kg)",lb,withN.map(w=>w.peso),"#C99A2E",1)}</div>`;
  h+=`<div class="card"><h2>Cintura média (cm)</h2>${lineSVG("Cintura média (cm)",lb,withN.map(w=>w.cint),"#4CAF50",1)}</div>`;
  h+=`<div class="card"><h2>Seguiu o plano — média (%)</h2>${lineSVG("Seguiu o plano — média (%)",lb,withN.map(w=>w.ader),"#5C6BC0",0)}</div>`;
  h+=`<div class="card"><h2>Sono médio (h)</h2>${lineSVG("Sono médio (h)",lb,withN.map(w=>w.sono),"#E8BE4E",1)}</div>`;
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
  let h=`<div class="card gold"><h2>${done} de ${items.length} itens comprados</h2><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${done}"><i style="width:${items.length?done/items.length*100:0}%"></i></div>
  <div class="rowbtns"><button class="btn btn-ghost btn-sm" onclick="App.mShopItem()">＋ Adicionar item</button><button class="btn btn-ghost btn-sm" onclick="App.shopReset()">Desmarcar todos</button></div></div>`;
  const cats=[...D.SHOP_CATS,...new Set(S.shopCustom.map(c=>c.cat).filter(c=>!D.SHOP_CATS.includes(c)))];
  cats.forEach(cat=>{ const rows=items.map((it,ix)=>({it,ix})).filter(x=>x.it.cat===cat); if(!rows.length) return;
    h+=`<div class="mealhead"><b>${esc(cat||"Outros")}</b><span>${rows.filter(x=>x.it.marcado).length}/${rows.length}</span></div>`;
    rows.forEach(({it,ix})=>{ h+=`<div class="item${it.marcado?" done":""}"><button class="shopcheck${it.marcado?" on":""}" role="checkbox" aria-checked="${!!it.marcado}" aria-label="${esc(it.n)}" onclick="App.shopToggle(${ix})">✔</button>
     <div class="grow"><div class="t">${esc(it.n)}</div></div>
     <input type="text" inputmode="decimal" value="${esc(it.qtd||"")}" placeholder="Qtd" aria-label="Quantidade de ${esc(it.n)}" maxlength="20" onchange="App.shopQ(${ix},this.value)" style="width:64px;padding:8px;text-align:center">
     <input type="text" value="${esc(it.unid||"")}" placeholder="Un." aria-label="Unidade de ${esc(it.n)}" maxlength="20" onchange="App.shopU(${ix},this.value)" style="width:58px;padding:8px;text-align:center">
     ${it.custom?`<button class="iconbtn danger" onclick="App.shopDel(${ix})" aria-label="Excluir ${esc(it.n)}">🗑</button>`:""}</div>`; });
  });
  return h;
}
function vSuple(){ const seg=(key,val,nome)=>`<div class="seg" role="group" aria-label="Uso de ${esc(nome)}" style="margin:8px 0 0"><button class="${val==="Sim"?"on":""}" aria-pressed="${val==="Sim"}" onclick="App.supleSet('${key}',1)">Uso</button><button class="${val==="Não"?"on":""}" aria-pressed="${val==="Não"}" onclick="App.supleSet('${key}',0)">Não uso</button></div>`;
  let h=`<div class="goldbox" style="margin-bottom:10px">Suplementos <b>não são obrigatórios</b>. Conteúdo educacional — na dúvida, fale com um profissional.</div>`;
  D.SUPLE.forEach((s,i)=>{ const v=S.supleUsa["b"+i]||"";
    h+=`<div class="card"><h2>${esc(s.n)}</h2><p class="small"><b>Finalidade:</b> ${esc(s.f)}<br><b>Dose de referência:</b> ${esc(s.d)}<br><b>Horário:</b> ${esc(s.h)}<br><span class="muted">${esc(s.o)}</span></p>${seg("b"+i,v,s.n)}</div>`; });
  S.supleCustom.forEach(s=>{ const key="c_"+s.id;
    h+=`<div class="card"><h2>${esc(s.n)} <span class="pill p-info">meu</span></h2><p class="small">${esc(s.f)}${s.d?" • "+esc(s.d):""}${s.h?" • "+esc(s.h):""}${s.o?`<br><span class="muted">${esc(s.o)}</span>`:""}</p>${seg(key,S.supleUsa[key]||"",s.n)}<div class="rowbtns"><button class="btn btn-danger btn-sm" onclick="App.supleDel('${s.id}')">Excluir</button></div></div>`; });
  h+=`<button class="btn btn-ghost" onclick="App.mSuple()">＋ Adicionar suplemento</button>`;
  h+=`<div style="height:10px"></div><div class="warnbox">Pessoas com doença renal, condições clínicas relevantes ou uso contínuo de medicamentos devem buscar orientação profissional antes de iniciar qualquer suplemento.</div>`;
  return h;
}
function vSobre(){ return `<div class="hero"><img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-zzEv8aiUXyc0FMlgiqC11JWN8CCJK2.png" alt="Capa do guia FORTIS — escudo dourado com capacete espartano sobre fundo preto" loading="lazy"></div>
  <div class="card gold"><h2>Guia completo para ganhar massa magra</h2>
  <div class="badges5">${D.BADGES5.map(b=>`<div><b aria-hidden="true">✓</b>${esc(b)}</div>`).join("")}</div>
  <p class="small" style="text-align:center"><b>Resultados reais, sem complicação.</b></p></div>
  <div class="card"><h2>Como usar — 5 passos</h2>
  ${[["1 • Perfil","Preencha seus dados e descubra TMB, GET e calorias-alvo."],["2 • Macros","Confira as metas de proteína, gordura, carbos e fibras."],["3 • Plano","Monte as refeições com o banco de alimentos."],["4 • Diário","Registre peso, medidas, sono, treino e aderência."],["5 • Progresso","Analise as médias semanais e os gráficos."]].map(s=>`<div class="checkrow"><b>${s[0]}</b><span>${s[1]}</span></div>`).join("")}</div>
  <div class="card"><h2>Regras</h2>
  <div class="checkrow"><b aria-hidden="true">▸</b><span>Analise tendências de 2–3 semanas antes de alterar o plano.</span></div>
  <div class="checkrow"><b aria-hidden="true">▸</b><span>Pese os alimentos; considere azeite, molhos e pastas.</span></div>
  <div class="checkrow"><b aria-hidden="true">▸</b><span>Oscilações diárias de peso são normais.</span></div></div>
  <div class="warnbox">Esta ferramenta tem finalidade educacional e <b>não substitui</b> avaliação individual com nutricionista, médico ou outro profissional habilitado. Os resultados são estimativas. Pessoas com doenças, uso contínuo de medicamentos, gestantes, lactantes, menores de idade ou com histórico de transtornos alimentares devem buscar orientação profissional.</div>
  <footer class="appfoot"><b>FORTIS</b> • Nutrição, saúde e suplementação<br>Disciplina, constância e fortaleza</footer>`;
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
  refreshFoodList();
  const bi=$("#btnInstall"); if(bi&&deferredPrompt) bi.style.display="inline-block";
}
/* re-renderiza depois que o foco já foi para o próximo campo e o devolve a ele (campos com id estável) */
function renderKeepFocus(){ setTimeout(()=>{ const a=document.activeElement, id=a&&a.id, y=window.scrollY;
  render(); window.scrollTo(0,y); if(id){ const el=document.getElementById(id); if(el&&el!==document.activeElement) el.focus(); } },0); }
function renderOnboarding(){ document.title="FORTIS — Bem-vindo";
  $("#brandTitle").innerHTML=BRAND; $("#viewtitle").innerHTML=ui.obStep?`<h1>Primeiros passos</h1>`:"";
  const view=$("#view"); view.innerHTML=vOnboarding(); linkLabels(view); $("#tabbar").innerHTML=""; refreshFoodList(); }

/* ================= modais de edição ================= */
const actions=(ok)=>`<div class="rowbtns"><button type="button" class="btn btn-ghost" onclick="App.close()">Cancelar</button><button class="btn btn-gold" type="submit">${ok}</button></div>`;
function mPlanItem(){ openSheet(`<h2 id="sheetTitle">Adicionar alimento</h2>
  <form onsubmit="return App.savePlan(event)"><label class="f">Refeição</label><select id="m_m">${D.MEALS8.map(m=>`<option${m===ui.lastMeal?" selected":""}>${esc(m)}</option>`).join("")}</select>
  <label class="f">Alimento</label><input id="m_f" list="dlFoods" placeholder="Buscar no banco…" autocomplete="off" required>
  <label class="f">Quantidade (g)</label><input id="m_q" type="number" inputmode="numeric" min="1" max="5000" step="1" placeholder="Ex.: 150" required>
  ${actions("Adicionar")}</form>`); }
function mDiary(id){ const r=id?S.diary.find(x=>x.id===id):null;
  const v=k=>r?esc(r[k]||""):"";
  openSheet(`<h2 id="sheetTitle">${r?"Editar":"Registrar"} dia</h2><form onsubmit="return App.saveDiary(event,'${r?r.id:""}')">
  <div class="grid2"><div><label class="f">Data</label><input id="d_data" type="date" value="${r?esc(r.data):todayISO()}" max="${todayISO()}" required></div>
  <div><label class="f">Treinou?</label><select id="d_treino"><option value="">—</option><option${r&&r.treinou==="Sim"?" selected":""}>Sim</option><option${r&&r.treinou==="Não"?" selected":""}>Não</option></select></div></div>
  <div class="grid2"><div><label class="f">Peso (kg)</label><input id="d_peso" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${v("peso")}"></div>
  <div>${labelHelp("Cintura (cm)","cintura")}<input id="d_cint" type="number" inputmode="decimal" step="0.1" min="40" max="250" value="${v("cintura")}"></div></div>
  <div class="grid2"><div><label class="f">Calorias</label><input id="d_kcal" type="number" inputmode="numeric" min="0" max="15000" value="${v("kcal")}"></div>
  <div><label class="f">Proteína (g)</label><input id="d_prot" type="number" inputmode="numeric" min="0" max="1000" value="${v("prot")}"></div></div>
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
function mFood(ix){ const f=ix!=null?S.customFoods[ix]:null; const v=k=>f?esc(f[k]??""):"";
  openSheet(`<h2 id="sheetTitle">${f?"Editar":"Cadastrar"} alimento</h2><p class="muted small">Valores por 100 g.</p><form onsubmit="return App.saveFood(event,${ix==null?"null":ix})">
  <label class="f">Nome</label><input id="f_n" value="${v("n")}" maxlength="120" required>
  <div class="grid3"><div><label class="f">Kcal</label><input id="f_k" type="number" inputmode="decimal" step="0.1" min="0" max="900" value="${v("k")}" required></div>
  <div><label class="f">Prot</label><input id="f_p" type="number" inputmode="decimal" step="0.1" min="0" max="100" value="${v("p")}"></div>
  <div><label class="f">Carb</label><input id="f_c" type="number" inputmode="decimal" step="0.1" min="0" max="100" value="${v("c")}"></div></div>
  <div class="grid3"><div><label class="f">Gord</label><input id="f_f" type="number" inputmode="decimal" step="0.1" min="0" max="100" value="${v("f")}"></div>
  <div><label class="f">Fibra</label><input id="f_fib" type="number" inputmode="decimal" step="0.1" min="0" max="100" value="${v("fib")}"></div>
  <div><label class="f">Estado</label><select id="f_e">${["cru","cozido","pronto"].map(e=>`<option${v("e")===e?" selected":""}>${e}</option>`).join("")}</select></div></div>
  ${actions("Salvar")}</form>`); }
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
    <img class="wlogo" src="assets/logo.svg" width="140" height="168" alt="">
    <h2 class="wtitle">Ganhe massa magra<span>sem passar fome</span></h2>
    <div class="brushbar"></div>
    <p class="wlead">Em 2 minutos o FORTIS calcula <b>quanto você deve comer por dia</b> e te ajuda a acompanhar sua evolução.</p>
    <ul class="wlist">
      <li><span aria-hidden="true">🔥</span><div><b>Quanto comer</b><small>Calorias e proteína certas para o seu corpo</small></div></li>
      <li><span aria-hidden="true">🍽️</span><div><b>O que comer</b><small>Monte refeições com ${D.FOODS.length} alimentos do dia a dia</small></div></li>
      <li><span aria-hidden="true">📈</span><div><b>Sua evolução</b><small>Registre peso e treino e veja gráficos semanais</small></div></li>
    </ul>
    <button class="btn btn-gold" onclick="App.obNext()">Começar</button>
    <button class="linkbtn" onclick="App.obSkip()">Só quero explorar o app</button>
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
   <p class="small muted" style="margin:10px 0 0">Você pode mudar tudo isso depois em <b>Mais → Perfil e metas</b>.</p>
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
   save(); $("#pfResult").innerHTML=vPerfilResult(); },
 mcSave(){ const p=num($("#mc_p").value),g=num($("#mc_g").value);
   S.macros={protKg:p!=null&&p>=0?p:S.macros.protKg,gordKg:g!=null&&g>=0?g:S.macros.gordKg}; save(); $("#mcResult").innerHTML=vMacrosResult(); },
 help(k){ const g=GLOSS[k]; if(!g) return; openSheet(`<h2 id="sheetTitle">${g[0]}</h2><p class="small" style="line-height:1.6">${g[1]}</p><div class="rowbtns"><button class="btn btn-gold" onclick="App.close()">Entendi</button></div>`); },
 mPlanItem, mDiary, mTreino, mFood, mShopItem, mSuple,
 savePlan(e){ e.preventDefault(); const m=foodMap(),f=$("#m_f").value.trim(),q=$("#m_q").value;
   if(!m[f]){ toast("Escolha um alimento válido do banco (digite e selecione da lista)."); $("#m_f").focus(); return false; }
   if(!(num(q)>0)){ toast("Informe a quantidade em gramas."); $("#m_q").focus(); return false; }
   ui.lastMeal=$("#m_m").value; S.plan.push({m:ui.lastMeal,f,q}); save(); closeSheet(); render(); return false; },
 planQty(i,v){ if(!S.plan[i]) return; S.plan[i].q=num(v)!=null&&num(v)>=0?String(num(v)):""; save(); renderKeepFocus(); },
 planDel(i){ mConfirm("Remover este item do plano?",()=>{ S.plan.splice(i,1); save(); render(); }); },
 planClear(){ mConfirm("Remover todos os itens do plano?",()=>{ S.plan=[]; save(); render(); }); },
 estrFood(i,j,v){ if(!S.estr[i]) S.estr[i]=[]; if(!S.estr[i][j]) S.estr[i][j]={f:"",q:""}; S.estr[i][j].f=v.trim(); save(); renderKeepFocus(); },
 estrQty(i,j,v){ if(!S.estr[i]) S.estr[i]=[]; if(!S.estr[i][j]) S.estr[i][j]={f:"",q:""}; S.estr[i][j].q=num(v)!=null&&num(v)>=0?String(num(v)):""; save(); renderKeepFocus(); },
 foodQ(v){ ui.foodQ=v; const r=foodListHTML(); $("#foodlist").innerHTML=r.html; $("#foodCount").textContent=r.count; },
 saveFood(e,ix){ e.preventDefault(); const g=id=>$(id).value.trim();
   const f={n:g("#f_n").replace(/\s+/g," "),k:num(g("#f_k"))||0,p:num(g("#f_p"))||0,c:num(g("#f_c"))||0,f:num(g("#f_f"))||0,fib:num(g("#f_fib"))||0,e:$("#f_e").value,src:"Meu cadastro",v:"OK"};
   if(!f.n){ toast("Informe o nome do alimento."); return false; }
   const low=f.n.toLowerCase();
   if(isBaseFood(f.n)){ toast("Já existe um alimento com esse nome no banco. Use outro nome (ex.: “"+f.n+" (marca)”)."); return false; }
   if(S.customFoods.some((x,i)=>i!==ix&&x.n.toLowerCase()===low)){ toast("Você já cadastrou um alimento com esse nome."); return false; }
   if(f.p*4+f.c*4+f.f*9>f.k*1.25+20) toast("Atenção: os macros somam bem mais que as kcal informadas. Confira o rótulo.");
   if(ix==null) S.customFoods.push(f); else { renameFoodRefs(S.customFoods[ix].n,f.n); S.customFoods[ix]=f; }
   save(); closeSheet(); render(); return false; },
 foodDel(ix){ const f=S.customFoods[ix]; if(!f) return;
   const uses=S.plan.filter(it=>it.f===f.n).length;
   mConfirm(`Excluir “${esc(f.n)}”?${uses?` Ele está em ${uses} item(ns) do seu plano.`:""}`,()=>{ S.customFoods.splice(ix,1); save(); render(); }); },
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
 diaryDel(id){ mConfirm("Excluir este registro?",()=>{ S.diary=S.diary.filter(x=>x.id!==id); save(); render(); }); },
 saveTreino(e,id){ e.preventDefault(); const g=x=>$(x).value.trim();
   const r={id:id||uid(),data:g("#t_data"),grupo:g("#t_grupo"),exercicio:g("#t_ex"),series:g("#t_ser"),reps:g("#t_rep"),carga:g("#t_car"),obs:g("#t_obs")};
   if(!C.isISODate(r.data)){ toast("Informe uma data válida."); return false; }
   if(!inRange(r.series,0,50)||!inRange(r.carga,0,1000)){ toast("Confira séries (0–50) e carga (0–1.000 kg)."); return false; }
   const i=S.treino.findIndex(x=>x.id===r.id); if(i>=0) S.treino[i]=r; else S.treino.push(r); contarEdicao();
   save(); closeSheet(); render(); return false; },
 treinoDel(id){ mConfirm("Excluir este treino?",()=>{ S.treino=S.treino.filter(x=>x.id!==id); save(); render(); }); },
 saveShop(e){ e.preventDefault(); const n=$("#s_n").value.trim(); if(!n) return false;
   S.shopCustom.push({cat:$("#s_cat").value,n,qtd:"",unid:"",marcado:false}); save(); closeSheet(); render(); return false; },
 shopToggle(ix){ const it=shopFlat()[ix]; if(!it) return;
   if(it.custom){ const c=S.shopCustom[it.ix]; c.marcado=!c.marcado; } else { const st=S.shop[it.n]||{}; st.marcado=!st.marcado; S.shop[it.n]=st; }
   save(); const y=window.scrollY; render(); window.scrollTo(0,y); },
 shopQ(ix,v){ const it=shopFlat()[ix]; if(!it) return;
   if(it.custom) S.shopCustom[it.ix].qtd=v.trim(); else { const st=S.shop[it.n]||{}; st.qtd=v.trim(); S.shop[it.n]=st; } save(); },
 shopU(ix,v){ const it=shopFlat()[ix]; if(!it) return;
   if(it.custom) S.shopCustom[it.ix].unid=v.trim(); else { const st=S.shop[it.n]||{}; st.unid=v.trim(); S.shop[it.n]=st; } save(); },
 shopDel(ix){ const it=shopFlat()[ix]; if(!it||!it.custom) return;
   mConfirm("Excluir este item?",()=>{ S.shopCustom.splice(it.ix,1); save(); render(); }); },
 shopReset(){ Object.keys(S.shop).forEach(k=>{S.shop[k].marcado=false;}); S.shopCustom.forEach(c=>c.marcado=false); save(); render(); },
 supleSet(key,sim){ S.supleUsa[key]=sim?"Sim":"Não"; save(); const y=window.scrollY; render(); window.scrollTo(0,y); },
 saveSuple(e){ e.preventDefault(); const g=x=>$(x).value.trim(); if(!g("#u_n")) return false;
   S.supleCustom.push({id:uid(),n:g("#u_n"),f:g("#u_f"),d:g("#u_d"),h:g("#u_h"),o:g("#u_o")}); save(); closeSheet(); render(); return false; },
 supleDel(id){ mConfirm("Excluir este suplemento?",()=>{ S.supleCustom=S.supleCustom.filter(s=>s.id!==id); delete S.supleUsa["c_"+id]; save(); render(); }); },
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
     if(!d||typeof d!=="object"||typeof d.profile!=="object"){ toast("Arquivo inválido: não parece um backup do FORTIS."); return; }
     const clean=C.sanitizeState(d,uid);
     const resumo=`${clean.diary.length} registro(s) diário(s), ${clean.treino.length} treino(s), ${clean.plan.length} item(ns) no plano e ${clean.customFoods.length} alimento(s) próprio(s)`;
     mConfirm(`Substituir TODOS os dados atuais pelo backup?<br><span class="muted small">${esc(resumo)}.</span>`,()=>{ S=clean; S.onboarded=true; S.meta.lastBackup=new Date().toISOString(); S.meta.editsSinceBackup=0; if(!S.meta.createdAt) S.meta.createdAt=S.meta.lastBackup; save(); ui.view="inicio"; ui.tab="inicio"; render(); toast("Backup importado."); },"Importar"); };
   rd.onerror=()=>toast("Não foi possível ler o arquivo.");
   rd.readAsText(f); },
 exportCSV(){ const dec=v=>v===""||v==null?"":String(v).replace(".",",");   // Excel pt-BR: “;” separa colunas, “,” é decimal
   const cell=v=>{ const s=String(v==null?"":v); return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; };
   const rows=[["data","semana","peso","cintura","kcal","proteina","sono","treinou","aderencia"]];
   diarySorted().forEach(r=>rows.push([r.data,weekOf(r.data)||"",dec(r.peso),dec(r.cintura),dec(r.kcal),dec(r.prot),dec(r.sono),r.treinou,dec(r.aderencia)]));
   const csv=rows.map(r=>r.map(cell).join(";")).join("\r\n");
   download(new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"}),`fortis-registro-${todayISO()}.csv`); },
 resetAll(){ mConfirm("Apagar TODOS os dados do app? Isso não pode ser desfeito.",()=>{ S=C.defState(); S.meta.createdAt=new Date().toISOString(); save(); ui.view="inicio"; ui.tab="inicio"; ui.ob={}; ui.obStep=0; render(); window.scrollTo(0,0); },"Apagar tudo"); },
 /* onboarding */
 obNext(){ obCollect(); const err=obValidate(ui.obStep); if(err){ toast(err); return; }
   if(ui.obStep>=OB_LAST){ obFinish(); return; }
   ui.obStep++; render(); window.scrollTo(0,0); },
 obBack(){ obCollect(); ui.obStep=Math.max(0,ui.obStep-1); render(); window.scrollTo(0,0); },
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
if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)){
  try{ navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).catch(()=>{}); }catch(e){}
}
if(!S.meta.createdAt) S.meta.createdAt=new Date().toISOString();
save();     // persiste a migração/validação feita na carga
render();
})();
