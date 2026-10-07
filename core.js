/* ================= FORTIS PWA — núcleo de cálculo (funções puras, testáveis em Node) =================
   Usado pelo app (window.FORTIS_CORE) e pelos testes (require("./core.js")). Sem acesso a DOM/armazenamento. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FORTIS_CORE = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MIN_WEEKS = 12; // a planilha acompanha 12 semanas; o app estende se houver mais dados
  const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
  const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

  /* ---------- utilitários ---------- */
  const num = (v) => {
    if (v == null || v === "") return null;
    const n = parseFloat(String(v).replace(",", "."));
    return isFinite(n) ? n : null;
  };
  const int = (v) => {
    if (v == null || v === "") return null;
    const n = parseInt(v, 10);
    return isFinite(n) ? n : null;
  };
  const isISODate = (s) => {
    if (typeof s !== "string" || !ISO_RE.test(s)) return false;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  };
  /* dias entre duas datas ISO, imune a horário de verão (usa UTC) */
  const daysBetween = (a, b) => {
    const pa = a.split("-").map(Number), pb = b.split("-").map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5);
  };
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  /* ---------- perfil e metas ---------- */
  function calcPerfil(profile, ACTS, GOALS) {
    const p = profile || {};
    const peso = num(p.peso), alt = int(p.altura), idade = int(p.idade);
    const a = ACTS.find((x) => x[0] === p.atividade), g = GOALS.find((x) => x[0] === p.objetivo);
    if (!p.sexo || idade == null || peso == null || alt == null || !a || !g) return null;
    if (peso <= 0 || alt <= 0 || idade <= 0) return null;
    // Mifflin-St Jeor
    const base = 10 * peso + 6.25 * alt - 5 * idade;
    const tmb = p.sexo === "Masculino" ? base + 5 : base - 161;
    const get = tmb * a[1], alvo = get * (1 + g[1]);
    return { tmb, get, alvo, fator: a[1], ajuste: g[1], peso, ritmoMin: peso * 0.0025 * 1000, ritmoMax: peso * 0.005 * 1000 };
  }

  function calcMacros(profile, macros, ACTS, GOALS) {
    const pf = calcPerfil(profile, ACTS, GOALS);
    const pk = num(macros && macros.protKg), gk = num(macros && macros.gordKg);
    if (!pf || pk == null || gk == null) return null;
    const protG = pf.peso * pk, gordG = pf.peso * gk, kP = protG * 4, kG = gordG * 9, kR = pf.alvo - kP - kG;
    const carbsG = kR / 4, carbsKg = carbsG / pf.peso;
    const sexo = profile.sexo;
    const fibra = sexo === "Masculino" ? 38 : sexo === "Feminino" ? 25 : null;
    return {
      protG, gordG, kP, kG, kR, carbsG, carbsKg,
      pctP: kP / pf.alvo, pctG: kG / pf.alvo, pctC: (carbsG * 4) / pf.alvo,
      fibra, alertaP: pk < 1.6 ? "low" : pk > 2.2 ? "high" : "ok",
      alertaG: kG / pf.alvo < 0.2 ? "low" : "ok",
      protMin: pf.peso * 0.3, protMax: pf.peso * 0.4, alvo: pf.alvo
    };
  }

  /* ---------- alimentos ---------- */
  function foodMap(FOODS, customFoods) {
    const m = {};
    FOODS.forEach((f) => (m[f[0]] = { n: f[0], k: f[1], p: f[2], c: f[3], f: f[4], fib: f[5], e: f[6], src: f[7], v: f[8], custom: false }));
    (customFoods || []).forEach((f) => (m[f.n] = { ...f, custom: true }));
    return m;
  }
  /* soma kcal/macros de itens {f: nome, q: gramas}; filtro opcional */
  /* medidas caseiras disponíveis para um alimento: [{label, g}] (g = gramas por 1 medida) */
  function measuresOf(name, food, UNITS) {
    const list = ((UNITS && UNITS[name]) || []).map((u) => ({ label: u[0], g: u[1] }));
    if (food && food.custom && food.un && food.ug > 0) list.unshift({ label: food.un, g: food.ug });
    return list;
  }
  /* gramas para N medidas, arredondado a 0,1 g */
  const gramsFor = (n, g) => Math.round((num(n) || 0) * g * 10) / 10;

  function sumItems(items, map, filter) {
    const t = { k: 0, p: 0, c: 0, g: 0, f: 0 };
    (items || []).forEach((it) => {
      if (filter && !filter(it)) return;
      const food = map[it.f];
      if (!food) return;
      const q = num(it.q) || 0;
      t.k += (food.k * q) / 100; t.p += (food.p * q) / 100; t.c += (food.c * q) / 100;
      t.g += (food.f * q) / 100; t.f += ((food.fib || 0) * q) / 100;
    });
    return t;
  }

  function statusOf(real, meta) {
    if (real == null || meta == null || !meta) return ["", ""];
    const d = Math.abs(real - meta) / meta;
    if (d <= 0.05) return ["Dentro de ±5%", "p-ok"];
    return real < meta ? ["Abaixo", "p-warn"] : ["Acima", "p-bad"];
  }

  /* ---------- diário / semanas ---------- */
  /* Semana 1 = data do primeiro registro (equivale ao $A$2 da planilha). */
  function firstDate(diary) {
    let first = null;
    (diary || []).forEach((r) => { if (r && isISODate(r.data) && (first == null || r.data < first)) first = r.data; });
    return first;
  }
  function weekNumber(startISO, iso) {
    if (!startISO || !isISODate(iso)) return null;
    return Math.floor(daysBetween(startISO, iso) / 7) + 1;
  }

  function leituraDe(v) {
    if (v == null) return "";
    if (v < -0.001) return "Peso em queda: se o objetivo é ganhar massa, revise a aderência e avalie ajuste de 100 a 150 kcal.";
    if (v < 0.001) return "Peso estável: se a aderência estiver boa, avalie ajuste de 100 a 150 kcal.";
    if (v > 0.005) return "Ganho acima do ritmo inicial: observe a cintura.";
    return "Ritmo dentro da referência inicial.";
  }

  function progressData(diary) {
    const start = firstDate(diary);
    const byWeek = {};
    let maxW = 0;
    (diary || []).forEach((r) => {
      const w = weekNumber(start, r.data);
      if (w == null) return;
      (byWeek[w] = byWeek[w] || []).push(r);
      if (w > maxW) maxW = w;
    });
    const total = Math.max(MIN_WEEKS, maxW);
    const out = [];
    for (let w = 1; w <= total; w++) {
      const rows = byWeek[w] || [];
      const mean = (fn) => avg(rows.map(fn).filter((x) => x != null));
      out.push({
        w, n: rows.length,
        peso: mean((r) => num(r.peso)), cint: mean((r) => num(r.cintura)), kcal: mean((r) => num(r.kcal)),
        prot: mean((r) => num(r.prot)), sono: mean((r) => num(r.sono)),
        treinos: rows.filter((r) => r.treinou === "Sim").length, ader: mean((r) => num(r.aderencia)),
        var: null, leitura: ""
      });
    }
    // variação semanal = vs. a última semana anterior que tem peso
    let prev = null;
    out.forEach((b) => {
      if (b.peso == null) return;
      if (prev && prev.peso) {
        const semanas = b.w - prev.w;
        b.var = (b.peso - prev.peso) / prev.peso / semanas; // normaliza por semana se houve lacuna
        b.leitura = leituraDe(b.var);
      }
      prev = b;
    });
    return out;
  }

  /* ---------- treino ---------- */
  function seriesByGroup(treino, gr) {
    return (treino || []).filter((t) => t.grupo === gr).reduce((a, t) => a + (int(t.series) || 0), 0);
  }
  function groupBadge(v) {
    if (!v) return ["Sem registros", "p-info"];
    if (v < 6) return ["Abaixo de iniciante", "p-warn"];
    if (v <= 10) return ["Iniciante (6–10)", "p-ok"];
    if (v <= 16) return ["Intermediário (10–16)", "p-ok"];
    return ["Acima de 16", "p-bad"];
  }

  /* ---------- estado: validação/migração (usado na carga e na importação de backup) ---------- */
  function defState() {
    return {
      v: 2,
      profile: { nome: "", sexo: "", idade: "", peso: "", altura: "", atividade: "", objetivo: "" },
      macros: { protKg: 2, gordKg: 1 }, customFoods: [], plan: [], estr: { 0: [], 1: [], 2: [] },
      diary: [], treino: [], shop: {}, shopCustom: [], supleUsa: {}, supleCustom: [], onboarded: false,
      meta: { createdAt: null, lastBackup: null, snoozeUntil: null, editsSinceBackup: 0 }
    };
  }
  const str = (v, max) => (v == null ? "" : String(v).slice(0, max || 200));
  const numStr = (v) => { const n = num(v); return n == null ? "" : String(n); };
  const isObj = (o) => o != null && typeof o === "object" && !Array.isArray(o);
  const arr = (a) => (Array.isArray(a) ? a.filter(isObj) : []);
  const oneOf = (v, list) => (list.includes(v) ? v : "");

  /* Recebe qualquer coisa (localStorage ou arquivo importado) e devolve um estado íntegro.
     Garante tipos, ids seguros (usados em atributos onclick) e datas ISO válidas. */
  function sanitizeState(input, genId) {
    const d = isObj(input) ? input : {};
    const S = defState();
    const usedIds = new Set();
    const safeId = (id) => {
      let v = typeof id === "string" && ID_RE.test(id) && !usedIds.has(id) ? id : genId();
      while (usedIds.has(v)) v = genId();
      usedIds.add(v);
      return v;
    };

    if (isObj(d.profile)) {
      const p = d.profile;
      S.profile = {
        nome: str(p.nome, 80), sexo: oneOf(p.sexo, ["Masculino", "Feminino"]),
        idade: numStr(p.idade), peso: numStr(p.peso), altura: numStr(p.altura),
        atividade: str(p.atividade, 60), objetivo: str(p.objetivo, 60)
      };
    }
    if (isObj(d.macros)) {
      S.macros = { protKg: num(d.macros.protKg) ?? 2, gordKg: num(d.macros.gordKg) ?? 1 };
    }
    S.customFoods = arr(d.customFoods)
      .filter((f) => str(f.n).trim())
      .map((f) => ({
        n: str(f.n, 120).trim(), k: num(f.k) || 0, p: num(f.p) || 0, c: num(f.c) || 0, f: num(f.f) || 0,
        fib: num(f.fib) || 0, e: oneOf(f.e, ["cru", "cozido", "pronto"]) || "pronto", src: "Meu cadastro", v: "OK",
        // medida caseira opcional do alimento próprio (ex.: "fatia" = 30 g)
        ...(str(f.un).trim() && num(f.ug) > 0 ? { un: str(f.un, 40).trim(), ug: num(f.ug) } : {})
      }));
    // q = gramas (sempre, é o que entra nos cálculos); u/n = medida caseira e quantidade de medidas, quando usadas
    S.plan = arr(d.plan).filter((it) => str(it.f).trim()).map((it) => {
      const item = { m: str(it.m, 60), f: str(it.f, 120), q: numStr(it.q) };
      if (str(it.u).trim() && num(it.n) > 0) { item.u = str(it.u, 40).trim(); item.n = numStr(it.n); }
      return item;
    });
    if (isObj(d.estr)) {
      [0, 1, 2].forEach((i) => {
        S.estr[i] = arr(d.estr[i]).map((x) => ({ f: str(x.f, 120), q: numStr(x.q) }));
      });
    }
    S.diary = arr(d.diary)
      .filter((r) => isISODate(r.data))
      .map((r) => ({
        id: safeId(r.id), data: r.data, peso: numStr(r.peso), cintura: numStr(r.cintura), kcal: numStr(r.kcal),
        prot: numStr(r.prot), sono: numStr(r.sono), treinou: oneOf(r.treinou, ["Sim", "Não"]), aderencia: numStr(r.aderencia)
      }));
    S.treino = arr(d.treino)
      .filter((t) => isISODate(t.data))
      .map((t) => ({
        id: safeId(t.id), data: t.data, grupo: str(t.grupo, 40), exercicio: str(t.exercicio, 120),
        series: numStr(t.series), reps: str(t.reps, 20), carga: numStr(t.carga), obs: str(t.obs, 300)
      }));
    if (isObj(d.shop)) {
      Object.keys(d.shop).forEach((k) => {
        const st = d.shop[k];
        if (!isObj(st)) return;
        S.shop[str(k, 120)] = { qtd: str(st.qtd, 20), unid: str(st.unid, 20), marcado: !!st.marcado };
      });
    }
    S.shopCustom = arr(d.shopCustom)
      .filter((c) => str(c.n).trim())
      .map((c) => ({ cat: str(c.cat, 60), n: str(c.n, 120), qtd: str(c.qtd, 20), unid: str(c.unid, 20), marcado: !!c.marcado }));

    // suplementos: v1 guardava o uso dos personalizados pela posição ("c0","c1"…); v2 usa o id ("c_<id>")
    const oldUsa = isObj(d.supleUsa) ? d.supleUsa : {};
    const legacy = !(num(d.v) >= 2);
    const usa = {};
    Object.keys(oldUsa).forEach((k) => {
      const v = oneOf(oldUsa[k], ["Sim", "Não"]);
      if (v && /^b\d+$/.test(k)) usa[k] = v;
    });
    S.supleCustom = arr(d.supleCustom)
      .filter((s) => str(s.n).trim())
      .map((s, ix) => {
        const id = safeId(s.id);
        const v = oneOf(oldUsa["c_" + s.id], ["Sim", "Não"]) || (legacy ? oneOf(oldUsa["c" + ix], ["Sim", "Não"]) : "");
        if (v) usa["c_" + id] = v;
        return { id, n: str(s.n, 120), f: str(s.f, 200), d: str(s.d, 120), h: str(s.h, 120), o: str(s.o, 300) };
      });
    S.supleUsa = usa;
    S.onboarded = !!d.onboarded;
    const m = isObj(d.meta) ? d.meta : {};
    const ts = (v) => (typeof v === "string" && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
    S.meta = { createdAt: ts(m.createdAt), lastBackup: ts(m.lastBackup), snoozeUntil: ts(m.snoozeUntil),
      editsSinceBackup: Math.max(0, int(m.editsSinceBackup) || 0) };
    return S;
  }

  /* ---------- lembrete de backup ----------
     Os dados ficam só no aparelho; este é o aviso para a pessoa não perder tudo ao trocar de celular.
     Retorna {due, reason: "never"|"old"|"many", days, edits}. */
  const BACKUP_EVERY_DAYS = 14, BACKUP_EVERY_EDITS = 15, FIRST_BACKUP_ENTRIES = 5, FIRST_BACKUP_DAYS = 7;
  function backupStatus(S, nowMs) {
    const meta = (S && S.meta) || {};
    const now = nowMs == null ? Date.now() : nowMs;
    const days = (iso) => (iso ? Math.floor((now - Date.parse(iso)) / 864e5) : null);
    const entries = ((S && S.diary) || []).length + ((S && S.treino) || []).length;
    const hasData = entries > 0 || ((S && S.plan) || []).length > 0;
    const edits = meta.editsSinceBackup || 0;
    const out = { due: false, reason: "", days: days(meta.lastBackup), edits };
    if (!hasData) return out;
    if (meta.snoozeUntil && Date.parse(meta.snoozeUntil) > now) return out;
    if (!meta.lastBackup) {
      if (entries >= FIRST_BACKUP_ENTRIES || (days(meta.createdAt) || 0) >= FIRST_BACKUP_DAYS) { out.due = true; out.reason = "never"; }
    } else if (out.days >= BACKUP_EVERY_DAYS) { out.due = true; out.reason = "old"; }
    else if (edits >= BACKUP_EVERY_EDITS) { out.due = true; out.reason = "many"; }
    return out;
  }

  return {
    backupStatus, measuresOf, gramsFor, MIN_WEEKS, num, int, isISODate, daysBetween, calcPerfil, calcMacros, foodMap, sumItems, statusOf,
    firstDate, weekNumber, leituraDe, progressData, seriesByGroup, groupBadge, defState, sanitizeState
  };
});
