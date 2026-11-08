# Einrichtung (einmalig)

Die `wrangler`- und `gh`-Befehle in einem normalen Terminal im Projektordner ausführen (die Anmeldungen öffnen einen Browser).

## 1. Cloudflare-Konto und Domain

1. Kostenloses Konto auf <https://dash.cloudflare.com/sign-up> anlegen.
2. Im Dashboard *Domains → Onboard a domain* (bzw. *Add a site*) → `schwanne.de` eingeben → **Free**-Plan wählen.
3. Cloudflare liest vorhandene DNS-Einträge ein. Prüfen, ob alles übernommen wurde, was beim bisherigen Anbieter eingetragen ist (vor allem **MX/TXT für E-Mail**); fehlende Einträge von Hand ergänzen. Einträge, die zu anderen Diensten zeigen (z. B. GitHub Pages), auf **„DNS only“** (graue Wolke) stellen.
4. Cloudflare zeigt zwei Nameserver an (z. B. `xyz.ns.cloudflare.com`). Beim Registrar von `schwanne.de` die Nameserver auf genau diese beiden ändern. Ist DNSSEC beim Registrar aktiv, vorher dort deaktivieren.
5. Warten, bis Cloudflare die Domain als **Active** meldet (meist Minuten, selten bis zu 24 h; Cloudflare schickt eine Mail).

Einen Eintrag für `kita.schwanne.de` nicht selbst anlegen – das erledigt das erste Deployment (Custom Domain inkl. Zertifikat).

## 2. Datenbank anlegen

```sh
pnpm wrangler login              # Browser-Anmeldung bei Cloudflare
pnpm wrangler d1 create kita     # Region-Abfrage: Standard (automatisch) ist ok
```

Die ausgegebene `database_id` in `wrangler.jsonc` bei `d1_databases[0].database_id` eintragen (statt `00000000-…`) und committen. Die ID ist kein Geheimnis. Falls wrangler anbietet, die Konfiguration selbst zu ergänzen: ablehnen, der Eintrag existiert schon.

## 3. API-Token und Account-ID für GitHub

1. Dashboard → Profil-Symbol oben rechts → *Profile → API Tokens → Create Token*.
2. Vorlage **„Edit Cloudflare Workers“** → *Use template*.
3. Unter *Permissions* eine Zeile hinzufügen: **Account → D1 → Edit**.
4. *Account Resources*: das eigene Konto. *Zone Resources*: **Specific zone → schwanne.de** (nötig, damit das Deployment die Custom Domain anlegen kann).
5. *Continue to summary → Create Token* und den Token kopieren (wird nur einmal angezeigt).
6. Account-ID: `pnpm wrangler whoami` oder im Dashboard auf *Workers & Pages* rechts unter *Account details*.

## 4. GitHub-Repository

```sh
git init -b develop
git add -A && git commit -m "Initial commit"
gh repo create overheadhunter/kita --private --source . --push   # pusht develop, CI testet
```

Da `develop` als erster Branch gepusht wird, ist er automatisch der Default-Branch (prüfen: `gh repo view --json defaultBranchRef`).

Secrets und Variable setzen (fragt jeweils nach dem Wert):

```sh
gh secret set CLOUDFLARE_API_TOKEN            # Token aus Schritt 3
gh secret set CLOUDFLARE_ACCOUNT_ID           # Account-ID aus Schritt 3
gh variable set PRODUCTION_URL --body https://kita.schwanne.de   # optional, nur für den Link in der Actions-Ansicht
```

Alternativ im Browser: Repository → *Settings → Secrets and variables → Actions*.

## 5. Erstes Deployment

Erst, wenn `schwanne.de` in Cloudflare **Active** ist (Schritt 1) – sonst schlägt das Anlegen der Custom Domain fehl.

```sh
git push origin develop:main                  # legt main an und löst das Deployment aus
gh run watch                                  # Lauf verfolgen
```

Danach existieren Datenbank-Schema, Worker und `kita.schwanne.de` (das Zertifikat kann ein paar Minuten brauchen). Optional unter *Settings → Branches* eine Regel für `main` anlegen (nur per Pull Request, CI muss grün sein).

## 6. Team-Link

```sh
pnpm token                                    # zufälligen Token erzeugen
pnpm wrangler secret put STAFF_TOKEN          # Token einfügen; wirkt sofort, ohne neues Deployment
```

Team-Link: `https://kita.schwanne.de/#t=<STAFF_TOKEN>`. Dort unter „Verwaltung“ die Familien anlegen und ihre Links verteilen.

Den Team-Link wie ein Passwort behandeln. Zum Austauschen einfach `secret put STAFF_TOKEN` mit einem neuen Token wiederholen.

## Danach

Neue Versionen: `develop` nach `main` mergen und pushen. Den Lauf verfolgen mit `gh run watch`.
