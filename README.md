# kaufhaus-broken

## Status, Datenpflege und RSS-Crawler

- `status.html` ist das Dashboard für RSS-Laufgesundheit, JSON-Gültigkeit, Vorschlags-/Datenmengen und aggregierte Cloudflare-Anfragen.
- `datenpflege.html` enthält die manuelle Vorschlagsprüfung und den JSON-Editor.
- `crawl.html` verwaltet RSS-Feeds und Suchbegriffe und kann URL-/Freitext-Eingaben direkt parsen.
- `.github/workflows/crawler.yml` führt den RSS-Crawler täglich um 06:17 UTC aus; er kann außerdem über GitHub Actions manuell gestartet werden. Erfolgreiche oder teilweise fehlgeschlagene Läufe schreiben `crawler_status.json` und neue Vorschläge in `submissions.json`. Der Commit aktualisiert Cloudflare Pages, sofern Pages auf diesen Branch deployt.
- `quellen.html` listet aktive Feeds, gespeicherte Artikel-/Seiten-URLs sowie die Zuordnung von JSON-Dateien zu HTML-Seiten. Beim Übernehmen eines Vorschlags in einen Datensatz muss dessen `source_url` mitgespeichert werden, damit die Herkunft dauerhaft nachvollziehbar bleibt.

Für die Cloudflare-Zugriffsstatistik zusätzlich in Pages konfigurieren:

- `CLOUDFLARE_ZONE_ID`: Zone-ID der Domain, für die Zugriffe angezeigt werden.
- `CLOUDFLARE_ANALYTICS_TOKEN`: verschlüsseltes Secret mit mindestens der Berechtigung `Zone Analytics:Read`.

Die Metriken kommen serverseitig aus der Cloudflare GraphQL Analytics API. Angezeigt werden HTTP-Anfragen der letzten 30 Tage und tägliche Unique-Client-Zahlen; letztere sind keine verifizierte Anzahl realer Personen und können automatisierte Zugriffe enthalten. Ohne Variablen bleibt der Analytics-Abschnitt ausdrücklich als nicht konfiguriert markiert.

## Cloudflare Admin und Kontaktversand

Pages Functions liegen unter `functions/`; Cloudflare Pages soll `public/` als Build-Ausgabeverzeichnis verwenden. Admin-JSON-Dateien werden über die Functions mit einem GitHub-Commit aktualisiert. Der GitHub-Token wird nie an den Browser ausgeliefert.

### Admin-Konfiguration

In Cloudflare Pages Umgebungsvariablen setzen:

- `ACCESS_TEAM_DOMAIN`: Zero-Trust-Teamdomain, ohne Schema.
- `ACCESS_AUD`: Audience Tag der geschützten Access-Anwendung.
- `ADMIN_EMAILS`: erlaubte Access-E-Mail-Adressen, kommasepariert.
- `GITHUB_REPOSITORY`: `owner/repository`.
- `GITHUB_BRANCH`: Zielbranch, üblicherweise `main`.
- `GITHUB_TOKEN`: Secret eines Fine-grained Tokens, begrenzt auf dieses Repository mit `Contents: Read and write`.

#### Cloudflare Access-Schutz

Der Access-Schutz wird nicht durch einen Git-Commit aktiviert. Bis die Anwendung im Cloudflare-Zero-Trust-Dashboard angelegt und gespeichert ist, bleiben die statischen Seiten öffentlich erreichbar. In **Zero Trust → Access controls → Applications** eine `Self-hosted`-Anwendung für die Produktionsdomain anlegen, eine `Allow`-Policy mit der Admin-E-Mail-Allowlist hinzufügen und den gewünschten Identity Provider aktivieren. Access muss vor Pages mindestens diese Pfade schützen:

- `/status.html`
- `/datenpflege.html`
- `/crawl.html`
- `/crawler.html` (Pages leitet danach auf `/crawl.html` weiter)
- `/api/admin/*`

Access leitet nicht authentifizierte Browser automatisch zur Loginmaske um; nach erfolgreichem Login wird der ursprüngliche Pfad fortgesetzt. Dieselben Regeln auch für die `*.pages.dev`-Adresse anlegen oder diese alternative Domain deaktivieren, sonst könnte sie die geschützte Produktionsdomain umgehen. Die API verifiziert zusätzlich Signatur, Issuer, Audience, Ablaufzeit und Admin-E-Mail im Access-JWT.

`standorte.json` hält `property_records`, die offene `closure_list` und quellenpflichtige `closure_waves`; öffentliche Immobilienangaben werden nur mit `review_status: "verified"` gerendert. RSS- und manuelle Crawl-Treffer können vorläufige Eigentümer-, Verkaufs-, Miet- und Übernahmehinweise enthalten; ein Immobilien-Review legt sie zunächst mit `pending_review` an.

### SMTP-Kontaktformular

Für `functions/api/contact.js` diese Werte konfigurieren:

- `SMTP_HOST`: standardmäßig `securesmtp.t-online.de`.
- `SMTP_PORT`: `465` für implizites TLS.
- `SMTP_USER`: vollständige T-Online-Mailadresse; diese ist der SMTP-Absender.
- `SMTP_PASSWORD`: separates E-Mail-Passwort des T-Online-Kontos als verschlüsseltes Cloudflare Secret; nicht das Telekom-Login-Passwort verwenden.
- `CONTACT_TO_EMAIL`: Zieladresse; hier `platzhalter@t-online.de` eintragen.

Das Formular versendet ausschließlich serverseitig. Die vom Nutzer angegebene „E-Mail für Rückfragen“ wird als `Reply-To` verwendet, nicht als gefälschter SMTP-Absender. Kein Mailpasswort und kein Token gehören in Git oder Frontend-Dateien. Für `/api/contact` in Cloudflare zusätzlich eine Rate-Limiting-Regel einrichten. SMTP-Zugangsdaten vor dem Livebetrieb mit den aktuellen Telekom-Mailserver-Einstellungen prüfen.

Die Kontaktadresse im Impressum wird über `GET /api/contact` aus `CONTACT_TO_EMAIL` geladen. Betreibername, ladungsfähige Anschrift und vollständige Datenschutzangaben müssen vor dem öffentlichen Betrieb ergänzt und geprüft werden.
