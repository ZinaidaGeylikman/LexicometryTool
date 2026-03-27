"""
POS tag mappings to Universal Dependencies
Based on CATTEX2009 and PRESTO tagsets
"""

# CATTEX to UD mapping (Format 1)
# CATTEX uses combined CATEG+TYPE format (e.g., "NOMcom", "VERcjg")
CATTEX_TO_UD = {
    # VER - Verbs
    'VERcjg': 'VERB',      # Conjugated verb
    'VERinf': 'VERB',      # Infinitive
    'VERppe': 'VERB',      # Past participle
    'VERppa': 'VERB',      # Present participle

    # NOM - Nouns
    'NOMcom': 'NOUN',      # Common noun
    'NOMpro': 'PROPN',     # Proper noun

    # ADJ - Adjectives
    'ADJqua': 'ADJ',       # Qualificative adjective
    'ADJind': 'DET',       # Indefinite (functions as determiner)
    'ADJcar': 'NUM',       # Cardinal number
    'ADJord': 'NUM',       # Ordinal number
    'ADJpos': 'ADJ',       # Possessive adjective

    # PRO - Pronouns
    'PROper': 'PRON',      # Personal pronoun
    'PROimp': 'PRON',      # Impersonal pronoun
    'PROadv': 'PRON',      # Adverbial pronoun
    'PROpos': 'PRON',      # Possessive pronoun
    'PROdem': 'PRON',      # Demonstrative pronoun
    'PROind': 'PRON',      # Indefinite pronoun
    'PROcar': 'NUM',       # Cardinal pronoun
    'PROord': 'NUM',       # Ordinal pronoun
    'PROrel': 'PRON',      # Relative pronoun
    'PROint': 'PRON',      # Interrogative pronoun
    'PROcom': 'PRON',      # Common pronoun

    # DET - Determiners
    'DETdef': 'DET',       # Definite article
    'DETndf': 'DET',       # Indefinite article
    'DETdem': 'DET',       # Demonstrative determiner
    'DETpos': 'DET',       # Possessive determiner
    'DETind': 'DET',       # Indefinite determiner
    'DETcar': 'DET',       # Cardinal determiner
    'DETrel': 'DET',       # Relative determiner
    'DETint': 'DET',       # Interrogative determiner
    'DETcom': 'DET',       # Common determiner

    # ADV - Adverbs
    'ADVgen': 'ADV',       # General adverb
    'ADVneg': 'PART',      # Negation particle
    'ADVint': 'ADV',       # Interrogative adverb
    'ADVsub': 'ADV',       # Subordinating adverb

    # PRE - Prepositions
    'PRE': 'ADP',          # Preposition

    # CON - Conjunctions
    'CONcoo': 'CCONJ',     # Coordinating conjunction
    'CONsub': 'SCONJ',     # Subordinating conjunction

    # INJ - Interjections
    'INJ': 'INTJ',         # Interjection

    # PON - Punctuation
    'PONfbl': 'PUNCT',     # Weak punctuation
    'PONfrt': 'PUNCT',     # Strong punctuation
    'PONpga': 'PUNCT',     # Left parenthesis
    'PONpdr': 'PUNCT',     # Right parenthesis
    'PONpxx': 'PUNCT',     # Other punctuation

    # Other categories
    'ETR': 'X',            # Foreign
    'ABR': 'X',            # Abbreviation
    'RED': 'X',            # Residual
    'OUT': 'X',            # Out of vocabulary
}

