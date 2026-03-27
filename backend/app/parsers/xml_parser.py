"""
XML-TEI parsers for different corpus formats
Handles Format 1 (CATTEX), Format 2 (TXM), Format 3 (PRESTO)
"""
import xml.etree.ElementTree as ET
from typing import List, Tuple, Optional
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
    citation: Optional[str] = None  # Line number or manuscript reference


class XMLParser:
    """Base class for XML-TEI parsing"""

    TEI_NS = '{http://www.tei-c.org/ns/1.0}'
    TXM_NS = '{http://textometrie.org/1.0}'

    @classmethod
    def detect_format(cls, root: ET.Element) -> str:
        """
        Detect which format the XML file uses

        Returns:
            'format1', 'format2', or 'format3'
        """
        # Find first <w> element (with or without namespace)
        w_elem = root.find(f'.//{cls.TEI_NS}w')
        if w_elem is None:
            w_elem = root.find('.//w')

        if w_elem is None:
            raise ValueError("No <w> elements found in XML file")

        # Format 2: has <txm:form> children
        txm_form = w_elem.find(f'{cls.TXM_NS}form')
        if txm_form is not None:
            return 'format2'

        # Format 1: has 'ana' attribute with # values
        if 'ana' in w_elem.attrib and '#' in w_elem.get('ana', ''):
            return 'format1'

        # Format 3: has 'pos' attribute (PRESTO)
        if 'pos' in w_elem.attrib:
            return 'format3'

        # Default to format1
        return 'format1'

    @classmethod
    def parse_file(cls, filepath: str) -> Tuple[str, List[ParsedToken]]:
        """
        Parse an XML-TEI file and extract tokens

        Returns:
            (format_type, list of ParsedToken)
        """
        tree = ET.parse(filepath)
        root = tree.getroot()

        # Detect format
        format_type = cls.detect_format(root)

        # Find text body
        body = root.find(f'.//{cls.TEI_NS}body')
        if body is None:
            body = root.find('.//body')

        if body is None:
            raise ValueError("No <body> element found in XML file")

        # Parse based on format (pass entire body to track line breaks)
        if format_type == 'format1':
            tokens = cls._parse_format1(body)
        elif format_type == 'format2':
            tokens = cls._parse_format2(body)
        elif format_type == 'format3':
            tokens = cls._parse_format3(body)
        else:
            raise ValueError(f"Unknown format: {format_type}")

        return format_type, tokens

    @classmethod
    def _parse_format1(cls, body: ET.Element) -> List[ParsedToken]:
        """
        Parse Format 1: CATTEX
        <w type="NOMcom" lemma="mai" ana="#...">mai</w>
        Tracks <lb n="X"/> for line numbers
        """
        tokens = []
        position = 0
        current_line = None

        # Find all <w> and <lb> elements in document order
        for elem in body.iter():
            # Check for line break
            if elem.tag == f'{cls.TEI_NS}lb' or elem.tag == 'lb':
                line_n = elem.get('n')
                if line_n:
                    current_line = line_n.strip()

            # Check for word token
            elif elem.tag == f'{cls.TEI_NS}w' or elem.tag == 'w':
                token_text = elem.text
                if not token_text:
                    continue

                token_text = token_text.strip()
                if not token_text:
                    continue

                lemma = elem.get('lemma', '').strip()
                if not lemma:
                    continue

                cattex_pos = elem.get('type', '').strip()

                # Convert CATTEX to UD
                ud_pos = CATTEX_TO_UD.get(cattex_pos, 'X')

                raw_lemma = lemma.lower()
                tokens.append(ParsedToken(
                    position=position,
                    token=token_text,
                    lemma=raw_lemma,
                    lemma_dmf=normalize_lemma(raw_lemma),
                    pos=ud_pos,
                    citation=current_line
                ))

                position += 1

        return tokens

    @classmethod
    def _parse_format2(cls, body: ET.Element) -> List[ParsedToken]:
        """
        Parse Format 2: TXM
        <w id="...">
            <txm:form>Mur</txm:form>
            <txm:ana type="#lemma">|mur|</txm:ana>
            <txm:ana type="#ud-pos">NOUN</txm:ana>
        </w>
        Tracks <lb n="X"> for line numbers
        """
        tokens = []
        position = 0
        current_line = None

        # Find all <w> and <lb> elements in document order
        for elem in body.iter():
            # Check for line break
            if elem.tag == f'{cls.TEI_NS}lb' or elem.tag == 'lb':
                line_n = elem.get('n')
                if line_n:
                    current_line = line_n.strip()

            # Check for word token
            elif elem.tag == f'{cls.TEI_NS}w' or elem.tag == 'w':
                # Extract form
                form_elem = elem.find(f'{cls.TXM_NS}form')
                if form_elem is None or not form_elem.text:
                    continue

                token_text = form_elem.text.strip()
                if not token_text:
                    continue

                # Extract lemma and UD POS from <txm:ana> elements
                lemma = ''
                ud_pos = 'X'

                for ana in elem.findall(f'{cls.TXM_NS}ana'):
                    ana_type = ana.get('type', '')

                    if ana_type == '#lemma':
                        # Lemma format: |mur|
                        lemma_text = ana.text or ''
                        lemma = lemma_text.strip('|').strip()

                    elif ana_type == '#ud-pos':
                        ud_pos = (ana.text or 'X').strip()

                if not lemma:
                    continue

                raw_lemma = lemma.lower()
                tokens.append(ParsedToken(
                    position=position,
                    token=token_text,
                    lemma=raw_lemma,
                    lemma_dmf=normalize_lemma(raw_lemma),
                    pos=ud_pos,
                    citation=current_line
                ))

                position += 1

        return tokens

    @classmethod
    def _parse_format3(cls, body: ET.Element) -> List[ParsedToken]:
        """
        Parse Format 3: PRESTO
        <w lemma="POUR" pos="S" n="...">pour</w>
        Also handles <choice><orig>ſ</orig><reg>s</reg></choice> patterns
        Tracks <lb facs="#facs_X_rYlZ"/> for manuscript references
        """
        tokens = []
        position = 0
        current_citation = None

        # Find all <w> and <lb> elements in document order
        for elem in body.iter():
            # Check for line break
            if elem.tag == f'{cls.TEI_NS}lb' or elem.tag == 'lb':
                # Extract manuscript reference from facs attribute
                # Format: facs="#facs_1_r1l8" -> extract "1_r1l8"
                facs = elem.get('facs')
                if facs:
                    # Remove "#facs_" prefix if present
                    if facs.startswith('#facs_'):
                        current_citation = facs[6:]  # Remove "#facs_"
                    else:
                        current_citation = facs.strip('#')

            # Check for word token (skip if it's inside another <w> - for nested lb)
            elif elem.tag == f'{cls.TEI_NS}w' or elem.tag == 'w':
                # Handle text content (may include <choice> elements)
                token_text = cls._extract_text(elem)
                if not token_text:
                    continue

                lemma = elem.get('lemma', '').strip()
                if not lemma:
                    continue

                presto_pos = elem.get('pos', '').strip()

                # Convert PRESTO to UD
                ud_pos = PRESTO_TO_UD.get(presto_pos, 'X')

                raw_lemma = lemma.lower()
                tokens.append(ParsedToken(
                    position=position,
                    token=token_text,
                    lemma=raw_lemma,
                    lemma_dmf=normalize_lemma(raw_lemma),
                    pos=ud_pos,
                    citation=current_citation
                ))

                position += 1

        return tokens

    @classmethod
    def _extract_text(cls, elem: ET.Element) -> str:
        """
        Extract text from element, handling <choice> patterns

        For <choice><orig>ſ</orig><reg>s</reg></choice>, prefers <reg>
        """
        # Direct text
        if elem.text and elem.text.strip():
            return elem.text.strip()

        # Check for <choice> pattern
        choice = elem.find('.//choice')
        if choice is not None:
            # Prefer regularized form
            reg = choice.find('reg')
            if reg is not None and reg.text:
                return reg.text.strip()

            # Fall back to original
            orig = choice.find('orig')
            if orig is not None and orig.text:
                return orig.text.strip()

        # Get all text content
        text = ''.join(elem.itertext()).strip()
        return text if text else ''
