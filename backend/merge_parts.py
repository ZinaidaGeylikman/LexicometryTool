"""
Merge multi-part texts into single records in the LogoScope database.
Run from backend/:  python3 merge_parts.py [--dry-run]
"""
import sys
import re
import logging
logging.disable(logging.CRITICAL)

from sqlalchemy import func, update as sa_update
from app.core.database import SessionLocal
from app.models import Token, Text

dry_run = "--dry-run" in sys.argv

# Groups to merge: (base_pattern, title, [filenames in order])
MERGE_GROUPS = [
    ("Berin",      "Roman de Berinus",                     ["Berin1.xml", "Berin2.xml"]),
    ("DialGreg",   "Li Dialoge Gregoire lo Pape",          ["DialGreg1.xml", "DialGreg2.xml"]),
    ("aliscans",   "Aliscans",                             ["aliscans1.xml", "aliscans2.xml"]),
    ("baye",       "Journal",                              ["baye1.xml", "baye2.xml"]),
    ("commyn",     "Mémoires",                             ["commyn1.xml", "commyn2.xml", "commyn3.xml",
                                                            "commyn4.xml", "commyn5.xml", "commyn6.xml",
                                                            "commyn7.xml", "commyn8.xml"]),
    ("eneas",      "Eneas",                                ["eneas1.xml", "eneas2.xml"]),
    ("jouvencel",  "Le Jouvencel",                         ["jouvencel1.xml", "jouvencel2.xml"]),
    ("quenouilles","Les Evangiles des Quenouilles",        ["quenouilles1.xml", "quenouilles2.xml"]),
    ("rosem",      "Roman de la Rose",                     ["rosem1.xml", "rosem2.xml", "rosem3.xml"]),
    ("thebes",     "Roman de Thèbes",                      ["thebes1.xml", "thebes2.xml"]),
]


def merge_group(db, title, filenames):
    # Load text records in order
    parts = []
    for fname in filenames:
        t = db.query(Text).filter(Text.filename == fname).first()
        if t is None:
            print(f"  WARNING: {fname} not found in DB, skipping group")
            return False
        parts.append(t)

    primary = parts[0]
    secondaries = parts[1:]

    total_tokens = db.query(func.count(Token.token_id)).filter(Token.text_id == primary.text_id).scalar()
    max_pos = db.query(func.max(Token.position)).filter(Token.text_id == primary.text_id).scalar() or -1

    print(f"  Primary: {primary.filename} ({total_tokens} tokens, positions 0–{max_pos})")

    for sec in secondaries:
        part_count = db.query(func.count(Token.token_id)).filter(Token.text_id == sec.text_id).scalar()
        offset = max_pos + 1
        print(f"  + {sec.filename} ({part_count} tokens, offset +{offset})")

        if not dry_run:
            db.execute(
                sa_update(Token)
                .where(Token.text_id == sec.text_id)
                .values(text_id=primary.text_id, position=Token.position + offset)
            )
            db.flush()
            db.delete(sec)
            db.flush()

        total_tokens += part_count
        max_pos += part_count

    # Use best period_start: max across parts (avoids obvious errors like 1275 for Commynes)
    all_starts = [t.period_start for t in parts if t.period_start]
    all_ends   = [t.period_end   for t in parts if t.period_end]
    best_start = max(all_starts) if all_starts else primary.period_start
    best_end   = max(all_ends)   if all_ends   else primary.period_end

    print(f"  -> title='{title}', tokens={total_tokens}, period={best_start}–{best_end}")

    if not dry_run:
        primary.title        = title
        primary.token_count  = total_tokens
        primary.period_start = best_start
        primary.period_end   = best_end
        db.commit()

    return True


def main():
    db = SessionLocal()
    ok = failed = 0

    for base, title, filenames in MERGE_GROUPS:
        print(f"\n[{title}]")
        if merge_group(db, title, filenames):
            ok += 1
        else:
            failed += 1

    db.close()
    print(f"\nDone. merged={ok}  failed={failed}" + (" (dry run)" if dry_run else ""))


if __name__ == "__main__":
    main()
