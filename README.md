# Kita

Kleine Web-Anwendungen für die Kita unter <https://kita.schwanne.de>. Alle Bereiche teilen sich dieselben Zugänge: jede Familie hat einen persönlichen Link, das Kita-Team einen eigenen.

| Pfad | Familien | Kita-Team |
|---|---|---|
| `/` | Übersicht der Bereiche | Übersicht der Bereiche |
| `/anwesenheiten` | eintragen, wann das Kind in der Kita ist | Heatmap der Belegung, „Aussagekraft“ |
| `/verwaltung` | – | Familien anlegen/entfernen, Anzahl der Kinder festlegen, Links verteilen |

## Zugang

- Links haben die Form `https://kita.schwanne.de/#t=<token>`. Der Token steht im URL-Fragment und wird deshalb nie als Teil der Adresse an den Server übertragen.
- Nach dem ersten Aufruf merkt sich der Browser den Zugang und entfernt den Token aus der Adresszeile, damit er beim Weitergeben einer Seiten-URL nicht versehentlich mitkopiert wird. Spätere Aufrufe funktionieren ohne `#t`.
- Familien-Links erzeugt das Team unter `/verwaltung` (zufällige UUIDs). Den Team-Token legt der Betreiber als Cloudflare-Secret fest (siehe unten).

## Anwesenheiten

- Ein Raster pro Kind (bei mehreren Kindern „Kind 1“, „Kind 2“, … – ohne Namen): Montag–Freitag, 07–16 Uhr in Stundenblöcken. Pro Tag zweimal tippen (Beginn, Ende); ein dritter Klick beginnt den Tag neu, „×“ leert ihn. Jede Änderung wird sofort gespeichert.
- Ohne Eintrag für die Woche wird die Vorwoche als Vorschlag angezeigt und erst mit „Übernehmen“ oder der ersten Änderung gespeichert.
- Vorausgewählt ist die aktuelle Woche, ab Samstag die nächste. Familien können eine Woche vor und zurück blättern, das Team beliebig.
- Die Heatmap zeigt Zahlen erst beim Darüberfahren. „Aussagekraft“ = Anteil der unter `/verwaltung` angelegten Familien, die für die Woche eingetragen haben („n von m Familien“).

## Entwicklung

```sh
pnpm install
cp .dev.vars.example .dev.vars   # lokaler STAFF_TOKEN
pnpm db:migrate                  # lokale D1-Datenbank anlegen
pnpm db:seed                     # Demo-Familien und -Einträge
pnpm dev                         # http://localhost:5173/#t=familie-a bzw. #t=staff-dev
pnpm test                        # Unit-Tests und Worker-Tests (lokal, ohne Cloudflare-Konto)
pnpm build                       # Typecheck + Build von SPA und Worker
```

Lokal läuft alles ohne Cloudflare-Konto: Der Worker läuft in workerd, die D1-Datenbank ist eine SQLite-Datei unter `.wrangler/state/`.

Neuer Bereich: Eintrag in `src/tools.ts` (Route, Kachel, Navigation), Seite unter `src/<bereich>/`, API-Modul `worker/<bereich>.ts` (in `worker/index.ts` einhängen), Tabellen mit Präfix `<bereich>_` in einer neuen Migration.

## Branches und Deployment

- `develop` ist der Default-Branch. Pushes und Pull Requests werden getestet und gebaut.
- Ein Push auf `main` wird getestet, gebaut, dann werden die D1-Migrationen angewendet und der Worker auf Cloudflare veröffentlicht (`.github/workflows/ci.yml`).
- Migrationen laufen, während noch die alte Worker-Version ausliefert: nur abwärtskompatible Änderungen (neue Tabellen/Spalten), nie bestehende Migrationen ändern.
- Einmalige Einrichtung (Cloudflare-Konto, Domain, Datenbank, GitHub-Secrets, Team-Link): siehe [EINRICHTUNG.md](EINRICHTUNG.md).
