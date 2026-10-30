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
    content, _ = fetch_feed_with_error(url)
    return content


def fetch_feed_with_error(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'KaufhausBrokenBot/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.read(), None
    except Exception as error:
        print(f"Fehler beim Abrufen von Feed {url}: {type(error).__name__}")
        return None, type(error).__name__

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
    return get_rss_feed_report()["contents"]


def get_rss_feed_report():
    enabled_feeds = [feed for feed in get_source_config()["feeds"] if feed.get("enabled", True)]
    contents = []
    feed_results = []

    for feed in enabled_feeds:
        feed_url = feed["url"]
        content, error = fetch_feed_with_error(feed_url)
        if content:
            contents.append((feed_url, content))
            feed_results.append({"name": feed.get("name", feed_url), "url": feed_url, "success": True})
        else:
            feed_results.append({
                "name": feed.get("name", feed_url),
                "url": feed_url,
                "success": False,
                "error": error or "EmptyResponse"
            })

    return {
        "configured": len(enabled_feeds),
        "successful": len(contents),
        "failed": len(enabled_feeds) - len(contents),
        "feeds": feed_results,
        "contents": contents
    }