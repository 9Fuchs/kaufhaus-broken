import argparse
import json
from pathlib import Path

if __package__:
    from .parser import parse_free_text, parse_html_page, parse_rss_xml
    from .sources import fetch_url_content, get_all_rss_contents
else:
    from parser import parse_free_text, parse_html_page, parse_rss_xml
    from sources import fetch_url_content, get_all_rss_contents

OUTPUT_FILE = Path(__file__).parent / "raw_submissions.json"


def run_crawler(manual_text=None, target_url=None, include_feeds=True):
    suggestions = []

    if include_feeds:
        print("Wertet RSS-Feeds aus...")
        for feed_url, content in get_all_rss_contents():
            suggestions.extend(parse_rss_xml(content, feed_url))

    if manual_text:
        print("Verarbeite manuellen Freitext...")
        suggestions.extend(parse_free_text(manual_text))

    if target_url:
        print(f"Scrape und analysiere URL: {target_url}...")
        html_data = fetch_url_content(target_url)
        if html_data:
            suggestions.extend(parse_html_page(html_data, target_url))

    OUTPUT_FILE.write_text(
        json.dumps(suggestions, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Crawler fertig: {len(suggestions)} Vorschläge in {OUTPUT_FILE} abgelegt.")
    return suggestions


def main():
    parser = argparse.ArgumentParser(
        description="Sammelt Warenhaus-Meldungen als lokal zu prüfende Vorschläge."
    )
    parser.add_argument("--url", help="Eine URL zur manuellen Analyse")
    parser.add_argument("--text", help="Freitext zur manuellen Analyse")
    parser.add_argument(
        "--text-file",
        type=Path,
        help="UTF-8-Textdatei zur manuellen Analyse",
    )
    parser.add_argument(
        "--no-feeds",
        action="store_true",
        help="RSS-Feeds nicht zusätzlich abrufen",
    )
    args = parser.parse_args()

    if args.text is not None and args.text_file is not None:
        parser.error("--text und --text-file können nicht gemeinsam verwendet werden")

    manual_text = args.text
    if args.text_file is not None:
        manual_text = args.text_file.read_text(encoding="utf-8")

    run_crawler(
        manual_text=manual_text,
        target_url=args.url,
        include_feeds=not args.no_feeds,
    )


if __name__ == "__main__":
    main()
