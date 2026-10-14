# kaufhaus-broken

Dokumentation deutscher Warenhausstandorte als statische Website. Das Datenmodell trennt geografischen **Standort**, physisches **Gebäude** und zeitliche **Mieternutzung**.

## Lokal starten

Im Repository-Root:

```powershell
python -m http.server 8000 --directory public
```

Dann `http://localhost:8000` öffnen. Ein Webserver ist nötig, damit Browser die JSON-Dateien laden können.

## Projektunterlagen

- [Datenmodell](docs/data-model.md)
- [Architektur, Hosting und Datenfreigabe](docs/architecture.md)

Die Website wird ohne Framework-Build aus `public/` ausgeliefert. Der vorgeschlagene Pages-Build-Output ist `public`; es gibt keine REST-API. Siehe Architektur für Hinweise zu Cloudflare Pages, OSM, Datenschutz und dem noch offenen Lizenzentscheid.
