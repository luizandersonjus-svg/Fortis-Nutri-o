/* Testes do núcleo de cálculo. Rodar: npm test (ou node --test tests/*.test.js) — sem dependências. */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../core.js");

// carrega foods.js (script de navegador) num contexto isolado para reutilizar os dados reais
const ctx = { window: {} };
ctx.window.FORTIS = {};
ctx.FORTIS = ctx.window.FORTIS;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "foods.js"), "utf8"), ctx);
const D = ctx.FORTIS;

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
let n = 0;
const gen = () => "id" + ++n;

const perfilH = { sexo: "Masculino", idade: "25", peso: "70", altura: "175", atividade: "Moderadamente ativo", objetivo: "Superávit leve" };

test("num aceita vírgula decimal e rejeita lixo", () => {
  assert.equal(C.num("70,5"), 70.5);
  assert.equal(C.num("80"), 80);
  assert.equal(C.num(""), null);
  assert.equal(C.num(null), null);
  assert.equal(C.num("abc"), null);
});

test("isISODate valida calendário real", () => {
  assert.ok(C.isISODate("2026-02-28"));
  assert.ok(C.isISODate("2024-02-29"));
  assert.ok(!C.isISODate("2026-02-30"));
  assert.ok(!C.isISODate("2026-2-3"));
  assert.ok(!C.isISODate("x');alert(1);//"));
  assert.ok(!C.isISODate(undefined));
});

test("calcPerfil: Mifflin-St Jeor masculino", () => {
  const pf = C.calcPerfil(perfilH, D.ACTS, D.GOALS);
  // 10*70 + 6.25*175 - 5*25 + 5 = 1673.75
  close(pf.tmb, 1673.75);
  close(pf.get, 1673.75 * 1.55);
  close(pf.alvo, 1673.75 * 1.55 * 1.075);
  close(pf.ritmoMin, 175);
  close(pf.ritmoMax, 350);
});

test("calcPerfil: Mifflin-St Jeor feminino", () => {
  const pf = C.calcPerfil({ ...perfilH, sexo: "Feminino" }, D.ACTS, D.GOALS);
  close(pf.tmb, 1673.75 - 5 - 161);
});

test("calcPerfil retorna null com perfil incompleto ou inválido", () => {
  assert.equal(C.calcPerfil({ ...perfilH, altura: "" }, D.ACTS, D.GOALS), null);
  assert.equal(C.calcPerfil({ ...perfilH, idade: "" }, D.ACTS, D.GOALS), null);
  assert.equal(C.calcPerfil({ ...perfilH, sexo: "" }, D.ACTS, D.GOALS), null);
  assert.equal(C.calcPerfil({ ...perfilH, atividade: "Inexistente" }, D.ACTS, D.GOALS), null);
  assert.equal(C.calcPerfil({ ...perfilH, peso: "0" }, D.ACTS, D.GOALS), null);
  assert.equal(C.calcPerfil(undefined, D.ACTS, D.GOALS), null);
});

test("calcMacros: proteína/gordura por kg e carbo pelo restante", () => {
  const mc = C.calcMacros(perfilH, { protKg: 2, gordKg: 1 }, D.ACTS, D.GOALS);
  const alvo = 1673.75 * 1.55 * 1.075;
  close(mc.protG, 140);
  close(mc.gordG, 70);
  close(mc.carbsG, (alvo - 560 - 630) / 4);
  close(mc.pctP + mc.pctG + mc.pctC, 1);
  assert.equal(mc.fibra, 38);
  assert.equal(mc.alertaP, "ok");
  assert.equal(C.calcMacros(perfilH, { protKg: 1.2, gordKg: 1 }, D.ACTS, D.GOALS).alertaP, "low");
  assert.equal(C.calcMacros(perfilH, { protKg: 3, gordKg: 1 }, D.ACTS, D.GOALS).alertaP, "high");
});

test("calcMacros sinaliza calorias insuficientes (kR < 0)", () => {
  const mc = C.calcMacros(perfilH, { protKg: 5, gordKg: 5 }, D.ACTS, D.GOALS);
  assert.ok(mc.kR < 0);
});

