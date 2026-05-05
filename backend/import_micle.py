"""
Batch import all TEI-XML files from the MICLE public corpus into LogoScope.
Each text lives at: Core corpus/Fr/{dir}/XML-TEI/{dir}.xml

Usage (from backend/):
    python3 import_micle.py [--dry-run]
"""
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

GITLAB_API  = "https://git.unicaen.fr/api/v4/projects/mathieu.goux%2Fmicle-public/repository"
RAW_BASE    = "https://git.unicaen.fr/mathieu.goux/micle-public/-/raw/master/Core%20corpus/Fr"
SOURCE_DB      = "MICLE"
SOURCE_DB_URL  = "https://txm-crisco.huma-num.fr/txm/"
UPLOAD_DIR  = Path(__file__).parent / "data" / "uploads"

dry_run = "--dry-run" in sys.argv


def fetch_text_dirs():
    url = f"{GITLAB_API}/tree?path=Core%20corpus%2FFr&per_page=100"
    with urllib.request.urlopen(url, timeout=30) as r:
        import json
        items = json.loads(r.read())
    return [i["name"] for i in items if i["type"] == "tree"]


def download_file(dir_name: str, dest: Path) -> bool:
    filename = f"{dir_name}.xml"
    raw_path = f"{RAW_BASE}/{urllib.parse.quote(dir_name)}/XML-TEI/{urllib.parse.quote(filename)}"
    try:
        with urllib.request.urlopen(raw_path, timeout=60) as r:
            dest.write_bytes(r.read())
        return True
    except Exception as e:
        print(f"  [download error] {e}")
        return False


def main():
    from app.core.database import SessionLocal
    from app.core.corpus_manager import CorpusManager

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    print("Fetching directory list from GitLab…")
    dirs = fetch_text_dirs()
    print(f"Found {len(dirs)} texts.\n")

    ok = skipped = failed = 0

    for i, dir_name in enumerate(dirs, 1):
        filename = f"{dir_name}.xml"
        print(f"[{i}/{len(dirs)}] {filename}")
        dest = UPLOAD_DIR / filename

        if dry_run:
            print("  (dry run — skipping)")
            continue

        if not dest.exists():
            if not download_file(dir_name, dest):
                failed += 1
                continue
        else:
            print("  already on disk")

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
