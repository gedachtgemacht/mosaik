# mosaik 1: Spezifikation

Status: Version 1, stabil für die hier beschriebenen Regeln. Referenzimplementierung: `mosaik.js`. Testvektoren: `vectors/` und gesammelt in `testvektoren.json`.

Die Schlüsselwörter MUSS, DARF und SOLL sind wie üblich zu lesen: MUSS ist Pflicht, SOLL ist dringend empfohlen, DARF ist erlaubt.

## 1. Zweck

`mosaik` ist ein Textformat für winzige Bilder (höchstens 64 mal 64 Pixel) aus einer Palette, einem Raster und zwei Formen (Rechteck, Linie). Dasselbe Textstück MUSS in jedem konformen Viewer exakt dieselben Pixel ergeben. Das Format enthält keine aktiven Inhalte, keine Verweise, keine Schriften und kein Antialiasing.

### Abgrenzung

- **XPM** hat ein Textraster mit Zeichenpalette, ist aber C-Quelltext, an X11 gebunden, hat keine Formen und keine kanonische Form.
- **Plain PBM/PPM** sind Zahlenkolonnen ohne Palette und für Menschen kaum lesbar.
- **SVG** ist zu mächtig (Skripte, Verweise, Filter, Schriften) und das Ergebnis hängt vom Renderer ab.

mosaik hat dagegen: zwei Formen mit wörtlich festgelegter Rasterregel, eine kanonische Schreibweise für saubere Diffs, harte Grenzen, keine Hülle drumherum, nur ASCII. Neu ist die Kombination, nicht jede Einzelidee.

## 2. Kodierung

- Ein Block ist Text aus druckbarem ASCII (`0x20` bis `0x7E`) und Zeilenenden.
- Zeilenende ist `LF` (`0x0A`). Beim Lesen MUSS `CRLF` akzeptiert werden: ein `CR` direkt vor `LF` (oder ganz am Textende) wird entfernt. Jedes andere Zeichen außerhalb von `0x20` bis `0x7E` (auch Tabulator, einzelnes `CR`, Umlaute, BOM) ergibt `E_CHAR`.
- Leerzeichen am Zeilenende werden ignoriert, auch in Rasterzeilen.
- Ein Zeilenumbruch am Ende des Blocks ist erlaubt, aber nicht nötig.

## 3. Aufbau eines Blocks

```
mosaik 1 <breite> <hoehe>
<schluessel> <rrggbb>
rect <x> <y> <b> <h> <schluessel>
line <x0> <y0> <x1> <y1> <schluessel>
rows
<hoehe> Zeilen mit je <breite> Zeichen
; Kommentar
```

### 3.1 Blockgrenzen und Zeilenzählung

- Leerzeilen (nur Leerzeichen oder gar nichts) vor der Kopfzeile werden übersprungen.
- Die Kopfzeile ist **Zeile 1**. Alle Zeilennummern in Fehlern zählen ab hier, 1-basiert.
- Die erste Leerzeile nach der Kopfzeile beendet den Block.
- Steht nach dieser Leerzeile noch etwas anderes als Leerzeilen, ist das `E_TRAILING` (Zeile des ersten solchen Inhalts). Das verhindert, dass ein versehentlicher Absatz den Rest eines Bildes still verschluckt. Wer einen Block aus längerem Text holen will, nimmt `extract` (Abschnitt 8).

### 3.2 Felder

Felder sind durch ein oder mehrere Leerzeichen getrennt. Eine Zeile, die mit einem Leerzeichen beginnt, ist `E_SYNTAX` (außer in Rasterzeilen, wo sie an der Breite oder am Schlüssel scheitert).

### 3.3 Zahlen

Ganze Dezimalzahl `0` bis `255`, ohne Vorzeichen, ohne führende Nullen (`0` ist erlaubt, `00` und `07` nicht). Alles andere ergibt `E_NUMBER`.

### 3.4 Kopfzeile

Genau vier Felder: `mosaik`, Version, Breite, Höhe.