test("sumItems soma por 100 g, ignora alimentos desconhecidos e aplica filtro", () => {
  const map = C.foodMap(D.FOODS, [{ n: "Meu shake", k: 100, p: 20, c: 5, f: 1, fib: 0 }]);
  const items = [
    { m: "Almoço", f: "Arroz branco cozido", q: "200" },
    { m: "Almoço", f: "Inexistente", q: "100" },
    { m: "Lanche", f: "Meu shake", q: "50" }
  ];
  const t = C.sumItems(items, map);
  close(t.k, 128 * 2 + 50);
  close(t.p, 2.5 * 2 + 10);
  close(t.f, 1.6 * 2);
  const almoco = C.sumItems(items, map, (it) => it.m === "Almoço");
  close(almoco.k, 256);
});

test("statusOf: faixa de ±5%", () => {
  assert.equal(C.statusOf(100, 100)[1], "p-ok");
  assert.equal(C.statusOf(105, 100)[1], "p-ok");
  assert.equal(C.statusOf(94, 100)[1], "p-warn");
  assert.equal(C.statusOf(106, 100)[1], "p-bad");
  assert.deepEqual(C.statusOf(10, null), ["", ""]);
});

test("weekNumber: semana 1 começa no primeiro registro e atravessa horário de verão", () => {
  assert.equal(C.weekNumber("2026-01-01", "2026-01-01"), 1);
  assert.equal(C.weekNumber("2026-01-01", "2026-01-07"), 1);
  assert.equal(C.weekNumber("2026-01-01", "2026-01-08"), 2);
  assert.equal(C.weekNumber("2026-03-01", "2026-04-05"), 6);
  assert.equal(C.weekNumber(null, "2026-01-01"), null);
});

test("progressData: médias semanais, variação e leituras", () => {
  const diary = [
    { data: "2026-01-01", peso: "70", aderencia: "80", treinou: "Sim" },
    { data: "2026-01-03", peso: "72", aderencia: "100", treinou: "Não" },
    { data: "2026-01-08", peso: "71.2" },
    { data: "2026-01-15", peso: "70" }
  ];
  const pd = C.progressData(diary);
  assert.equal(pd.length, 12);
  close(pd[0].peso, 71);
  close(pd[0].ader, 90);
  assert.equal(pd[0].treinos, 1);
  assert.equal(pd[0].var, null);
  close(pd[1].var, (71.2 - 71) / 71);
  assert.match(pd[1].leitura, /Ritmo dentro/);
  assert.ok(pd[2].var < 0);
  assert.match(pd[2].leitura, /queda/, "perda de peso não pode ser lida como 'estável'");
});

test("progressData: compara com a última semana com pesagem (lacunas) e não corta após 12 semanas", () => {
  const diary = [
    { data: "2026-01-01", peso: "70" },
    { data: "2026-01-15", peso: "70.7" }, // semana 3, semana 2 sem pesagem
    { data: "2026-04-10", peso: "72" }   // semana 15
  ];
  const pd = C.progressData(diary);
  assert.equal(pd.length, 15);
  close(pd[2].var, 0.7 / 70 / 2);
  assert.equal(pd[14].n, 1);
});

test("progressData com um único registro não quebra", () => {
  const pd = C.progressData([{ data: "2026-01-01", peso: "70" }]);
  assert.equal(pd.filter((w) => w.n).length, 1);
  assert.equal(pd[0].var, null);
  assert.equal(pd[0].leitura, "");
});

test("seriesByGroup e groupBadge", () => {
  const t = [{ grupo: "Peito", series: "4" }, { grupo: "Peito", series: "4" }, { grupo: "Costas", series: "x" }];
  assert.equal(C.seriesByGroup(t, "Peito"), 8);
  assert.equal(C.seriesByGroup(t, "Costas"), 0);
  assert.equal(C.groupBadge(0)[0], "Sem registros");
  assert.equal(C.groupBadge(5)[1], "p-warn");
  assert.equal(C.groupBadge(8)[0], "Iniciante (6–10)");
  assert.equal(C.groupBadge(12)[0], "Intermediário (10–16)");
  assert.equal(C.groupBadge(20)[1], "p-bad");
});

