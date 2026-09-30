# 🛡️ FORTIS — App PWA (Calorias, Macros e Progresso) — v1.1

Acompanha o ebook + planilha FORTIS. **PWA instalável, 100% offline, dados só no aparelho** (sem conta, sem servidor).

## Telas (espelham a planilha)
- **Início** — calorias-alvo, metas, peso, semana + atalhos
- **Perfil e Metas** — TMB (Mifflin-St Jeor), GET, calorias-alvo, ritmo semanal
- **Macronutrientes** — g/kg, distribuição, fibras, alertas + gráfico de pizza
- **Plano Alimentar** — refeições, totais vs. metas (±5%), subtotal por refeição
- **Estruturas de Referência** — ≈2.200 / 2.800 / 3.400 kcal (não são cardápios prontos)
- **Banco de Alimentos** — 65 alimentos + busca + cadastro próprio
- **Registro Diário** — peso, cintura, kcal, proteína, sono, treino, aderência
- **Progresso** — médias semanais 1–12, variação, leituras + 4 gráficos
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
```bash
cd fortis-app
python3 -m http.server 8080
```
Abra `http://localhost:8080` (app) ou `/instalar.html` (página de instalação).

## Como publicar (grátis)
- **GitHub Pages / Netlify / Vercel:** suba esta pasta. Exige HTTPS (instalação PWA só funciona em HTTPS ou localhost).
- Depois de publicado: Android → Chrome ⋮ → **Instalar app**. iPhone → Safari → Compartilhar → **Adicionar à Tela de Início**.

## Trocar logo/ícones
- Substitua `assets/cover.jpg` (capa). Para refazer os ícones a partir de um novo `logo.svg`, renderize com `cairosvg` nos tamanhos 192/512 (+ maskable com margem) — veja o histórico de geração.

## Notas técnicas
- Zero dependências, zero rede: funciona offline via Service Worker (`sw.js`, cache `fortis-v2`).
- Armazenamento: `localStorage` (chave `fortis_pwa_v1`) com fallback em memória.
- Semana 1 = data do primeiro registro (equivale ao `$A$2` da planilha).

> Ferramenta educacional. Não substitui nutricionista, médico ou outro profissional habilitado. Sem promessas de resultado.
