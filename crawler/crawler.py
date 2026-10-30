import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

from parser import parse_free_text, parse_html_page, parse_rss_xml
from sources import fetch_url_content, get_rss_feed_report

DATA_DIR = Path(__file__).parent.parent / "public" / "data"
OUTPUT_FILE = DATA_DIR / "submissions.json"
STATUS_FILE = DATA_DIR / "crawler_status.json"


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_submissions():
    if not OUTPUT_FILE.exists():
        return []
    with open(OUTPUT_FILE, encoding="utf-8") as submissions_file:
        submissions = json.load(submissions_file)
    if not isinstance(submissions, list):
        raise ValueError("submissions.json muss ein JSON-Array enthalten.")
    return submissions


def write_status(status):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temporary_file = STATUS_FILE.with_suffix(".tmp")
    with open(temporary_file, "w", encoding="utf-8") as status_file:
        json.dump(status, status_file, ensure_ascii=False, indent=2)
        status_file.write("\n")
    temporary_file.replace(STATUS_FILE)


def run_crawler(manual_text=None, target_url=None):
    started_at = utc_now()
    started_clock = time.monotonic()
    new_suggestions = []
    submissions = read_submissions()
    feed_report = {"configured": 0, "successful": 0, "failed": 0, "feeds": [], "contents": []}
    run_result = {
        "started_at": started_at,
        "finished_at": None,
        "trigger": os.environ.get("CRAWLER_TRIGGER", "manual" if manual_text or target_url else "cli"),
        "success": False,
        "feeds": [],
        "configured_feeds": 0,
        "successful_feeds": 0,
        "failed_feeds": 0,
        "processed_items": 0,
        "new_suggestions": 0,
        "total_suggestions": len(submissions),
        "error": None
    }

    try:
        feed_report = get_rss_feed_report()
        for feed_url, content in feed_report["contents"]:
            parsed_items = parse_rss_xml(content, feed_url)
            run_result["processed_items"] += len(parsed_items)
            for feed_result in feed_report["feeds"]:
                if feed_result["url"] == feed_url:
                    feed_result["matched_items"] = len(parsed_items)
                    break
            new_suggestions.extend(parsed_items)

        if manual_text:
            new_suggestions.extend(parse_free_text(manual_text))

        if target_url:
            html_data = fetch_url_content(target_url)
            if html_data:
                parsed_page = parse_html_page(html_data, target_url)
                run_result["processed_items"] += len(parsed_page)
                new_suggestions.extend(parsed_page)

        existing_keys = {
            (item.get("source_url", ""), item.get("title", ""))
            for item in submissions
            if isinstance(item, dict)
        }
        for suggestion in new_suggestions:
            key = (suggestion.get("source_url", ""), suggestion.get("title", ""))
            if key in existing_keys:
                continue
            submissions.append(suggestion)
            existing_keys.add(key)
            run_result["new_suggestions"] += 1

        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as submissions_file:
            json.dump(submissions, submissions_file, ensure_ascii=False, indent=2)
            submissions_file.write("\n")

        run_result["success"] = feed_report["configured"] > 0 and feed_report["failed"] == 0
        if feed_report["configured"] == 0:
            run_result["error"] = "NoActiveFeeds"
        elif feed_report["failed"] and feed_report["successful"] == 0:
            run_result["error"] = "AllConfiguredFeedsFailed"
    except Exception as error:
        run_result["error"] = type(error).__name__
        raise
    finally:
        run_result.update({
            "finished_at": utc_now(),
            "last_run_at": utc_now(),
            "duration_seconds": round(time.monotonic() - started_clock, 2),
            "feeds": feed_report["feeds"],
            "configured_feeds": feed_report["configured"],
            "successful_feeds": feed_report["successful"],
            "failed_feeds": feed_report["failed"],
            "total_suggestions": len(submissions)
        })
        try:
            previous = json.loads(STATUS_FILE.read_text(encoding="utf-8")) if STATUS_FILE.exists() else {}
            history = previous.get("runs", []) if isinstance(previous, dict) else []
        except (OSError, json.JSONDecodeError):
            history = []
        run_result["runs"] = [run_result.copy(), *history[:29]]
        write_status(run_result)

    print(f"Crawler abgeschlossen: {run_result['new_suggestions']} neue Vorschläge in {OUTPUT_FILE} gespeichert.")
    return run_result["new_suggestions"]


if __name__ == "__main__":
    run_crawler()