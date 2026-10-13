import urllib.request
import urllib.error

# Standard RSS-Feeds
FEEDS = [
    "https://www.waz.de/rss",
    "https://www.wdr.de/nachrichten/index.rss",
    "https://www.insolution.info/rss"
]

# Deine Google Alerts als RSS-Feeds
GOOGLE_ALERT_FEEDS = [
    # Beispiel: "https://www.google.com/alerts/feeds/123456789/987654321"
]

def fetch_feed(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'KaufhausBrokenBot/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.read()
    except Exception as e:
        print(f"Fehler beim Abrufen von Feed {url}: {e}")
        return None

def fetch_url_content(url):
    """Holt den Inhalt einer gezielten Website-URL für die Analyse."""
    req = urllib.request.Request(url, headers={'User-Agent': 'KaufhausBrokenBot/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"Fehler beim Abrufen der URL {url}: {e}")
        return None

def get_all_rss_contents():
    content_list = []
    
    # Standard-Feeds laden
    for feed_url in FEEDS:
        content = fetch_feed(feed_url)
        if content:
            content_list.append((feed_url, content))
            
    # Google Alert Feeds laden
    for alert_url in GOOGLE_ALERT_FEEDS:
        content = fetch_feed(alert_url)
        if content:
            content_list.append((f"GoogleAlert: {alert_url}", content))
            
    return content_list