test("sanitizeState: entrada vazia ou inválida gera estado padrão", () => {
  for (const bad of [null, undefined, 42, "x", [], { diary: null, plan: "x", estr: 3, macros: null }]) {
    const s = C.sanitizeState(bad, gen);
    assert.deepEqual(Object.keys(s).sort(), Object.keys(C.defState()).sort());
    assert.ok(Array.isArray(s.diary) && Array.isArray(s.plan));
    assert.equal(s.macros.protKg, 2);
  }
});

test("sanitizeState: neutraliza ids e datas maliciosos (usados em onclick)", () => {
  const s = C.sanitizeState({
    profile: {},
    diary: [
      { id: "x');alert(1);//", data: "2026-01-01", peso: "70" },
      { id: "ok1", data: "2026-01-02');alert(1);//" },
      { id: "ok1", data: "2026-01-03" },
      { id: "ok1", data: "2026-01-04" }
    ],
    treino: [{ id: "<img src=x>", data: "2026-01-01", series: "3" }]
  }, gen);
  assert.equal(s.diary.length, 3, "registro com data inválida é descartado");
  s.diary.forEach((r) => assert.match(r.id, /^[A-Za-z0-9_-]+$/));
  assert.equal(new Set(s.diary.map((r) => r.id)).size, 3, "ids duplicados são regenerados");
  assert.match(s.treino[0].id, /^[A-Za-z0-9_-]+$/);
});

test("sanitizeState: normaliza números e campos enumerados", () => {
  const s = C.sanitizeState({
    profile: { sexo: "Outro", peso: "70,5", idade: 30 },
    diary: [{ data: "2026-01-01", peso: "abc", treinou: "talvez", sono: "7,5" }],
    customFoods: [{ n: "  Shake  ", k: "120", e: "frito" }, { n: "" }]
  }, gen);
  assert.equal(s.profile.sexo, "");
  assert.equal(s.profile.peso, "70.5");
  assert.equal(s.profile.idade, "30");
  assert.equal(s.diary[0].peso, "");
  assert.equal(s.diary[0].sono, "7.5");
  assert.equal(s.diary[0].treinou, "");
  assert.equal(s.customFoods.length, 1);
  assert.equal(s.customFoods[0].n, "Shake");
  assert.equal(s.customFoods[0].e, "pronto");
});

test("sanitizeState: migra uso de suplementos da v1.1 (posição) para id", () => {
  const v1 = {
    profile: {},
    supleCustom: [{ n: "A" }, { n: "B" }, { n: "C" }],
    supleUsa: { b0: "Sim", c2: "Sim", c0: "Não", lixo: "Sim" }
  };
  const s = C.sanitizeState(v1, gen);
  const [a, , c] = s.supleCustom;
  assert.equal(s.supleUsa.b0, "Sim");
  assert.equal(s.supleUsa["c_" + c.id], "Sim");
  assert.equal(s.supleUsa["c_" + a.id], "Não");
  assert.equal(s.supleUsa.lixo, undefined);
  // estado já migrado (v2) é estável: sanitizar de novo não altera nada
  assert.deepEqual(C.sanitizeState(s, gen), s);
});

