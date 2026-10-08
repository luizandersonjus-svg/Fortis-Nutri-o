"""Gera o emblema, o símbolo e os ícones do app a partir da arte original do Canva.

Fonte: assets/fonte/emblema-canva.jpg — página 1 do design "FORTIS - capa final do ebook"
exportada do Canva em PNG (2178 x 2262). Se a arte mudar, exporte de novo, salve por cima
desse arquivo e rode:

    pip install pillow numpy
    python3 gerar_icones.py

Saídas:
  assets/emblema.png        emblema circular completo, fundo transparente (boas-vindas, instalação)
  assets/simbolo.png        escudo + capacete + halteres, fundo transparente (cabeçalho)
  icons/icon-512.png, icon-192.png, apple-touch-icon.png (180), maskable-512.png, favicon-32.png
  instalar.html             emblema embutido entre <!--emblema--> e <!--/emblema-->
"""
import base64, io, re
import numpy as np
from PIL import Image, ImageDraw

FONTE = "assets/fonte/emblema-canva.jpg"
PRETO = (11, 11, 11)          # --black do app
SS = 4                        # supersampling das máscaras (borda suave)


def contorno_do_anel(rgb):
    """Centro e raios (elipse) do anel dourado externo."""
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    ouro = (r > 150) & (g > 100) & (b < 110) & (r - b > 80)
    ys, xs = np.where(ouro)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    ang, d = np.arctan2(ys - cy, xs - cx), np.hypot(xs - cx, ys - cy)
    raio = lambda a: d[np.abs(((ang - a + np.pi) % (2 * np.pi)) - np.pi) < 0.03].max()
    rx = max(raio(0), raio(np.pi))
    ry = max(raio(np.pi / 2), raio(-np.pi / 2))
    return cx, cy, rx, ry, ouro


def mascara_elipse(size, box):
    W, H = size
    m = Image.new("L", (W * SS, H * SS), 0)
    ImageDraw.Draw(m).ellipse([v * SS for v in box], fill=255)
    return m.resize((W, H), Image.LANCZOS)


def emblema(img, cx, cy, rx, ry):
    """Recorta o círculo (some o fundo e a marca d'água do canto) com fundo transparente."""
    folga = 6
    box = (cx - rx - folga, cy - ry - folga, cx + rx + folga, cy + ry + folga)
    out = img.convert("RGBA")
    out.putalpha(mascara_elipse(img.size, box))
    return out.crop(tuple(int(round(v)) for v in box))


def recorte_luminoso(img, box, anel, preto=38, cheio=120):
    """Dourado sobre preto → fundo transparente (alfa pelo brilho; cor original preservada).
    anel = (cx, cy, rx, ry): o que fica perto do anel externo é descartado."""
    c = np.asarray(img.crop(box).convert("RGB")).astype(float)
    lum = c.max(axis=2)
    alfa = np.clip((lum - preto) / (cheio - preto), 0, 1)
    cx, cy, rx, ry = anel
    yy, xx = np.mgrid[box[1]:box[3], box[0]:box[2]]
    dist = np.hypot((xx - cx) / rx, (yy - cy) / ry)
    alfa *= np.clip((0.92 - dist) / 0.02, 0, 1)
    rgba = np.dstack([c, alfa * 255]).astype(np.uint8)
    out = Image.fromarray(rgba, "RGBA")
    return out.crop(out.getbbox())


def no_quadrado(rgba, lado, ocupa=0.94, fundo=PRETO):
    """Centraliza numa tela quadrada; fundo None = transparente."""
    tela = Image.new("RGBA", (lado, lado), (*fundo, 255) if fundo else (0, 0, 0, 0))
    esc = ocupa * lado / max(rgba.size)
    peq = rgba.resize((round(rgba.width * esc), round(rgba.height * esc)), Image.LANCZOS)
    tela.alpha_composite(peq, ((lado - peq.width) // 2, (lado - peq.height) // 2))
    return tela


def main():
    img = Image.open(FONTE).convert("RGB")
    rgb = np.asarray(img)
    cx, cy, rx, ry, ouro = contorno_do_anel(rgb)

    emb = emblema(img, cx, cy, rx, ry)
    emb.resize((480, round(480 * emb.height / emb.width)), Image.LANCZOS).save("assets/emblema.png", optimize=True)

    # símbolo = ouro dentro do anel e acima do letreiro "FORTIS"
    ys, xs = np.where(ouro & (np.hypot((np.arange(rgb.shape[1]) - cx)[None, :] / rx,
                                        (np.arange(rgb.shape[0]) - cy)[:, None] / ry) < 0.9))
    topo = ys.min()
    corte = topo + int(0.43 * 2 * ry)            # o símbolo ocupa ~43% da altura do emblema
    sel = ys < corte
    box = (xs[sel].min() - 8, topo - 8, xs[sel].max() + 9, corte)
    simb = recorte_luminoso(img, box, (cx, cy, rx, ry))
    simb.resize((240, round(240 * simb.height / simb.width)), Image.LANCZOS).save("assets/simbolo.png", optimize=True)

    # escudo sozinho (sem halteres) para o favicon de 32 px: faixa central do símbolo
    # largura do escudo medida no topo, onde ainda não há halteres
    a = np.asarray(simb)[..., 3]
    cols = np.where(a[: int(simb.height * 0.2)].max(axis=0) > 60)[0]
    escudo = simb.crop((cols.min(), 0, cols.max() + 1, simb.height))
    escudo = escudo.crop(escudo.getbbox())

    no_quadrado(emb, 512).convert("RGB").save("icons/icon-512.png", optimize=True)
    no_quadrado(emb, 192).convert("RGB").save("icons/icon-192.png", optimize=True)
    no_quadrado(emb, 180, ocupa=0.9).convert("RGB").save("icons/apple-touch-icon.png", optimize=True)
    # maskable: o sistema pode cortar até 20% de cada lado → emblema dentro do círculo seguro (80%)
    no_quadrado(emb, 512, ocupa=0.78).convert("RGB").save("icons/maskable-512.png", optimize=True)
    no_quadrado(escudo, 32, ocupa=0.96, fundo=None).save("icons/favicon-32.png", optimize=True)
    # instalar.html é autocontida (abre até como arquivo solto): emblema embutido em base64
    buf = io.BytesIO()
    emb.resize((240, round(240 * emb.height / emb.width)), Image.LANCZOS).save(buf, "PNG", optimize=True)
    tag = ('<img src="data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
           + '" width="150" height="155" alt="Emblema FORTIS">')
    with open("instalar.html", encoding="utf-8") as f:
        html = f.read()
    html, n = re.subn(r"<!--emblema-->.*?<!--/emblema-->", lambda m: "<!--emblema-->" + tag + "<!--/emblema-->", html, flags=re.S)
    assert n == 1, "marcador <!--emblema--> não encontrado em instalar.html"
    with open("instalar.html", "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    print("emblema", emb.size, "símbolo", simb.size, "escudo", escudo.size)


if __name__ == "__main__":
    main()
