# mosaik.

Ein lesbares Textformat für winzige Bilder mit Palette, Raster und einfachen Formen, das man in Chats, Notizen und Mails einfügt und das jeder Viewer pixelgleich zeigt.

## Problem

Kleine Grafiken wie Icons, Pixelbilder, Statusmarken oder Skizzen lassen sich nicht als Text tragen. Base64-PNG ist unlesbar und nicht diffbar. SVG ist lesbar, aber riesig in den Möglichkeiten (Skripte, externe Verweise, Schriften, Filter) und rendert je nach Programm unterschiedlich, daher heikel zum Einfügen aus fremden Quellen. Gleichzeitig schreiben Menschen und Sprachmodelle heute ständig Text, der eigentlich ein Bild meint. Es fehlt ein kleines, strenges Format: lesbar, kanonisch, diffbar, ohne aktive Inhalte, mit einer festen Rasterregel, sodass dasselbe Textstück überall genau dieselben Pixel ergibt.

## Zielgruppe

- Leute, die kleine Grafiken in Notizen, Wikis, Issues oder Git versionieren wollen und Diffs lesen möchten.
- Entwickler, die Icons oder Spielsprites als Text im Code halten.
- Sprachmodelle und ihre Nutzer: ein Modell kann ein `mosaik`-Block direkt schreiben, der Mensch schaut ihn im Viewer an.
- Alle, die ein Bild durch einen reinen Textkanal schicken müssen.

## Vorbild und Abgrenzung

- **XPM (1989):** Textraster mit Zeichenpalette, aber als C-Quelltext verpackt, an X11 gebunden, ohne Formen, ohne kanonische Form.
- **Plain PBM/PPM:** Text, aber Zahlenkolonnen ohne Palette, für Menschen kaum lesbar.
- **SVG:** lesbarer Vektortext, aber zu mächtig und zu offen, Ausgabe hängt vom Renderer ab (Antialiasing).
- **typixel, textmosaic und ähnliche:** Pixelkunst aus Text in einzelnen Umgebungen, ohne eigenständige Spezifikation und Testvektoren.

mosaik. macht anders: ein einziges kleines Format mit Palette, Raster und zwei Formen (Rechteck, Linie), feste Grenzen, eine exakte ganzzahlige Rasterregel ohne Antialiasing, eine kanonische Schreibweise für saubere Diffs, keine Skripte, keine Verweise, nur ASCII. Ehrlich: Ein Chat zeigt den Block nur als Text, das Bild entsteht erst im Viewer. Neu ist die Kombination, nicht jede Einzelidee.

## Funktionen v1

- `SPEC.md` für `mosaik 1` mit Grammatik, Grenzen, Rasterregel, Fehlercodes.
- Referenzimplementierung `mosaik.js` (ES-Modul, ohne Abhängigkeiten, läuft im Browser und in Node):
  - `parse(text)` liefert Bildobjekt oder Fehler mit Code und Zeile
  - `extract(text)` findet den ersten mosaik-Block in beliebigem Text (auch in Codezäunen)
  - `render(img)` liefert RGBA-Pixel (`Uint8ClampedArray`, Breite mal Höhe mal 4)
  - `canonical(img)` liefert die kanonische Textform
  - `flatten(img)` liefert die kanonische Form nur mit `rows` (Formen aufgelöst)
  - `toSVG(img, scale)` liefert sicheres, selbst erzeugtes SVG aus Rechtecken
- Testvektoren in `vectors/` (Eingabe `.mosaik`, erwartete Ausgabe `.json`).
- Demoseite mit Editor, Live-Vorschau, Beispielen, Export als PNG, SVG und Text.

## Nicht-Ziele

- Keine Fotos, keine Verläufe, kein Alpha außer voll transparent.
- Keine Kreise, Kurven, Text, Füllwerkzeug, Ebenen, Animation in v1.
- Keine Kompression, kein Base64, keine Binärform.
- Kein Bildimport aus PNG mit Farbreduktion (Kandidat für später).
- Kein Plugin für Chat-Programme.