# PRESTO to UD mapping (Format 3)
# Based on official PRESTO documentation (Étiquettes_Presto-2014-10-13.pdf)
PRESTO_TO_UD = {
    # N - Nouns
    'Nc': 'NOUN',          # Common noun
    'Np': 'PROPN',         # Proper noun

    # V - Verbs
    'Vu': 'AUX',           # être & avoir (auxiliaries)
    'Vuc': 'AUX',          # être & avoir conjugated
    'Vun': 'AUX',          # être & avoir infinitive
    'Vv': 'VERB',          # Other verbs
    'Vvc': 'VERB',         # Other verbs conjugated
    'Vvn': 'VERB',         # Other verbs infinitive
    'V': 'VERB',           # Verb (generic)

    # A - Adjectives
    'Ag': 'ADJ',           # General adjective
    'As': 'ADJ',           # Possessive adjective
    'Aq': 'ADJ',           # Qualifying adjective
    'A': 'ADJ',            # Adjective (generic)

    # P - Pronouns
    'Pp': 'PRON',          # Personal pronoun
    'Pd': 'PRON',          # Demonstrative pronoun
    'Pi': 'PRON',          # Indefinite pronoun
    'Ps': 'PRON',          # Possessive pronoun
    'Pt': 'PRON',          # Interrogative pronoun
    'Pr': 'PRON',          # Relative pronoun
    'Pq': 'PRON',          # Interrogative pronoun (alternate)
    'P': 'PRON',           # Pronoun (generic)

    # D - Determiners
    'Da': 'DET',           # Definite article
    'Dd': 'DET',           # Demonstrative determiner
    'Ds': 'DET',           # Possessive determiner
    'Dn': 'DET',           # Indefinite article
    'Dp': 'DET',           # Partitive article
    'Di': 'DET',           # Indefinite determiner
    'Dr': 'DET',           # Relative determiner
    'Dt': 'DET',           # Interrogative/exclamative determiner
    'D': 'DET',            # Determiner (generic)

    # G - Participle-Adjective-Gerund
    'Ga': 'VERB',          # Present participle / adjective / gerund
    'Ge': 'VERB',          # Past participle / adjective
    'G': 'VERB',           # Participle (generic)

    # R - Adverbs
    'Rg': 'ADV',           # General adverb
    'Rp': 'PART',          # Particle (ne, n')
    'Rt': 'ADV',           # Interrogative/exclamative adverb
    'Ar': 'ADV',           # Adverb (alternate notation)
    'R': 'ADV',            # Adverb (generic)

    # S - Prepositions/Adpositions
    'S': 'ADP',            # Preposition

    # C - Conjunctions
    'Cc': 'CCONJ',         # Coordinating conjunction
    'Cs': 'SCONJ',         # Subordinating conjunction
    'C': 'CCONJ',          # Conjunction (generic)

    # M - Numerals
    'Mc': 'NUM',           # Cardinal number
    'Mo': 'NUM',           # Ordinal number
    'M': 'NUM',            # Numeral (generic)

    # I - Interjections
    'I': 'INTJ',           # Interjection

    # F - Punctuation (from French "Fort/Faible")
    'Fs': 'PUNCT',         # Strong punctuation (. ! ?)
    'Fw': 'PUNCT',         # Weak punctuation (, : ;)
    'Fo': 'PUNCT',         # Other punctuation (- () [])
    'F': 'PUNCT',          # Punctuation (generic)

    # X - Residual
    'Xa': 'X',             # Abbreviation
    'Xe': 'X',             # Foreign word
    'Xs': 'SYM',           # Symbol
    'Xp': 'X',             # Prefix
    'Xi': 'X',             # Intercalated consonant
    'X': 'X',              # Unknown
}


def map_pos_to_ud(pos_tag: str, tagset: str = 'auto') -> str:
    """
    Map a POS tag to Universal Dependencies

    Args:
        pos_tag: The original POS tag
        tagset: 'cattex', 'presto', or 'auto' (auto-detect)

    Returns:
        UD POS tag, or 'X' if unknown
    """
    if tagset == 'cattex' or (tagset == 'auto' and len(pos_tag) >= 3 and pos_tag[:3].isupper()):
        return CATTEX_TO_UD.get(pos_tag, 'X')
    elif tagset == 'presto' or tagset == 'auto':
        return PRESTO_TO_UD.get(pos_tag, 'X')
    else:
        return 'X'