Die Prüfung läuft genau in dieser Reihenfolge, der erste Treffer zählt:

| Schritt | Fall | Fehler |
|---|---|---|
| 1 | erstes Feld nicht `mosaik` oder weniger als zwei Felder | `E_HEADER` |
| 2 | Version ist nicht `1` und keine Ziffernfolge | `E_HEADER` |
| 3 | Version ist eine Ziffernfolge, aber nicht `1` | `E_VERSION` |
| 4 | Feldanzahl nicht 4 | `E_HEADER` |
| 5 | Breite oder Höhe keine gültige Zahl | `E_NUMBER` |
| 6 | Breite oder Höhe außerhalb 1 bis 64 | `E_SIZE` |

Die Version wird also vor der Feldanzahl geprüft: `mosaik 2` und `mosaik 2 3 3 x` ergeben `E_VERSION`, weil eine künftige Version eine andere Kopfzeile haben darf (Abschnitt 10). `mosaik 1 3` ergibt `E_HEADER`. Ein leerer Text ergibt `E_HEADER` in Zeile 1.

### 3.5 Palette

`<schluessel> <rrggbb>`: genau zwei Felder, das erste genau ein Zeichen.

- Schlüssel: ein Zeichen aus `a-z`, `A-Z`, `0-9`. Andere Einzelzeichen (zum Beispiel `.` oder `#`) ergeben `E_SYNTAX`. `.` ist reserviert und heißt "nichts malen".
- Farbe: genau sechs Hexziffern, Groß und Klein egal, ohne `#`. Sonst `E_COLOR`.
- Ein Schlüssel darf nur einmal definiert werden, sonst `E_DUP_KEY`.
- Höchstens 62 Farben (`E_LIMIT`). Mit 62 möglichen Schlüsseln ist diese Grenze nur über `E_DUP_KEY` erreichbar, sie steht der Klarheit halber trotzdem hier.
- Paletteneinträge DÜRFEN zwischen Befehlen stehen, MÜSSEN aber vor ihrer ersten Nutzung stehen. Nutzung vor der Definition ergibt `E_UNKNOWN_KEY`.
- Farben sind deckend (Alpha 255). Halbtransparenz gibt es nicht.

### 3.6 Befehle

Befehle sind `rect`, `line` und `rows`. Sie werden in Textreihenfolge ausgeführt, spätere übermalen frühere. Höchstens 256 Befehle je Block, der 257. ergibt `E_LIMIT` in seiner Zeile. Paletteneinträge und Kommentare zählen nicht als Befehle.

- `rect x y b h k`: sechs Felder, sonst `E_SYNTAX`.
- `line x0 y0 x1 y1 k`: sechs Felder, sonst `E_SYNTAX`.
- `k` MUSS ein definierter Schlüssel sein, sonst `E_UNKNOWN_KEY`.
- `rows`: steht allein in der Zeile (sonst `E_SYNTAX`) und darf höchstens einmal vorkommen (sonst `E_ROWS`). Danach folgen genau `<hoehe>` Rasterzeilen.
- Unbekannte Wörter ergeben `E_SYNTAX`.

Reihenfolge der Prüfung in einer Befehlszeile: Befehlszähler (`E_LIMIT`), Feldanzahl (`E_SYNTAX`), Zahlen von links nach rechts (`E_NUMBER`), Schlüssel (`E_UNKNOWN_KEY`).

### 3.7 Rasterzeilen

- Jede Rasterzeile hat nach dem Entfernen der Leerzeichen am Ende genau `<breite>` Zeichen, sonst `E_ROWS`.
- Jedes Zeichen ist `.` oder ein definierter Schlüssel, sonst `E_UNKNOWN_KEY`.
- Kommentarzeilen zwischen Rasterzeilen sind erlaubt und zählen nicht als Rasterzeile.
- Endet der Block (Leerzeile oder Textende), bevor alle Rasterzeilen da sind, ist das `E_ROWS` in der Zeile, an der der Block endet (also eine Zeile nach der letzten Blockzeile).