## Daten und Format

Kodierung: nur druckbares ASCII plus Zeilenende `LF` (beim Lesen wird `CRLF` akzeptiert). Zeilen, die mit `;` beginnen, sind Kommentare. Leerzeilen innerhalb des Blocks beenden ihn. Leerzeichen am Zeilenende werden ignoriert.

```
mosaik 1 <breite> <hoehe>
<schluessel> <rrggbb>          Palette, beliebig viele Zeilen
rect <x> <y> <b> <h> <schluessel>
line <x0> <y0> <x1> <y1> <schluessel>
rows                           danach genau <hoehe> Zeilen mit je <breite> Zeichen
```

- Kopfzeile genau `mosaik 1`, dann Breite und Höhe, je 1 bis 64. Die `1` ist die Formatversion; ein Parser lehnt unbekannte Versionen mit `E_VERSION` ab.
- Palette: Schlüssel ist ein Zeichen aus `a-z A-Z 0-9`, Farbe sechs Hexziffern ohne `#`, Groß und Klein egal. Höchstens 62 Farben. `.` ist reserviert und heißt "nichts malen".
- Paletteneinträge müssen vor ihrer ersten Nutzung stehen. Doppelte Schlüssel sind ein Fehler.
- Befehle `rect`, `line`, `rows` werden in Reihenfolge ausgeführt, spätere übermalen frühere. `rows` darf höchstens einmal vorkommen.
- Zahlen: ganze Dezimalzahlen 0 bis 255 ohne Vorzeichen und führende Nullen. Was außerhalb der Fläche liegt, wird abgeschnitten, ist aber kein Fehler.
- Grenzen: höchstens 256 Befehle, höchstens 8192 Bytes je Block.
- Kanonische Form: Kopfzeile, Palette in Definitionsreihenfolge, Hex klein, Befehle in Originalreihenfolge, genau ein Leerzeichen zwischen Feldern, keine Kommentare, `LF`, abschließender Zeilenumbruch.
- Fehlercodes (Auswahl): `E_HEADER`, `E_VERSION`, `E_SIZE`, `E_COLOR`, `E_DUP_KEY`, `E_UNKNOWN_KEY`, `E_NUMBER`, `E_ROWS`, `E_LIMIT`, `E_CHAR`. Jeder Fehler nennt die Zeile (1-basiert, gezählt ab Kopfzeile).

## Rechenlogik

Startfläche: alle Pixel transparent `[0,0,0,0]`. Gemalte Pixel bekommen die Palettenfarbe mit Alpha 255.

- `rect x y b h k`: alle Pixel mit `x <= px < x+b` und `y <= py < y+h`, abgeschnitten an der Fläche.
- `line x0 y0 x1 y1 k`: Bresenham für alle Richtungen, genau so:
  `dx=|x1-x0|, sx=sign, dy=-|y1-y0|, sy=sign, err=dx+dy`; Schleife: Pixel setzen; wenn Endpunkt, fertig; `e2=2*err`; wenn `e2>=dy`: `err+=dy, x+=sx`; wenn `e2<=dx`: `err+=dx, y+=sy`.
- `rows`: Zeichen `.` lässt das Pixel unverändert, jedes andere Zeichen setzt die Farbe des Schlüssels.

Testvektoren (Koordinaten als `(x,y)`, Ursprung oben links):

1. Raster:
   ```
   mosaik 1 3 2
   a ff0000
   b 0000ff
   rows
   ab.
   .ba
   ```
   ergibt Zeile 0: rot, blau, transparent; Zeile 1: transparent, blau, rot. RGBA: `255,0,0,255, 0,0,255,255, 0,0,0,0, 0,0,0,0, 0,0,255,255, 255,0,0,255`.

