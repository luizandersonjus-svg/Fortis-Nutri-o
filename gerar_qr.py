#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Regenera o QR code da página de instalação após publicar o app.

Uso:
    1. Publique a pasta fortis-app (GitHub Pages, Netlify, Vercel...).
    2. Edite URL_BASE abaixo com o endereço final (https).
    3. Rode:  python3 gerar_qr.py
    4. Suba novamente os arquivos alterados (assets/qr-install.png e instalar.html).
"""
import base64
import re

URL_BASE = "https://luizandersonjus-svg.github.io/Fortis-Nutri-o"

import segno

INSTALL_URL = URL_BASE.rstrip("/") + "/instalar.html"
APP_URL = URL_BASE.rstrip("/") + "/index.html"

qr = segno.make(INSTALL_URL, error="m")
qr.save("assets/qr-install.png", scale=8, border=2, dark="#0B0B0B", light="#FFFFFF")
print("QR regenerado:", INSTALL_URL)

b64 = base64.b64encode(open("assets/qr-install.png", "rb").read()).decode()
h = open("instalar.html").read()
h2, n = re.subn(r'src="data:image/png;base64,[^"]*"', 'src="data:image/png;base64,' + b64 + '"', h)
assert n == 1, "img do QR não encontrada em instalar.html"
# atualiza URLs visíveis (qualquer https anterior -> nova base)
h2 = re.sub(r"https://[A-Za-z0-9.\-:]+(?=/instalar\.html)", URL_BASE.rstrip("/"), h2)
open("instalar.html", "w").write(h2)
print("instalar.html atualizado. Suba os arquivos e teste o QR com a câmera do celular.")
