"""Gera taco.js a partir da TACO 4ª edição (NEPA/UNICAMP, 2011).

Fonte dos CSVs: https://github.com/raulfdm/taco-api (references/csv, licença MIT),
normalizados a partir da planilha original da UNICAMP.

Uso:  python3 gerar_taco.py
"""
import csv, io, json, re, unicodedata, urllib.request

BASE = "https://raw.githubusercontent.com/raulfdm/taco-api/main/references/csv/"


def baixar(nome):
    with urllib.request.urlopen(BASE + nome) as r:
        return list(csv.DictReader(io.StringIO(r.read().decode("utf-8"))))


def numero(v):
    # vazio = traço/não analisado na TACO → 0
    try:
        x = round(float(v), 1)
    except (TypeError, ValueError):
        return 0
    return int(x) if x == int(x) else x


def estado(nome):
    n = unicodedata.normalize("NFD", nome.lower())
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")
    if re.search(r"\bcru[as]?\b", n):
        return "cru"
    if re.search(r"cozid|assad|grelhad|frit|refogad|ensopad|braseado", n):
        return "cozido"
    return "pronto"


def nomes_base():
    """nomes já existentes em foods.js (não duplicar)"""
    txt = open("foods.js", encoding="utf-8").read()
    bloco = txt.split("FORTIS.FOODS = [", 1)[1].split("\n];", 1)[0]
    return {m.lower() for m in re.findall(r'^\["([^"]+)"', bloco, re.M)}


def main():
    cats = {c["id"]: c["name"] for c in baixar("categories.csv")}
    nut = {n["foodId"]: n for n in baixar("nutrients.csv")}
    existentes = nomes_base()
    linhas, pulados = [], []
    for f in baixar("food.csv"):
        n = nut.get(f["id"], {})
        nome = " ".join(f["name"].split())
        if not n.get("kcal"):
            pulados.append(nome)
            continue
        if nome.lower() in existentes:
            continue
        linhas.append([nome, numero(n["kcal"]), numero(n["protein"]), numero(n["carbohydrates"]),
                       numero(n["lipids"]), numero(n["dietaryFiber"]), estado(nome),
                       "TACO 4ª ed.", "OK", cats[f["categoryId"]]])
    linhas.sort(key=lambda x: x[0])
    corpo = ",\n".join(json.dumps(l, ensure_ascii=False) for l in linhas)
    with open("taco.js", "w", encoding="utf-8", newline="\n") as out:
        out.write(
            "/* FORTIS PWA — TACO 4ª edição (NEPA/UNICAMP, 2011). Valores por 100 g da parte comestível.\n"
            "   GERADO por gerar_taco.py — não edite à mão.\n"
            "   nome, kcal, prot, carb, gord, fibra, estado, fonte, verif, categoria\n"
            "   Campos sem valor na tabela (traço/não analisado) entram como 0. */\n"
            "window.FORTIS = window.FORTIS || {};\n"
            f"FORTIS.TACO = [\n{corpo}\n];\n")
    print(f"{len(linhas)} alimentos gravados em taco.js; sem kcal (ignorados): {pulados}")


if __name__ == "__main__":
    main()