### 3.8 Kommentare

Eine Zeile, die mit `;` beginnt, ist ein Kommentar und wird ignoriert. Die Kopfzeile kann kein Kommentar sein. Kommentare zählen beim Bytelimit mit, nicht beim Befehlslimit, und fallen in der kanonischen Form weg.

### 3.9 Grenzen

| Grenze | Wert | Fehler |
|---|---|---|
| Breite, Höhe | 1 bis 64 | `E_SIZE` |
| Farben | 62 | `E_LIMIT` |
| Befehle | 256 | `E_LIMIT` |
| Bytes je Block | 8192 | `E_LIMIT` |

Bytes werden so gezählt: für jede Blockzeile (ab Kopfzeile, ohne `CR`, mit Leerzeichen am Ende) ihre Länge plus 1 für das Zeilenende. Die Leerzeile, die den Block beendet, und das leere Stück nach dem letzten `LF` zählen nicht mit. Ein Block mit genau 8192 Bytes einschließlich `LF` am Ende ist also gültig (Vektor `17-genau-8192-bytes`). Der Fehler steht in der Zeile, mit der die Summe 8192 überschreitet.

## 4. Fehler

Ein Parser MUSS beim ersten Fehler abbrechen und Code und Zeile melden. Zeilen werden von oben nach unten geprüft, innerhalb einer Zeile zuerst die Zeichen (`E_CHAR`), dann das Bytelimit, dann der Inhalt.

| Code | Bedeutung |
|---|---|
| `E_HEADER` | Kopfzeile fehlt oder ist falsch gebaut |
| `E_VERSION` | Formatversion ist nicht `1` |
| `E_SIZE` | Breite oder Höhe außerhalb 1 bis 64 |
| `E_COLOR` | Farbe ist nicht sechsstellig hex |
| `E_DUP_KEY` | Schlüssel doppelt definiert |
| `E_UNKNOWN_KEY` | Schlüssel genutzt, aber (noch) nicht definiert |
| `E_NUMBER` | Zahl nicht im Format 0 bis 255 |
| `E_ROWS` | Rasterzeile falsch lang, Rasterzeilen fehlen oder `rows` doppelt |
| `E_LIMIT` | Grenze aus 3.9 überschritten |
| `E_CHAR` | Zeichen außerhalb des druckbaren ASCII |
| `E_SYNTAX` | Zeile nicht verstanden |
| `E_TRAILING` | Inhalt nach der Leerzeile, die den Block beendet |

Die Fehlertexte der Referenzimplementierung sind nicht normativ, Code und Zeile schon.

## 5. Rasterregel

Koordinaten sind `(x, y)`, Ursprung oben links, `x` nach rechts, `y` nach unten.

Startfläche: alle Pixel transparent `[0,0,0,0]`. Ein gemaltes Pixel bekommt die Palettenfarbe `[r,g,b,255]`. Was außerhalb der Fläche liegt, wird pixelweise verworfen, das ist kein Fehler.

### 5.1 rect

`rect x y b h k` malt alle Pixel mit `x <= px < x+b` und `y <= py < y+h`, abgeschnitten an der Fläche. `b = 0` oder `h = 0` malt nichts.

### 5.2 line

Bresenham, wörtlich so:

```
dx  = |x1 - x0|        sx = (x0 < x1) ? 1 : -1
dy  = -|y1 - y0|       sy = (y0 < y1) ? 1 : -1
err = dx + dy
x = x0, y = y0
Schleife:
  Pixel (x, y) setzen
  wenn x == x1 und y == y1: fertig
  e2 = 2 * err
  wenn e2 >= dy: err += dy, x += sx
  wenn e2 <= dx: err += dx, y += sy
```

Beide Bedingungen werden mit demselben `e2` geprüft. Es wird mit ganzen Zahlen gerechnet.

