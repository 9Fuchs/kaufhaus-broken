# Architektur und Betrieb

## KISS-Entscheidung

- Frontend: statische HTML-, CSS- und JavaScript-Dateien unter `public/`; kein Astro.
- Veröffentlichte Daten: versionierte JSON-Dateien unter `public/data/`.
- Quelle der Wahrheit: GitHub-Repository. Änderungen an Live-Daten werden geprüft und als Commit nachvollziehbar.
- Keine öffentliche Bearbeitung und keine REST-API.
- Leaflet für die Karte; die Standard-OSM-Kacheln werden nur für den aktuellen Kartenausschnitt geladen.

Das entspricht dem vorhandenen Projekt und benötigt keinen Build-Schritt oder Server für den Lesezugriff. **Die Git-Historie ist der Changelog**; D1 und eine SQL-Changelog-Tabelle werden nicht eingesetzt. Cloudflare D1 wäre SQLite-kompatibel, würde für Zugriffe aus Pages aber eine Pages Function und damit zusätzliche Backend-Komplexität benötigen.

## Cloudflare Pages und GitHub

Das Repository ist bereits mit `https://github.com/9Fuchs/kaufhaus-broken` verbunden. Für Cloudflare Pages:

1. Pages-Projekt mit GitHub verbinden, Repository `9Fuchs/kaufhaus-broken` wählen und Produktionsbranch `main` setzen.
2. Build command leer lassen; Build output directory `public` eintragen.
3. Pull Requests als Preview Deployments prüfen, Änderungen erst nach manueller Freigabe in `main` veröffentlichen.
4. `kaufhaus-broken.ff9x.net` im Pages-Projekt unter **Custom domains** hinzufügen. Für die Subdomain den dort angezeigten CNAME-Zielwert im DNS setzen. Nur einen CNAME manuell anzulegen, ohne die Domain im Pages-Projekt zuzuordnen, reicht laut Cloudflare nicht.

Cloudflare dokumentiert für Pages Free derzeit 500 Builds pro Monat. Für dieses statische Projekt ist kein Framework-Build nötig. Werte und Limits können sich ändern; vor Einrichtung die verlinkten Produktdokumente prüfen.

## Datenfreigabe und Crawler

- Menschen bearbeiten Daten über normale Git-Änderungen/Pull Requests.
- Der Crawler sammelt ausschließlich Kandidaten und Quell-URLs. Er verändert niemals `public/data/` direkt und veröffentlicht nichts automatisch.
- Eine Person vergleicht Kandidat und Quelle, korrigiert oder verwirft ihn und übernimmt bestätigte Fakten in die passenden Datensätze.
- Jede neue Tatsachenbehauptung braucht eine konkrete Quelle. Unbestätigte Schließungsgerüchte werden nicht als Tatsache auf Karte oder Timeline angezeigt.
- Git-Historie ist das Audit-Log. Die Impressums-/Datenschutzseite verlinkt direkt auf die Commit-Historie des Produktionsbranches. `changelog.json` ist kein zweites maßgebliches Audit-Log.

## Hinweisformular

Das Formular nutzt genau eine Pages Function unter `POST /api/hinweis`; es gibt keine allgemeine REST-API und keine Speicherung von Hinweisen in Git, JSON oder `localStorage`. Die Function prüft den Turnstile-Token serverseitig und sendet den validierten Inhalt über SMTP mit TLS auf Port 465. SMTP-Zugangsdaten werden ausschließlich als Cloudflare-Secrets konfiguriert.

Für den Betrieb:

1. In Cloudflare Turnstile ein Widget anlegen und `kaufhaus-broken.ff9x.net` als Hostname erlauben. Den öffentlichen Sitekey in `public/hinweise.html` anstelle von `YOUR_TURNSTILE_SITE_KEY` eintragen. Den dazugehörigen Secret Key als Cloudflare-Secret `TURNSTILE_SECRET_KEY` hinterlegen.
2. In den Pages-Einstellungen unter **Settings > Variables and Secrets** `SMTP_HOST` als Variable setzen. `SMTP_USERNAME`, `SMTP_PASSWORD` und `HINTS_TO_EMAIL` als Secrets anlegen. `HINTS_TO_EMAIL` kann entfallen; dann wird an `SMTP_USERNAME` gesendet. Der SMTP-Host muss der von T-Online für externe Mailprogramme dokumentierte Host sein. Der Code nutzt implizites TLS auf Port 465; Benutzername und Passwort müssen für SMTP-Nutzung freigeschaltet sein.
3. Die Function wird mit der nächsten Pages-Deployment aus `functions/api/hinweis.js` bereitgestellt. Lokal ist für `npx wrangler pages dev public` Node.js und Wrangler erforderlich.
4. Mit einer echten Nachricht in der Ziel-Mailbox prüfen, ob Anmeldung, Turnstile, SMTP-Versand und Antworten über `Reply-To` funktionieren.

