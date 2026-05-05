"""
Re-extract citations for all texts already in the database.
Updates Token.citation only — does not re-tokenise or change lemmas/POS.

Usage (from backend/):
    python3 reparse_citations.py [--dry-run]
"""
import sys
import logging
logging.disable(logging.CRITICAL)

from pathlib import Path
from sqlalchemy import update as sa_update
from app.core.database import SessionLocal
from app.models import Token, Text
from app.parsers.xml_parser import XMLParser

UPLOAD_DIR = Path(__file__).parent / "data" / "uploads"
dry_run = "--dry-run" in sys.argv


def main():
    db = SessionLocal()
    texts = db.query(Text).order_by(Text.text_id).all()
    print(f"Processing {len(texts)} texts…\n")

    ok = skipped = failed = 0

    for text in texts:
        xml_path = UPLOAD_DIR / text.filename
        if not xml_path.exists():
            print(f"[{text.text_id}] {text.filename}: XML not found, skipping")
            skipped += 1
            continue

        try:
            cmap = XMLParser.extract_citation_map(str(xml_path))
        except Exception as e:
            print(f"[{text.text_id}] {text.filename}: parse error — {e}")
            failed += 1
            continue

        if not cmap:
            print(f"[{text.text_id}] {text.filename}: no citations extracted")
            skipped += 1
            continue

        # Sample for display
        sample = [(pos, cit) for pos, cit in sorted(cmap.items()) if cit][:3]
        has_cit = sum(1 for c in cmap.values() if c)
        print(f"[{text.text_id}] {text.filename}: {has_cit}/{len(cmap)} tokens have citations  eg. {sample}")

        if not dry_run:
            # Bulk-update each unique citation value at once
            from collections import defaultdict
            by_cit: dict = defaultdict(list)
            for pos, cit in cmap.items():
                by_cit[cit].append(pos)

            for cit, positions in by_cit.items():
                db.execute(
                    sa_update(Token)
                    .where(Token.text_id == text.text_id)
                    .where(Token.position.in_(positions))
                    .values(citation=cit)
                )
            db.commit()

        ok += 1

    db.close()
    print(f"\nDone. updated={ok}  skipped={skipped}  failed={failed}" +
          (" (dry run)" if dry_run else ""))


if __name__ == "__main__":
    main()