test("backupStatus: quando lembrar de fazer backup", () => {
  const now = Date.parse("2026-10-04T12:00:00Z");
  const dia = 864e5, iso = (ms) => new Date(ms).toISOString();
  const diary = (n) => Array.from({ length: n }, (_, i) => ({ id: "d" + i, data: "2026-09-0" + ((i % 9) + 1) }));
  const st = (extra) => ({ ...C.defState(), ...extra, meta: { ...C.defState().meta, ...(extra.meta || {}) } });

  assert.equal(C.backupStatus(st({}), now).due, false, "sem dados, sem aviso");
  assert.equal(C.backupStatus(st({ diary: diary(2), meta: { createdAt: iso(now - dia) } }), now).due, false, "pouco uso ainda");
  assert.equal(C.backupStatus(st({ diary: diary(5) }), now).reason, "never", "5 registros sem nenhum backup");
  assert.equal(C.backupStatus(st({ plan: [{ f: "x" }], meta: { createdAt: iso(now - 8 * dia) } }), now).reason, "never", "1 semana de uso");
  assert.equal(C.backupStatus(st({ diary: diary(5), meta: { lastBackup: iso(now - 3 * dia) } }), now).due, false, "backup recente");
  const old = C.backupStatus(st({ diary: diary(5), meta: { lastBackup: iso(now - 15 * dia) } }), now);
  assert.equal(old.reason, "old"); assert.equal(old.days, 15);
  assert.equal(C.backupStatus(st({ diary: diary(5), meta: { lastBackup: iso(now - dia), editsSinceBackup: 15 } }), now).reason, "many");
  assert.equal(C.backupStatus(st({ diary: diary(9), meta: { snoozeUntil: iso(now + dia) } }), now).due, false, "adiado");
  assert.equal(C.backupStatus(st({ diary: diary(9), meta: { snoozeUntil: iso(now - dia) } }), now).due, true, "adiamento venceu");
});

test("sanitizeState: valida os metadados de backup", () => {
  const s = C.sanitizeState({ profile: {}, meta: { lastBackup: "2026-01-01T10:00:00Z", snoozeUntil: "lixo", editsSinceBackup: "-4" } }, gen);
  assert.equal(s.meta.lastBackup, "2026-01-01T10:00:00.000Z");
  assert.equal(s.meta.snoozeUntil, null);
  assert.equal(s.meta.editsSinceBackup, 0);
  assert.deepEqual(C.sanitizeState({}, gen).meta, C.defState().meta);
});

test("medidas caseiras: todo alimento do banco tem medida e a conversão para gramas", () => {
  D.FOODS.forEach((f) => assert.ok((D.UNITS[f[0]] || []).length > 0, "sem medida: " + f[0]));
  Object.keys(D.UNITS).forEach((n) => assert.ok(D.FOODS.some((f) => f[0] === n), "medida para alimento inexistente: " + n));
  const map = C.foodMap(D.FOODS, [{ n: "Pão caseiro", k: 280, p: 9, c: 50, f: 4, fib: 2, un: "fatia", ug: 40 }]);
  const plain = (x) => JSON.parse(JSON.stringify(x)); // UNITS vem de outro contexto (vm)
  assert.deepEqual(plain(C.measuresOf("Ovo cozido", map["Ovo cozido"], D.UNITS)), [{ label: "unidade", g: 50 }]);
  assert.deepEqual(plain(C.measuresOf("Pão caseiro", map["Pão caseiro"], D.UNITS)), [{ label: "fatia", g: 40 }]);
  assert.equal(C.gramsFor(2, 50), 100);
  assert.equal(C.gramsFor("1,5", 13), 19.5);
  assert.equal(C.gramsFor(200, 1.03), 206);
  const t = C.sumItems([{ f: "Ovo cozido", q: String(C.gramsFor(2, 50)), u: "unidade", n: "2" }], map);
  close(t.k, 155);
});

test("sanitizeState: guarda a medida caseira do plano e do alimento próprio", () => {
  const s = C.sanitizeState({
    profile: {},
    plan: [{ m: "Café", f: "Ovo cozido", q: "100", u: "unidade", n: "2" }, { m: "Café", f: "Ovo cozido", q: "50", u: "unidade", n: "0" }, { f: "Arroz branco cozido", q: "150" }],
    customFoods: [{ n: "Pão caseiro", k: 280, un: "fatia", ug: "40" }, { n: "Bolo", k: 300, un: "fatia", ug: "" }]
  }, gen);
  assert.deepEqual(s.plan[0], { m: "Café", f: "Ovo cozido", q: "100", u: "unidade", n: "2" });
  assert.equal(s.plan[1].u, undefined, "quantidade inválida volta a ser só gramas");
  assert.equal(s.plan[2].u, undefined);
  assert.equal(s.customFoods[0].un, "fatia"); assert.equal(s.customFoods[0].ug, 40);
  assert.equal(s.customFoods[1].un, undefined);
});
