# 🛡️ FORTIS — App PWA (Calorias, Macros e Progresso) — v1.2

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

## Identidade visual (v1.1)
- **Novo logotipo**: escudo dourado com **capacete espartano desenhado em SVG** (`assets/logo.svg`) — cabeçalho do app, página de instalação e ícones PWA.
- Preto texturizado + dourado metálico, pincelada dourada e os 5 checks da capa (`assets/cover.jpg` na abertura e no Sobre).

## Página de instalação + QR code
- **`instalar.html`** — página autocontida (funciona até em prévia de arquivo) com QR, botão de abrir o app e passo a passo Android/iPhone. Linkada no app em **Mais → Instalar o app**.
- **`assets/qr-install.png`** — QR apontando para a página de instalação (para imprimir/divulgar).
- ⚠️ **Após publicar**, regenere o QR com o domínio final:
  ```bash
  # edite URL_BASE em gerar_qr.py, depois:
  python3 gerar_qr.py
  ```
  Suba novamente `instalar.html` + `assets/qr-install.png`.

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
- Substitua `assets/cover.jpg` (capa). Para refazer os ícones a partir de um novo `logo.svg`, renderize com `cairosvg` nos tamanhos 192/512 (+ maskable com margem) — veja o histórico de geração.

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

## Novidades da v1.2
- **Correções:** onboarding em 4 passos voltou a funcionar (antes pulava para o Início no 1º passo e não salvava nada); gráficos com uma única semana não quebram mais (NaN); excluir um suplemento próprio não troca mais as marcações dos outros; perda de peso não é mais lida como “peso estável”; gráfico de pizza com carboidrato negativo; “Apagar tudo” volta ao onboarding; dados após a semana 12 não somem mais.
- **Segurança:** backups importados são validados (não quebram o app e não injetam código).
- **Dados:** alimento próprio com nome duplicado é recusado; renomear um alimento atualiza o plano e as estruturas; data duplicada no diário pede confirmação.
- **Acessibilidade:** rótulos associados aos campos, `aria-label` em botões de ícone, aba atual anunciada, modal com `Esc` e foco gerenciado, gráficos com descrição textual, contraste dos eixos, mensagens em *toast* acessível no lugar de `alert()`; o foco não se perde ao editar o perfil/macros/plano.
- **Visual:** a fonte Oswald agora é carregada de fato (antes caía para Arial Narrow).
- **Desempenho:** derivados (mapa de alimentos, início das semanas) em cache; lista de alimentos só é reconstruída quando muda.

> Ferramenta educacional. Não substitui nutricionista, médico ou outro profissional habilitado. Sem promessas de resultado.
