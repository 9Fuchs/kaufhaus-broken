import json
import re
import datetime
import urllib.request
import xml.etree.ElementTree as ET
import logging
from pathlib import Path

# Ziel-Suchbegriffe
KEYWORDS = ["Galeria", "Karstadt", "Kaufhof", "Hertie", "Horten", "Warenhaus", "Insolvenz", "Schließung"]

# RSS-Feeds von Medien und Portalen
FEEDS = [
    "https://www.waz.de/rss",
    "https://www.wdr.de/nachrichten/index.rcs",
    "https://www.insolution.info/rss"  # Beispiel Bekanntmachungen
]

def fetch_feed(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'KaufhausBrokenBot/1.0'})
    try:
        with urllib.request.urlopen(req) as response:
            return response.read()
    except Exception as e:
        print(f"Fehler beim Abrufen von {url}: {e}")
        return None

def parse_rss(xml_content):
    suggestions = []
    if not xml_content:
        return suggestions
    
    root = ET.fromstring(xml_content)
    for item in root.findall('.//item'):
        title = item.find('title').text if item.find('title') is not None else ""
        link = item.find('link').text if item.find('link') is not None else ""
        desc = item.find('description').text if item.find('description') is not None else ""

        full_text = f"{title} {desc}"
        if any(re.search(r'\b' + re.escape(kw) + r'\b', full_text, re.IGNORECASE) for kw in KEYWORDS):
            suggestions.append({
                "crawled_at": datetime.datetime.utcnow().isoformat(),
                "title": title,
                "source_url": link,
                "snippet": desc[:250] + "...",
                "status": "PENDING_REVIEW"
            })
    return suggestions

def run():
    all_suggestions = []
    for feed in FEEDS:
        content = fetch_feed(feed)
        if content:
            all_suggestions.extend(parse_rss(content))

    # In die Staging-Datei schreiben
    with open('crawler/raw_submissions.json', 'w', encoding='utf-8') as f:
        json.dump(all_suggestions, f, ensure_ascii=False, indent=2)

    print(f"Crawler fertig: {len(all_suggestions)} relevante Vorschläge isoliert.")

if __name__ == "__main__":
    run()


# Lokale Module aus demselben Ordner
from sources import fetch_source_data
from parser import parse_raw_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"

def run_crawler():
    logging.info("Starte Crawler...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # 1. Rohdaten holen
    raw_data = fetch_source_data()
    
    # 2. Parsen und Säubern
    parsed_items = parse_raw_data(raw_data)
    
    # 3. Als JSON im public/data Ordner speichern
    output_file = OUTPUT_DIR / "locations.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(parsed_items, f, ensure_ascii=False, indent=2)
        
    logging.info(f"Crawler erfolgreich beendet. {len(parsed_items)} Einträge nach {output_file} geschrieben.")

if __name__ == "__main__":
    run_crawler()

    import json
from pathlib import Path
from sources import get_all_rss_contents, fetch_url_content
from parser import parse_rss_xml, parse_free_text, parse_html_page

OUTPUT_DIR = Path(__file__).parent / "raw_submissions.json"

def run_crawler(manual_text=None, target_url=None):
    all_suggestions = []
    
    # 1. RSS Feeds auswerten
    print("Wertet RSS-Feeds aus...")
    for feed_url, content in get_all_rss_contents():
        items = parse_rss_xml(content, feed_url)
        all_suggestions.extend(items)
        
    # 2. Optional: Freitext einlesen und parsen
    if manual_text:
        print("Verarbeite manuellen Freitext...")
        all_suggestions.extend(parse_free_text(manual_text))
        
    # 3. Optional: Ziel-URL scrapen und parsen
    if target_url:
        print(f"Scrape und analysiere URL: {target_url}...")
        html_data = fetch_url_content(target_url)
        if html_data:
            all_suggestions.extend(parse_html_page(html_data, target_url))

    # In die Staging-Datei schreiben
    OUTPUT_DIR.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_DIR, 'w', encoding='utf-8') as f:
        json.dump(all_suggestions, f, ensure_ascii=False, indent=2)

    print(f"Crawler fertig: {len(all_suggestions)} Vorschläge in raw_submissions.json abgelegt.")

if __name__ == "__main__":
    # Test-Aufruf (kann später z. B. über CLI-Argumente oder ein Admin-Interface gesteuert werden)
    run_crawler()