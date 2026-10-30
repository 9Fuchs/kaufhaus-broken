import json
import urllib.request
import urllib.error
from pathlib import Path

CONFIG_PATH = Path(__file__).parent.parent / "public" / "data" / "source_config.json"

DEFAULT_SOURCE_CONFIG = {
    "feeds": [],
    "keywords": ["Galeria", "Karstadt", "Kaufhof", "Hertie", "Horten", "Warenhaus", "Insolvenz", "Schließung", "Eröffnung"]
}


def get_source_config():
    try:
        with open(CONFIG_PATH, encoding="utf-8") as source_file:
            config = json.load(source_file)
    except (OSError, json.JSONDecodeError):
        return DEFAULT_SOURCE_CONFIG

    if not isinstance(config, dict):
        return DEFAULT_SOURCE_CONFIG

    feeds = config.get("feeds")
    keywords = config.get("keywords")
    return {
        "feeds": [feed for feed in feeds if isinstance(feed, dict) and isinstance(feed.get("url"), str)] if isinstance(feeds, list) else [],
        "keywords": [keyword for keyword in keywords if isinstance(keyword, str) and keyword.strip()] if isinstance(keywords, list) else DEFAULT_SOURCE_CONFIG["keywords"]
    }

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

    for feed in get_source_config()["feeds"]:
        if not feed.get("enabled", True):
            continue
        feed_url = feed["url"]
        content = fetch_feed(feed_url)
        if content:
            content_list.append((feed_url, content))

    return content_list