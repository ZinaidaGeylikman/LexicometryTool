"""
Extract metadata from TEI headers
"""
import xml.etree.ElementTree as ET
from typing import Optional, Tuple
from dataclasses import dataclass


@dataclass
class TEIMetadata:
    """Metadata extracted from TEI header"""
    title: Optional[str] = None
    author: Optional[str] = None
    header_meta: Optional[dict] = None  # full structured header info
    # Composition dates (period_start/period_end kept as aliases for backward compat)
    period_start: Optional[int] = None
    period_end: Optional[int] = None
    # Manuscript dates
    ms_date_start: Optional[int] = None
    ms_date_end: Optional[int] = None


class TEIMetadataExtractor:
    """Extract metadata from TEI headers"""

    TEI_NS = '{http://www.tei-c.org/ns/1.0}'

    @classmethod
    def extract_metadata(cls, filepath: str) -> TEIMetadata:
        """
        Extract metadata from TEI header.

        Composition dates: from <creation> element, or <bibl> outside <msDesc>.
        Manuscript dates:  from <msDesc> subtree (preferably <origin>).
        """
        tree = ET.parse(filepath)
        root = tree.getroot()

        metadata = TEIMetadata()

        tei_header = root.find(f'.//{cls.TEI_NS}teiHeader')
        if tei_header is None:
            tei_header = root.find('.//teiHeader')
        if tei_header is None:
            return metadata

        metadata.title = cls._extract_title(tei_header)
        metadata.author = cls._extract_author(tei_header)
        metadata.header_meta = cls._extract_header_meta(tei_header)

        comp_start, comp_end = cls._extract_composition_dates(tei_header)
        metadata.period_start = comp_start
        metadata.period_end = comp_end

        ms_start, ms_end = cls._extract_manuscript_dates(tei_header)
        metadata.ms_date_start = ms_start
        metadata.ms_date_end = ms_end

        return metadata

    # ------------------------------------------------------------------
    # Title
    # ------------------------------------------------------------------

    @classmethod
    def _extract_title(cls, tei_header: ET.Element) -> Optional[str]:
        title_elem = tei_header.find(f'.//{cls.TEI_NS}titleStmt/{cls.TEI_NS}title')
        if title_elem is None:
            title_elem = tei_header.find('.//titleStmt/title')
        if title_elem is not None and title_elem.text:
            return title_elem.text.strip()
        return None

    @classmethod
    def _extract_author(cls, tei_header: ET.Element) -> Optional[str]:
        for path in [
            f'.//{cls.TEI_NS}titleStmt/{cls.TEI_NS}author',
            './/titleStmt/author',
            f'.//{cls.TEI_NS}titleStmt/{cls.TEI_NS}persName[@role="author"]',
            './/titleStmt/persName[@role="author"]',
        ]:
            elem = tei_header.find(path)
            if elem is not None:
                text = "".join(elem.itertext()).strip()
                if text:
                    return text
        return None

    @classmethod
    def _extract_header_meta(cls, tei_header: ET.Element) -> dict:
        """Extract structured attribution/credit info from the TEI header."""
        meta = {}
        ns = cls.TEI_NS

        def txt(el):
            return "".join(el.itertext()).strip() if el is not None else None

        # Editor
        for path in [f'.//{ns}titleStmt/{ns}editor', './/titleStmt/editor']:
            el = tei_header.find(path)
            if el is not None:
                v = txt(el)
                if v:
                    meta['editor'] = v
                    break

        # Funder
        for path in [f'.//{ns}titleStmt/{ns}funder', './/titleStmt/funder']:
            el = tei_header.find(path)
            if el is not None:
                v = txt(el)
                if v:
                    meta['funder'] = v
                    break

        # respStmt entries (role → names), grouped by role
        resp_entries = []
        seen_roles = {}
        for path in [f'.//{ns}editionStmt/{ns}respStmt', './/editionStmt/respStmt']:
            for rs in tei_header.findall(path):
                resp_el = rs.find(f'{ns}resp') or rs.find('resp')
                role = txt(resp_el) if resp_el is not None else None
                # Support both <name> (BFM) and <persName> (MICLE)
                name_elems = (list(rs.findall(f'{ns}name')) or list(rs.findall('name')) or
                              list(rs.findall(f'{ns}persName')) or list(rs.findall('persName')))
                names = [txt(n) for n in name_elems if txt(n)]
                if role and names:
                    if role not in seen_roles:
                        seen_roles[role] = len(resp_entries)
                        resp_entries.append({'role': role, 'names': names})
                    else:
                        resp_entries[seen_roles[role]]['names'].extend(names)
        if resp_entries:
            meta['contributors'] = resp_entries

        # Publisher
        for path in [f'.//{ns}publicationStmt/{ns}publisher', './/publicationStmt/publisher']:
            el = tei_header.find(path)
            if el is not None:
                v = txt(el)
                if v:
                    meta['publisher'] = v
                    break

        # Identifiers (idno)
        for path in [f'.//{ns}publicationStmt/{ns}idno', './/publicationStmt/idno']:
            for idno in tei_header.findall(path):
                id_type = idno.get('type', '')
                v = txt(idno)
                if v and id_type:
                    meta[f'idno_{id_type}'] = v

        # How-to-cite
        for path in [
            f'.//{ns}availability//{ns}ab[@type="how_to_cite"]/{ns}bibl',
            './/availability//ab/bibl',
        ]:
            el = tei_header.find(path)
            if el is not None:
                v = txt(el)
                if v:
                    meta['citation'] = v
                    break

        return meta

    # ------------------------------------------------------------------
    # Composition dates
    # ------------------------------------------------------------------

    @classmethod
    def _extract_composition_dates(cls, tei_header: ET.Element) -> Tuple[Optional[int], Optional[int]]:
        """
        Priority:
        1. <creation> element (under profileDesc or anywhere in header)
        2. <bibl> elements under <sourceDesc> that are NOT inside <msDesc>
        """
        # 1. <creation>
        for ns in [cls.TEI_NS, '']:
            creation = tei_header.find(f'.//{ns}creation')
            if creation is not None:
                result = cls._subtree_date_range(creation)
                if result != (None, None):
                    return result

        # 2. <bibl> in sourceDesc (skip anything inside msDesc)
        for ns in [cls.TEI_NS, '']:
            source_desc = tei_header.find(f'.//{ns}sourceDesc')
            if source_desc is None:
                continue
            ms_desc = source_desc.find(f'.//{ns}msDesc')
            if ms_desc is None:
                ms_desc = source_desc.find('.//msDesc')

            for bibl in (list(source_desc.findall(f'.//{ns}bibl')) +
                         list(source_desc.findall('.//bibl'))):
                if ms_desc is not None and cls._is_descendant(bibl, ms_desc):
                    continue
                result = cls._subtree_date_range(bibl)
                if result != (None, None):
                    return result

        return None, None

    # ------------------------------------------------------------------
    # Manuscript dates
    # ------------------------------------------------------------------

    @classmethod
    def _extract_manuscript_dates(cls, tei_header: ET.Element) -> Tuple[Optional[int], Optional[int]]:
        """
        Extract from <msDesc> subtree; prefer <origin>, fall back to whole msDesc.
        """
        for ns in [cls.TEI_NS, '']:
            ms_desc = tei_header.find(f'.//{ns}msDesc')
            if ms_desc is None:
                continue
            origin = ms_desc.find(f'.//{ns}origin')
            if origin is None:
                origin = ms_desc.find('.//origin')
            if origin is not None:
                result = cls._subtree_date_range(origin)
                if result != (None, None):
                    return result
            result = cls._subtree_date_range(ms_desc)
            if result != (None, None):
                return result

        return None, None

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @classmethod
    def _subtree_date_range(cls, element: ET.Element) -> Tuple[Optional[int], Optional[int]]:
        """Min notBefore / max notAfter across all date/origDate in the subtree."""
        s_min: Optional[int] = None
        e_max: Optional[int] = None

        candidates = [element]
        for ns in [cls.TEI_NS, '']:
            candidates += list(element.findall(f'.//{ns}date'))
            candidates += list(element.findall(f'.//{ns}origDate'))

        for elem in candidates:
            s, e = cls._parse_date_attrs(elem)
            if s is not None and (s_min is None or s < s_min):
                s_min = s
            if e is not None and (e_max is None or e > e_max):
                e_max = e

        return s_min, e_max

    @classmethod
    def _parse_date_attrs(cls, elem: ET.Element) -> Tuple[Optional[int], Optional[int]]:
        """Extract (start_year, end_year) from a single element's attributes."""
        start: Optional[int] = None
        end: Optional[int] = None

        nb = elem.get('notBefore')
        na = elem.get('notAfter')
        when = elem.get('when')

        if nb:
            try:
                start = int(nb[:4])
            except (ValueError, TypeError):
                pass
        if na:
            try:
                end = int(na[:4])
            except (ValueError, TypeError):
                pass
        if when and start is None and end is None:
            try:
                y = int(when[:4])
                start = end = y
            except (ValueError, TypeError):
                pass

        return start, end

    @staticmethod
    def _is_descendant(node: ET.Element, ancestor: ET.Element) -> bool:
        """Return True if node is a descendant of ancestor."""
        return any(child is node for child in ancestor.iter())
