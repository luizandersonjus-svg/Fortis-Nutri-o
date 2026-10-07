# 🛡️ FORTIS — App PWA (Calorias, Macros e Progresso) — v1.5

Acompanha o ebook + planilha FORTIS. **PWA instalável, 100% offline, dados só no aparelho** (sem conta, sem servidor).

## Telas (espelham a planilha)
- **Início** — calorias-alvo, metas, peso, semana + atalhos
- **Perfil e Metas** — TMB (Mifflin-St Jeor), GET, calorias-alvo, ritmo semanal
- **Macronutrientes** — g/kg, distribuição, fibras, alertas + gráfico de pizza
- **Plano Alimentar** — refeições, totais vs. metas (±5%), subtotal por refeição
- **Estruturas de Referência** — ≈2.200 / 2.800 / 3.400 kcal (não são cardápios prontos)
- **Banco de Alimentos** — 65 alimentos + busca (ignora acentos) + cadastro próprio
- **Registro Diário** — peso, cintura, kcal, proteína, sono, treino, aderência
- **Progresso** — médias semanais (12 semanas, estende se houver mais), variação, leituras + 4 gráficos
- **Treino** — log + séries por grupo vs. referência (6–10 / 10–16)
- **Lista de Compras** — 36 itens do ebook + contador + personalizados
- **Suplementação** — 5 referências + toggle de uso + personalizados
- **Backup** — exportar/importar JSON, exportar CSV, apagar dados

## Identidade visual
- **Símbolo:** escudo dourado com o **capacete espartano da capa do ebook**, redesenhado em vetor com textura de folha de ouro (`assets/logo.svg`). Usado no cabeçalho, na tela de boas-vindas, na página de instalação e nos ícones PWA.
- Preto + dourado metálico, pincelada dourada e os 5 checks da capa (`assets/cover.jpg` em *Sobre o método*).

## Página de instalação + QR code
- **`instalar.html`** — página autocontida (funciona até em prévia de arquivo) com QR, botão de abrir o app e passo a passo Android/iPhone. Linkada no app em **Mais → Instalar o app**.
- **`assets/qr-install.png`** — QR apontando para a página de instalação (para imprimir/divulgar).
- ⚠️ **Após publicar**, regenere o QR com o domínio final:
  ```bash
  # edite URL_BASE em gerar_qr.py, depois:
  python3 gerar_qr.py
  ```
  Suba novamente `instalar.html` + `assets/qr-install.png`.

## Página de instalação para o ebook
`ebook/pagina-instalacao.pdf` (A4, com **botão e QR clicáveis**) e `ebook/pagina-instalacao.png` (imagem para Canva — lá, adicione o link ao botão manualmente). Para regenerar após mudar o texto em `ebook/pagina-instalacao.html`:
```bash
npm install --no-save playwright && npx playwright install chromium
node ebook/gerar.js
```

## Como testar local
Na raiz do repositório:
```bash
python3 -m http.server 8080      # ou: npm start
```
Abra `http://localhost:8080` (app) ou `/instalar.html` (página de instalação).

## Como publicar (grátis)
- **GitHub Pages / Netlify / Vercel:** suba esta pasta. Exige HTTPS (instalação PWA só funciona em HTTPS ou localhost).
- Depois de publicado: Android → Chrome ⋮ → **Instalar app**. iPhone → Safari → Compartilhar → **Adicionar à Tela de Início**.

## Trocar logo/ícones
- Substitua `assets/cover.jpg` (capa). Ao mudar `assets/logo.svg`, copie o mesmo SVG para dentro de `instalar.html` (a página é autocontida) e regenere os PNGs de `icons/` (192, 512, maskable 512 com margem de segurança, apple-touch 180, favicon 32) renderizando o SVG num navegador — o `cairosvg` não suporta o filtro de textura.

## Estrutura do código
| Arquivo | Papel |
|---|---|
| `index.html` | Casca do app (cabeçalho, área da tela, barra de abas, modal, toast) |
| `core.js` | **Cálculos puros** (TMB/GET, macros, totais, semanas, progresso) e validação/migração do estado. Roda no navegador e no Node (testes) |
| `app.js` | Telas, modais, navegação e ações (`window.App`) |
| `foods.js` | Dados base: alimentos, fatores, estruturas, compras, suplementos |
| `sw.js` | Service Worker (offline) |
| `fonts/` | Oswald (SIL OFL 1.1, ver `fonts/OFL.txt`) embutida para funcionar offline |
| `tests/` | `core.test.js` (unitários, `node:test`) e `e2e.js` (navegador, Playwright) |

## Testes
```bash
npm run check   # sintaxe de todos os scripts
npm test        # testes unitários — sem dependências (Node ≥ 18)

# ponta a ponta no Chromium (onboarding, diário, importação maliciosa, offline…)
npm install --no-save playwright && npx playwright install chromium
npm run e2e
```
O GitHub Actions (`.github/workflows/ci.yml`) roda os dois a cada push/PR.

