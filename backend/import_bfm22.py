"""
Batch import all TEI-TXM files from BFM22 into LogoScope.
Downloads from the public GitLab repo and ingests via CorpusManager.

Usage (from backend/):
    python3 import_bfm22.py [--dry-run]
"""
import sys
import time
import urllib.request
from pathlib import Path

GITLAB_API = "https://gitlab.huma-num.fr/api/v4/projects/bfm%2Fbfm-textes-diffusion/repository"
RAW_BASE   = "https://gitlab.huma-num.fr/bfm/bfm-textes-diffusion/-/raw/main/TEI-TXM"
SOURCE_DB      = "BFM22"
SOURCE_DB_URL  = "https://txm-bfm.huma-num.fr/txm/"
UPLOAD_DIR = Path(__file__).parent / "data" / "uploads"

dry_run = "--dry-run" in sys.argv


def fetch_file_list():
    import json, urllib.parse
    files = []
    page = 1
    while True:
        url = f"{GITLAB_API}/tree?path=TEI-TXM&per_page=100&page={page}"
        with urllib.request.urlopen(url, timeout=30) as r:
            items = json.loads(r.read())
        xmls = [i["name"] for i in items if i["name"].endswith(".xml")]
        files.extend(xmls)
        if len(items) < 100:
            break
        page += 1
    return files


def download_file(filename: str, dest: Path) -> bool:
    url = f"{RAW_BASE}/{urllib.request.quote(filename)}"
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            dest.write_bytes(r.read())
        return True
    except Exception as e:
        print(f"  [download error] {e}")
        return False


def main():
    from app.core.database import SessionLocal
    from app.core.corpus_manager import CorpusManager

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    print("Fetching file list from GitLab…")
    files = fetch_file_list()
    print(f"Found {len(files)} XML files.\n")

    ok = skipped = failed = 0

    for i, filename in enumerate(files, 1):
        print(f"[{i}/{len(files)}] {filename}")
        dest = UPLOAD_DIR / filename

        if dry_run:
            print("  (dry run — skipping)")
            continue

        # Download if not already on disk
        if not dest.exists():
            if not download_file(filename, dest):
                failed += 1
                continue
        else:
            print("  already on disk")

        # Fresh session per text — avoids SQLite lock cascade on error
        db = SessionLocal()
        try:
            manager = CorpusManager(db)
            text_id = manager.load_text(
                str(dest),
                source_db=SOURCE_DB,
                source_db_url=SOURCE_DB_URL,
            )
            print(f"  -> imported (text_id={text_id})")
            ok += 1
        except ValueError as e:
            print(f"  -> skipped: {e}")
            skipped += 1
        except Exception as e:
            db.rollback()
            print(f"  -> ERROR: {e}")
            failed += 1
        finally:
            db.close()

        time.sleep(0.3)

    print(f"\nDone. imported={ok}  skipped={skipped}  failed={failed}")


if __name__ == "__main__":
    main()
