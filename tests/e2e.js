/* Teste ponta a ponta no navegador (Chromium via Playwright).
   Uso: npm i --no-save playwright && npx playwright install chromium && npm run e2e
   Sobe um servidor estático próprio, então não precisa de nada rodando antes. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".json": "application/json" };

function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, path.normalize(p));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r(srv)));
}

const steps = [];
async function step(name, fn) {
  try { await fn(); steps.push(["ok", name]); console.log("✔", name); }
  catch (e) { steps.push(["fail", name]); console.error("✘", name, "\n ", e.message); }
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  let browser;
  try { browser = await chromium.launch(exe ? { executablePath: exe } : {}); }
  catch (e) { browser = await chromium.launch(); }
  const context = await browser.newContext({ locale: "pt-BR" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("dialog", (d) => { errors.push("dialog inesperado: " + d.message()); d.dismiss(); });
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("fortis_pwa_v1")));
  const viewText = () => page.textContent("#view");

  await page.goto(base);

  await step("onboarding percorre os passos, valida e salva o perfil", async () => {
    assert.match(await viewText(), /sem passar fome/i);
    await page.click("text=Começar");
    await page.click("text=Continuar");
    assert.match(await page.textContent("#toast"), /Homem ou Mulher/, "exige os dados do passo 1");
    await page.fill("#ob_nome", "Ana Souza");
    await page.click(".opt >> text=Mulher");
    await page.fill("#ob_idade", "28");
    await page.fill("#ob_peso", "60");
    await page.fill("#ob_alt", "165");
    await page.click("text=Continuar");
    await page.click("text=Voltar");
    assert.equal(await page.inputValue("#ob_nome"), "Ana Souza", "voltar mantém o que foi digitado");
    assert.equal(await page.getAttribute(".opt.on", "aria-checked"), "true");
    await page.click("text=Continuar");
    await page.click('.opt .ot >> text="Ativo"');
    await page.click("text=Continuar");
    await page.click("text=Ganhar massa devagar");
    await page.click("text=Ver meu resultado");
    assert.match(await viewText(), /Coma por dia/i);
    await page.click(".kpi.big .help");
    assert.match(await page.textContent("#sheet"), /Calorias por dia/);
    await page.click("text=Entendi");
    await page.click("text=Começar a usar");
    assert.equal((await page.textContent("#viewtitle h1")).trim(), "Início");
    const s = await state();
    assert.equal(s.onboarded, true);
    assert.equal(s.profile.peso, "60");
    assert.equal(s.profile.atividade, "Moderadamente ativo");
    assert.equal(s.profile.objetivo, "Superávit leve");
    assert.match(await viewText(), /Seus próximos passos/);
    assert.match(await viewText(), /Ana/);
  });

  await step("labels ficam associados aos campos", async () => {
    await page.evaluate(() => App.go("perfil"));
    const orphan = await page.evaluate(() => [...document.querySelectorAll("label.f")].filter((l) => !l.control).length);
    assert.equal(orphan, 0);
  });

  await step("editar perfil não perde o foco do próximo campo", async () => {
    await page.focus("#pf_idade");
    await page.fill("#pf_idade", "29");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), "pf_peso");
    assert.equal((await state()).profile.idade, "29");
  });

  await step("um único registro no diário gera gráficos válidos (sem NaN)", async () => {
    await page.evaluate(() => App.go("diario"));
    await page.click("text=＋ Registrar dia");
    await page.fill("#d_peso", "60.4");
    await page.fill("#d_ader", "90");
    await page.click("#sheet button[type=submit]");
    await page.evaluate(() => App.go("progresso"));
    const html = await page.innerHTML("#view");
    assert.ok(!html.includes("NaN"), "não pode haver NaN nos SVGs");
    assert.match(html, /<svg class="chart"/);
  });

  await step("registro duplicado na mesma data pede confirmação e substitui", async () => {
    await page.evaluate(() => App.mDiary());
    await page.fill("#d_peso", "61");
    await page.click("#sheet button[type=submit]");
    assert.match(await page.textContent("#sheet"), /Já existe um registro/);
    await page.click("#btnConfirmYes");
    const s = await state();
    assert.equal(s.diary.length, 1);
    assert.equal(s.diary[0].peso, "61");
  });

  await step("validação usa toast, não alert()", async () => {
    await page.evaluate(() => App.mDiary());
    await page.fill("#d_peso", "");
    await page.evaluate(() => { document.getElementById("d_peso").removeAttribute("min"); document.getElementById("d_peso").value = "10"; });
    await page.click("#sheet button[type=submit]");
    assert.match(await page.textContent("#toast"), /Confira os intervalos/);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.getElementById("modal").classList.contains("open")), false, "Esc fecha o modal");
  });

  await step("excluir suplemento próprio não troca as marcações dos outros", async () => {
    await page.evaluate(() => App.go("suple"));
    for (const n of ["A", "B", "C"]) {
      await page.evaluate(() => App.mSuple());
      await page.fill("#u_n", n);
      await page.click("#sheet button[type=submit]");
    }
    let s = await state();
    const idC = s.supleCustom[2].id;
    await page.evaluate((id) => App.supleSet("c_" + id, 1), idC);
    await page.evaluate((id) => App.supleDel(id), s.supleCustom[0].id);
    await page.click("#btnConfirmYes");
    s = await state();
    assert.deepEqual(s.supleCustom.map((x) => x.n), ["B", "C"]);
    assert.equal(s.supleUsa["c_" + idC], "Sim");
    assert.equal(Object.keys(s.supleUsa).filter((k) => k.startsWith("c_")).length, 1);
  });

  await step("renomear alimento próprio atualiza o plano; nome duplicado é recusado", async () => {
    await page.evaluate(() => App.go("plano"));
    await page.evaluate(() => App.segPlano("alimentos"));
    await page.click("text=＋ Cadastrar alimento");
    await page.fill("#f_n", "Arroz branco cozido");
    await page.fill("#f_k", "130");
    await page.click("#sheet button[type=submit]");
    assert.match(await page.textContent("#toast"), /Já existe um alimento/);
    await page.fill("#f_n", "Shake caseiro");
    await page.click("#sheet button[type=submit]");
    await page.evaluate(() => App.segPlano("plano"));
    await page.click("text=＋ Adicionar alimento");
    await page.fill("#m_f", "Shake caseiro");
    await page.dispatchEvent("#m_f", "change");
    assert.equal(await page.inputValue("#m_u"), "", "alimento sem medida caseira usa gramas");
    await page.fill("#m_n", "200");
    await page.click("#sheet button[type=submit]");
    await page.evaluate(() => App.mFood(0));
    await page.fill("#f_n", "Shake da Ana");
    await page.click("#sheet button[type=submit]");
    const s = await state();
    assert.equal(s.plan[0].f, "Shake da Ana");
    assert.ok(!(await viewText()).includes("não encontrado"));
  });

  await step("busca de alimento por parte do nome (sem acento) e cadastro direto do modal", async () => {
    await page.evaluate(() => { App.go("plano"); App.segPlano("plano"); });
    const n0 = (await state()).plan.length;
    await page.click("text=＋ Adicionar alimento");
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === "m_m"); // modal terminou de abrir
    await page.selectOption("#m_m", "Jantar");
    await page.type("#m_f", "frango peito");
    const opt = page.locator(".acopt", { hasText: "Peito de frango grelhado" });
    await opt.waitFor(); await opt.click();
    assert.equal(await page.inputValue("#m_f"), "Peito de frango grelhado");
    assert.equal(await page.isVisible(".acbox"), false);
    await page.selectOption("#m_u", ""); await page.fill("#m_n", "120");
    await page.click("#sheet button[type=submit]");
    let s = await state(); assert.equal(s.plan.length, n0 + 1);
    assert.deepEqual([s.plan[n0].m, s.plan[n0].f, s.plan[n0].q], ["Jantar", "Peito de frango grelhado", "120"]);
    // texto parcial com um único resultado: completa e pede confirmação antes de salvar
    await page.click("text=＋ Adicionar alimento");
    await page.fill("#m_f", "tilapia"); await page.fill("#m_n", "100");
    await page.click("#sheet button[type=submit]");
    assert.equal(await page.inputValue("#m_f"), "Tilápia grelhada");
    assert.equal((await state()).plan.length, n0 + 1);
    await page.evaluate(() => App.close());
    // alimento inexistente: cadastra pelo próprio modal e volta com ele escolhido
    await page.click("text=＋ Adicionar alimento");
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === "m_m"); // modal terminou de abrir
    await page.selectOption("#m_m", "Ceia");
    await page.fill("#m_n", "40"); await page.type("#m_f", "Granola XYZ");
    await page.click(".acnew");
    assert.equal(await page.inputValue("#f_n"), "Granola XYZ");
    await page.fill("#f_k", "420");
    await page.click("#sheet button[type=submit]");
    assert.equal(await page.inputValue("#m_f"), "Granola XYZ");
    assert.equal(await page.inputValue("#m_m"), "Ceia");
    assert.equal(await page.inputValue("#m_n"), "40");
    await page.click("#sheet button[type=submit]");
    s = await state(); const it = s.plan[s.plan.length - 1];
    assert.deepEqual([it.m, it.f, it.q], ["Ceia", "Granola XYZ", "40"]);
    assert.ok(s.customFoods.some((f) => f.n === "Granola XYZ" && f.k === 420));
  });

  await step("tabela TACO completa: busca, adiciona e filtra por categoria", async () => {
    await page.evaluate(() => { App.go("plano"); App.segPlano("plano"); });
    await page.click("text=＋ Adicionar alimento");
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === "m_m");
    await page.type("#m_f", "banana prata");
    const opt = page.locator(".acopt", { hasText: "Banana, prata, crua" });
    await opt.waitFor(); await opt.click();
    await page.fill("#m_n", "100");
    assert.match(await page.textContent("#m_prev"), /98 kcal/);
    await page.click("#sheet button[type=submit]");
    const s = await state(); assert.equal(s.plan[s.plan.length - 1].f, "Banana, prata, crua");
    await page.evaluate(() => App.segPlano("alimentos"));
    await page.selectOption("#foodCat", "Pescados e frutos do mar");
    const txt = await page.textContent("#foodlist");
    assert.match(txt, /Sardinha/); assert.doesNotMatch(txt, /Frango/);
    await page.fill("#foodSearch", "salmao"); await page.dispatchEvent("#foodSearch", "input");
    assert.match(await page.textContent("#foodlist"), /Salmão/);
    await page.selectOption("#foodCat", ""); await page.fill("#foodSearch", ""); await page.dispatchEvent("#foodSearch", "input");
  });

  await step("registro do dia: ajuda no próprio formulário e preencher com os valores do plano", async () => {
    await page.evaluate(() => App.mDiary());
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === "d_data"); // modal terminou de abrir
    await page.fill("#d_peso", "72.5");
    await page.click("button[aria-label='Saiba mais: Calorias que você comeu']");
    assert.match(await page.textContent("#hb_dkcal"), /realmente comeu/);
    assert.equal(await page.inputValue("#d_peso"), "72.5", "abrir a ajuda não apaga o que foi digitado");
    await page.click("button[aria-label='Saiba mais: Calorias que você comeu']");
    assert.equal(await page.$("#hb_dkcal"), null, "segundo toque fecha a ajuda");
    const btn = page.locator("text=Usar valores do meu plano");
    const [, kcal, prot] = (await btn.textContent()).match(/\(([\d.]+) kcal • ([\d.]+) g/);
    await btn.click();
    assert.equal(await page.inputValue("#d_kcal"), kcal.replace(/\./g, ""));
    assert.equal(await page.inputValue("#d_prot"), prot.replace(/\./g, ""));
    await page.evaluate(() => App.close());
  });

  await step("adicionar por medida caseira (2 ovos) calcula as gramas e permite mudar a quantidade", async () => {
    await page.evaluate(() => { App.go("plano"); App.segPlano("plano"); });
    await page.click("text=＋ Adicionar alimento");
    await page.fill("#m_f", "Ovo cozido");
    await page.dispatchEvent("#m_f", "change");
    assert.equal(await page.$eval("#m_u option:checked", (o) => o.textContent), "unidade (50 g)");
    await page.fill("#m_n", "2");
    assert.match(await page.textContent("#m_prev"), /100 g.*155 kcal/);
    await page.click("#sheet button[type=submit]");
    let s = await state(); const it = s.plan[s.plan.length - 1];
    assert.deepEqual([it.f, it.q, it.u, it.n], ["Ovo cozido", "100", "unidade", "2"]);
    assert.match(await viewText(), /2 × unidade \(100 g\)/);
    const id = "#pq" + (s.plan.length - 1);
    await page.fill(id, "3"); await page.dispatchEvent(id, "change"); await page.waitForTimeout(50);
    s = await state(); assert.equal(s.plan[s.plan.length - 1].q, "150");
    // leite em ml
    await page.click("text=＋ Adicionar alimento");
    await page.fill("#m_f", "Leite integral"); await page.dispatchEvent("#m_f", "change");
    await page.selectOption("#m_u", { label: "ml" }); await page.fill("#m_n", "300");
    await page.click("#sheet button[type=submit]");
    s = await state(); assert.equal(s.plan[s.plan.length - 1].q, "309");
    // ainda dá para usar gramas
    await page.click("text=＋ Adicionar alimento");
    await page.fill("#m_f", "Arroz branco cozido"); await page.dispatchEvent("#m_f", "change");
    await page.selectOption("#m_u", ""); await page.fill("#m_n", "150");
    await page.click("#sheet button[type=submit]");
    s = await state(); const last = s.plan[s.plan.length - 1];
    assert.equal(last.q, "150"); assert.equal(last.u, undefined);
  });

  await step("auditoria: Sobre sem rede externa, '?' após editar o perfil, nome longo e arquivo que não é backup", async () => {
    // Sobre: capa local, nenhuma requisição para fora do app
    const externos = [];
    const onReq = (r) => { if (!r.url().startsWith(base) && !r.url().startsWith("data:")) externos.push(r.url()); };
    page.on("request", onReq);
    await page.evaluate(() => App.go("sobre"));
    await page.waitForFunction(() => { const i = document.querySelector(".hero img"); return i && i.complete && i.naturalWidth > 0; });
    page.off("request", onReq);
    assert.deepEqual(externos, []);
    // Perfil: o "?" do resultado funciona logo depois de editar um campo
    await page.evaluate(() => App.go("perfil"));
    await page.fill("#pf_peso", "82");
    await page.click("#pfResult button[aria-label^='Saiba mais: Gasto em repouso']");
    assert.match(await page.textContent("#sheet"), /Gasto em repouso/);
    await page.evaluate(() => App.close());
    await page.fill("#pf_altura", "1.91");
    assert.match(await page.textContent("#pfResult"), /altura entre 100 e 250 cm/);
    assert.equal(await page.getAttribute("#pf_altura", "aria-invalid"), "true");
    await page.fill("#pf_altura", "175");
    // Lista de compras: nome longo sem espaços não cria rolagem lateral
    await page.evaluate(() => App.go("compras"));
    await page.click("#btnShopAdd");
    await page.fill("#s_n", "X".repeat(120));
    await page.click("#sheet button[type=submit]");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    // Backup: um JSON qualquer com "profile" não substitui os dados
    const file = path.join(require("node:os").tmpdir(), "fortis-nao-backup.json");
    fs.writeFileSync(file, JSON.stringify({ profile: {}, foo: 1 }));
    await page.evaluate(() => App.go("backup"));
    await page.setInputFiles("#impFile", file);
    await page.waitForFunction(() => /não parece um backup/.test(document.getElementById("toast").textContent));
    assert.equal(await page.isVisible("#btnConfirmYes"), false);
  });

  await step("importar backup malicioso não executa código e não quebra o app", async () => {
    const evil = {
      profile: { nome: "<img src=x onerror=window.__pwned=1>" }, onboarded: true,
      diary: [{ id: "a');window.__pwned=1;//", data: "2026-01-01", peso: "70" }, { id: "b", data: "2026-01-02');window.__pwned=1;//" }],
      treino: null, plan: "lixo", supleCustom: [{ n: "<script>window.__pwned=1</script>" }]
    };
    const file = path.join(require("node:os").tmpdir(), "fortis-evil.json");
    fs.writeFileSync(file, JSON.stringify(evil));
    await page.evaluate(() => App.go("backup"));
    await page.setInputFiles("#impFile", file);
    await page.click("#btnConfirmYes");
    for (const v of ["inicio", "diario", "suple", "progresso"]) await page.evaluate((x) => App.go(x), v);
    await page.evaluate(() => App.go("diario"));
    await page.click("text=Editar");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => window.__pwned), undefined);
    const s = await state();
    assert.equal(s.diary.length, 1);
    assert.ok(Array.isArray(s.treino) && Array.isArray(s.plan));
  });

  await step("lembrete de backup aparece, pode ser adiado e some após o backup", async () => {
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("fortis_pwa_v1"));
      s.diary = Array.from({ length: 6 }, (_, i) => ({ id: "b" + i, data: "2026-09-0" + (i + 1), peso: "70" }));
      s.meta = { createdAt: new Date().toISOString(), lastBackup: null, snoozeUntil: null, editsSinceBackup: 0 };
      localStorage.setItem("fortis_pwa_v1", JSON.stringify(s));
    });
    await page.reload();
    assert.match(await viewText(), /Proteja seus dados/);
    await page.click(".backupcard >> text=Agora não");
    assert.ok(!(await viewText()).includes("Proteja seus dados"), "adiado some");
    assert.ok((await state()).meta.snoozeUntil);
    await page.evaluate(() => App.go("mais"));
    assert.match(await viewText(), /Nenhum backup ainda/);
    await page.evaluate(() => App.go("backup"));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("text=Enviar backup")]);
    assert.match(dl.suggestedFilename(), /^fortis-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const s = await state();
    assert.ok(s.meta.lastBackup, "registra a data do backup");
    assert.equal(s.meta.editsSinceBackup, 0);
    assert.match(await viewText(), /Último backup: hoje/);
  });

  await step("apagar tudo volta ao onboarding sem recarregar", async () => {
    await page.evaluate(() => App.go("backup"));
    await page.click("text=Apagar todos os dados");
    await page.click("#btnConfirmYes");
    assert.match(await viewText(), /sem passar fome/i);
  });

  await step("funciona offline depois da primeira visita (service worker)", async () => {
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();                         // agora controlado pelo SW
    await context.setOffline(true);
    await page.reload();
    assert.match(await viewText(), /sem passar fome/i);
    const font = await page.evaluate(() => document.fonts.check("700 16px Oswald"));
    assert.ok(font, "fonte Oswald carregada do cache");
    await context.setOffline(false);
  });

  await step("nenhum erro de JavaScript no console", async () => {
    assert.deepEqual(errors, []);
  });

  await browser.close();
  srv.close();
  const failed = steps.filter((s) => s[0] === "fail").length;
  console.log(`\n${steps.length - failed}/${steps.length} etapas ok`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
