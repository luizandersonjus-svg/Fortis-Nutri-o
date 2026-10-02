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

  await step("onboarding percorre os 4 passos e salva o perfil", async () => {
    assert.equal((await page.textContent("#viewtitle")).trim(), "Bem-vindo");
    await page.fill("#ob_nome", "Ana Souza");
    await page.selectOption("#ob_sexo", "Feminino");
    await page.click("text=Continuar");
    await page.fill("#ob_idade", "28");
    await page.fill("#ob_peso", "60");
    await page.fill("#ob_alt", "165");
    await page.click("text=Voltar");
    assert.equal(await page.inputValue("#ob_nome"), "Ana Souza", "voltar mantém o que foi digitado");
    await page.click("text=Continuar");
    assert.equal(await page.inputValue("#ob_peso"), "60");
    await page.click("text=Continuar");
    await page.selectOption("#ob_ativ", "Moderadamente ativo");
    await page.selectOption("#ob_obj", "Superávit leve");
    await page.click("text=Continuar");
    await page.click("text=Começar!");
    assert.equal((await page.textContent("#viewtitle h1")).trim(), "Início");
    const s = await state();
    assert.equal(s.onboarded, true);
    assert.equal(s.profile.peso, "60");
    assert.match(await viewText(), /Calorias-alvo/);
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
    await page.click("#sheet .btn-gold");
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
    await page.click("#sheet .btn-gold");
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
    await page.fill("#m_q", "200");
    await page.click("#sheet button[type=submit]");
    await page.evaluate(() => App.mFood(0));
    await page.fill("#f_n", "Shake da Ana");
    await page.click("#sheet button[type=submit]");
    const s = await state();
    assert.equal(s.plan[0].f, "Shake da Ana");
    assert.ok(!(await viewText()).includes("não encontrado"));
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
    await page.click("#sheet .btn-gold");
    for (const v of ["inicio", "diario", "suple", "progresso"]) await page.evaluate((x) => App.go(x), v);
    await page.evaluate(() => App.go("diario"));
    await page.click("text=Editar");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => window.__pwned), undefined);
    const s = await state();
    assert.equal(s.diary.length, 1);
    assert.ok(Array.isArray(s.treino) && Array.isArray(s.plan));
  });

  await step("apagar tudo volta ao onboarding sem recarregar", async () => {
    await page.evaluate(() => App.go("backup"));
    await page.click("text=Apagar todos os dados");
    await page.click("#sheet .btn-gold");
    assert.equal((await page.textContent("#viewtitle")).trim(), "Bem-vindo");
  });

  await step("funciona offline depois da primeira visita (service worker)", async () => {
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();                         // agora controlado pelo SW
    await context.setOffline(true);
    await page.reload();
    assert.equal((await page.textContent("#viewtitle")).trim(), "Bem-vindo");
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
