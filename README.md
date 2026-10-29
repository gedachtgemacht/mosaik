# mosaik.

**Ein Bild, das als Text durch jeden Kanal passt.** mosaik. ist ein kleines, strenges Textformat für winzige Bilder, das überall dieselben Pixel ergibt.

Icons, Pixelbilder und Statusmarken lassen sich schlecht als Text tragen. Base64-PNG ist unlesbar und nicht diffbar. SVG ist lesbar, kann aber Skripte und Verweise enthalten und sieht je nach Programm anders aus. mosaik. hat eine Palette, ein Raster und zwei Formen (Rechteck, Linie), feste Grenzen und eine wörtlich festgelegte Rasterregel. Das Format ist eine Spezifikation mit Referenzimplementierung, Testvektoren und Demoseite. Es gehört zur Art `neuland`.

```
mosaik 1 3 2
a ff0000
b 0000ff
rows
ab.
.ba
```

Reiner Text, keine KI, kein Server. Alles bleibt auf deinem Gerät.

<p align="center">
  <img src="bilder/1-uebersicht.png" width="240" alt="">
</p>
<p align="center">
  <img src="bilder/2-breit.png" width="640" alt="">
</p>

## Warum

Menschen und Sprachmodelle schreiben ständig Text, der eigentlich ein Bild meint. Es fehlt ein Format, das lesbar ist, sich in Git sauber vergleichen lässt, keine aktiven Inhalte kennt und in jedem Viewer pixelgleich aussieht. Verwandte Ansätze gibt es: XPM ist an C-Quelltext und X11 gebunden, Plain PBM/PPM sind Zahlenkolonnen ohne Palette. Neu ist die Kombination, nicht jede Einzelidee.

## Funktionen

- **Spezifikation** `SPEC.md` für `mosaik 1`: Grammatik, Grenzen, Rasterregel, Fehlercodes mit Zeilennummer
- **Referenzimplementierung** `mosaik.js`, ein ES-Modul ohne Abhängigkeiten für Browser und Node: `parse`, `extract`, `render`, `canonical`, `flatten`, `toSVG`
- **Testvektoren** in `vectors/` und gesammelt in `testvektoren.json`, von Hand gerechnet
- **Demoseite** mit Editor, Live-Vorschau, Fehleranzeige mit Code und Zeile, Beispielen und Kurzreferenz
- **Einfügen** ganzer Chat- oder Mailtexte: `extract` findet den ersten Block, auch in Codezäunen und Zitaten
- **Kanonische Form** für saubere Diffs und **flache Form**, die Formen in ein Raster auflöst
- **Export** als Text, als Raster, als PNG und als SVG, alles lokal
- **Beispiele** (herz, pfeil, haus, icon), als `Beispiel` markiert und mit einem Klick entfernbar
- Hell und dunkel, funktioniert offline, installierbar als App

## Datenschutz

Nichts verlässt dein Gerät. Die Demoseite hat keinen Server, kein Konto, keine Analyse, keine Werbung und lädt nichts aus dem Netz nach, auch keine Schriften. Was du in den Editor schreibst, bleibt im Browser. Exporte entstehen nur, wenn du sie auslöst.

## Installation

Die Demoseite ist eine statische Web-App. Es gibt keinen Build-Schritt und keine Abhängigkeiten.

1. Den Ordner auf einen beliebigen statischen Host legen. Für die Installation als App ist HTTPS nötig.
2. Die Adresse im Browser öffnen.
3. Im Browsermenü **Zum Startbildschirm hinzufügen** wählen. Danach startet mosaik. wie eine App und funktioniert auch ohne Netz.

Lokal testen:

```
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen. `index.html` enthält eine eingebettete Kopie von `mosaik.js` und läuft auch direkt aus der Datei. Nach Änderungen an `mosaik.js` kopiert `node einbetten.js` sie wieder hinein.

Als Bibliothek:

```js
import { extract, parse, render, toSVG } from './mosaik.js';

const text = extract(chatText);   // erster Block oder null
const bild = parse(text);          // Bild oder Fehler mit Code und Zeile
```

Die genauen Rückgabeformen stehen in `SPEC.md` und `mosaik.js`.

## Wie es funktioniert

Die vollständige Beschreibung steht in [`SPEC.md`](SPEC.md). Kurz:

- Ein Block besteht aus Kopfzeile `mosaik 1 <breite> <hoehe>`, Palette (bis 62 deckende Farben als `rrggbb`), Befehlen `rect`, `line` und `rows` sowie Kommentaren. Spätere Befehle übermalen frühere.
- Größe 1 bis 64 mal 1 bis 64, höchstens 256 Befehle, höchstens 8192 Bytes, nur druckbares ASCII.
- Linien nutzen Bresenham mit ganzen Zahlen, wörtlich in der Spezifikation. Vertauschte Endpunkte können andere Pixel ergeben, deshalb darf eine Implementierung sie nicht normalisieren.
- Kein Antialiasing, kein Alpha außer voll transparent.
- Der Parser bricht beim ersten Fehler ab und nennt Code und Zeile, etwa `E_UNKNOWN_KEY` in Zeile 4.

Getestet mit `node test-calc.js` (Vektoren, Eigenschaften wie idempotente kanonische Form, Grenzen, Fehlerfälle, SVG ohne Skripte und Verweise) und mit `test-browser.py` für die Demoseite.

**Bekannt:** die Rasterregel, die Fehlercodes und die kanonische Form sind festgelegt und durch Vektoren abgedeckt.

**Vermutung, noch offen:**

- Ob Formen wirklich Text sparen. Beim Icon der Demoseite ja (165 gegen 278 Bytes), beim Herz nicht.
- Ob ein Codezaun mit Sprachkennung `mosaik` in Chats und Foren brauchbar erkannt wird. Ein Chat zeigt den Block ohnehin nur als Text, das Bild entsteht erst im Viewer.
- Ob 64 mal 64 und 62 Farben die richtigen Grenzen sind.
- Ob halbtransparente Farben in einer Version 2 nötig werden.

## Lizenz

GNU Affero General Public License v3.0 (AGPL-3.0), siehe `LICENSE`.

---

**gedacht.gemacht.** Kleine, ehrliche Software. Alles bleibt auf deinem Gerät.
