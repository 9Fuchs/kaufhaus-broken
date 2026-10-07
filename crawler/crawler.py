import json
import re
import datetime
import urllib.request
import xml.etree.ElementTree as ET

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
