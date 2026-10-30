# kaufhaus-broken

Dokumentation deutscher Warenhausstandorte als statische Website. Das Datenmodell trennt geografischen **Standort**, physisches **Gebäude** und zeitliche **Mieternutzung**.

## Lokal starten

Im Repository-Root:

```powershell
python -m http.server 8000 --directory public
```

Dann `http://localhost:8000` öffnen. Ein Webserver ist nötig, damit Browser die JSON-Dateien laden können. Pages Functions wie `/api/contact` benötigen für einen vollständigen lokalen Funktionstest eine passende Functions-Laufzeit.

## Crawler und Datenpflege

Der Crawler verarbeitet die konfigurierten RSS-Quellen sowie gezielt eingereichte öffentliche URLs oder Texte. Funde werden als Vorschläge zur redaktionellen Prüfung gespeichert und nicht automatisch in öffentliche Datensätze übernommen. Die Verwaltung von Quellen, Vorschlägen und Datensätzen erfolgt über die lokalen Admin-Seiten und serverseitige Pages Functions.

Die Website wird ohne Framework-Build aus `public/` ausgeliefert. Der Crawler-Workflow liegt unter `.github/workflows/crawler.yml`; erfolgreiche Läufe aktualisieren den Vorschlags- und Laufstatus im Repository.

## Cloudflare Admin und Kontaktversand

Pages Functions liegen unter `functions/`; Cloudflare Pages soll `public/` als Build-Ausgabeverzeichnis verwenden. Admin-JSON-Dateien werden über die Functions mit einem GitHub-Commit aktualisiert. Der GitHub-Token wird nie an den Browser ausgeliefert.

In Cloudflare Pages sind für Admin-Funktionen `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS`, `GITHUB_REPOSITORY`, `GITHUB_BRANCH` und `GITHUB_TOKEN` erforderlich. Cloudflare Access muss mindestens `/status.html`, `/datenpflege.html`, `/crawl.html` und `/api/admin/*` schützen. Die Function verifiziert zusätzlich Signatur, Issuer, Audience, Ablaufzeit und Admin-E-Mail.

Für `functions/api/contact.js` werden `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` und `CONTACT_TO_EMAIL` benötigt. Das Formular versendet ausschließlich serverseitig; die Rückfrageadresse wird als `Reply-To` verwendet. Mailpasswort und GitHub-Token gehören ausschließlich in verschlüsselte Cloudflare Secrets, nie in Git oder Frontend-Dateien. Für `/api/contact` sollte zusätzlich eine Rate-Limiting-Regel eingerichtet werden.

Betreibername, ladungsfähige Anschrift und vollständige Datenschutzangaben müssen vor dem öffentlichen Betrieb ergänzt und geprüft werden.

## Projektunterlagen

- [Datenmodell](docs/data-model.md)
- [Architektur, Hosting und Datenfreigabe](docs/architecture.md)
