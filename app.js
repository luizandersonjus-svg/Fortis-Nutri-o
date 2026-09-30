/* ================= FORTIS PWA — lógica do app (100% local/offline) ================= */
(function(){
"use strict";
const D = window.FORTIS;
const $ = (s, r) => (r||document).querySelector(s);
const $$ = (s, r) => Array.from((r||document).querySelectorAll(s));

/* ---------- storage seguro ---------- */
const store = {
  mem:{},
  get(k,fb){ try{ const v=localStorage.getItem(k); if(v!=null) return JSON.parse(v); }catch(e){} return (k in this.mem)?this.mem[k]:fb; },
  set(k,v){ this.mem[k]=v; try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} },
  del(k){ delete this.mem[k]; try{ localStorage.removeItem(k); }catch(e){} }
};
const KEY="fortis_pwa_v1";
const defState=()=>({profile:{nome:"",sexo:"",idade:"",peso:"",altura:"",atividade:"",objetivo:""},
  macros:{protKg:2,gordKg:1}, customFoods:[], plan:[], estr:{0:[],1:[],2:[]},
  diary:[], treino:[], shop:{}, shopCustom:[], supleUsa:{}, supleCustom:[], onboarded:false});
let S=Object.assign(defState(),store.get(KEY,{}));
if(!S.macros) S.macros={protKg:2,gordKg:1};
const save=()=>{ store.set(KEY,S); refreshFoodList(); };

/* ---------- helpers ---------- */
const esc=(s)=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const num=(v)=>{ if(v==null||v==="") return null; const n=parseFloat(String(v).replace(",",".")); return isFinite(n)?n:null; };
const fi=(n)=>n==null||!isFinite(n)?"—":Math.round(n).toLocaleString("pt-BR");
const f1=(n)=>n==null||!isFinite(n)?"—":Number(n).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1});
const f2=(n)=>n==null||!isFinite(n)?"—":Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=(n,d)=>n==null||!isFinite(n)?"—":(n*100).toLocaleString("pt-BR",{minimumFractionDigits:d||0,maximumFractionDigits:d||0})+"%";
const pDate=(iso)=>{ const p=String(iso).split("-"); return new Date(+p[0],+p[1]-1,+p[2]); };
const dataBR=(iso)=>{ if(!iso) return "—"; const p=String(iso).split("-"); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:iso; };
const todayISO=()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const saudacao=()=>{ const h=new Date().getHours(); return h<12?"Bom dia":h<18?"Boa tarde":"Boa noite"; };

/* ---------- alimentos ---------- */
function foodMap(){ const m={};
  D.FOODS.forEach(f=>m[f[0]]={n:f[0],k:f[1],p:f[2],c:f[3],f:f[4],fib:f[5],e:f[6],src:f[7],v:f[8],custom:false});
  S.customFoods.forEach(f=>m[f.n]={...f,custom:true});
  return m;
}
function refreshFoodList(){ const dl=$("#dlFoods"); if(!dl) return;
  const names=[...D.FOODS.map(f=>f[0]),...S.customFoods.map(f=>f.n)].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  dl.innerHTML=names.map(n=>`<option value="${esc(n)}">`).join("");
}

/* ---------- cálculos (espelham a planilha) ---------- */
function calcPerfil(){ const p=S.profile;
  const peso=num(p.peso), alt=p.atura===""?null:parseInt(p.altura,10), idade=p.idade===""?null:parseInt(p.idade,10);
  const a=D.ACTS.find(x=>x[0]===p.atividade), g=D.GOALS.find(x=>x[0]===p.objetivo);
  if(!p.sexo||idade==null||isNaN(idade)||peso==null||alt==null||isNaN(alt)||!a||!g) return null;
  const tmb=p.sexo==="Masculino"?10*peso+6.25*alt-5*idade+5:10*peso+6.25*alt-5*idade-161;
  const get=tmb*a[1], alvo=get*(1+g[1]);
  return {tmb,get,alvo,fator:a[1],ajuste:g[1],peso,ritmoMin:peso*0.0025*1000,ritmoMax:peso*0.005*1000};
}
function calcMacros(){ const pf=calcPerfil(), pk=num(S.macros.protKg), gk=num(S.macros.gordKg);
  if(!pf||pk==null||gk==null) return null;
  const protG=pf.peso*pk, gordG=pf.peso*gk, kP=protG*4, kG=gordG*9, kR=pf.alvo-kP-kG;
  const carbsG=kR/4, carbsKg=carbsG/pf.peso;
  const fibra=S.profile.sexo==="Masculino"?38:S.profile.sexo==="Feminino"?25:null;
  return {protG,gordG,kP,kG,kR,carbsG,carbsKg,pctP:kP/pf.alvo,pctG:kG/pf.alvo,pctC:carbsG*4/pf.alvo,
    fibra,alertaP:pk<1.6?"low":pk>2.2?"high":"ok",
    alertaG:(kG/pf.alvo)<0.2?"low":"ok",protMin:pf.peso*0.3,protMax:pf.peso*0.4,alvo:pf.alvo};
}
function planTotals(){ const m=foodMap(); let k=0,p=0,c=0,g=0,f=0;
  S.plan.forEach(it=>{ const f_=m[it.f]; const q=num(it.q)||0; if(!f_) return;
    k+=f_.k*q/100; p+=f_.p*q/100; c+=f_.c*q/100; g+=f_.f*q/100; f+=f_.fib*q/100; });
  return {k,p,c,g,f};
}
function mealSub(meal){ const m=foodMap(); let k=0,p=0,c=0,g=0;
  S.plan.forEach(it=>{ if(it.m!==meal) return; const f_=m[it.f]; const q=num(it.q)||0; if(!f_) return;
    k+=f_.k*q/100; p+=f_.p*q/100; c+=f_.c*q/100; g+=f_.f*q/100; });
  return {k,p,c,g};
}
function statusOf(real,meta){ if(real==null||meta==null||!meta) return ["",""];
  const d=Math.abs(real-meta)/meta;
  if(d<=0.05) return ["Dentro de ±5%","p-ok"];
  return real<meta?["Abaixo","p-warn"]:["Acima","p-bad"];
}
function diarySorted(){ return [...S.diary].sort((a,b)=>a.data<b.data?-1:a.data>b.data?1:0); }
function weekOf(iso){ const s=diarySorted(); if(!s.length||!iso) return null;
  const days=Math.round((pDate(iso)-pDate(s[0].data))/864e5); return Math.floor(days/7)+1; }
function progressData(){ const out=[];
  for(let w=1;w<=12;w++){ const rows=S.diary.filter(r=>weekOf(r.data)===w);
    const avg=(fn)=>{ const v=rows.map(fn).filter(x=>x!=null); return v.length?v.reduce((a,b)=>a+b,0)/v.length:null; };
    out.push({w,n:rows.length,peso:avg(r=>num(r.peso)),cint:avg(r=>num(r.cintura)),kcal:avg(r=>num(r.kcal)),
      prot:avg(r=>num(r.prot)),sono:avg(r=>num(r.sono)),treinos:rows.filter(r=>r.treinou==="Sim").length,
      ader:avg(r=>num(r.aderencia))});
  }
  for(let i=1;i<out.length;i++){ const a=out[i-1],b=out[i];
    b.var=(a.peso!=null&&b.peso!=null&&a.peso)?(b.peso-a.peso)/a.peso:null;
    b.leitura=b.var==null?"":b.var<0.001?"Peso estável: se a aderência estiver boa, avalie ajuste de 100 a 150 kcal."
      :b.var>0.005?"Ganho acima do ritmo inicial: observe a cintura.":"Ritmo dentro da referência inicial.";
  }
  return out;
}
function seriesByGroup(gr){ return S.treino.filter(t=>t.grupo===gr).reduce((a,t)=>a+(parseInt(t.series,10)||0),0); }
function groupBadge(v){ if(!v) return ["Sem registros","p-info"];
  if(v<6) return ["Abaixo de iniciante","p-warn"]; if(v<=10) return ["Iniciante (6–10)","p-ok"];
  if(v<=16) return ["Intermediário (10–16)","p-ok"]; return ["Acima de 16","p-bad"]; }