2. Linie und Rechteck:
   ```
   mosaik 1 4 3
   a 9b8afb
   b 0d0d10
   rect 0 0 4 3 b
   line 0 2 3 0 a
   ```
   Linie trifft `(0,2) (1,1) (2,1) (3,0)`. `flatten` ergibt die Zeilen `bbba`, `baab`, `abbb` mit derselben Palette.

3. Kanonisch: Eingabe `mosaik 1  3 2` CRLF `; logo` CRLF `a FF0000` CRLF `b 0000Ff` CRLF `rows` CRLF `ab.` CRLF `.ba` ergibt genau `mosaik 1 3 2\na ff0000\nb 0000ff\nrows\nab.\n.ba\n`.

4. Fehler: `mosaik 1 3 2`, `a ff0000`, `rows`, `ax.`, `...` ergibt `E_UNKNOWN_KEY` in Zeile 4.

## Demoseite

`index.html`, ohne Server lauffähig, Handy zuerst, als PWA installierbar.

- **Editor:** Textfeld mit dem mosaik-Block, darunter die Vorschau (Canvas, ganzzahlig skaliert, `image-rendering: pixelated`, Schachbrett für Transparenz). Fehler erscheinen mit Code und Zeile in `--mono`. Größe, Farbanzahl und Bytes als kleine Statuszeile.
- **Einfügen:** ganzen Chat- oder Mailtext einfügen, `extract` findet den Block.
- **Beispiele:** drei bis vier erfundene Bilder (Herz, Pfeil, Haus, Icon im Hausstil), als `Beispiel` markiert, mit einem Klick entfernbar.
- **Export:** kanonischen Text kopieren, `flatten` kopieren, PNG und SVG herunterladen, alles lokal.
- Kurzreferenz der Syntax zum Aufklappen. Hell und dunkel, Hausstil.

## Testplan

- `node --test`: alle Vektoren in `vectors/` gegen `parse`, `render`, `canonical`, `flatten`, Fehlercodes und Zeilen.
- Eigenschaften: `canonical(parse(canonical(x)))` gleich `canonical(x)`; `render(flatten(x))` gleich `render(x)`; Linie mit `x0=x1` oder `y0=y1` trifft genau die erwarteten Pixel; vertauschte Endpunkte als eigener Testfall dokumentiert.
- Grenzen: 64 mal 64 geht, 65 nicht; 257 Befehle ergeben `E_LIMIT`; Nicht-ASCII ergibt `E_CHAR`.
- `toSVG` enthält nur `svg` und `rect`, keine Skripte, keine Verweise.
- Browsertest bei 390 und 1280 px, hell und dunkel, Vorschau entspricht den RGBA-Werten.
- Offline-Test nach erstem Laden über den Service Worker.
- Netzwerkprotokoll der Demoseite: null externe Requests.

## Risiken

- Bresenham hat bei vertauschten Endpunkten manchmal andere Pixel. Darum legt die Spezifikation den Algorithmus wörtlich fest, nicht nur "eine Linie".
- Chats ersetzen Zeichen oder Leerzeichen (Proportionalschrift, Zeilenumbruch, typografische Ersetzung). Gegenmaßnahme: Codezaun empfehlen, Toleranz bei Leerzeichen am Zeilenende.
- Sprachmodelle verzählen sich bei Zeilenbreiten. Der Parser meldet `E_ROWS` mit Zeile statt still zu raten.
- Abgrenzung zu XPM wirkt für manche klein. Die SPEC muss den Unterschied (Formen, Kanon, Grenzen, keine Hülle) knapp begründen.

## Offene Fragen

- Ob Formen wirklich Text sparen oder ob reines Raster reicht, ist Vermutung. Zu prüfen an den Beispielen.
- Ob ein Codezaun mit Sprachkennung `mosaik` in Chats und Foren brauchbar erkannt wird, ist offen.
- Ob 64 mal 64 und 62 Farben die richtigen Grenzen sind.
- Ob halbtransparente Farben (`rrggbbaa`) in einer Version 2 nötig werden.
