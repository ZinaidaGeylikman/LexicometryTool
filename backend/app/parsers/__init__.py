"""
XML parsers for different corpus formats
"""
from .xml_parser import XMLParser, ParsedToken
from .pos_mappings import CATTEX_TO_UD, PRESTO_TO_UD, map_pos_to_ud
from .lemma_normalizer import normalize_lemma, reload_manual_map

__all__ = ["XMLParser", "ParsedToken", "CATTEX_TO_UD", "PRESTO_TO_UD", "map_pos_to_ud",
           "normalize_lemma", "reload_manual_map"]
