# Datenmodell

## Leitlinien

- Ein `location` ist der geografische Standort bzw. die Adresse auf der Karte.
- Ein `building` ist ein physisches Gebäude an einem Standort. Ein Standort kann im Lauf der Zeit mehrere Gebäude haben.
- Ein `tenant` ist eine zeitlich begrenzte Nutzung durch ein Unternehmen in einem Gebäude. Fläche, belegte Etagen und Sortiment gehören zu dieser Nutzung, nicht zum Standort.
- Ein `company` bezeichnet den Betreiber bzw. die Warenhauskette. `display_name` am Mieteintrag hält fest, unter welchem Namen die Filiale damals auftrat.
- Unbekannte Werte bleiben `null`; fehlende Quellen werden nicht durch Schätzungen ersetzt.

## Tabellen

### `locations`

Ein stabiler Kartenpunkt mit Adresse. `current_status` ist eine zusammenfassende Anzeige für den Standort, keine Aussage über den Zustand jedes einzelnen Gebäudes.

| Feld | Bedeutung |
| --- | --- |
| `id` | stabile ID, z. B. `loc-velbert-friedrichstr` |
| `name` | lesbarer Standortname |
| `street`, `postal_code`, `city` | Anschrift |
| `lat`, `lng` | WGS84-Koordinaten |
| `current_status` | `active`, `closing_announced`, `closed`, `demolished` oder `repurposed` |

`year_built` und `year_demolished` gehören nicht hierher: ein Standort kann mehrere, nacheinander errichtete Gebäude umfassen.

### `buildings`

| Feld | Bedeutung |
| --- | --- |
| `id` | stabile Gebäude-ID |
| `location_id` | Pflicht-Fremdschlüssel auf `locations.id` |
| `name` | optionaler Gebäude-/Hausname |
| `year_built`, `year_demolished` | Bau- und Abrissjahr, sofern belegt |
| `total_floors` | bekannte Gesamtzahl der Geschosse |
| `gross_floor_area_sqm` | bekannte Gesamtfläche des Gebäudes in m² |
| `source_url` | Beleg für die Gebäudedaten |

### `companies`

| Feld | Bedeutung |
| --- | --- |
| `id` | stabile Firmen-/Ketten-ID |
| `name` | Firmen- oder Kettenname |
| `type` | kontrollierte Kategorie, z. B. Warenhaus, Betreiber, Gastronomie |

Die aktuelle `companies.json` mischt teilweise Marken, Ketten und Muttergesellschaften. Beim Aufräumen muss `type` diese Unterscheidung sichtbar machen; Namen aus der Vergangenheit bleiben zusätzlich am jeweiligen Mietzeitraum erhalten.

### `tenants` (zeitliche Nutzungen)

| Feld | Bedeutung |
| --- | --- |
| `id` | stabile Nutzungs-ID |
| `building_id` | Pflicht-Fremdschlüssel auf `buildings.id` |
| `company_id` | Pflicht-Fremdschlüssel auf `companies.id` |
| `display_name` | vor Ort verwendeter Marken-/Filialname in diesem Zeitraum |
| `from_date`, `to_date` | Gültigkeitszeitraum als ISO-Datum; offenes Ende ist `null` |
| `floor_area_sqm` | von diesem Mieter genutzte Fläche, nicht Gebäudegesamtfläche |
| `floors_used` | tatsächlich genutzte Geschosse |
| `assortment` | belegtes Sortiment |
| `source_url` | Beleg für die Nutzung und deren Zeitraum |

`location_id` wird über `building_id -> location_id` ermittelt und nicht doppelt gespeichert. Das verhindert widersprüchliche Zuordnungen.

### `timeline_events`

Diese Tabelle ist die gemeinsame Historie je Standort und ersetzt langfristig sowohl `history.json` als auch `historicnotes` als getrennte Konzepte.

| Feld | Bedeutung |
| --- | --- |
| `id` | stabile Text-ID |
| `location_id` | Standort; `null` für unternehmensweite Ereignisse |
| `building_id`, `tenant_id` | optionale genauere Zuordnung |
| `event_date` | ISO-Datum oder `null`, wenn unbekannt |
| `date_precision` | `day`, `month` oder `year`; verhindert erfundene Tagesdaten |
| `event_type` | `OPENING`, `CLOSURE`, `SALE`, `RENAMING`, `REBUILD`, `DEMOLITION`, `NEWTENANT`, `INSOLVENCY`, `REOPENING` oder `NAMECHANGE` |
| `title`, `description` | kurze, sachliche Darstellung |
| `source_url` | Quelle des Ereignisses |
| `created_at` | Zeitpunkt der Aufnahme in den Datenbestand |

### Änderungsprotokoll

Entscheidung: Die Git-Historie des öffentlichen Repositories ist der maßgebliche Changelog für Website und Daten. Es gibt keine D1-Datenbank und keine SQL-Changelog-Tabelle. `changelog.json` bleibt höchstens ein ergänzender, menschenlesbarer Datensatz; sie ersetzt weder Git noch wird sie als vollständiges Audit-Log behandelt.

### Hinweise und Crawler-Vorschläge

Hinweise und Crawler-Funde sind **Vorschläge**, keine veröffentlichten Standortdaten. Sie brauchen Status wie `PENDING_REVIEW`, `APPROVED` oder `REJECTED` und eine manuelle Freigabe. Namen und E-Mail-Adressen von Hinweisgebenden dürfen nicht in `public/data/` oder im öffentlichen Git-Verlauf landen. Die aktuelle Formularspeicherung im Browser ist nur ein Prototyp und sendet keine E-Mail.

## Beziehungen

```text
locations 1 --- n buildings 1 --- n tenants n --- 1 companies
locations 1 --- n timeline_events
buildings 0 --- n timeline_events
tenants 0 --- n timeline_events
```

## Migrationsreihenfolge

1. Fehlende Gebäude als eigene Einträge ergänzen, aber nur mit belegten Angaben.
2. `year_built` und `year_demolished` aus Standortdatensätzen in Gebäude verschieben.
3. Mietzeiträume um `building_id`, `display_name` und `source_url` ergänzen. Vorhandene `location_id` erst entfernen, wenn alle Verknüpfungen geprüft sind.
4. `history.json` und `timeline_events.json` nach und nach auf ein Ereignisformat mit `date_precision` und Quellen-URL vereinheitlichen.
5. Fremdschlüssel und Quellen bei jedem Daten-PR automatisiert prüfen; unklare Beziehungen als offene Datenlücke führen.

**Ist-Zustand:** `tenants.json` enthält bereits Mietzeitraum, Fläche, Etagen und Sortiment, aber nur `location_id`. Für `loc-velbert-friedrichstr` fehlen derzeit ein Eintrag in `locations.json` und ein belegter Gebäudeeintrag. Diese Lücke darf nicht mit geratenen Koordinaten oder Gebäudedaten geschlossen werden.