**Vertauschte Endpunkte** können andere Pixel ergeben. Beispiel (Vektoren 07 und 08): `line 0 0 4 1` trifft `(0,0) (1,0) (2,1) (3,1) (4,1)`, `line 4 1 0 0` trifft `(4,1) (3,1) (2,0) (1,0) (0,0)`. Darum legt die Spezifikation den Algorithmus fest und nicht nur "eine Linie". Eine Implementierung DARF Endpunkte nicht tauschen oder normalisieren.

### 5.3 rows

Jedes Zeichen der Rasterzeile `y` an Stelle `x` (ab 0): `.` lässt das Pixel unverändert, jeder Schlüssel setzt dessen Farbe. Damit kann `rows` über Formen liegen, ohne sie zu löschen.

## 6. Kanonische Form

Die kanonische Form eines gültigen Blocks ist:

1. Kopfzeile `mosaik 1 <breite> <hoehe>`.
2. Alle Paletteneinträge in Definitionsreihenfolge, Hex klein.
3. Alle Befehle in Originalreihenfolge, `rows` gefolgt von den Rasterzeilen.
4. Genau ein Leerzeichen zwischen Feldern, keine Leerzeichen am Zeilenende, keine Kommentare, keine Leerzeilen.
5. `LF` als Zeilenende, abschließender Zeilenumbruch.

Paletteneinträge wandern also vor alle Befehle. Das ist immer gültig, weil jeder Eintrag vorher schon vor seiner ersten Nutzung stand. Es gilt `canonical(parse(canonical(x))) == canonical(x)`.

Zwei Blöcke mit gleicher kanonischer Form sind gleich. Zwei Blöcke mit gleichen Pixeln können verschiedene kanonische Formen haben (zum Beispiel Rechteck gegen Raster). Für einen Pixelvergleich als Text gibt es `flatten`.

## 7. Flache Form

`flatten` liefert die kanonische Form mit derselben Palette (alle Einträge, auch unbenutzte, gleiche Reihenfolge) und genau einem Befehl `rows`, der das gerenderte Ergebnis wiedergibt. Für jedes Pixel steht der Schlüssel, der es zuletzt gemalt hat, oder `.`. Es gilt `render(flatten(x)) == render(x)`.

Haben zwei Schlüssel dieselbe Farbe, bleibt der zuletzt malende Schlüssel stehen.

## 8. Einbetten in Text

Ein Block SOLL in einem Codezaun stehen, damit Chats und Mailprogramme die Zeilen nicht umbrechen oder typografisch ersetzen:

````
```mosaik
mosaik 1 3 2
a ff0000
b 0000ff
rows
ab.
.ba
```
````

`extract(text)` findet den ersten Block in beliebigem Text:

