"""
XML-TEI parsers for different corpus formats
Handles Format 1 (CATTEX), Format 2 (TXM), Format 3 (PRESTO), Format 4 (MICLE)

Citation priority (all formats):
  1. <lb n="X">       → line number (verse, most precise)
  2. <div type="livre/book"> + <div type="chapitre/chapter">  → "l. X, ch. Y"
  3. <pb n="X">       → "p. X" (page break, prose fallback)
"""
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from .pos_mappings import CATTEX_TO_UD, PRESTO_TO_UD
from .lemma_normalizer import normalize_lemma


@dataclass
class ParsedToken:
    """Represents a parsed token before database insertion"""
    position: int
    token: str
    lemma: str       # original source lemma (TL/BFM form)
    lemma_dmf: str   # DMF-normalized lemma
    pos: str         # UD POS tag
    citation: Optional[str] = None


class XMLParser:
    TEI_NS = '{http://www.tei-c.org/ns/1.0}'
    TXM_NS = '{http://textometrie.org/1.0}'

    # ------------------------------------------------------------------ #
    # Citation helpers                                                     #
    # ------------------------------------------------------------------ #

    @classmethod
    def _build_citation(cls, ctx: dict) -> Optional[str]:
        """Build citation string from context dict. Priority: lb > div > pb."""
        if ctx.get('lb'):
            return ctx['lb']
        livre = ctx.get('livre')
        chapitre = ctx.get('chapitre')
        if livre or chapitre:
            parts = []
            if livre:
                parts.append(f'l. {livre}')
            if chapitre:
                parts.append(f'ch. {chapitre}')
            return ', '.join(parts)
        if ctx.get('pb'):
            return f"p. {ctx['pb']}"
        return None

    @classmethod
    def _update_ctx(cls, elem: ET.Element, ctx: dict) -> bool:
        """Update citation context from a structural element. Returns True if element was handled."""
        tag = elem.tag
        bare = tag.split('}')[-1] if '}' in tag else tag

        if bare == 'lb':
            n = elem.get('n')
            if n:
                ctx['lb'] = n.strip()
            return True

        if bare == 'pb':
            n = elem.get('n')
            if n:
                ctx['pb'] = n.strip()
            return True

        if bare == 'div':
            div_type = (elem.get('type') or '').lower()
            n = elem.get('n')
            if n:
                if div_type in ('livre', 'book'):
                    ctx['livre'] = n.strip()
                    ctx['chapitre'] = None   # reset chapter on new book
                elif div_type in ('chapitre', 'chapter'):
                    ctx['chapitre'] = n.strip()
            return True

        return False

    @classmethod
    def _fresh_ctx(cls) -> dict:
        return {'lb': None, 'pb': None, 'livre': None, 'chapitre': None}

    # ------------------------------------------------------------------ #
    # Format detection                                                     #
    # ------------------------------------------------------------------ #

    @classmethod
    def detect_format(cls, root: ET.Element) -> str:
        w_elem = root.find(f'.//{cls.TEI_NS}w')
        if w_elem is None:
            w_elem = root.find('.//w')
        if w_elem is None:
            raise ValueError("No <w> elements found in XML file")

        if w_elem.find(f'{cls.TXM_NS}form') is not None:
            return 'format2'
        if 'ana' in w_elem.attrib and '#' in w_elem.get('ana', ''):
            return 'format1'
        if 'udpos' in w_elem.attrib:
            return 'format4'
        if 'pos' in w_elem.attrib:
            return 'format3'
        return 'format1'

    # ------------------------------------------------------------------ #
    # Main entry point                                                     #
    # ------------------------------------------------------------------ #

    @classmethod
    def parse_file(cls, filepath: str) -> Tuple[str, List[ParsedToken]]:
        tree = ET.parse(filepath)
        root = tree.getroot()
        fmt = cls.detect_format(root)

        body = root.find(f'.//{cls.TEI_NS}body')
        if body is None:
            body = root.find('.//body')
        if body is None:
            raise ValueError("No <body> element found in XML file")

        parsers = {
            'format1': cls._parse_format1,
            'format2': cls._parse_format2,
            'format3': cls._parse_format3,
            'format4': cls._parse_format4,
        }
        return fmt, parsers[fmt](body)

    # ------------------------------------------------------------------ #
    # Citation-only re-extraction (for updating existing DB records)       #
    # ------------------------------------------------------------------ #

    @classmethod
    def extract_citation_map(cls, filepath: str) -> Dict[int, Optional[str]]:
        """
        Re-parse an XML file and return {token_position: citation_string}.
        Does NOT re-tokenise — only extracts citation context.
        Used to update the citation field on already-imported tokens.
        """
        tree = ET.parse(filepath)
        root = tree.getroot()
        fmt = cls.detect_format(root)

        body = root.find(f'.//{cls.TEI_NS}body')
        if body is None:
            body = root.find('.//body')
        if body is None:
            return {}

        if fmt == 'format3':
            return cls._citation_map_format3(body)
        else:
            return cls._citation_map_generic(body, fmt)

    @classmethod
    def _citation_map_generic(cls, body: ET.Element, fmt: str) -> Dict[int, Optional[str]]:
        """Citation map for formats 1, 2, 4 (all use the shared ctx system)."""
        ctx = cls._fresh_ctx()
        cmap: Dict[int, Optional[str]] = {}
        position = 0

        for elem in body.iter():
            bare = (elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag)

            if bare in ('lb', 'pb', 'div'):
                cls._update_ctx(elem, ctx)
                continue

            if bare == 'w':
                # For format2, skip <w> that have no <txm:form> (they won't have been tokenised)
                if fmt == 'format2':
                    form_elem = elem.find(f'{cls.TXM_NS}form')
                    if form_elem is None or not (form_elem.text or '').strip():
                        continue
                else:
                    text = cls._extract_text(elem)
                    if not text:
                        continue
                    # Format 4: skip words without lemma
                    if fmt == 'format4' and not elem.get('lemma', '').strip():
                        continue
                    # Format 1: skip words without lemma
                    if fmt == 'format1' and not elem.get('lemma', '').strip():
                        continue

                cmap[position] = cls._build_citation(ctx)
                position += 1

        return cmap

    @classmethod
    def _citation_map_format3(cls, body: ET.Element) -> Dict[int, Optional[str]]:
        """Citation map for format3 (PRESTO) — uses facs attribute on <lb>."""
        cmap: Dict[int, Optional[str]] = {}
        position = 0
        current = None

        for elem in body.iter():
            bare = (elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag)

            if bare == 'lb':
                facs = elem.get('facs')
                if facs:
                    current = facs[6:] if facs.startswith('#facs_') else facs.strip('#')

            elif bare == 'w':
                text = cls._extract_text(elem)
                if not text or not elem.get('lemma', '').strip():
                    continue
                cmap[position] = current
                position += 1

        return cmap

    # ------------------------------------------------------------------ #
    # Format parsers                                                       #
    # ------------------------------------------------------------------ #

    @classmethod
    def _parse_format1(cls, body: ET.Element) -> List[ParsedToken]:
        """CATTEX: <w type="NOMcom" lemma="mai" ana="#...">mai</w>"""
        tokens = []
        position = 0
        ctx = cls._fresh_ctx()

        for elem in body.iter():
            bare = (elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag)

            if bare in ('lb', 'pb', 'div'):
                cls._update_ctx(elem, ctx)
                continue

            if bare == 'w':
                token_text = (elem.text or '').strip()
                if not token_text:
                    continue
                lemma = elem.get('lemma', '').strip()
                if not lemma:
                    continue
                ud_pos = CATTEX_TO_UD.get(elem.get('type', '').strip(), 'X')
                raw = lemma.lower()
                tokens.append(ParsedToken(
                    position=position, token=token_text,
                    lemma=raw, lemma_dmf=normalize_lemma(raw),
                    pos=ud_pos, citation=cls._build_citation(ctx)
                ))
                position += 1

        return tokens

    @classmethod
    def _parse_format2(cls, body: ET.Element) -> List[ParsedToken]:
        """TXM: <w><txm:form>…</txm:form><txm:ana type="#lemma">…</txm:ana></w>"""
        tokens = []
        position = 0
        ctx = cls._fresh_ctx()

        for elem in body.iter():
            bare = (elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag)

            if bare in ('lb', 'pb', 'div'):
                cls._update_ctx(elem, ctx)
                continue

            if bare == 'w':
                form_elem = elem.find(f'{cls.TXM_NS}form')
                if form_elem is None or not (form_elem.text or '').strip():
                    continue
                token_text = form_elem.text.strip()

                lemma = ud_pos = ''
                ud_pos = 'X'
                for ana in elem.findall(f'{cls.TXM_NS}ana'):
                    ana_type = ana.get('type', '')
                    if ana_type == '#lemma':
                        lemma = (ana.text or '').strip('|').strip()
                    elif ana_type == '#ud-pos':
                        ud_pos = (ana.text or 'X').strip()

                if not lemma:
                    continue
                raw = lemma.lower()
                tokens.append(ParsedToken(
                    position=position, token=token_text,
                    lemma=raw, lemma_dmf=normalize_lemma(raw),
                    pos=ud_pos, citation=cls._build_citation(ctx)
                ))
                position += 1

        return tokens

    @classmethod
    def _parse_format3(cls, body: ET.Element) -> List[ParsedToken]:
        """PRESTO: <w lemma="POUR" pos="S">pour</w> with <lb facs="…"/>"""
        tokens = []
        position = 0
        current_citation = None

        for elem in body.iter():
            bare = (elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag)

            if bare == 'lb':
                facs = elem.get('facs')
                if facs:
                    current_citation = facs[6:] if facs.startswith('#facs_') else facs.strip('#')

            elif bare == 'w':
                token_text = cls._extract_text(elem)
                if not token_text:
                    continue
                lemma = elem.get('lemma', '').strip()
                if not lemma:
                    continue
                ud_pos = PRESTO_TO_UD.get(elem.get('pos', '').strip(), 'X')
                raw = lemma.lower()
                tokens.append(ParsedToken(
                    position=position, token=token_text,
                    lemma=raw, lemma_dmf=normalize_lemma(raw),
                    pos=ud_pos, citation=current_citation
                ))
                position += 1

        return tokens

    @classmethod
    def _parse_format4(cls, body: ET.Element) -> List[ParsedToken]:
        """MICLE: <w lemma="le" udpos="DET" n="1">L'</w> with <div type="livre/chapitre">"""
        tokens = []
        position = 0
        ctx = cls._fresh_ctx()

        for elem in body.iter():
            bare = (elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag)

            if bare in ('lb', 'pb', 'div'):
                cls._update_ctx(elem, ctx)
                continue

            if bare == 'w':
                token_text = cls._extract_text(elem)
                if not token_text:
                    continue
                lemma = elem.get('lemma', '').strip()
                if not lemma:
                    continue
                ud_pos = elem.get('udpos', 'X').strip().upper()
                raw = lemma.lower()
                tokens.append(ParsedToken(
                    position=position, token=token_text,
                    lemma=raw, lemma_dmf=normalize_lemma(raw),
                    pos=ud_pos, citation=cls._build_citation(ctx)
                ))
                position += 1

        return tokens

    # ------------------------------------------------------------------ #
    # Text extraction helper                                               #
    # ------------------------------------------------------------------ #

    @classmethod
    def _extract_text(cls, elem: ET.Element) -> str:
        if elem.text and elem.text.strip():
            return elem.text.strip()
        choice = elem.find('.//choice')
        if choice is not None:
            for tag in ('reg', 'orig'):
                child = choice.find(tag)
                if child is not None and child.text:
                    return child.text.strip()
        return ''.join(elem.itertext()).strip()