Cloudflare dokumentiert `cloudflare:sockets` für ausgehende TCP-Verbindungen, blockiert aber Port 25 und Cloudflare-eigene IP-Bereiche. Deshalb muss `SMTP_HOST` ein externer SMTP-Anbieter sein, etwa der SMTP-Host des T-Online-Kontos; Cloudflares eigener SMTP-Endpunkt ist aus der Pages Function kein geeigneter Zielhost. Für Entwicklung und Tests sind getrennte Turnstile-Keys und getrennte E-Mail-Zugangsdaten zu verwenden. Keine Geheimnisse in Git oder Frontend-Code eintragen.

Das Formular sendet keine Client-IP an Siteverify und protokolliert keine Formulardaten. Turnstile verarbeitet laut eigener Datenschutzerklärung technische Signale (u. a. IP-Adresse, TLS-Fingerprint, User-Agent, Sitekey/Origin). Datenschutzhinweise müssen deshalb Verantwortliche, Rechtsgrundlage, Empfänger und konkrete Aufbewahrung benennen. Eine Cookie-Einwilligungsleiste folgt nicht automatisch aus dem Einbau; ihre Notwendigkeit hängt von den tatsächlich eingesetzten Speicher-/Zugriffstechniken ab und ist vor Livegang zu prüfen.

Eine eigene URL `/datenschutz.html` ist nicht zwingend, wenn die Datenschutzinformationen auf der bestehenden, dauerhaft erreichbaren Seite `impressum.html` vollständig und leicht auffindbar sind. Eine separate Seite kann die Inhalte übersichtlicher machen, ist aber kein Ersatz für korrekte Angaben. Ein Cookie-Banner ist nicht pauschal für jede Website erforderlich; vor Einsatz von Analyse-/Marketing-Technik oder nicht erforderlichem Zugriff auf Endgeräteinformationen muss die konkrete Einwilligungspflicht geprüft werden. Für Turnstile sind Verarbeitung und Anbieter in der Datenschutzerklärung zu nennen; keine pauschale „DSGVO-konform“-Behauptung verwenden.

## Datenschutz und Kartenbetrieb

- Keine Analyse-Cookies oder Tracker hinzufügen, solange sie nicht benötigt werden.
- Die Startseite lädt Leaflet derzeit von `unpkg.com` und Kartenkacheln von OpenStreetMap. Dadurch entstehen Drittanbieter-Verbindungen; ein pauschales „DSGVO-konform“ ist keine belastbare Aussage. Anbieter, Datenflüsse, Rechtsgrundlage und Datenschutzhinweise müssen vor öffentlichem Betrieb geprüft werden.
- OSM verlangt den offiziellen Tile-Endpunkt, sichtbare Attribution und untersagt Vorabruf/Bulk-Downloads. Keine Offline-Karten oder flächendeckenden Kachel-Crawler bauen.
- Impressum, Datenschutz, Verantwortliche, Kontakt, Hosting-Logs und Aufbewahrungsfristen müssen mit echten Angaben ergänzt werden. Dies ist technische Projektdokumentation, keine Rechtsberatung.

## Open Source

Das GitHub-Repository ist öffentlich, enthält im Projektstand aber keine `LICENSE`-Datei. Öffentlich sichtbar bedeutet nicht automatisch, dass Code oder Daten frei wiederverwendbar sind.

**Empfehlung:** eigenen Programmcode unter MIT stellen, wenn möglichst breite Wiederverwendung gewünscht ist. Für die kuratierte Datenbank separat entscheiden: ODbL 1.0 passt zu Datenbanken und verlangt Attribution sowie Share-Alike; CC BY 4.0 ist eine einfachere Namensnennungslizenz, aber kein Ersatz für die MIT-Code-Lizenz. Nur Rechte lizenzieren, die tatsächlich vorliegen. Fremde Artikel, Bilder und geschützte Inhalte nicht in die Datenbank kopieren; knappe eigene Zusammenfassungen mit Quellenlink verwenden. Bei aus OSM-Daten abgeleiteten Daten zusätzlich die ODbL-Anforderungen prüfen.

GitHub weist darauf hin, dass ohne Lizenz das standardmäßige Urheberrecht gilt. Lizenzdateien erst hinzufügen, wenn Code- und Datenlizenz bewusst bestätigt sind; die Trennung sollte in README und Repository sichtbar sein.

## Primärquellen

- [Cloudflare Pages: Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare Pages: Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare Pages: Limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Cloudflare Workers TCP Sockets](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)
- [Cloudflare Turnstile: Widget einbetten](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)
- [Cloudflare Turnstile: Token serverseitig validieren](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Cloudflare Email Service: SMTP](https://developers.cloudflare.com/email-service/api/send-emails/smtp/)
- [Cloudflare Turnstile Privacy Addendum](https://www.cloudflare.com/turnstile-privacy-policy/)
- [OpenStreetMap Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- [TDDDG § 25](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [GitHub: Repository lizenzieren](https://docs.github.com/articles/licensing-a-repository)
- [OSI: MIT License](https://opensource.org/license/mit)
- [Open Data Commons: ODbL](https://opendatacommons.org/licenses/odbl/)
- [Creative Commons: CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- [DSGVO, Verordnung (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