- `CRLF` und einzelnes `CR` werden zu `LF`, geschützte Leerzeichen (`U+00A0`) zu Leerzeichen.
- Gesucht wird die erste Zeile, die nach einem Präfix aus Leerzeichen und `>` mit `mosaik`, mindestens einem Leerzeichen und einer Ziffer beginnt.
- Das Präfix dieser Zeile (Einrückung, Mailzitat `> `) wird von den folgenden Zeilen abgezogen. Eine Zeile ohne dieses Präfix, eine Leerzeile oder ein Codezaun (```` ``` ```` oder `~~~`) beendet den Block.
- Ergebnis: die Blockzeilen ohne Leerzeichen am Ende, mit `LF` verbunden, mit abschließendem `LF`. Ohne Fund: nichts (`null`).

`extract` prüft nichts. Das Ergebnis geht danach in `parse`.

## 9. Ausgabe als SVG

`toSVG(img, scale)` erzeugt SVG ausschließlich aus einem `svg`-Element mit `xmlns`, `width`, `height`, `viewBox` und `shape-rendering="crispEdges"` sowie `rect`-Elementen mit `x`, `y`, `width`, `height`, `fill="#rrggbb"`. Waagerecht gleiche Nachbarpixel werden zu einem Rechteck zusammengefasst, transparente Pixel erzeugen nichts. Keine Skripte, keine Verweise, keine Stile. `scale` ist eine ganze Zahl 1 bis 64 und setzt nur `width` und `height`.

## 10. Versionierung

- Die Zahl nach `mosaik` ist die Formatversion. Diese Spezifikation beschreibt `1`.
- Ein Parser für Version 1 MUSS jede andere Version mit `E_VERSION` ablehnen und DARF nicht raten.
- Eine spätere Version darf Neues hinzufügen (etwa `rrggbbaa`), aber einen gültigen `mosaik 1`-Block nicht anders darstellen.

## 11. Testvektoren

`vectors/<name>.mosaik` ist die Eingabe (Bytes wie gespeichert, `CRLF` bleibt erhalten), `vectors/<name>.json` die Erwartung:

- gültig: `{"ok": true, "canonical": "...", "flatten": "...", "width"?, "height"?, "rgba"?: [...]}`
- Fehler: `{"ok": false, "error": {"code": "E_...", "line": n}}`
- extract: `{"extract": "..."}` oder `{"extract": null}`

`testvektoren.json` enthält dieselben Vektoren in einer Datei mit dem Feld `input`. Die Erwartungen sind von Hand gerechnet und stehen als Daten in `vectors/erzeugen.js`.

Die vier Vektoren aus dem Entwurf:

1. `01-raster`: `mosaik 1 3 2`, `a ff0000`, `b 0000ff`, `rows`, `ab.`, `.ba` ergibt RGBA `255,0,0,255, 0,0,255,255, 0,0,0,0, 0,0,0,0, 0,0,255,255, 255,0,0,255`.
2. `02-linie-rechteck`: `rect 0 0 4 3 b`, `line 0 2 3 0 a` auf 4 mal 3, Linie trifft `(0,2) (1,1) (2,1) (3,0)`, flach `bbba`, `baab`, `abbb`.
3. `03-kanonisch`: `mosaik 1  3 2` mit `CRLF`, Kommentar und großem Hex ergibt `mosaik 1 3 2\na ff0000\nb 0000ff\nrows\nab.\n.ba\n`.
4. `04-fehler-unbekannter-schluessel`: `ax.` in Zeile 4 ergibt `E_UNKNOWN_KEY` in Zeile 4.

Handrechnung für die Linie in Vektor 2 (`0 2 3 0`): `dx=3, sx=1, dy=-2, sy=-1, err=1`. Pixel `(0,2)`, `e2=2`: `err=-1, x=1`, dann `err=2, y=1`. Pixel `(1,1)`, `e2=4`: `err=0, x=2`. Pixel `(2,1)`, `e2=0`: `err=-2, x=3`, dann `err=1, y=0`. Pixel `(3,0)`, Ende.

## 12. Bewusst offen

- Ob Formen wirklich Text sparen, ist Vermutung. Bei den Beispielen der Demoseite sparen sie deutlich (das Icon braucht 165 Bytes mit Formen, 278 als Raster), das Herz ist reines Raster und spart nichts. Die Statuszeile zeigt beide Größen.
- Ob ein Codezaun mit Sprachkennung `mosaik` in Chats und Foren brauchbar erkannt wird, ist offen.
- Ob 64 mal 64 und 62 Farben die richtigen Grenzen sind, ist offen.
- Halbtransparente Farben (`rrggbbaa`) sind ein Kandidat für Version 2.
- Kein MIME-Typ ist registriert. Vorschlag: Dateiendung `.mosaik`, Typ `text/x-mosaik`.
- Wie ein Viewer skaliert, legt die Spezifikation nicht fest. Er SOLL ganzzahlig und ohne Glättung skalieren, damit die Pixel gleich bleiben.

## 13. Nicht-Ziele

Keine Fotos, Verläufe oder Halbtransparenz. Keine Kreise, Kurven, Text, Füllwerkzeug, Ebenen oder Animation. Keine Kompression, kein Base64, keine Binärform. Kein Import aus PNG mit Farbreduktion.