## Notas técnicas
- Zero dependências de execução, zero rede: funciona offline via Service Worker (`sw.js`).
- **Atualizações:** o Service Worker usa *rede primeiro* (tempo-limite de 3,5 s) e cai para o cache quando offline — quem está online recebe a versão publicada sem precisar trocar o nome do cache. Ao **adicionar um arquivo novo** ao app, inclua-o em `ASSETS` no `sw.js` para que funcione offline já na primeira visita.
- Armazenamento: `localStorage` (chave `fortis_pwa_v1`) com fallback em memória e aviso se não for possível salvar. O estado é **validado e migrado** a cada carga e importação (`sanitizeState` em `core.js`): tipos, datas ISO e ids seguros; backups da v1.1 são aceitos.
- Semana 1 = data do primeiro registro (equivale ao `$A$2` da planilha). A variação semanal compara com a última semana anterior que tem pesagem (normalizada por semana).
- Um registro por dia: lançar outro na mesma data pede confirmação e substitui.
- CSV exportado no padrão do Excel pt-BR (`;` entre colunas, vírgula decimal, UTF-8 com BOM).

## Novidades da v1.5 — medidas caseiras
- Ao adicionar um alimento ao plano, escolha a **medida**: unidade, colher de sopa, concha, fatia, copo (200 ml), **ml** para líquidos… ou gramas. O app converte para gramas e mostra na hora calorias e macros (ex.: “2 × unidade = 100 g • 155 kcal”).
- Todos os 65 alimentos do banco têm pelo menos uma medida (`FORTIS.UNITS` em `foods.js`, valores aproximados de tabelas de medidas caseiras). A lista de alimentos mostra “📏 1 unidade ≈ 50 g”.
- No plano, itens por medida mostram “2 × unidade (100 g)” e o campo altera a **quantidade de medidas** (as gramas são recalculadas).
- Alimentos próprios podem ter uma medida caseira (nome + gramas).
- Cálculos continuam em gramas (`q`); a medida fica em `u`/`n` no item do plano. Planos antigos (só gramas) seguem funcionando.

## Novidades da v1.4 — backup sem esquecer
- **Lembrete no Início** (“Proteja seus dados”) quando há dados e nenhum backup (5 registros ou 1 semana de uso), quando o último backup tem 14+ dias ou após 15 registros novos. “Agora não” adia por 3 dias. Regra em `backupStatus` (`core.js`), com testes.
- **Backup em 1 toque:** “Enviar backup” abre o compartilhamento do celular (WhatsApp, e-mail, Drive); sem suporte, baixa o arquivo. No Android o arquivo vai como `.txt` (o Chrome não compartilha `.json`); o Importar aceita os dois.
- Tela **Backup e dados** com o status (“Último backup: há X dias”), passo a passo para **trocar de celular** e o status também no menu Mais.
- Pede **armazenamento persistente** ao navegador (após registrar ou fazer backup) para reduzir o risco de o sistema apagar os dados.
- Aviso de backup na tela de boas-vindas e na página do ebook.
- `instalar.html` detecta o aparelho: botão **Instalar agora** (1 toque) no Android, passo a passo do Safari no iPhone e QR só no computador.

## Novidades da v1.3 — mais fácil para iniciantes
- **Nova tela de boas-vindas** com o logo vetorial e textos de verdade (a capa do ebook continua em *Sobre o método*).
- **Cadastro guiado em 4 passos** com validação: sobre você → quanto se movimenta → objetivo → resultado explicado.
- **Linguagem simples:** opções em cartões com explicação (ex.: “Ganhar massa devagar — bom para começar” em vez de “Superávit leve”; “Ativo — treina 3 a 5 vezes por semana” em vez de “Moderadamente ativo”). Os valores salvos não mudaram, então dados antigos continuam válidos. Textos ficam em `FORTIS.ACT_INFO` / `FORTIS.GOAL_INFO` (`foods.js`).
- **Botões “?”** explicam cada termo (calorias por dia, gasto em repouso, gasto total, superávit, macros, g/kg, cintura, “seguiu o plano?”).
- **Início com “Seus próximos passos”** (perfil → plano → registrar peso) e a meta de calorias explicada em uma frase.
- Termos renomeados: “Calorias-alvo” → “Coma por dia”, “Aderência” → “Seguiu o plano?”, “Estruturas” → “Cardápios-modelo”.

## Novidades da v1.2
- **Correções:** onboarding em 4 passos voltou a funcionar (antes pulava para o Início no 1º passo e não salvava nada); gráficos com uma única semana não quebram mais (NaN); excluir um suplemento próprio não troca mais as marcações dos outros; perda de peso não é mais lida como “peso estável”; gráfico de pizza com carboidrato negativo; “Apagar tudo” volta ao onboarding; dados após a semana 12 não somem mais.
- **Segurança:** backups importados são validados (não quebram o app e não injetam código).
- **Dados:** alimento próprio com nome duplicado é recusado; renomear um alimento atualiza o plano e as estruturas; data duplicada no diário pede confirmação.
- **Acessibilidade:** rótulos associados aos campos, `aria-label` em botões de ícone, aba atual anunciada, modal com `Esc` e foco gerenciado, gráficos com descrição textual, contraste dos eixos, mensagens em *toast* acessível no lugar de `alert()`; o foco não se perde ao editar o perfil/macros/plano.
- **Visual:** a fonte Oswald agora é carregada de fato (antes caía para Arial Narrow).
- **Desempenho:** derivados (mapa de alimentos, início das semanas) em cache; lista de alimentos só é reconstruída quando muda.

> Ferramenta educacional. Não substitui nutricionista, médico ou outro profissional habilitado. Sem promessas de resultado.
