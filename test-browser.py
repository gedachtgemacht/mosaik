"""Browsertest: Vorschau der Demoseite gegen die RGBA-Werte der Testvektoren.

Braucht Python mit Playwright und Chromium. Aufruf: python3 test-browser.py
Laedt index.html ohne Server, setzt jeden Vektor mit rgba in den Editor und
vergleicht die Mitte jedes vergroesserten Pixels im Canvas mit den Erwartungen.
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

HIER = pathlib.Path(__file__).resolve().parent
SEITE = (HIER / "index.html").as_uri()

PRUEFEN = """
([text, rgba]) => {
  const src = document.getElementById('src');
  src.value = text;
  src.dispatchEvent(new Event('input'));
  const r = parse(text);
  const w = r.image.width, h = r.image.height;
  const cv = document.getElementById('view');
  const s = cv.width / w;
  const ctx = cv.getContext('2d');
  const all = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const fehler = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = Math.floor(x * s + s / 2), cy = Math.floor(y * s + s / 2);
    const o = (cy * cv.width + cx) * 4, k = (y * w + x) * 4;
    for (let c = 0; c < 4; c++) if (all[o + c] !== rgba[k + c]) fehler.push([x, y, c, all[o + c], rgba[k + c]]);
  }
  return { s, fehler: fehler.slice(0, 5), ganzzahlig: Number.isInteger(s) };
}
"""


def main():
    vektoren = json.loads((HIER / "testvektoren.json").read_text())["vektoren"]
    mit_rgba = [v for v in vektoren if v.get("rgba")]
    schlecht = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        for schema in ("dark", "light"):
            for breite in (390, 1280):
                page = b.new_page(viewport={"width": breite, "height": 900}, color_scheme=schema)
                page.goto(SEITE)
                for v in mit_rgba:
                    r = page.evaluate(PRUEFEN, [v["input"], v["rgba"]])
                    gut = not r["fehler"] and r["ganzzahlig"]
                    schlecht += 0 if gut else 1
                    print(("ok    " if gut else "FEHLER"), schema, breite, v["name"], "massstab", r["s"], r["fehler"])
                page.close()

        # Einfuegen aus Chattext und Beispiele mit einem Klick entfernen
        page = b.new_page(viewport={"width": 390, "height": 900})
        page.goto(SEITE)
        page.click("#pastebox summary")
        page.fill("#paste", "Hallo,\n\n```mosaik\nmosaik 1 2 1\na ff0000\nrows\na.\n```\nGruss\n")
        page.click("#find")
        gefunden = page.input_value("#src") == "mosaik 1 2 1\na ff0000\nrows\na.\n"
        page.click("#exDel")
        weg = page.is_hidden("#exCard") and page.is_visible("#exBack")
        for name, gut in (("extract im browser", gefunden), ("beispiele entfernen", weg)):
            schlecht += 0 if gut else 1
            print(("ok    " if gut else "FEHLER"), name)
        b.close()
    sys.exit(1 if schlecht else 0)


if __name__ == "__main__":
    main()
