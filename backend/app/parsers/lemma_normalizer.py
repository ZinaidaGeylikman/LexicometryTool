"""
Lemma normalization: TL (Tobler-Lommatzsch) → DMF (Dictionnaire du Moyen Français)

Three-step process:
  1. Manual table (lemma_normalizations.json) — checked first; handles cases where
     automatic stripping is insufficient (e.g. röine→reine, pöoir→pouvoir,
     estre→être).
  2. CATTEX homograph digit stripping — removes trailing digit suffixes used by
     CATTEX to distinguish homographs (e.g. estre1→estre, roi2→roi, avoir1→avoir).
     After stripping, the manual table is consulted again for the base form.
  3. TL hiatus-stripping algorithm — strips diaeresis from the FIRST vowel of a
     hiatus pair when preceded by a consonant (or word boundary):
       röine → roine,  vëoir → veoir,  crïer → crier
     Preserves legitimate French diaeresis on the SECOND vowel of a pair:
       haïr, ouïr, aïeul, noël  (unchanged).
"""

import json
import os
import re
from functools import lru_cache

# Vowels used for the positional test
_VOWELS = frozenset("aeiouàâäéèêëîïôùûüœæ")

# Diacriticized vowels that TL uses as hiatus markers → their plain equivalents
_TL_TO_PLAIN = {"ä": "a", "ë": "e", "ï": "i", "ö": "o", "ü": "u"}

_MANUAL_MAP: dict[str, str] | None = None
_MAP_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "lemma_normalizations.json")


def _load_manual_map() -> dict[str, str]:
    global _MANUAL_MAP
    if _MANUAL_MAP is None:
        try:
            with open(os.path.normpath(_MAP_PATH), encoding="utf-8") as f:
                raw = json.load(f)
            # Drop comment keys
            _MANUAL_MAP = {k: v for k, v in raw.items() if not k.startswith("_")}
        except FileNotFoundError:
            _MANUAL_MAP = {}
    return _MANUAL_MAP


def _strip_tl_hiatus(lemma: str) -> str:
    """
    Strip TL hiatus diacritics from a lemma.

    Rule: if a diacriticized vowel (ä ë ï ö ü) is:
      - preceded by a consonant (or is at the start of the word), AND
      - followed by another vowel
    then it is a TL hiatus marker → replace with its plain equivalent.

    Otherwise (preceded by a vowel, or not followed by a vowel) → keep as-is.
    This correctly preserves: haïr, ouïr, aïeul, noël, neïs, anseïs …
    """
    if not any(c in _TL_TO_PLAIN for c in lemma):
        return lemma  # fast path: nothing to do

    chars = list(lemma)
    result = []
    for i, c in enumerate(chars):
        if c in _TL_TO_PLAIN:
            prev = chars[i - 1] if i > 0 else ""
            nxt = chars[i + 1] if i + 1 < len(chars) else ""
            prev_is_consonant = (i == 0) or (prev not in _VOWELS)
            if prev_is_consonant and nxt in _VOWELS:
                result.append(_TL_TO_PLAIN[c])
            else:
                result.append(c)
        else:
            result.append(c)
    return "".join(result)


def normalize_lemma(lemma: str) -> str:
    """
    Return the DMF-normalized form of a lemma.

    Priority:
      1. Manual mapping table — exact form (e.g. "röine" → "reine")
      2. Strip trailing CATTEX homograph digits (e.g. "estre1" → "estre")
      3. Manual mapping table — digit-stripped base form (e.g. "estre" → "être")
      4. TL hiatus-stripping algorithm on base form
      5. Base form unchanged
    """
    if not lemma:
        return lemma
    manual = _load_manual_map()
    if lemma in manual:
        return manual[lemma]
    # Strip trailing CATTEX homograph numbering (e.g. estre1, roi2, avoir1).
    # Lookbehind ensures we only strip when digits follow a letter, so purely
    # numeric lemmas like "1430" (year citations) are left intact.
    base = re.sub(r'(?<=[^\W\d_])\d+$', '', lemma)
    if base != lemma:
        if base in manual:
            return manual[base]
    return _strip_tl_hiatus(base)


def reload_manual_map() -> None:
    """Force reload of the JSON table (useful after editing the file)."""
    global _MANUAL_MAP
    _MANUAL_MAP = None
    _load_manual_map()
