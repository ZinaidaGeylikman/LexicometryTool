#!/usr/bin/env python3
"""
Re-run lemma normalization on all existing tokens.

Run this after updating lemma_normalizer.py or lemma_normalizations.json
to apply the new rules to already-loaded texts.

Usage:
    cd backend
    ../venv/bin/python3 renormalize_lemmas.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.models.corpus import Token
from app.parsers.lemma_normalizer import normalize_lemma, reload_manual_map


def main():
    reload_manual_map()
    db = SessionLocal()
    try:
        # Compute new DMF form for every distinct source lemma
        distinct = db.query(Token.lemma).distinct().all()
        print(f"Processing {len(distinct)} distinct lemmas...")

        total_changed = 0
        for (lemma,) in distinct:
            new_dmf = normalize_lemma(lemma)
            count = (
                db.query(Token)
                .filter(Token.lemma == lemma, Token.lemma_dmf != new_dmf)
                .update({Token.lemma_dmf: new_dmf}, synchronize_session=False)
            )
            if count:
                print(f"  {lemma!r:30s} → {new_dmf!r}  ({count} tokens)")
                total_changed += count

        db.commit()
        print(f"\nDone. {total_changed} tokens updated.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
