"""
Query engine for corpus searches
Supports lemma, POS, sequence queries with context windows and exclusions
"""
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, not_, func, exists
from dataclasses import dataclass
from ..models import Token, Text, Dataset, DatasetToken, subcorpus_texts


@dataclass
class QueryResult:
    """Single query result with context"""
    token_id: int
    text_id: int
    text_title: str
    text_filename: str
    position: int
    token: str
    lemma: str
    pos: str
    citation: Optional[str]  # Line number or manuscript reference
    context_before: List[Dict[str, Any]]
    context_after: List[Dict[str, Any]]
    # Metadata
    domain: str
    genre: str
    period_start: int
    period_end: int


class QueryEngine:
    """Main query engine for corpus searches"""

    def __init__(self, db: Session):
        self.db = db

    def _parse_alternatives(self, value: Optional[str], uppercase: bool = False) -> List[str]:
        """Parse slash-separated alternatives: 'roi/conte/baron' -> ['roi', 'conte', 'baron']"""
        if not value:
            return []
        if uppercase:
            return [v.strip().upper() for v in value.split('/') if v.strip()]
        return [v.strip().lower() for v in value.split('/') if v.strip()]

    def _lemma_match(self, field, v: str):
        """Match v as an exact lemma or as one alternative in a pipe-separated ambiguous lemma."""
        return or_(field == v, field.like(f'{v}|%'), field.like(f'%|{v}'), field.like(f'%|{v}|%'))

    def _build_filter(
        self,
        include: Optional[str],
        exclude: Optional[str],
        field,
        match_numbered_variants: bool = False,
        match_pipe_alternatives: bool = False,
        uppercase: bool = False,
    ):
        """
        Build SQLAlchemy filter for include/exclude patterns

        Args:
            include: Values to include (e.g., "roi/conte/baron")
            exclude: Values to exclude (e.g., "le/la/les")
            field: SQLAlchemy column to filter on
            match_numbered_variants: If True, "roi" also matches "roi2", "roi3" etc.
                (handles numbered lemma conventions like CATTEX)
            uppercase: If True, values are uppercased (for POS tags)

        Returns:
            SQLAlchemy filter expression
        """
        filters = []

        # Include filter
        if include:
            values = self._parse_alternatives(include, uppercase=uppercase)
            if values:
                conditions = []
                for v in values:
                    if match_numbered_variants:
                        conditions.append(field == v)
                        conditions.append(field.op('GLOB')(v + '[0-9]'))
                        conditions.append(field.op('GLOB')(v + '[0-9][0-9]'))
                    if match_pipe_alternatives:
                        conditions.append(self._lemma_match(field, v))
                    elif not match_numbered_variants:
                        conditions.append(field == v)
                filters.append(or_(*conditions))

        # Exclude filter
        if exclude:
            values = self._parse_alternatives(exclude, uppercase=uppercase)
            if values:
                conditions = []
                for v in values:
                    if match_numbered_variants:
                        conditions.append(field != v)
                        conditions.append(not_(field.like(v + '%')))
                    if match_pipe_alternatives:
                        conditions.append(not_(self._lemma_match(field, v)))
                    elif not match_numbered_variants:
                        conditions.append(field != v)
                filters.append(and_(*conditions))

        return and_(*filters) if filters else None

    def _build_filtered_query(
        self,
        base_query,
        lemma=None, pos=None, domain=None, genre=None,
        not_lemma=None, not_pos=None, not_domain=None, not_genre=None,
        period_start=None, period_end=None, dataset_id=None,
        subcorpus_id=None, lemma_field="dmf",
        form=None, not_form=None, text_id=None,
    ):
        """Build a query with all standard filters applied (shared by query and query_count)"""
        filters = []

        # Lemma filters — use lemma_dmf (default) or source TL lemma.
        # match_numbered_variants only applies to source TL lemmas (CATTEX convention: roi2, roi3).
        lemma_col = Token.lemma_dmf if lemma_field == "dmf" else Token.lemma
        lemma_filter = self._build_filter(lemma, not_lemma, lemma_col,
                                          match_numbered_variants=(lemma_field != "dmf"),
                                          match_pipe_alternatives=True)
        if lemma_filter is not None:
            filters.append(lemma_filter)

        # Form filters (surface graphic form, case-sensitive)
        form_filter = self._build_filter(form, not_form, Token.token)
        if form_filter is not None:
            filters.append(form_filter)

        # POS filters (uppercase because DB stores NOUN, VERB, etc.)
        pos_filter = self._build_filter(pos, not_pos, Token.pos, uppercase=True)
        if pos_filter is not None:
            filters.append(pos_filter)

        # Domain filters
        domain_filter = self._build_filter(domain, not_domain, Text.domain)
        if domain_filter is not None:
            filters.append(domain_filter)

        # Genre filters
        genre_filter = self._build_filter(genre, not_genre, Text.genre)
        if genre_filter is not None:
            filters.append(genre_filter)

        # Period filters
        if period_start is not None:
            filters.append(Text.period_end >= period_start)
        if period_end is not None:
            filters.append(Text.period_start <= period_end)

        # Dataset filter — search ALL tokens within context windows, not just pivots
        if dataset_id is not None:
            # A token is "in the dataset" if its (text_id, position) falls within
            # any context window stored in dataset_tokens.
            # We use a correlated subquery via EXISTS to avoid duplicate rows.
            PivotToken = Token.__table__.alias("pivot_token")
            dataset_subq = exists().where(
                and_(
                    DatasetToken.dataset_id == dataset_id,
                    DatasetToken.token_id == PivotToken.c.token_id,
                    PivotToken.c.text_id == Token.text_id,
                    Token.position >= DatasetToken.context_start_position,
                    Token.position <= DatasetToken.context_end_position,
                )
            )
            filters.append(dataset_subq)

        # Subcorpus filter — restrict to texts in the subcorpus
        if subcorpus_id is not None:
            subcorpus_subq = exists().where(
                and_(
                    subcorpus_texts.c.subcorpus_id == subcorpus_id,
                    subcorpus_texts.c.text_id == Token.text_id,
                )
            )
            filters.append(subcorpus_subq)

        # Single text filter
        if text_id is not None:
            filters.append(Token.text_id == text_id)

        if filters:
            base_query = base_query.filter(and_(*filters))

        return base_query

    def query_count(
        self,
        lemma=None, pos=None, domain=None, genre=None,
        not_lemma=None, not_pos=None, not_domain=None, not_genre=None,
        period_start=None, period_end=None, dataset_id=None,
        subcorpus_id=None, lemma_field="dmf",
        form=None, not_form=None, text_id=None,
    ) -> int:
        """Return total count of matching tokens (for pagination)"""
        base = self.db.query(func.count(Token.token_id)).join(Text, Token.text_id == Text.text_id)
        q = self._build_filtered_query(
            base, lemma=lemma, pos=pos, domain=domain, genre=genre,
            not_lemma=not_lemma, not_pos=not_pos, not_domain=not_domain, not_genre=not_genre,
            period_start=period_start, period_end=period_end, dataset_id=dataset_id,
            subcorpus_id=subcorpus_id, lemma_field=lemma_field,
            form=form, not_form=not_form, text_id=text_id,
        )
        return q.scalar()

    def query(
        self,
        # Positive filters
        lemma: Optional[str] = None,
        pos: Optional[str] = None,
        domain: Optional[str] = None,
        genre: Optional[str] = None,
        # Negative filters
        not_lemma: Optional[str] = None,
        not_pos: Optional[str] = None,
        not_domain: Optional[str] = None,
        not_genre: Optional[str] = None,
        # Period filters
        period_start: Optional[int] = None,
        period_end: Optional[int] = None,
        # Context
        context_before: int = 0,
        context_after: int = 0,
        # Pagination
        limit: Optional[int] = None,
        offset: int = 0,
        # Dataset filter (query within a dataset)
        dataset_id: Optional[int] = None,
        # Subcorpus filter (query within a subcorpus)
        subcorpus_id: Optional[int] = None,
        # Lemma field: "dmf" (default) or "source"
        lemma_field: str = "dmf",
        # Surface form filter
        form: Optional[str] = None,
        not_form: Optional[str] = None,
        # Single text filter
        text_id: Optional[int] = None,
    ) -> List[QueryResult]:
        """
        Main query method

        Example usage:
            # Find all "roi" as NOUN, exclude "le" as DET
            results = engine.query(
                lemma="roi",
                pos="NOUN",
                not_lemma="le",
                genre="romance",
                context_before=5,
                context_after=5
            )
        """
        # Base query with filters
        base = self.db.query(Token).join(Text, Token.text_id == Text.text_id)
        query = self._build_filtered_query(
            base, lemma=lemma, pos=pos, domain=domain, genre=genre,
            not_lemma=not_lemma, not_pos=not_pos, not_domain=not_domain, not_genre=not_genre,
            period_start=period_start, period_end=period_end, dataset_id=dataset_id,
            subcorpus_id=subcorpus_id, lemma_field=lemma_field,
            form=form, not_form=not_form, text_id=text_id,
        )

        # Pagination
        if limit:
            query = query.limit(limit)
        if offset:
            query = query.offset(offset)

        # Execute query
        tokens = query.all()

        # Build results with context
        results = []
        for token in tokens:
            # Get context
            ctx_before = self._get_context(
                token.text_id,
                token.position - context_before,
                token.position - 1
            ) if context_before > 0 else []

            ctx_after = self._get_context(
                token.text_id,
                token.position + 1,
                token.position + context_after
            ) if context_after > 0 else []

            results.append(QueryResult(
                token_id=token.token_id,
                text_id=token.text_id,
                text_title=token.text.title or token.text.filename,
                text_filename=token.text.filename,
                position=token.position,
                token=token.token,
                lemma=token.lemma,
                pos=token.pos,
                citation=token.citation,
                context_before=ctx_before,
                context_after=ctx_after,
                domain=token.text.domain,
                genre=token.text.genre,
                period_start=token.text.period_start,
                period_end=token.text.period_end,
            ))

        return results

    def _get_context(
        self,
        text_id: int,
        start_position: int,
        end_position: int
    ) -> List[Dict[str, Any]]:
        """Get context tokens for a given position range"""
        if start_position < 0:
            start_position = 0

        tokens = self.db.query(Token).filter(
            Token.text_id == text_id,
            Token.position >= start_position,
            Token.position <= end_position
        ).order_by(Token.position).all()

        return [
            {
                'position': t.position,
                'token': t.token,
                'lemma': t.lemma,
                'pos': t.pos
            }
            for t in tokens
        ]

    def query_sequence(
        self,
        pattern: List[Dict[str, str]],
        # Metadata filters
        domain: Optional[str] = None,
        genre: Optional[str] = None,
        not_domain: Optional[str] = None,
        not_genre: Optional[str] = None,
        period_start: Optional[int] = None,
        period_end: Optional[int] = None,
        # Dataset
        dataset_id: Optional[int] = None,
        # Subcorpus
        subcorpus_id: Optional[int] = None,
        # Single text
        text_id: Optional[int] = None,
        # Context
        context_before: int = 0,
        context_after: int = 0,
        # Pagination
        limit: Optional[int] = None,
        offset: int = 0,
        # Lemma field
        lemma_field: str = "dmf",
    ) -> Tuple[int, List[List[QueryResult]]]:
        """
        Query for sequences matching a pattern

        Pattern format:
            [
                {'pos': 'DET', 'not_lemma': 'le/la/les'},
                {'lemma': 'roi/comte'},
                {'pos': 'VERB', 'not_lemma': 'être/avoir'}
            ]

        Returns:
            Tuple of (total_count, paginated_results)
        """
        if not pattern:
            return 0, []

        # Get texts matching metadata filters
        text_query = self.db.query(Text.text_id)

        text_filters = []
        if domain:
            domain_vals = self._parse_alternatives(domain)
            text_filters.append(Text.domain.in_(domain_vals))
        if not_domain:
            domain_vals = self._parse_alternatives(not_domain)
            text_filters.append(not_(Text.domain.in_(domain_vals)))
        if genre:
            genre_vals = self._parse_alternatives(genre)
            text_filters.append(Text.genre.in_(genre_vals))
        if not_genre:
            genre_vals = self._parse_alternatives(not_genre)
            text_filters.append(not_(Text.genre.in_(genre_vals)))
        if period_start is not None:
            text_filters.append(Text.period_end >= period_start)
        if period_end is not None:
            text_filters.append(Text.period_start <= period_end)

        if text_filters:
            text_query = text_query.filter(and_(*text_filters))

        text_ids = [t[0] for t in text_query.all()]

        # If searching within a subcorpus, restrict to its texts
        if subcorpus_id is not None:
            sc_text_ids = set(
                t[0] for t in self.db.query(subcorpus_texts.c.text_id).filter(
                    subcorpus_texts.c.subcorpus_id == subcorpus_id
                ).all()
            )
            text_ids = [tid for tid in text_ids if tid in sc_text_ids]

        # If searching within a single text, restrict to that text
        if text_id is not None:
            text_ids = [tid for tid in text_ids if tid == text_id]

        if not text_ids:
            return 0, []

        # If searching within a dataset, get the allowed position ranges per text
        dataset_ranges = None
        if dataset_id is not None:
            dataset_ranges = {}  # {text_id: [(start, end), ...]}
            dt_rows = self.db.query(
                Token.text_id,
                DatasetToken.context_start_position,
                DatasetToken.context_end_position,
            ).join(
                Token, Token.token_id == DatasetToken.token_id
            ).filter(
                DatasetToken.dataset_id == dataset_id
            ).all()
            for tid, start, end in dt_rows:
                dataset_ranges.setdefault(tid, []).append((start, end))
            # Only scan texts that are in both the metadata filter AND the dataset
            text_ids = [tid for tid in text_ids if tid in dataset_ranges]

        # Phase 1: Fast scan — find match positions without fetching context
        # Each entry is (text_id, [start_position_indices]) — lightweight
        all_match_positions = []
        for text_id in text_ids:
            positions = self._find_sequence_positions_in_text(
                text_id, pattern,
                allowed_ranges=dataset_ranges.get(text_id) if dataset_ranges else None,
                lemma_field=lemma_field,
            )
            all_match_positions.extend(positions)

        total = len(all_match_positions)

        # Phase 2: Apply pagination to the lightweight list
        page_positions = all_match_positions[offset:offset + limit] if limit else all_match_positions[offset:]

        # Phase 3: Only build full results (with context) for the paginated page
        page_results = []
        for text_id, token_indices in page_positions:
            # Fetch the tokens for this match
            tokens = self.db.query(Token).filter(
                Token.text_id == text_id,
                Token.position.in_(token_indices)
            ).order_by(Token.position).all()

            if not tokens:
                continue

            text = tokens[0].text
            match_results = []
            for token in tokens:
                ctx_before = self._get_context(
                    text_id,
                    token.position - context_before,
                    token.position - 1
                ) if context_before > 0 else []

                ctx_after = self._get_context(
                    text_id,
                    token.position + 1,
                    token.position + context_after
                ) if context_after > 0 else []

                match_results.append(QueryResult(
                    token_id=token.token_id,
                    text_id=token.text_id,
                    text_title=text.title or text.filename,
                    text_filename=text.filename,
                    position=token.position,
                    token=token.token,
                    lemma=token.lemma,
                    pos=token.pos,
                    citation=token.citation,
                    context_before=ctx_before,
                    context_after=ctx_after,
                    domain=text.domain,
                    genre=text.genre,
                    period_start=text.period_start,
                    period_end=text.period_end,
                ))
            page_results.append(match_results)

        return total, page_results

    def _get_texts_for_sequence(
        self,
        domain=None, genre=None, not_domain=None, not_genre=None,
        period_start=None, period_end=None, subcorpus_id=None, text_id=None,
        dataset_id=None,
    ):
        """Get filtered Text objects for sequence scanning. Returns list of Text."""
        query = self.db.query(Text)
        filters = []
        if domain:
            filters.append(Text.domain.in_(self._parse_alternatives(domain)))
        if not_domain:
            filters.append(not_(Text.domain.in_(self._parse_alternatives(not_domain))))
        if genre:
            filters.append(Text.genre.in_(self._parse_alternatives(genre)))
        if not_genre:
            filters.append(not_(Text.genre.in_(self._parse_alternatives(not_genre))))
        if period_start is not None:
            filters.append(Text.period_end >= period_start)
        if period_end is not None:
            filters.append(Text.period_start <= period_end)
        if text_id is not None:
            filters.append(Text.text_id == text_id)
        if subcorpus_id is not None:
            sc_text_ids = [
                t[0] for t in self.db.query(subcorpus_texts.c.text_id).filter(
                    subcorpus_texts.c.subcorpus_id == subcorpus_id
                ).all()
            ]
            filters.append(Text.text_id.in_(sc_text_ids))
        if dataset_id is not None:
            ds_text_ids = list({
                t[0] for t in self.db.query(Token.text_id).join(
                    DatasetToken, Token.token_id == DatasetToken.token_id
                ).filter(DatasetToken.dataset_id == dataset_id).all()
            })
            filters.append(Text.text_id.in_(ds_text_ids))
        if filters:
            query = query.filter(and_(*filters))
        return query.all()

    def _get_dataset_ranges(self, dataset_id: int) -> Dict[int, list]:
        """Return {text_id: [(start, end), ...]} for tokens in a dataset."""
        dt_rows = self.db.query(
            Token.text_id,
            DatasetToken.context_start_position,
            DatasetToken.context_end_position,
        ).join(Token, Token.token_id == DatasetToken.token_id).filter(
            DatasetToken.dataset_id == dataset_id
        ).all()
        ranges: Dict[int, list] = {}
        for tid, start, end in dt_rows:
            ranges.setdefault(tid, []).append((start, end))
        return ranges

    def sequence_frequency_by_genre(
        self,
        pattern: List[Dict[str, str]],
        domain: Optional[str] = None,
        period_start: Optional[int] = None,
        period_end: Optional[int] = None,
        normalize: bool = False,
        per_n_words: int = 10000,
        subcorpus_id: Optional[int] = None,
        text_id: Optional[int] = None,
        dataset_id: Optional[int] = None,
        lemma_field: str = "dmf",
    ) -> Dict[str, float]:
        """Count sequence matches broken down by genre."""
        if not pattern:
            return {}
        dataset_ranges = self._get_dataset_ranges(dataset_id) if dataset_id is not None else None
        texts = self._get_texts_for_sequence(domain=domain, period_start=period_start, period_end=period_end, subcorpus_id=subcorpus_id, text_id=text_id, dataset_id=dataset_id)
        counts = {}
        for text in texts:
            if not text.genre:
                continue
            allowed = dataset_ranges.get(text.text_id) if dataset_ranges is not None else None
            positions = self._find_sequence_positions_in_text(text.text_id, pattern, allowed_ranges=allowed, lemma_field=lemma_field)
            counts[text.genre] = counts.get(text.genre, 0) + len(positions)

        if not normalize:
            return counts

        # Total tokens per genre
        total_query = self.db.query(
            Text.genre, func.count(Token.token_id)
        ).join(Text, Token.text_id == Text.text_id)
        if domain:
            total_query = total_query.filter(Text.domain.in_(self._parse_alternatives(domain)))
        totals = {g: t for g, t in total_query.group_by(Text.genre).all() if g}

        return {
            g: round((c / totals[g]) * per_n_words, 2)
            for g, c in counts.items()
            if g in totals and totals[g] > 0
        }

    def sequence_frequency_by_domain(
        self,
        pattern: List[Dict[str, str]],
        period_start: Optional[int] = None,
        period_end: Optional[int] = None,
        normalize: bool = False,
        per_n_words: int = 10000,
        subcorpus_id: Optional[int] = None,
        text_id: Optional[int] = None,
        dataset_id: Optional[int] = None,
        lemma_field: str = "dmf",
    ) -> Dict[str, float]:
        """Count sequence matches broken down by domain."""
        if not pattern:
            return {}
        dataset_ranges = self._get_dataset_ranges(dataset_id) if dataset_id is not None else None
        texts = self._get_texts_for_sequence(period_start=period_start, period_end=period_end, subcorpus_id=subcorpus_id, text_id=text_id, dataset_id=dataset_id)
        counts = {}
        for text in texts:
            if not text.domain:
                continue
            allowed = dataset_ranges.get(text.text_id) if dataset_ranges is not None else None
            positions = self._find_sequence_positions_in_text(text.text_id, pattern, allowed_ranges=allowed, lemma_field=lemma_field)
            counts[text.domain] = counts.get(text.domain, 0) + len(positions)

        if not normalize:
            return counts

        total_query = self.db.query(
            Text.domain, func.count(Token.token_id)
        ).join(Text, Token.text_id == Text.text_id).group_by(Text.domain)
        totals = {d: t for d, t in total_query.all() if d}

        return {
            d: round((c / totals[d]) * per_n_words, 2)
            for d, c in counts.items()
            if d in totals and totals[d] > 0
        }

    def sequence_frequency_by_period(
        self,
        pattern: List[Dict[str, str]],
        bin_size: int = 50,
        domain: Optional[str] = None,
        genre: Optional[str] = None,
        subcorpus_id: Optional[int] = None,
        text_id: Optional[int] = None,
        dataset_id: Optional[int] = None,
        date_source: str = "composition",
        lemma_field: str = "dmf",
    ) -> Dict[int, int]:
        """Count sequence matches over time, binned by period using midpoint pivot."""
        if not pattern:
            return {}
        dataset_ranges = self._get_dataset_ranges(dataset_id) if dataset_id is not None else None
        texts = self._get_texts_for_sequence(domain=domain, genre=genre, subcorpus_id=subcorpus_id, text_id=text_id, dataset_id=dataset_id)
        period_counts = {}
        for text in texts:
            if date_source == "manuscript" and (text.ms_date_start is not None or text.ms_date_end is not None):
                d_start = text.ms_date_start if text.ms_date_start is not None else text.period_start
                d_end = text.ms_date_end if text.ms_date_end is not None else text.period_end
            else:
                d_start, d_end = text.period_start, text.period_end
            if d_start is None:
                continue
            allowed = dataset_ranges.get(text.text_id) if dataset_ranges is not None else None
            positions = self._find_sequence_positions_in_text(text.text_id, pattern, allowed_ranges=allowed, lemma_field=lemma_field)
            pivot = round((d_start + (d_end if d_end is not None else d_start)) / 2)
            bin_start = (pivot // bin_size) * bin_size
            period_counts[bin_start] = period_counts.get(bin_start, 0) + len(positions)

        return dict(sorted(period_counts.items()))

    def _find_sequence_positions_in_text(
        self,
        text_id: int,
        pattern: List[Dict[str, str]],
        allowed_ranges: Optional[List[Tuple[int, int]]] = None,
        lemma_field: str = "dmf",
    ) -> List[Tuple[int, List[int]]]:
        """Find matching sequence positions in a text (fast, no context fetching).

        Uses lightweight tuples instead of ORM objects for speed.
        If allowed_ranges is provided, only matches whose positions all fall
        within at least one range are returned (for dataset filtering).
        Returns list of (text_id, [position1, position2, ...]) tuples.
        """
        # Fetch position, both lemma columns, pos, and surface form as lightweight tuples
        rows = self.db.query(
            Token.position, Token.lemma, Token.lemma_dmf, Token.pos, Token.token
        ).filter(
            Token.text_id == text_id
        ).order_by(Token.position).all()

        pattern_len = len(pattern)
        matches = []

        # Pre-compile pattern criteria into sets for fast lookup
        compiled = []
        for criteria in pattern:
            c = {}
            if 'lemma' in criteria:
                c['lemma'] = set(self._parse_alternatives(criteria['lemma']))
            if 'pos' in criteria:
                c['pos'] = set(self._parse_alternatives(criteria['pos'], uppercase=True))
            if 'not_lemma' in criteria:
                c['not_lemma'] = set(self._parse_alternatives(criteria['not_lemma']))
            if 'not_pos' in criteria:
                c['not_pos'] = set(self._parse_alternatives(criteria['not_pos'], uppercase=True))
            if 'form' in criteria:
                c['form'] = set(self._parse_alternatives(criteria['form']))
            if 'not_form' in criteria:
                c['not_form'] = set(self._parse_alternatives(criteria['not_form']))
            compiled.append(c)

        # Sliding window through rows
        for i in range(len(rows) - pattern_len + 1):
            match = True
            for j in range(pattern_len):
                pos_val, lemma_tl, lemma_dmf_val, pos_tag, token_form = rows[i + j]
                lemma_val = lemma_dmf_val if lemma_field == "dmf" else lemma_tl
                c = compiled[j]
                if 'lemma' in c and lemma_val not in c['lemma']:
                    match = False
                    break
                if 'pos' in c and pos_tag not in c['pos']:
                    match = False
                    break
                if 'not_lemma' in c and lemma_val in c['not_lemma']:
                    match = False
                    break
                if 'not_pos' in c and pos_tag in c['not_pos']:
                    match = False
                    break
                if 'form' in c and token_form not in c['form']:
                    match = False
                    break
                if 'not_form' in c and token_form in c['not_form']:
                    match = False
                    break

            if match:
                positions = [rows[i + j][0] for j in range(pattern_len)]
                # If filtering by dataset, check all positions fall within allowed ranges
                if allowed_ranges is not None:
                    if not self._positions_in_ranges(positions, allowed_ranges):
                        continue
                matches.append((text_id, positions))

        return matches

    @staticmethod
    def _positions_in_ranges(positions: List[int], ranges: List[Tuple[int, int]]) -> bool:
        """Check that ALL positions in the sequence fall within at least one allowed range."""
        for pos in positions:
            if not any(start <= pos <= end for start, end in ranges):
                return False
        return True