/* ---------- gráficos SVG ---------- */
function pieSVG(parts){ const R=54,C=2*Math.PI*R; let acc=0;
  const segs=parts.map(s=>{ const frac=s.v>0?s.v/parts.reduce((a,b)=>a+b.v,0):0;
    const dash=frac*C, off=-acc*C; acc+=frac;
    return `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${s.color}" stroke-width="26" stroke-dasharray="${dash.toFixed(1)} ${(C-dash).toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 70 70)"/>`; }).join("");
  return `<svg class="chart" viewBox="0 0 140 140">${segs}<circle cx="70" cy="70" r="34" fill="#101010"/><text x="70" y="66" text-anchor="middle" fill="#E8BE4E" font-size="15" font-weight="bold">${fi(parts.reduce((a,b)=>a+b.v,0))}</text><text x="70" y="82" text-anchor="middle" fill="#B8B8B8" font-size="10">kcal</text></svg>`;
}
function lineSVG(labels,vals,color,dec){ const W=480,H=200,P=34;
  const vv=vals.filter(v=>v!=null);
  if(!vv.length) return `<div class="muted small">Sem dados suficientes ainda.</div>`;
  let mn=Math.min(...vv),mx=Math.max(...vv); if(mn===mx){mn-=1;mx+=1;} const pad=(mx-mn)*0.15; mn-=pad; mx+=pad;
  const X=i=>P+i*(W-2*P)/(labels.length-1), Y=v=>H-P-(v-mn)*(H-2*P)/(mx-mn);
  let grid=""; for(let g=0;g<=3;g++){ const v=mn+(mx-mn)*g/3,y=Y(v);
    grid+=`<line x1="${P}" y1="${y}" x2="${W-8}" y2="${y}" stroke="#2a2a2a" stroke-width="1"/><text x="2" y="${y+4}" fill="#777" font-size="11">${Number(v).toLocaleString("pt-BR",{maximumFractionDigits:dec})}</text>`; }
  let pts=[],dots="",xl="";
  vals.forEach((v,i)=>{ if(v==null) return; pts.push(`${X(i).toFixed(0)},${Y(v).toFixed(0)}`);
    dots+=`<circle cx="${X(i)}" cy="${Y(v)}" r="4.5" fill="${color}" stroke="#0B0B0B" stroke-width="2"/>`; });
  labels.forEach((l,i)=>{ xl+=`<text x="${X(i)}" y="${H-8}" text-anchor="middle" fill="#777" font-size="11">${l}</text>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${grid}<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>${dots}${xl}</svg>`;
}

/* ---------- navegação ---------- */
const ui={tab:"inicio",view:"inicio",segPlano:"plano",segDiario:"registro",segEstr:0,foodQ:"",ob:{},obStep:0};
const ICO={
 home:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z"/></svg>',
 plan:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 2v20M4 2v6a3 3 0 006 0V2M17 2c-2 0-3 3-3 7v4h3v9M17 2v20"/></svg>',
 cal:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
 chart:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
 more:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'};
const TABS=[["inicio","Início","home"],["plano","Plano","plan"],["diario","Diário","cal"],["progresso","Progresso","chart"],["mais","Mais","more"]];
const TITLES={inicio:"Início",perfil:"Perfil e Metas",macros:"Macronutrientes",plano:"Plano Alimentar",diario:"Diário",progresso:"Progresso",mais:"Mais",compras:"Lista de Compras",suple:"Suplementação",sobre:"Sobre o Método",backup:"Backup e Dados"};
const BACK=["perfil","macros","compras","suple","sobre","backup"];
const LOGO=`<svg width="32" height="37" viewBox="0 0 96 112">
<defs>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#F3D67C"/><stop offset=".5" stop-color="#C99A2E"/><stop offset="1" stop-color="#8a6517"/>
</linearGradient>
<linearGradient id="goldd" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#C99A2E"/><stop offset="1" stop-color="#6e4d0e"/>
</linearGradient>
</defs>
<path d="M48 3 88 20v38c0 24-18 38-40 51C26 96 8 82 8 58V20Z" fill="#0B0B0B" stroke="url(#gold)" stroke-width="4" stroke-linejoin="round"/>
<path d="M48 9.5 82 23v35c0 20-15 32-34 43-19-11-34-23-34-43V23Z" fill="none" stroke="#C99A2E" stroke-width="1" opacity=".45"/>
<rect x="43" y="11" width="10" height="27" rx="5" fill="url(#goldd)" stroke="#4d3408" stroke-width="1.5"/>
<path d="M44.5 18h7M44.5 24h7M44.5 30h7" stroke="#4d3408" stroke-width="1"/>
<path d="M24 60C24 44 34 34 48 34s24 10 24 26l-2 4H26Z" fill="url(#gold)" stroke="#4d3408" stroke-width="2" stroke-linejoin="round"/>
<path d="M32 56C32 46 38 40 44 38" fill="none" stroke="#FFF3C4" stroke-width="3" stroke-linecap="round" opacity=".55"/>
<path d="M26 68h16v18c0 3-3 5-6 5-6 0-10-8-10-16Z" fill="url(#goldd)" stroke="#4d3408" stroke-width="1.5"/>
<path d="M70 68H54v18c0 3 3 5 6 5 6 0 10-8 10-16Z" fill="url(#goldd)" stroke="#4d3408" stroke-width="1.5"/>
<rect x="24" y="60" width="48" height="7" rx="2" fill="url(#goldd)" stroke="#4d3408" stroke-width="1.5"/>
<path d="M30 72h13l-2 6H30Z" fill="#0B0B0B"/>
<path d="M66 72H53l2 6h11Z" fill="#0B0B0B"/>
<path d="M45 67h6l-1 23h-4Z" fill="url(#gold)" stroke="#4d3408" stroke-width="1.5"/>
<path d="M48 96l4 4-4 4-4-4Z" fill="url(#gold)"/>
</svg>`;

/* ---------- modal ---------- */
function openSheet(html){ $("#sheet").innerHTML=html; $("#modal").classList.add("open"); }
function closeSheet(){ $("#modal").classList.remove("open"); $("#sheet").innerHTML=""; }
let _confirmCb=null;
function mConfirm(msg,cb){ _confirmCb=cb; openSheet(`<h2>Confirmar</h2><p>${msg}</p><div class="rowbtns"><button class="btn btn-ghost" onclick="App.close()">Cancelar</button><button class="btn btn-gold" onclick="App.confirmYes()">Confirmar</button></div>`); }

/* ================= VIEWS ================= */
function vInicio(){ const pf=calcPerfil(),mc=calcMacros();
  const first=S.profile.nome?esc(S.profile.nome.split(" ")[0]):"Guerreiro";
  let h=`<div class="card gold"><div class="muted">${saudacao()},</div><h2 style="font-size:20px;margin:2px 0 6px">${first} 🛡️</h2><div class="brushbar"></div>`;
  if(!pf){ h+=`<p class="small">Complete seu perfil para calcular <b>TMB, GET, calorias-alvo e macros</b>.</p><button class="btn btn-gold" onclick="App.go('perfil')">Montar meu perfil</button>`; }
  else{
    h+=`<div class="kpis"><div class="kpi big"><div class="l">Calorias-alvo</div><div class="v">${fi(mc?mc.alvo:pf.alvo)} <em>kcal/dia</em></div></div>
    <div class="kpi"><div class="l">Proteína</div><div class="v">${mc?fi(mc.protG):"—"} <em>g</em></div></div>
    <div class="kpi"><div class="l">Carboidratos</div><div class="v">${mc?fi(mc.carbsG):"—"} <em>g</em></div></div>
    <div class="kpi"><div class="l">Gorduras</div><div class="v">${mc?fi(mc.gordG):"—"} <em>g</em></div></div>
    <div class="kpi"><div class="l">Peso atual</div><div class="v">${pesoAtual()?f1(pesoAtual())+" <em>kg</em>":"—"}</div></div></div>`;
    const wk=S.diary.map(r=>weekOf(r.data)).filter(Boolean); const cw=wk.length?Math.max(...wk):null;
    if(cw){ const rows=S.diary.filter(r=>weekOf(r.data)===cw);
      const ad=rows.map(r=>num(r.aderencia)).filter(x=>x!=null);
      const tr=rows.filter(r=>r.treinou==="Sim").length;
      h+=`<div class="hr"></div><div class="grid2"><div class="kpi"><div class="l">Treinos sem ${cw}</div><div class="v">${tr}</div></div><div class="kpi"><div class="l">Aderência sem ${cw}</div><div class="v">${ad.length?fi(ad.reduce((a,b)=>a+b,0)/ad.length)+" <em>%</em>":"—"}</div></div></div>`;
    }
    h+=`<div class="rowbtns" style="margin-top:12px"><button class="btn btn-gold" onclick="App.mDiary()">Registrar hoje</button></div>`;
  }
  h+=`</div>`;
  const L=(v,label,sub,ic)=>`<button class="menurow" onclick="App.go('${v}')"><span class="ic">${ic}</span><span style="flex:1">${label}<small>${sub}</small></span><span style="color:#555">›</span></button>`;
  h+=`<div class="card"><h2>Atalhos</h2>${L("perfil","Perfil e metas","TMB, GET e calorias-alvo","👤")}${L("macros","Macronutrientes","Proteína, gordura, carbos e fibras","🥩")}</div>`;
  h+=`<div class="card"><h2>Alimentação</h2>
    <button class="menurow" onclick="App.goSeg('plano','plano')"><span class="ic">🍽️</span><span style="flex:1">Meu plano<small>Monte as refeições do dia</small></span><span style="color:#555">›</span></button>
    <button class="menurow" onclick="App.goSeg('plano','estruturas')"><span class="ic">🏛️</span><span style="flex:1">Estruturas de referência<small>2.200 • 2.800 • 3.400 kcal</small></span><span style="color:#555">›</span></button>
    <button class="menurow" onclick="App.goSeg('plano','alimentos')"><span class="ic">🔍</span><span style="flex:1">Banco de alimentos<small>65 alimentos + seus itens</small></span><span style="color:#555">›</span></button></div>`;
  h+=`<div class="card"><h2>Rotina</h2>${L("compras","Lista de compras","Mercado e organização","🛒")}${L("suple","Suplementação","Referências educacionais","💊")}</div>`;
  h+=`<footer class="appfoot"><b>FORTIS</b> • Disciplina, constância e fortaleza</footer>`;
  return h;
}
function pesoAtual(){ const s=diarySorted().filter(r=>num(r.peso)!=null); if(s.length) return num(s[s.length-1].peso); const p=num(S.profile.peso); return p; }

function selOpts(list,val){ return `<option value="">— Selecionar —</option>`+list.map(o=>{ const v=Array.isArray(o)?o[0]:o; return `<option value="${esc(v)}"${v===val?" selected":""}>${esc(v)}</option>`; }).join(""); }
function vPerfil(){ const p=S.profile,pf=calcPerfil();
  let h=`<div class="card"><h2>Seus dados</h2>
   <label class="f">Nome</label><input id="pf_nome" value="${esc(p.nome)}" placeholder="Seu nome" onchange="App.pfSave()">
   <div class="grid2"><div><label class="f">Sexo</label><select id="pf_sexo" onchange="App.pfSave()">${selOpts(["Masculino","Feminino"],p.sexo)}</select></div>
   <div><label class="f">Idade (anos)</label><input id="pf_idade" type="number" min="10" max="100" value="${esc(p.idade)}" onchange="App.pfSave()"></div></div>
   <div class="grid2"><div><label class="f">Peso (kg)</label><input id="pf_peso" type="number" step="0.1" min="30" max="300" value="${esc(p.peso)}" onchange="App.pfSave()"></div>
   <div><label class="f">Altura (cm)</label><input id="pf_altura" type="number" min="100" max="250" value="${esc(p.altura)}" onchange="App.pfSave()"></div></div>
   <label class="f">Nível de atividade</label><select id="pf_ativ" onchange="App.pfSave()">${selOpts(D.ACTS,p.atividade)}</select>
   <label class="f">Objetivo</label><select id="pf_obj" onchange="App.pfSave()">${selOpts(D.GOALS,p.objetivo)}</select>
   <p class="muted small">Fatores: Sedentário 1,20 • Levemente 1,35 • Moderado 1,55 • Muito 1,725 • Extremo 1,90. Ajustes: 0% • 7,5% • 12,5% • 17,5%.</p></div>`;
  if(!pf){ h+=`<div class="card"><span class="pill p-warn">⚠ Preencha todos os campos para calcular suas metas</span></div>`; }
  else{ h+=`<div class="card gold"><h2>Suas metas calculadas</h2><div class="kpis">
    <div class="kpi"><div class="l">TMB (Mifflin-St Jeor)</div><div class="v">${f2(pf.tmb)}</div></div>
    <div class="kpi"><div class="l">GET (gasto total)</div><div class="v">${f2(pf.get)}</div></div>
    <div class="kpi big"><div class="l">Calorias-alvo</div><div class="v">${f2(pf.alvo)} <em>kcal/dia</em></div></div></div>
    <p class="small" style="margin:10px 0 0">📈 Ritmo semanal de referência: <b>${fi(pf.ritmoMin)} a ${fi(pf.ritmoMax)} g/semana</b> <span class="muted">— referência inicial para iniciantes com baixo peso.</span></p>
    <p class="small" style="margin:6px 0 0"><span class="pill p-ok">✓ Perfil completo! Veja a aba Macronutrientes</span></p></div>`; }
  return h;
}

function vMacros(){ const mc=calcMacros(),pf=calcPerfil();
  if(!pf) return `<div class="card"><span class="pill p-warn">⚠ Preencha o Perfil primeiro</span><div class="rowbtns"><button class="btn btn-gold" onclick="App.go('perfil')">Ir para o perfil</button></div></div>`;
  let h=`<div class="card"><h2>Ajuste (g/kg)</h2><div class="grid2">
   <div><label class="f">Proteína (ref. 1,6–2,2)</label><input id="mc_p" type="number" step="0.1" value="${esc(S.macros.protKg)}" onchange="App.mcSave()"></div>
   <div><label class="f">Gordura (≈1,0)</label><input id="mc_g" type="number" step="0.1" value="${esc(S.macros.gordKg)}" onchange="App.mcSave()"></div></div></div>`;
  if(!mc) return h;
  const row=(l,v,u,hl)=>`<div class="kpi${hl?" big":""}"${hl?' style="grid-column:1/-1"':""}><div class="l">${l}</div><div class="v">${v}${u?` <em>${u}</em>`:""}</div></div>`;
  h+=`<div class="card gold"><h2>Metas diárias</h2><div class="kpis">
   ${row("Proteína",fi(mc.protG),"g")}${row("Gordura",fi(mc.gordG),"g")}${row("Carboidratos",fi(mc.carbsG),"g")}
   ${row("Carbos",f1(mc.carbsKg),"g/kg")}${row("Proteína",pct(mc.pctP),"")}${row("Gordura",pct(mc.pctG),"")}${row("Carbos",pct(mc.pctC),"")}
   ${row("Fibras (ref.)",mc.fibra==null?"—":mc.fibra,"g/dia")}</div>
   <p class="small">🍽️ Proteína por refeição (ref.): <b>${fi(mc.protMin)} a ${fi(mc.protMax)} g</b> (0,3–0,4 g/kg).</p>
   <p class="small">Proteína: ${mc.alertaP==="ok"?'<span class="pill p-ok">Dentro da faixa de referência</span>':mc.alertaP==="low"?'<span class="pill p-warn">Abaixo da faixa de referência</span>':'<span class="pill p-bad">Acima da faixa de referência</span>'}</p>
   <p class="small">Gordura: ${mc.alertaG==="ok"?'<span class="pill p-ok">Adequado como referência inicial</span>':'<span class="pill p-bad">Abaixo de 20% das calorias: avalie com um profissional</span>'}</p>
   ${mc.kR<0?'<div class="warnbox">⚠ Calorias insuficientes para essa combinação de proteína e gordura. Reduza as metas de g/kg.</div>':""}</div>`;
  h+=`<div class="card"><h2>Distribuição de calorias</h2>${pieSVG([{label:"Proteína",v:mc.kP,color:"#C99A2E"},{label:"Gordura",v:mc.kG,color:"#4CAF50"},{label:"Carboidratos",v:mc.carbsG*4,color:"#5C6BC0"}])}
   <div class="legend"><span><i style="background:#C99A2E"></i>Proteína ${pct(mc.pctP)}</span><span><i style="background:#4CAF50"></i>Gordura ${pct(mc.pctG)}</span><span><i style="background:#5C6BC0"></i>Carbos ${pct(mc.pctC)}</span></div></div>`;
  return h;
}

/* ----- plano ----- */
function segBar(segs,cur,fn){ return `<div class="seg">${segs.map(s=>`<button class="${s[0]===cur?"on":""}" onclick="${fn}('${s[0]}')">${s[1]}</button>`).join("")}</div>`; }
function vPlano(){ return segBar([["plano","Meu plano"],["estruturas","Estruturas"],["alimentos","Alimentos"]],ui.segPlano,"App.segPlano")
  + (ui.segPlano==="plano"?vPlanoDia():ui.segPlano==="estruturas"?vEstruturas():vAlimentos()); }
function vPlanoDia(){ const t=planTotals(),pf=calcPerfil(),mc=calcMacros();
  const metas=[["Kcal",t.k,pf?pf.alvo:null],["Proteína (g)",t.p,mc?mc.protG:null],["Carboidratos (g)",t.c,mc?mc.carbsG:null],["Gorduras (g)",t.g,mc?mc.gordG:null],["Fibras (g)",t.f,mc?mc.fibra:null]];
  let h=`<div class="card gold"><h2>Resumo do dia</h2><div class="tblwrap"><table><tr><th></th><th>Real</th><th>Meta</th><th>Status</th></tr>`;
  metas.forEach(m=>{ const st=statusOf(m[1],m[2]); h+=`<tr><td class="l">${m[0]}</td><td>${fi(m[1])}</td><td>${m[2]==null?"—":fi(m[2])}</td><td>${st[0]?`<span class="pill ${st[1]}">${st[0]}</span>`:"—"}</td></tr>`; });
  h+=`</table></div><p class="muted small">Pese os alimentos e indique se estão crus ou cozidos. Considere azeite, molhos e pastas.</p></div>`;
  h+=`<button class="btn btn-gold" onclick="App.mPlanItem()">＋ Adicionar alimento</button><div style="height:10px"></div>`;
  const m=foodMap();
  D.MEALS8.forEach(meal=>{ const idxs=[]; S.plan.forEach((it,i)=>{ if(it.m===meal) idxs.push(i); });
    if(!idxs.length) return; const s=mealSub(meal);
    h+=`<div class="mealhead"><b>${esc(meal)}</b><span>${fi(s.k)} kcal • P ${fi(s.p)}g</span></div>`;
    idxs.forEach(i=>{ const it=S.plan[i],f=m[it.f]; const q=num(it.q)||0;
      h+=`<div class="item"><div class="grow"><div class="t">${esc(it.f)}</div><div class="s">${f?`${fi(f.k*q/100)} kcal • P ${f1(f.p*q/100)} • C ${f1(f.c*q/100)} • G ${f1(f.f*q/100)}`:"Alimento não encontrado"}</div></div>
      <input type="number" min="0" step="1" value="${esc(it.q)}" onchange="App.planQty(${i},this.value)" title="gramas"><span class="muted small">g</span>
      <button class="iconbtn danger" onclick="App.planDel(${i})">🗑</button></div>`; });
  });
  if(!S.plan.length) h+=`<div class="card"><p class="muted">Nenhum item ainda. Toque em <b>＋ Adicionar alimento</b> e monte seu dia.</p></div>`;
  return h;
}
function vEstruturas(){ const i=ui.segEstr, st=D.STRUCTS[i], m=foodMap();
  if(!S.estr[i]||!S.estr[i].length) S.estr[i]=st.rows.map(()=>({f:"",q:""}));
  let h=`<div class="goldbox" style="margin-bottom:10px"><b>🏛️ Estruturas alimentares de referência</b> — NÃO são cardápios prontos calculados. Escolha o alimento e a quantidade.</div>`;
  h+=segBar([["0","≈2.200"],["1","≈2.800"],["2","≈3.400"]],String(i),"App.segEstr");
  let tk=0,tp=0,tc=0,tg=0,lastMeal="";
  st.rows.forEach((r,j)=>{ const sel=S.estr[i][j]||{f:"",q:""}; const f=m[sel.f]; const q=num(sel.q)||0;
    if(f){ tk+=f.k*q/100; tp+=f.p*q/100; tc+=f.c*q/100; tg+=f.f*q/100; }
    if(r[0]!==lastMeal){ lastMeal=r[0]; h+=`<div class="mealhead"><b>${esc(r[0])}</b><span></span></div>`; }
    h+=`<div class="item"><div class="grow"><div class="s">${esc(r[1])}</div><input list="dlFoods" value="${esc(sel.f)}" placeholder="Escolher alimento…" onchange="App.estrFood(${i},${j},this.value)" style="margin-top:4px"></div><input type="number" min="0" step="1" value="${esc(sel.q)}" onchange="App.estrQty(${i},${j},this.value)" title="gramas"><span class="muted small">g</span></div>`;
  });
  const diff=tk-st.kcal;
  h+=`<div class="card gold"><h2>Total da estrutura</h2><div class="kpis"><div class="kpi big"><div class="l">Total</div><div class="v">${fi(tk)} <em>kcal</em></div></div>
   <div class="kpi"><div class="l">Proteína</div><div class="v">${fi(tp)} <em>g</em></div></div><div class="kpi"><div class="l">Carbos</div><div class="v">${fi(tc)} <em>g</em></div></div></div>
   <p class="small">Diferença vs alvo: <b>${diff>=0?"+":""}${fi(diff)} kcal</b> (alvo aprox. ${st.kcal.toLocaleString("pt-BR")} kcal)</p>
   <p class="muted small">Os valores finais dependem das quantidades, marcas e preparo. Não constitui prescrição individual.</p></div>`;
  return h;
}
function vAlimentos(){ const q=ui.foodQ.trim().toLowerCase();
  const all=[...D.FOODS.map(f=>({n:f[0],k:f[1],p:f[2],c:f[3],f:f[4],fib:f[5],e:f[6],src:f[7],v:f[8],custom:false})),
    ...S.customFoods.map((f,ix)=>({...f,custom:true,ix}))];
  const list=q?all.filter(f=>f.n.toLowerCase().includes(q)):all;
  let h=`<div class="card"><h2>Banco de alimentos (por 100 g)</h2>
   <input id="foodSearch" placeholder="🔍 Buscar alimento…" value="${esc(ui.foodQ)}" oninput="App.foodQ(this.value)">
   <p class="muted small">${list.length} de ${all.length} alimentos • Valores aproximados. Confira o rótulo.</p>
   <button class="btn btn-ghost btn-sm" onclick="App.mFood()">＋ Cadastrar alimento</button></div><div id="foodlist">`;
  list.slice(0,120).forEach(f=>{ h+=`<div class="item"><div class="grow"><div class="t">${esc(f.n)} ${f.v==="WARN"?'<span class="pill p-warn">conferir</span>':""} ${f.custom?'<span class="pill p-info">meu</span>':""}</div>
    <div class="s">${fi(f.k)} kcal • P ${f1(f.p)} • C ${f1(f.c)} • G ${f1(f.f)} • Fib ${f1(f.fib)} • ${esc(f.e)}</div></div>
    ${f.custom?`<button class="iconbtn" onclick="App.mFood(${f.ix})">✎</button><button class="iconbtn danger" onclick="App.foodDel(${f.ix})">🗑</button>`:""}</div>`; });
  return h+`</div>`;
}

/* ----- diário ----- */
function vDiario(){ return segBar([["registro","Registro"],["treino","Treino"]],ui.segDiario,"App.segDiario")
  +(ui.segDiario==="registro"?vRegistro():vTreino()); }
function vRegistro(){ const rows=[...S.diary].sort((a,b)=>a.data<b.data?1:-1);
  let h=`<button class="btn btn-gold" onclick="App.mDiary()">＋ Registrar dia</button><div style="height:10px"></div>`;
  if(!rows.length) h+=`<div class="card"><p class="muted">Nenhum registro. Toque acima para lançar peso, cintura, calorias, proteína, sono, treino e aderência.</p></div>`;
  rows.forEach(r=>{ const w=weekOf(r.data),ad=num(r.aderencia);
    h+=`<div class="card" style="padding:12px"><div style="display:flex;justify-content:space-between;align-items:center"><b>${dataBR(r.data)}</b><span class="pill p-info">Semana ${w==null?"—":w}</span></div>
    <div class="grid3" style="margin-top:8px"><div class="kpi"><div class="l">Peso</div><div class="v" style="font-size:17px">${r.peso===""?"—":f1(num(r.peso))+" <em>kg</em>"}</div></div>
    <div class="kpi"><div class="l">Cintura</div><div class="v" style="font-size:17px">${r.cintura===""?"—":f1(num(r.cintura))+" <em>cm</em>"}</div></div>
    <div class="kpi"><div class="l">Sono</div><div class="v" style="font-size:17px">${r.sono===""?"—":f1(num(r.sono))+" <em>h</em>"}</div></div></div>
    <div class="grid3" style="margin-top:8px"><div class="kpi"><div class="l">Kcal</div><div class="v" style="font-size:17px">${r.kcal===""?"—":fi(num(r.kcal))}</div></div>
    <div class="kpi"><div class="l">Proteína</div><div class="v" style="font-size:17px">${r.prot===""?"—":fi(num(r.prot))+" <em>g</em>"}</div></div>
    <div class="kpi"><div class="l">Treino</div><div class="v" style="font-size:17px">${r.treinou==="Sim"?"✅":r.treinou==="Não"?"⬜":"—"}</div></div></div>
    ${ad!=null?`<div class="small" style="margin-top:8px">Aderência ${fi(ad)}%</div><div class="bar"><i style="width:${Math.min(100,Math.max(0,ad))}%"></i></div>`:""}
    <div class="rowbtns"><button class="btn btn-ghost btn-sm" onclick="App.mDiary('${r.id}')">Editar</button><button class="btn btn-danger btn-sm" onclick="App.diaryDel('${r.id}')">Excluir</button></div></div>`;
  });
  return h;
}
function vTreino(){ let h=`<div class="card"><h2>Séries por grupo (soma)</h2><div class="tblwrap"><table><tr><th>Grupo</th><th>Séries</th><th>Referência</th></tr>`;
  D.GROUPS.forEach(g=>{ const v=seriesByGroup(g),b=groupBadge(v); h+=`<tr><td class="l">${g}</td><td><b>${v}</b></td><td><span class="pill ${b[1]}">${b[0]}</span></td></tr>`; });
  h+=`</table></div><p class="muted small">Ebook: iniciante 6–10 séries/semana por grupo • intermediário 10–16.</p></div>`;
  h+=`<button class="btn btn-gold" onclick="App.mTreino()">＋ Registrar treino</button><div style="height:10px"></div>`;
  const rows=[...S.treino].sort((a,b)=>a.data<b.data?1:-1);
  if(!rows.length) h+=`<div class="card"><p class="muted">Nenhum treino registrado.</p></div>`;
  rows.forEach(t=>{ h+=`<div class="item"><div class="grow"><div class="t">${esc(t.exercicio||"Treino")} <span class="pill p-info">${esc(t.grupo||"")}</span></div>
    <div class="s">${dataBR(t.data)} • ${esc(t.series||"—")} séries • ${esc(t.reps||"—")} reps • ${esc(t.carga||"—")} kg${t.obs?" • "+esc(t.obs):""}</div></div>
    <button class="iconbtn" onclick="App.mTreino('${t.id}')">✎</button><button class="iconbtn danger" onclick="App.treinoDel('${t.id}')">🗑</button></div>`; });
  return h;
}

/* ----- progresso ----- */
function vProgresso(){ const pd=progressData(); const has=pd.some(w=>w.n>0);
  let h=`<div class="goldbox"><b>📊 Médias semanais (1–12)</b> calculadas do seu Registro. Analise tendências de 2–3 semanas — oscilações diárias não representam necessariamente ganho ou perda de tecido.</div><div style="height:10px"></div>`;
  if(!has) return h+`<div class="card"><p class="muted">Registre dias na aba Diário para ver seu progresso aqui.</p></div>`;
  h+=`<div class="card"><h2>Tabela semanal</h2><div class="tblwrap"><table><tr><th>Sem</th><th>Peso</th><th>Cint</th><th>Kcal</th><th>Prot</th><th>Sono</th><th>Tr</th><th>Ader</th><th>Var</th></tr>`;
  pd.forEach(w=>{ if(!w.n) return; h+=`<tr><td><b>${w.w}</b></td><td>${w.peso==null?"—":f1(w.peso)}</td><td>${w.cint==null?"—":f1(w.cint)}</td><td>${w.kcal==null?"—":fi(w.kcal)}</td><td>${w.prot==null?"—":fi(w.prot)}</td><td>${w.sono==null?"—":f1(w.sono)}</td><td>${w.treinos}</td><td>${w.ader==null?"—":fi(w.ader)+"%"}</td><td>${w.var==null?"—":pct(w.var,1)}</td></tr>`; });
  h+=`</table></div></div>`;
  const withN=pd.filter(w=>w.n>0), lb=withN.map(w=>"S"+w.w);
  h+=`<div class="card"><h2>Peso médio (kg)</h2>${lineSVG(lb,withN.map(w=>w.peso),"#C99A2E",1)}</div>`;
  h+=`<div class="card"><h2>Cintura média (cm)</h2>${lineSVG(lb,withN.map(w=>w.cint),"#4CAF50",1)}</div>`;
  h+=`<div class="card"><h2>Aderência média (%)</h2>${lineSVG(lb,withN.map(w=>w.ader),"#5C6BC0",0)}</div>`;
  h+=`<div class="card"><h2>Sono médio (h)</h2>${lineSVG(lb,withN.map(w=>w.sono),"#E8BE4E",1)}</div>`;
  h+=`<div class="card"><h2>Leituras</h2>`;
  pd.forEach(w=>{ if(w.w>1&&w.leitura&&w.n) h+=`<p class="small"><b>Semana ${w.w}:</b> ${esc(w.leitura)}</p>`; });
  return h+`</div>`;
}

/* ----- mais ----- */
function vMais(){ const L=(v,label,sub,ic)=>`<button class="menurow" onclick="App.go('${v}')"><span class="ic">${ic}</span><span style="flex:1">${label}<small>${sub}</small></span><span style="color:#555">›</span></button>`;
  return `<div class="card"><h2>Ajustes e conteúdo</h2>${L("perfil","Perfil e metas","Seus dados e calorias-alvo","👤")}${L("macros","Macronutrientes","Metas de proteína, gordura e carbos","🥩")}${L("compras","Lista de compras","Mercado e organização","🛒")}${L("suple","Suplementação","Referências educacionais","💊")}${L("sobre","Sobre o método","Como usar + avisos","🛡️")}${L("backup","Backup e dados","Exportar, importar, apagar","💾")}</div>
  <div class="card"><h2>Instalar o app</h2><p class="small muted">No Android (Chrome): menu ⋮ → <b>Instalar app / Adicionar à tela inicial</b>. No iPhone: <b>Compartilhar → Adicionar à Tela de Início</b>. Depois funciona offline.</p><button class="btn btn-ghost btn-sm" id="btnInstall" style="display:none" onclick="App.install()">📲 Instalar agora</button><a class="btn btn-ghost btn-sm" href="instalar.html" style="margin-left:6px">🔗 Página de instalação (QR)</a></div>
  <footer class="appfoot"><b>FORTIS</b> v1.1 • Disciplina, constância e fortaleza</footer>`;
}
function shopFlat(){ const items=[];
  D.SHOPPING.forEach(s=>{ const st=S.shop[s[1]]||{}; items.push({cat:s[0],n:s[1],custom:false,...st}); });
  S.shopCustom.forEach((c,ix)=>items.push({...c,custom:true,ix}));
  return items;
}
function vCompras(){ const items=shopFlat(); const done=items.filter(i=>i.marcado).length;
  let h=`<div class="card gold"><h2>${done} de ${items.length} itens comprados</h2><div class="bar"><i style="width:${items.length?done/items.length*100:0}%"></i></div>
  <div class="rowbtns"><button class="btn btn-ghost btn-sm" onclick="App.mShopItem()">＋ Adicionar item</button><button class="btn btn-ghost btn-sm" onclick="App.shopReset()">Desmarcar todos</button></div></div>`;
  D.SHOP_CATS.forEach(cat=>{ const rows=items.map((it,ix)=>({it,ix})).filter(x=>x.it.cat===cat); if(!rows.length) return;
    h+=`<div class="mealhead"><b>${esc(cat)}</b><span>${rows.filter(x=>x.it.marcado).length}/${rows.length}</span></div>`;
    rows.forEach(({it,ix})=>{ h+=`<div class="item${it.marcado?" done":""}"><button class="shopcheck${it.marcado?" on":""}" onclick="App.shopToggle(${ix})">✔</button>
     <div class="grow"><div class="t">${esc(it.n)}</div></div>
     <input type="text" inputmode="decimal" value="${esc(it.qtd||"")}" placeholder="Qtd" onchange="App.shopQ(${ix},this.value)" style="width:64px;padding:8px;text-align:center">
     <input type="text" value="${esc(it.unid||"")}" placeholder="Un." onchange="App.shopU(${ix},this.value)" style="width:58px;padding:8px;text-align:center">
     ${it.custom?`<button class="iconbtn danger" onclick="App.shopDel(${ix})">🗑</button>`:""}</div>`; });
  });
  return h;
}
function vSuple(){ const seg=(key,val)=>`<div class="seg" style="margin:8px 0 0"><button class="${val==="Sim"?"on":""}" onclick="App.supleSet('${key}',1)">Uso</button><button class="${val==="Não"?"on":""}" onclick="App.supleSet('${key}',0)">Não uso</button></div>`;
  let h=`<div class="goldbox" style="margin-bottom:10px">Suplementos <b>não são obrigatórios</b>. Conteúdo educacional — na dúvida, fale com um profissional.</div>`;
  D.SUPLE.forEach((s,i)=>{ const v=S.supleUsa["b"+i]||"";
    h+=`<div class="card"><h2>${esc(s.n)}</h2><p class="small"><b>Finalidade:</b> ${esc(s.f)}<br><b>Dose de referência:</b> ${esc(s.d)}<br><b>Horário:</b> ${esc(s.h)}<br><span class="muted">${esc(s.o)}</span></p>${seg("b"+i,v)}</div>`; });
  S.supleCustom.forEach((s,ix)=>{ h+=`<div class="card"><h2>${esc(s.n)} <span class="pill p-info">meu</span></h2><p class="small">${esc(s.f)}${s.d?" • "+esc(s.d):""}${s.h?" • "+esc(s.h):""}${s.o?`<br><span class="muted">${esc(s.o)}</span>`:""}</p>${seg("c"+ix,S.supleUsa["c"+ix]||"")}<div class="rowbtns"><button class="btn btn-danger btn-sm" onclick="App.supleDel(${ix})">Excluir</button></div></div>`; });
  h+=`<button class="btn btn-ghost" onclick="App.mSuple()">＋ Adicionar suplemento</button>`;
  h+=`<div style="height:10px"></div><div class="warnbox">Pessoas com doença renal, condições clínicas relevantes ou uso contínuo de medicamentos devem buscar orientação profissional antes de iniciar qualquer suplemento.</div>`;
  return h;
}
function vSobre(){ return `<div class="hero"><img src="assets/cover.jpg" alt="FORTIS — Guia completo para ganhar massa magra"></div>
  <div class="card gold"><h2>Guia completo para ganhar massa magra</h2>
  <div class="badges5">${D.BADGES5.map(b=>`<div><b>✓</b>${b}</div>`).join("")}</div>
  <p class="small" style="text-align:center"><b>Resultados reais, sem complicação.</b></p></div>
  <div class="card"><h2>Como usar — 5 passos</h2>
  ${[["1 • Perfil","Preencha seus dados e descubra TMB, GET e calorias-alvo."],["2 • Macros","Confira as metas de proteína, gordura, carbos e fibras."],["3 • Plano","Monte as refeições com o banco de alimentos."],["4 • Diário","Registre peso, medidas, sono, treino e aderência."],["5 • Progresso","Analise as médias semanais e os gráficos."]].map(s=>`<div class="checkrow"><b>${s[0]}</b><span>${s[1]}</span></div>`).join("")}</div>
  <div class="card"><h2>Regras</h2>
  <div class="checkrow"><b>▸</b><span>Analise tendências de 2–3 semanas antes de alterar o plano.</span></div>
  <div class="checkrow"><b>▸</b><span>Pese os alimentos; considere azeite, molhos e pastas.</span></div>
  <div class="checkrow"><b>▸</b><span>Oscilações diárias de peso são normais.</span></div></div>
  <div class="warnbox">Esta ferramenta tem finalidade educacional e <b>não substitui</b> avaliação individual com nutricionista, médico ou outro profissional habilitado. Os resultados são estimativas. Pessoas com doenças, uso contínuo de medicamentos, gestantes, lactantes, menores de idade ou com histórico de transtornos alimentares devem buscar orientação profissional.</div>
  <footer class="appfoot"><b>FORTIS</b> • Nutrição, saúde e suplementação<br>Disciplina, constância e fortaleza</footer>`;
}
function vBackup(){ return `<div class="card"><h2>Seus dados</h2><p class="small muted">Tudo fica salvo <b>só neste aparelho</b> (privado, sem conta). Exporte um backup para não perder nada.</p>
  <button class="btn btn-gold" onclick="App.exportJSON()">⬇ Exportar backup (JSON)</button>
  <button class="btn btn-ghost" onclick="document.getElementById('impFile').click()">⬆ Importar backup</button>
  <input type="file" id="impFile" accept=".json,application/json" style="display:none" onchange="App.importFile(this)">
  <button class="btn btn-ghost" onclick="App.exportCSV()">📄 Exportar registro (CSV)</button>
  <button class="btn btn-danger" onclick="App.resetAll()">🗑 Apagar todos os dados</button></div>
  <div class="card"><h2>Sobre</h2><p class="small muted">FORTIS PWA v1.1 • Funciona offline após a primeira abertura • Português (Brasil)</p></div>`;
}
const VIEWS={inicio:vInicio,perfil:vPerfil,macros:vMacros,plano:vPlano,diario:vDiario,progresso:vProgresso,mais:vMais,compras:vCompras,suple:vSuple,sobre:vSobre,backup:vBackup};

/* ================= render ================= */
function render(){ document.title="FORTIS — "+(TITLES[ui.view]||"");
  $("#brandTitle").innerHTML=`<b>FORTIS</b><span>Nutrição • Saúde • Suplementação</span>`;
  $("#viewtitle").innerHTML=(BACK.includes(ui.view)?`<button class="backbtn" onclick="App.go('mais')">‹</button>`:"")+`<h1>${TITLES[ui.view]||""}</h1>`;
  $("#view").innerHTML=VIEWS[ui.view]();
  $("#tabbar").innerHTML=TABS.map(t=>`<button class="${ui.tab===t[0]?"on":""}" onclick="App.go('${t[0]}')">${ICO[t[2]]}${t[1]}</button>`).join("");
  refreshFoodList();
  const bi=$("#btnInstall"); if(bi&&deferredPrompt) bi.style.display="inline-block";
}

/* ================= modais de edição ================= */
function mPlanItem(){ openSheet(`<h2>Adicionar alimento</h2>
  <form onsubmit="return App.savePlan(event)"><label class="f">Refeição</label><select id="m_m">${D.MEALS8.map(m=>`<option>${m}</option>`).join("")}</select>
  <label class="f">Alimento</label><input id="m_f" list="dlFoods" placeholder="Buscar no banco…" autocomplete="off">
  <label class="f">Quantidade (g)</label><input id="m_q" type="number" min="0" step="1" placeholder="Ex.: 150">
  <div class="rowbtns"><button type="button" class="btn btn-ghost" onclick="App.close()">Cancelar</button><button class="btn btn-gold" type="submit">Adicionar</button></div></form>`); }
function mDiary(id){ const r=id?S.diary.find(x=>x.id===id):null;
  const v=k=>r?esc(r[k]||""):"";
  openSheet(`<h2>${r?"Editar":"Registrar"} dia</h2><form onsubmit="return App.saveDiary(event,'${id||""}')">
  <div class="grid2"><div><label class="f">Data</label><input id="d_data" type="date" value="${r?r.data:todayISO()}" required></div>
  <div><label class="f">Treinou?</label><select id="d_treino"><option value="">—</option><option${v("treinou")==="Sim"?" selected":""}>Sim</option><option${v("treinou")==="Não"?" selected":""}>Não</option></select></div></div>
  <div class="grid2"><div><label class="f">Peso (kg)</label><input id="d_peso" type="number" step="0.1" min="30" max="300" value="${v("peso")}"></div>
  <div><label class="f">Cintura (cm)</label><input id="d_cint" type="number" step="0.1" min="40" max="250" value="${v("cintura")}"></div></div>
  <div class="grid2"><div><label class="f">Calorias</label><input id="d_kcal" type="number" min="0" max="15000" value="${v("kcal")}"></div>
  <div><label class="f">Proteína (g)</label><input id="d_prot" type="number" min="0" max="1000" value="${v("prot")}"></div></div>
  <div class="grid2"><div><label class="f">Sono (h)</label><input id="d_sono" type="number" step="0.5" min="0" max="24" value="${v("sono")}"></div>
  <div><label class="f">Aderência (%)</label><input id="d_ader" type="number" min="0" max="100" value="${v("aderencia")}"></div></div>
  <div class="rowbtns"><button type="button" class="btn btn-ghost" onclick="App.close()">Cancelar</button><button class="btn btn-gold" type="submit">Salvar</button></div></form>`); }
function mTreino(id){ const r=id?S.treino.find(x=>x.id===id):null; const v=k=>r?esc(r[k]||""):"";
  openSheet(`<h2>${r?"Editar":"Registrar"} treino</h2><form onsubmit="return App.saveTreino(event,'${id||""}')">
  <div class="grid2"><div><label class="f">Data</label><input id="t_data" type="date" value="${r?r.data:todayISO()}" required></div>
  <div><label class="f">Grupo</label><select id="t_grupo">${selOpts(D.GROUPS,r?r.grupo:"")}</select></div></div>
  <label class="f">Exercício</label><input id="t_ex" value="${v("exercicio")}" placeholder="Ex.: Supino reto">
  <div class="grid3"><div><label class="f">Séries</label><input id="t_ser" type="number" min="0" value="${v("series")}"></div>
  <div><label class="f">Reps</label><input id="t_rep" value="${v("reps")}" placeholder="8–12"></div>
  <div><label class="f">Carga kg</label><input id="t_car" type="number" step="0.5" min="0" value="${v("carga")}"></div></div>
  <label class="f">Observações</label><input id="t_obs" value="${v("obs")}">
  <div class="rowbtns"><button type="button" class="btn btn-ghost" onclick="App.close()">Cancelar</button><button class="btn btn-gold" type="submit">Salvar</button></div></form>`); }
function mFood(ix){ const f=ix!=null?S.customFoods[ix]:null; const v=k=>f?esc(f[k]??""):"";
  openSheet(`<h2>${f?"Editar":"Cadastrar"} alimento</h2><p class="muted small">Valores por 100 g.</p><form onsubmit="return App.saveFood(event,${ix==null?"null":ix})">
  <label class="f">Nome</label><input id="f_n" value="${v("n")}" required>
  <div class="grid3"><div><label class="f">Kcal</label><input id="f_k" type="number" step="0.1" min="0" value="${v("k")}"></div>
  <div><label class="f">Prot</label><input id="f_p" type="number" step="0.1" min="0" value="${v("p")}"></div>
  <div><label class="f">Carb</label><input id="f_c" type="number" step="0.1" min="0" value="${v("c")}"></div></div>
  <div class="grid3"><div><label class="f">Gord</label><input id="f_f" type="number" step="0.1" min="0" value="${v("f")}"></div>
  <div><label class="f">Fibra</label><input id="f_fib" type="number" step="0.1" min="0" value="${v("fib")}"></div>
  <div><label class="f">Estado</label><select id="f_e">${["cru","cozido","pronto"].map(e=>`<option${v("e")===e?" selected":""}>${e}</option>`).join("")}</select></div></div>
  <div class="rowbtns"><button type="button" class="btn btn-ghost" onclick="App.close()">Cancelar</button><button class="btn btn-gold" type="submit">Salvar</button></div></form>`); }
function mShopItem(){ openSheet(`<h2>Novo item</h2><form onsubmit="return App.saveShop(event)">
  <label class="f">Categoria</label><select id="s_cat">${D.SHOP_CATS.map(c=>`<option>${c}</option>`).join("")}</select>
  <label class="f">Alimento/produto</label><input id="s_n" required><div class="rowbtns">
  <button type="button" class="btn btn-ghost" onclick="App.close()">Cancelar</button><button class="btn btn-gold" type="submit">Adicionar</button></div></form>`); }
function mSuple(){ openSheet(`<h2>Novo suplemento</h2><form onsubmit="return App.saveSuple(event)">
  <label class="f">Nome</label><input id="u_n" required><label class="f">Finalidade</label><input id="u_f">
  <div class="grid2"><div><label class="f">Dose</label><input id="u_d"></div><div><label class="f">Horário</label><input id="u_h"></div></div>
  <label class="f">Observações</label><input id="u_o"><div class="rowbtns">
  <button type="button" class="btn btn-ghost" onclick="App.close()">Cancelar</button><button class="btn btn-gold" type="submit">Adicionar</button></div></form>`); }

/* ================= onboarding ================= */
function vOnboarding(){ const s=ui.obStep, ob=ui.ob;
  const dots=`<div class="steps">${[0,1,2,3].map(i=>`<i class="${i<=s?"on":""}"></i>`).join("")}</div>`;
  if(s===0) return `<div class="hero"><img src="assets/cover.jpg" alt="FORTIS"></div><div class="card gold" style="text-align:center"><h2>Bem-vindo ao método FORTIS 🛡️</h2><p class="small">Calorias, macros e progresso — <b>sem passar fome</b>.</p>${dots}
   <label class="f" style="text-align:left">Como podemos te chamar?</label><input id="ob_nome" value="${esc(ob.nome||"")}" placeholder="Seu nome">
   <label class="f" style="text-align:left">Sexo</label><select id="ob_sexo">${selOpts(["Masculino","Feminino"],ob.sexo||"")}</select>
   <div class="rowbtns"><button class="btn btn-ghost" onclick="App.obSkip()">Depois</button><button class="btn btn-gold" onclick="App.obNext()">Continuar</button></div></div>`;
  if(s===1) return `<div class="card"><h2>Medidas básicas</h2>${dots}
   <div class="grid3"><div><label class="f">Idade</label><input id="ob_idade" type="number" value="${esc(ob.idade||"")}"></div>
   <div><label class="f">Peso kg</label><input id="ob_peso" type="number" step="0.1" value="${esc(ob.peso||"")}"></div>
   <div><label class="f">Altura cm</label><input id="ob_alt" type="number" value="${esc(ob.altura||"")}"></div></div>
   <div class="rowbtns"><button class="btn btn-ghost" onclick="App.obBack()">Voltar</button><button class="btn btn-gold" onclick="App.obNext()">Continuar</button></div></div>`;
  if(s===2) return `<div class="card"><h2>Rotina e objetivo</h2>${dots}
   <label class="f">Nível de atividade</label><select id="ob_ativ">${selOpts(D.ACTS,ob.atividade||"")}</select>
   <label class="f">Objetivo</label><select id="ob_obj">${selOpts(D.GOALS,ob.objetivo||"")}</select>
   <div class="rowbtns"><button class="btn btn-ghost" onclick="App.obBack()">Voltar</button><button class="btn btn-gold" onclick="App.obNext()">Continuar</button></div></div>`;
  return `<div class="card gold"><h2>Metas de macros</h2>${dots}
   <p class="small">Sugerimos <b>2,0 g/kg de proteína</b> e <b>1,0 g/kg de gordura</b> (referência inicial do método). Você pode ajustar depois.</p>
   <div class="grid2"><div><label class="f">Proteína g/kg</label><input id="ob_p" type="number" step="0.1" value="${esc(ob.protKg??2)}"></div>
   <div><label class="f">Gordura g/kg</label><input id="ob_g" type="number" step="0.1" value="${esc(ob.gordKg??1)}"></div></div>
   <div class="rowbtns"><button class="btn btn-ghost" onclick="App.obBack()">Voltar</button><button class="btn btn-gold" onclick="App.obFinish()">Começar! 💪</button></div></div>`;
}

/* ================= API pública ================= */
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); deferredPrompt=e; const b=$("#btnInstall"); if(b) b.style.display="inline-block"; });
window.App={
 go(v){ ui.view=v; if(TABS.some(t=>t[0]===v)) ui.tab=v; closeSheet(); render(); window.scrollTo(0,0); },
 goSeg(v,seg){ if(v==="plano") ui.segPlano=seg; ui.view=v; ui.tab=v; render(); window.scrollTo(0,0); },
 segPlano(s){ ui.segPlano=s; render(); }, segDiario(s){ ui.segDiario=s; render(); }, segEstr(s){ ui.segEstr=+s; save(); render(); },
 close:closeSheet, confirmYes(){ closeSheet(); if(_confirmCb){ const f=_confirmCb; _confirmCb=null; f(); } },
 install(){ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; } },
 pfSave(){ S.profile={nome:$("#pf_nome").value.trim(),sexo:$("#pf_sexo").value,idade:$("#pf_idade").value,peso:$("#pf_peso").value,altura:$("#pf_altura").value,atividade:$("#pf_ativ").value,objetivo:$("#pf_obj").value}; save(); render(); },
 mcSave(){ S.macros={protKg:num($("#mc_p").value)??S.macros.protKg,gordKg:num($("#mc_g").value)??S.macros.gordKg}; save(); render(); },
 mPlanItem, mDiary, mTreino, mFood, mShopItem, mSuple,
 savePlan(e){ e.preventDefault(); const m=foodMap(),f=$("#m_f").value.trim(),q=$("#m_q").value;
   if(!m[f]){ alert("Escolha um alimento válido do banco (digite e selecione da lista)."); return false; }
   S.plan.push({m:$("#m_m").value,f,q}); save(); closeSheet(); render(); return false; },
 planQty(i,v){ S.plan[i].q=v; save(); render(); },
 planDel(i){ mConfirm("Remover este item do plano?",()=>{ S.plan.splice(i,1); save(); render(); }); },
 estrFood(i,j,v){ if(!S.estr[i]) S.estr[i]=[]; if(!S.estr[i][j]) S.estr[i][j]={f:"",q:""}; S.estr[i][j].f=v.trim(); save(); },
 estrQty(i,j,v){ if(!S.estr[i]) S.estr[i]=[]; if(!S.estr[i][j]) S.estr[i][j]={f:"",q:""}; S.estr[i][j].q=v; save();
   const pos=window.scrollY; render(); window.scrollTo(0,pos); },
 foodQ(v){ ui.foodQ=v; const tmp=document.createElement("div"); tmp.innerHTML=vAlimentos();
   const nl=tmp.querySelector("#foodlist"); if(nl) $("#foodlist").innerHTML=nl.innerHTML;
   const n=tmp.querySelector(".card p.muted"); const o=$("#view .card p.muted"); if(n&&o) o.innerHTML=n.innerHTML; },
 saveFood(e,ix){ e.preventDefault(); const g=id=>$(id).value.trim();
   const f={n:g("#f_n"),k:num(g("#f_k"))||0,p:num(g("#f_p"))||0,c:num(g("#f_c"))||0,f:num(g("#f_f"))||0,fib:num(g("#f_fib"))||0,e:$("#f_e").value,src:"Meu cadastro",v:"OK"};
   if(ix==null) S.customFoods.push(f); else S.customFoods[ix]=f;
   save(); closeSheet(); render(); return false; },
 foodDel(ix){ mConfirm("Excluir este alimento cadastrado?",()=>{ S.customFoods.splice(ix,1); save(); render(); }); },
 saveDiary(e,id){ e.preventDefault(); const g=x=>$(x).value;
   const r={id:id||uid(),data:g("#d_data"),peso:g("#d_peso"),cintura:g("#d_cint"),kcal:g("#d_kcal"),prot:g("#d_prot"),sono:g("#d_sono"),treinou:g("#d_treino"),aderencia:g("#d_ader")};
   const chk=(v,a,b)=>v===""||(+v>=a&&+v<=b);
   if(!chk(r.peso,30,300)||!chk(r.cintura,40,250)||!chk(r.sono,0,24)||!chk(r.aderencia,0,100)){ alert("Confira os intervalos: peso 30–300, cintura 40–250, sono 0–24, aderência 0–100."); return false; }
   if(id){ const i=S.diary.findIndex(x=>x.id===id); S.diary[i]=r; } else S.diary.push(r);
   save(); closeSheet(); render(); return false; },
 diaryDel(id){ mConfirm("Excluir este registro?",()=>{ S.diary=S.diary.filter(x=>x.id!==id); save(); render(); }); },
 saveTreino(e,id){ e.preventDefault(); const g=x=>$(x).value;
   const r={id:id||uid(),data:g("#t_data"),grupo:g("#t_grupo"),exercicio:g("#t_ex"),series:g("#t_ser"),reps:g("#t_rep"),carga:g("#t_car"),obs:g("#t_obs")};
   if(id){ const i=S.treino.findIndex(x=>x.id===id); S.treino[i]=r; } else S.treino.push(r);
   save(); closeSheet(); render(); return false; },
 treinoDel(id){ mConfirm("Excluir este treino?",()=>{ S.treino=S.treino.filter(x=>x.id!==id); save(); render(); }); },
 saveShop(e){ e.preventDefault(); S.shopCustom.push({cat:$("#s_cat").value,n:$("#s_n").value.trim(),qtd:"",unid:"",marcado:false}); save(); closeSheet(); render(); return false; },
 shopToggle(ix){ const items=shopFlat(),it=items[ix];
   if(it.custom){ const c=S.shopCustom[it.ix]; c.marcado=!c.marcado; } else { const st=S.shop[it.n]||{}; st.marcado=!st.marcado; S.shop[it.n]=st; }
   save(); render(); },
 shopQ(ix,v){ const items=shopFlat(),it=items[ix];
   if(it.custom) S.shopCustom[it.ix].qtd=v; else { const st=S.shop[it.n]||{}; st.qtd=v; S.shop[it.n]=st; } save(); },
 shopU(ix,v){ const items=shopFlat(),it=items[ix];
   if(it.custom) S.shopCustom[it.ix].unid=v; else { const st=S.shop[it.n]||{}; st.unid=v; S.shop[it.n]=st; } save(); },
 shopDel(ix){ const items=shopFlat(),it=items[ix]; if(!it.custom) return;
   mConfirm("Excluir este item?",()=>{ S.shopCustom.splice(it.ix,1); save(); render(); }); },
 shopReset(){ Object.keys(S.shop).forEach(k=>{S.shop[k].marcado=false;}); S.shopCustom.forEach(c=>c.marcado=false); save(); render(); },
 supleSet(key,sim){ S.supleUsa[key]=sim?"Sim":"Não"; save(); render(); },
 saveSuple(e){ e.preventDefault(); const g=x=>$(x).value.trim();
   S.supleCustom.push({n:g("#u_n"),f:g("#u_f"),d:g("#u_d"),h:g("#u_h"),o:g("#u_o")}); save(); closeSheet(); render(); return false; },
 supleDel(ix){ mConfirm("Excluir este suplemento?",()=>{ S.supleCustom.splice(ix,1); delete S.supleUsa["c"+ix]; save(); render(); }); },
 exportJSON(){ const blob=new Blob([JSON.stringify(S,null,1)],{type:"application/json"});
   const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="fortis-backup.json"; a.click(); },
 importFile(inp){ const f=inp.files[0]; if(!f) return; const rd=new FileReader();
   rd.onload=()=>{ try{ const d=JSON.parse(rd.result); if(!d.profile) throw 0;
     mConfirm("Substituir TODOS os dados pelo backup?",()=>{ S=Object.assign(defState(),d); save(); render(); }); }catch(e){ alert("Arquivo inválido."); } };
   rd.readAsText(f); inp.value=""; },
 exportCSV(){ const rows=[["data","semana","peso","cintura","kcal","proteina","sono","treinou","aderencia"]];
   diarySorted().forEach(r=>rows.push([r.data,weekOf(r.data)||"",r.peso,r.cintura,r.kcal,r.prot,r.sono,r.treinou,r.aderencia]));
   const csv=rows.map(r=>r.join(";")).join("\n");
   const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv"})); a.download="fortis-registro.csv"; a.click(); },
 resetAll(){ mConfirm("Apagar TODOS os dados do app? Isso não pode ser desfeito.",()=>{ S=defState(); save(); ui.view="inicio"; ui.tab="inicio"; render(); window.scrollTo(0,0); }); },
 /* onboarding */
 obNext(){ const s=ui.obStep,o=ui.ob;
   if(s===0){ o.nome=$("#ob_nome").value.trim(); o.sexo=$("#ob_sexo").value; }
   if(s===1){ o.idade=$("#ob_idade").value; o.peso=$("#ob_peso").value; o.altura=$("#ob_alt").value; }
   if(s===2){ o.atividade=$("#ob_ativ").value; o.objetivo=$("#ob_obj").value; }
   ui.obStep=Math.min(3,s+1); render(); },
 obBack(){ ui.obStep=Math.max(0,ui.obStep-1); render(); },
 obSkip(){ S.onboarded=true; save(); render(); },
 obFinish(){ const o=ui.ob;
   S.profile={nome:o.nome||"",sexo:o.sexo||"",idade:o.idade||"",peso:o.peso||"",altura:o.altura||"",atividade:o.atividade||"",objetivo:o.objetivo||""};
   S.macros={protKg:num($("#ob_p").value)??2,gordKg:num($("#ob_g").value)??1};
   S.onboarded=true; save(); render(); window.scrollTo(0,0); }
};

/* ---------- init ---------- */
function renderRoot(){ if(!S.onboarded){ $("#brandTitle").innerHTML=`<b>FORTIS</b><span>Nutrição • Saúde • Suplementação</span>`;
    $("#viewtitle").innerHTML=`<h1>Bem-vindo</h1>`; $("#view").innerHTML=vOnboarding(); $("#tabbar").innerHTML=""; refreshFoodList(); return; } render(); }
document.getElementById("modal").addEventListener("click",e=>{ if(e.target.id==="modal") closeSheet(); });
document.getElementById("brandMark").innerHTML=LOGO;
if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)){ try{ navigator.serviceWorker.register("sw.js").catch(()=>{}); }catch(e){} }
refreshFoodList();
renderRoot();
window._fortisRender=render;
})();
