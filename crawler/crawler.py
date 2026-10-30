import json
from pathlib import Path

from parser import parse_free_text, parse_html_page, parse_rss_xml
from sources import fetch_url_content, get_all_rss_contents

OUTPUT_FILE = Path(__file__).parent.parent / "public" / "data" / "submissions.json"


def run_crawler(manual_text=None, target_url=None):
    new_suggestions = []

    for feed_url, content in get_all_rss_contents():
        new_suggestions.extend(parse_rss_xml(content, feed_url))

    if manual_text:
        new_suggestions.extend(parse_free_text(manual_text))

    if target_url:
        html_data = fetch_url_content(target_url)
        if html_data:
            new_suggestions.extend(parse_html_page(html_data, target_url))

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, encoding="utf-8") as submissions_file:
            submissions = json.load(submissions_file)
        if not isinstance(submissions, list):
            raise ValueError("submissions.json muss ein JSON-Array enthalten.")
    else:
        submissions = []

    existing_keys = {
        (item.get("source_url", ""), item.get("title", ""))
        for item in submissions
        if isinstance(item, dict)
    }
    added = 0
    for suggestion in new_suggestions:
        key = (suggestion.get("source_url", ""), suggestion.get("title", ""))
        if key in existing_keys:
            continue
        submissions.append(suggestion)
        existing_keys.add(key)
        added += 1

    with open(OUTPUT_FILE, "w", encoding="utf-8") as submissions_file:
        json.dump(submissions, submissions_file, ensure_ascii=False, indent=2)
        submissions_file.write("\n")

    print(f"Crawler abgeschlossen: {added} neue Vorschläge in {OUTPUT_FILE} gespeichert.")
    return added


if __name__ == "__main__":
    run_crawler()