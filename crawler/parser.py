import re
import datetime
import xml.etree.ElementTree as ET

KEYWORDS = ["Galeria", "Karstadt", "Kaufhof", "Hertie", "Horten", "Warenhaus", "Insolvenz", "Schließung", "Eröffnung"]

def parse_rss_xml(xml_content, feed_url):
    suggestions = []
    if not xml_content:
        return suggestions
    
    try:
        root = ET.fromstring(xml_content)
        for item in root.findall('.//item'):
            title = item.find('title').text if item.find('title') is not None else ""
            link = item.find('link').text if item.find('link') is not None else ""
            desc = item.find('description').text if item.find('description') is not None else ""

            full_text = f"{title} {desc}"
            if any(re.search(r'\b' + re.escape(kw) + r'\b', full_text, re.IGNORECASE) for kw in KEYWORDS):
                suggestions.append({
                    "crawled_at": datetime.datetime.utcnow().isoformat(),
                    "source_type": "rss",
                    "origin": feed_url,
                    "title": title.strip(),
                    "source_url": link.strip(),
                    "snippet": desc[:250].strip() + "...",
                    "extracted_data": extract_entities(full_text),
                    "status": "PENDING_REVIEW"
                })
    except ET.ParseError as e:
        print(f"XML-Parsing-Fehler bei {feed_url}: {e}")
        
    return suggestions

def parse_free_text(text, source_label="Freitext-Eingabe"):
    """Analysiert manuellen Freitext und extrahiert relevante Infos intelligent."""
    if not text:
        return []
    
    entities = extract_entities(text)
    return [{
        "crawled_at": datetime.datetime.utcnow().isoformat(),
        "source_type": "manual_text",
        "origin": source_label,
        "title": entities.get("detected_title", text[:50] + "..."),
        "source_url": "",
        "snippet": text[:250],
        "extracted_data": entities,
        "status": "PENDING_REVIEW"
    }]

def parse_html_page(html_content, url):
    """Extrahiert Textfragmente und Metadaten von einer beliebigen Ziel-URL."""
    if not html_content:
        return []
    
    # Einfaches HTML-Tag stripping für den Rohtext
    clean_text = re.sub(r'<[^>]+>', ' ', html_content)
    clean_text = re.sub(r'\s+', ' ', clean_text).strip()
    
    entities = extract_entities(clean_text)
    
    # Titel der Seite herausfischen falls vorhanden
    title_match = re.search(r'<title>(.*?)</title>', html_content, re.IGNORECASE)
    page_title = title_match.group(1).strip() if title_match else url
    
    return [{
        "crawled_at": datetime.datetime.utcnow().isoformat(),
        "source_type": "url_scrape",
        "origin": url,
        "title": page_title,
        "source_url": url,
        "snippet": clean_text[:250] + "...",
        "extracted_data": entities,
        "status": "PENDING_REVIEW"
    }]

def extract_entities(text):
    """Einfache Heuristik, um strukturierte JSON-Daten aus Text zu erraten."""
    # Beispiel-Regex für Jahreszahlen
    years = re.findall(r'\b(19\d{2}|20\d{2})\b', text)
    
    # Bekannte Ketten als Platzhalter-Erkennung
    found_brands = [kw for kw in ["Galeria", "Karstadt", "Kaufhof", "Hertie", "Horten"] if re.search(r'\b' + re.escape(kw) + r'\b', text, re.IGNORECASE)]
    
    return {
        "brands_mentioned": list(set(found_brands)),
        "years_mentioned": list(set(years)),
        "detected_title": f"Mögliches Update für {', '.join(found_brands)}" if found_brands else "Manueller Vorschlag"
    }