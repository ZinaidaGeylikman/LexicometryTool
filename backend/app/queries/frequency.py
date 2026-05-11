"""
Frequency analysis and statistics
"""
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, exists, func, not_, or_
from collections import Counter
from ..models import Token, Text, DatasetToken, subcorpus_texts


class FrequencyAnalyzer:
    """Frequency and statistical analysis"""

    def __init__(self, db: Session):
        self.db = db

    def _parse_alternatives(self, value: Optional[str], uppercase: bool = False) -> List[str]:
        """Parse slash-separated alternatives"""
        if not value:
            return []
        if uppercase:
            return [v.strip().upper() for v in value.split('/') if v.strip()]
        return [v.strip().lower() for v in value.split('/') if v.strip()]

    def _lemma_match(self, field, v: str):
        """Match v as an exact lemma or as one alternative in a pipe-separated ambiguous lemma."""
        return or_(field == v, field.like(f'{v}|%'), field.like(f'%|{v}'), field.like(f'%|{v}|%'))

    def _build_token_filters(
        self,
        lemma: Optional[str] = None,
        pos: Optional[str] = None,
        not_lemma: Optional[str] = None,
        not_pos: Optional[str] = None,
        lemma_field: str = "dmf",
        form: Optional[str] = None,
        not_form: Optional[str] = None,
    ) -> list:
        """Build token-level filters from lemma/POS/form include/exclude params."""
        col = Token.lemma_dmf if lemma_field == "dmf" else Token.lemma
        filters = []
        if lemma:
            lemma_vals = self._parse_alternatives(lemma)
            filters.append(or_(*[self._lemma_match(col, v) for v in lemma_vals]))
        if pos:
            pos_vals = self._parse_alternatives(pos, uppercase=True)
            filters.append(Token.pos.in_(pos_vals))
        if not_lemma:
            lemma_vals = self._parse_alternatives(not_lemma)
            filters.append(and_(*[not_(self._lemma_match(col, v)) for v in lemma_vals]))
        if not_pos:
            pos_vals = self._parse_alternatives(not_pos, uppercase=True)
            filters.append(not_(Token.pos.in_(pos_vals)))
        if form:
            form_vals = self._parse_alternatives(form)
            filters.append(Token.token.in_(form_vals))
        if not_form:
            form_vals = self._parse_alternatives(not_form)
            filters.append(not_(Token.token.in_(form_vals)))
        return filters

    def _build_metadata_filters(
        self,
        domain: Optional[str] = None,
        genre: Optional[str] = None,
        period_start: Optional[int] = None,
        period_end: Optional[int] = None,
        subcorpus_id: Optional[int] = None,
        text_id: Optional[int] = None,
        dataset_id: Optional[int] = None,
    ) -> list:
        """Build text-level metadata filters."""
        filters = []
        if domain:
            domain_vals = self._parse_alternatives(domain)
            filters.append(Text.domain.in_(domain_vals))
        if genre:
            genre_vals = self._parse_alternatives(genre)
            filters.append(Text.genre.in_(genre_vals))
        if period_start is not None:
            filters.append(Text.period_end >= period_start)
        if period_end is not None:
            filters.append(Text.period_start <= period_end)
        if text_id is not None:
            filters.append(Text.text_id == text_id)
        if subcorpus_id is not None:
            subcorpus_subq = exists().where(
                and_(
                    subcorpus_texts.c.subcorpus_id == subcorpus_id,
                    subcorpus_texts.c.text_id == Token.text_id,
                )
            )
            filters.append(subcorpus_subq)
        if dataset_id is not None:
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
        return filters

    def frequency_by_genre(
        self,
        lemma: Optional[str] = None,
        pos: Optional[str] = None,
        not_lemma: Optional[str] = None,
        not_pos: Optional[str] = None,
        domain: Optional[str] = None,
        period_start: Optional[int] = None,
        period_end: Optional[int] = None,
        normalize: bool = False,
        per_n_words: int = 10000,
        subcorpus_id: Optional[int] = None,
        text_id: Optional[int] = None,
        dataset_id: Optional[int] = None,
        lemma_field: str = "dmf",
        form: Optional[str] = None,
        not_form: Optional[str] = None,
    ) -> Dict[str, float]:
        """Get frequency broken down by genre."""
        query = self.db.query(
            Text.genre,
            func.count(Token.token_id).label('count')
        ).join(Text, Token.text_id == Text.text_id)

        filters = self._build_token_filters(lemma, pos, not_lemma, not_pos, lemma_field=lemma_field, form=form, not_form=not_form)
        filters += self._build_metadata_filters(domain=domain, period_start=period_start, period_end=period_end, subcorpus_id=subcorpus_id, text_id=text_id, dataset_id=dataset_id)

        if filters:
            query = query.filter(and_(*filters))

        results = query.group_by(Text.genre).all()

        if not normalize:
            return {genre: count for genre, count in results if genre}

        # Get total tokens per genre (with same metadata filter only)
        total_query = self.db.query(
            Text.genre,
            func.count(Token.token_id).label('total')
        ).join(Text, Token.text_id == Text.text_id)

        meta_filters = self._build_metadata_filters(domain=domain, period_start=period_start, period_end=period_end, subcorpus_id=subcorpus_id, dataset_id=dataset_id)
        if meta_filters:
            total_query = total_query.filter(and_(*meta_filters))

        total_query = total_query.group_by(Text.genre)
        totals = {genre: total for genre, total in total_query.all() if genre}

        relative_freqs = {}
        for genre, count in results:
            if genre and genre in totals and totals[genre] > 0:
                relative_freq = (count / totals[genre]) * per_n_words
                relative_freqs[genre] = round(relative_freq, 2)

        return relative_freqs

    def frequency_by_domain(
        self,
        lemma: Optional[str] = None,
        pos: Optional[str] = None,
        not_lemma: Optional[str] = None,
        not_pos: Optional[str] = None,
        period_start: Optional[int] = None,
        period_end: Optional[int] = None,
        normalize: bool = False,
        per_n_words: int = 10000,
        subcorpus_id: Optional[int] = None,
        text_id: Optional[int] = None,
        dataset_id: Optional[int] = None,
        lemma_field: str = "dmf",
        form: Optional[str] = None,
        not_form: Optional[str] = None,
    ) -> Dict[str, float]:
        """Get frequency broken down by domain."""
        query = self.db.query(
            Text.domain,
            func.count(Token.token_id).label('count')
        ).join(Text, Token.text_id == Text.text_id)

        filters = self._build_token_filters(lemma, pos, not_lemma, not_pos, lemma_field=lemma_field, form=form, not_form=not_form)
        filters += self._build_metadata_filters(period_start=period_start, period_end=period_end, subcorpus_id=subcorpus_id, text_id=text_id, dataset_id=dataset_id)

        if filters:
            query = query.filter(and_(*filters))

        results = query.group_by(Text.domain).all()

        if not normalize:
            return {domain: count for domain, count in results if domain}

        # Total tokens per domain (no token filters, just totals)
        total_query = self.db.query(
            Text.domain,
            func.count(Token.token_id).label('total')
        ).join(Text, Token.text_id == Text.text_id)

        meta_filters = self._build_metadata_filters(period_start=period_start, period_end=period_end, subcorpus_id=subcorpus_id, dataset_id=dataset_id)
        if meta_filters:
            total_query = total_query.filter(and_(*meta_filters))

        total_query = total_query.group_by(Text.domain)
        totals = {domain: total for domain, total in total_query.all() if domain}

        relative_freqs = {}
        for domain, count in results:
            if domain and domain in totals and totals[domain] > 0:
                relative_freq = (count / totals[domain]) * per_n_words
                relative_freqs[domain] = round(relative_freq, 2)

        return relative_freqs

    def frequency_by_period(
        self,
        lemma: Optional[str] = None,
        pos: Optional[str] = None,
        not_lemma: Optional[str] = None,
        not_pos: Optional[str] = None,
        bin_size: int = 50,
        domain: Optional[str] = None,
        genre: Optional[str] = None,
        subcorpus_id: Optional[int] = None,
        text_id: Optional[int] = None,
        dataset_id: Optional[int] = None,
        date_source: str = "composition",
        lemma_field: str = "dmf",
        form: Optional[str] = None,
        not_form: Optional[str] = None,
    ) -> Dict[int, int]:
        """Get frequency over time, binned by period using midpoint pivot."""
        query = self.db.query(
            Text.period_start,
            Text.period_end,
            Text.ms_date_start,
            Text.ms_date_end,
            func.count(Token.token_id).label('count')
        ).join(Text, Token.text_id == Text.text_id)

        filters = self._build_token_filters(lemma, pos, not_lemma, not_pos, lemma_field=lemma_field, form=form, not_form=not_form)
        filters += self._build_metadata_filters(domain=domain, genre=genre, subcorpus_id=subcorpus_id, text_id=text_id, dataset_id=dataset_id)

        if filters:
            query = query.filter(and_(*filters))

        results = query.group_by(
            Text.period_start, Text.period_end,
            Text.ms_date_start, Text.ms_date_end,
        ).all()

        period_counts = {}
        for comp_start, comp_end, ms_start, ms_end, count in results:
            if date_source == "manuscript" and (ms_start is not None or ms_end is not None):
                d_start = ms_start if ms_start is not None else comp_start
                d_end = ms_end if ms_end is not None else comp_end
            else:
                d_start, d_end = comp_start, comp_end
            if d_start is None:
                continue
            pivot = round((d_start + (d_end if d_end is not None else d_start)) / 2)
            bin_start = (pivot // bin_size) * bin_size
            period_counts[bin_start] = period_counts.get(bin_start, 0) + count

        return dict(sorted(period_counts.items()))

    def lemma_index(
        self,
        lemma: Optional[str] = None,
        pos: Optional[str] = None,
        not_lemma: Optional[str] = None,
        not_pos: Optional[str] = None,
        domain: Optional[str] = None,
        genre: Optional[str] = None,
        period_start: Optional[int] = None,
        period_end: Optional[int] = None,
        subcorpus_id: Optional[int] = None,
        text_id: Optional[int] = None,
        dataset_id: Optional[int] = None,
        limit: int = 500,
        lemma_field: str = "dmf",
        form: Optional[str] = None,
        not_form: Optional[str] = None,
    ) -> List[dict]:
        """Return (lemma, pos, count) sorted by frequency descending."""
        col = Token.lemma_dmf if lemma_field == "dmf" else Token.lemma
        query = self.db.query(
            col.label('lemma'),
            Token.pos,
            func.count(Token.token_id).label('count'),
        ).join(Text, Token.text_id == Text.text_id)

        filters = self._build_token_filters(lemma=lemma, pos=pos, not_lemma=not_lemma, not_pos=not_pos, lemma_field=lemma_field, form=form, not_form=not_form)
        filters += self._build_metadata_filters(
            domain=domain, genre=genre,
            period_start=period_start, period_end=period_end,
            subcorpus_id=subcorpus_id, text_id=text_id, dataset_id=dataset_id,
        )

        if filters:
            query = query.filter(and_(*filters))

        results = (
            query.group_by(col, Token.pos)
            .order_by(func.count(Token.token_id).desc())
            .limit(limit)
            .all()
        )
        return [{'lemma': l, 'pos': p, 'count': c} for l, p, c in results if l]

    def pos_index(
        self,
        pos: Optional[str] = None,
        not_pos: Optional[str] = None,
        domain: Optional[str] = None,
        genre: Optional[str] = None,
        period_start: Optional[int] = None,
        period_end: Optional[int] = None,
        subcorpus_id: Optional[int] = None,
        text_id: Optional[int] = None,
        dataset_id: Optional[int] = None,
        limit: int = 10000,
    ) -> List[dict]:
        """Return (pos, count) sorted by frequency descending."""
        query = self.db.query(
            Token.pos,
            func.count(Token.token_id).label('count'),
        ).join(Text, Token.text_id == Text.text_id)

        filters = []
        if pos:
            pos_vals = self._parse_alternatives(pos, uppercase=True)
            filters.append(Token.pos.in_(pos_vals))
        if not_pos:
            pos_vals = self._parse_alternatives(not_pos, uppercase=True)
            filters.append(not_(Token.pos.in_(pos_vals)))
        filters += self._build_metadata_filters(
            domain=domain, genre=genre,
            period_start=period_start, period_end=period_end,
            subcorpus_id=subcorpus_id, text_id=text_id, dataset_id=dataset_id,
        )

        if filters:
            query = query.filter(and_(*filters))

        results = (
            query.group_by(Token.pos)
            .order_by(func.count(Token.token_id).desc())
            .limit(limit)
            .all()
        )
        return [{'pos': p, 'count': c} for p, c in results if p]

    def lemma_frequency(
        self,
        lemma: Optional[str] = None,
        domain: Optional[str] = None,
        genre: Optional[str] = None,
        period_start: Optional[int] = None,
        period_end: Optional[int] = None,
    ) -> Dict[str, int]:
        """Get frequency count of lemma(s)."""
        query = self.db.query(
            Token.lemma,
            func.count(Token.token_id).label('count')
        ).join(Text, Token.text_id == Text.text_id)

        filters = []
        if lemma:
            lemma_vals = self._parse_alternatives(lemma)
            filters.append(Token.lemma.in_(lemma_vals))
        filters += self._build_metadata_filters(domain, genre, period_start, period_end)

        if filters:
            query = query.filter(and_(*filters))

        results = query.group_by(Token.lemma).all()
        return {lemma: count for lemma, count in results}

    def pos_frequency(
        self,
        pos: Optional[str] = None,
        domain: Optional[str] = None,
        genre: Optional[str] = None,
    ) -> Dict[str, int]:
        """Get frequency of POS tag(s)."""
        query = self.db.query(
            Token.pos,
            func.count(Token.token_id).label('count')
        ).join(Text, Token.text_id == Text.text_id)

        filters = []
        if pos:
            pos_vals = self._parse_alternatives(pos, uppercase=True)
            filters.append(Token.pos.in_(pos_vals))
        if domain:
            domain_vals = self._parse_alternatives(domain)
            filters.append(Text.domain.in_(domain_vals))
        if genre:
            genre_vals = self._parse_alternatives(genre)
            filters.append(Text.genre.in_(genre_vals))

        if filters:
            query = query.filter(and_(*filters))

        results = query.group_by(Token.pos).all()
        return {pos: count for pos, count in results}

    def corpus_statistics(self) -> Dict[str, any]:
        """Get overall corpus statistics"""
        total_tokens = self.db.query(func.count(Token.token_id)).scalar()
        total_texts = self.db.query(func.count(Text.text_id)).scalar()

        tokens_by_domain = self.db.query(
            Text.domain, func.count(Token.token_id).label('count')
        ).join(Text, Token.text_id == Text.text_id).group_by(Text.domain).all()

        tokens_by_genre = self.db.query(
            Text.genre, func.count(Token.token_id).label('count')
        ).join(Text, Token.text_id == Text.text_id).group_by(Text.genre).all()

        texts_by_domain = self.db.query(
            Text.domain, func.count(Text.text_id).label('count')
        ).group_by(Text.domain).all()

        texts_by_genre = self.db.query(
            Text.genre, func.count(Text.text_id).label('count')
        ).group_by(Text.genre).all()

        unique_lemmas = self.db.query(func.count(func.distinct(Token.lemma))).scalar()

        total_domains = self.db.query(func.count(func.distinct(Text.domain))).filter(Text.domain != None).scalar()
        total_genres  = self.db.query(func.count(func.distinct(Text.genre))).filter(Text.genre != None).scalar()
        period = self.db.query(func.min(Text.period_start), func.max(Text.period_end)).first()

        return {
            'total_tokens': total_tokens,
            'total_texts': total_texts,
            'unique_lemmas': unique_lemmas,
            'total_domains': total_domains,
            'total_genres': total_genres,
            'period_start': period[0],
            'period_end': period[1],
            'tokens_by_domain': {d: c for d, c in tokens_by_domain if d},
            'tokens_by_genre': {g: c for g, c in tokens_by_genre if g},
            'texts_by_domain': {d: c for d, c in texts_by_domain if d},
            'texts_by_genre': {g: c for g, c in texts_by_genre if g},
        }
