"""API routes for frequency analysis"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..queries.frequency import FrequencyAnalyzer
from ..queries.query_engine import QueryEngine
from ..schemas.frequency import (
    FrequencyByGroupParams, FrequencyByPeriodParams,
    SeqFrequencyByGroupParams, SeqFrequencyByPeriodParams,
    FrequencyResponse, CorpusStatsResponse,
    LemmaIndexParams, LemmaIndexResponse, LemmaIndexEntry,
    PosIndexParams, PosIndexResponse, PosIndexEntry,
)

router = APIRouter()


@router.post("/by-genre", response_model=FrequencyResponse)
def frequency_by_genre(params: FrequencyByGroupParams, db: Session = Depends(get_db)):
    """Get lemma frequency broken down by genre"""
    analyzer = FrequencyAnalyzer(db)
    data = analyzer.frequency_by_genre(
        lemma=params.lemma,
        pos=params.pos,
        not_lemma=params.not_lemma,
        not_pos=params.not_pos,
        form=params.form,
        not_form=params.not_form,
        domain=params.domain,
        period_start=params.period_start,
        period_end=params.period_end,
        normalize=params.normalize,
        per_n_words=params.per_n_words,
        subcorpus_id=params.subcorpus_id,
        text_id=params.text_id,
        dataset_id=params.dataset_id,
        lemma_field=params.lemma_field,
    )
    return FrequencyResponse(data=data)


@router.post("/by-domain", response_model=FrequencyResponse)
def frequency_by_domain(params: FrequencyByGroupParams, db: Session = Depends(get_db)):
    """Get lemma frequency broken down by domain"""
    analyzer = FrequencyAnalyzer(db)
    data = analyzer.frequency_by_domain(
        lemma=params.lemma,
        pos=params.pos,
        not_lemma=params.not_lemma,
        not_pos=params.not_pos,
        form=params.form,
        not_form=params.not_form,
        period_start=params.period_start,
        period_end=params.period_end,
        normalize=params.normalize,
        per_n_words=params.per_n_words,
        subcorpus_id=params.subcorpus_id,
        text_id=params.text_id,
        dataset_id=params.dataset_id,
        lemma_field=params.lemma_field,
    )
    return FrequencyResponse(data=data)


@router.post("/by-period", response_model=FrequencyResponse)
def frequency_by_period(params: FrequencyByPeriodParams, db: Session = Depends(get_db)):
    """Get lemma frequency over time periods"""
    analyzer = FrequencyAnalyzer(db)
    data = analyzer.frequency_by_period(
        lemma=params.lemma,
        pos=params.pos,
        not_lemma=params.not_lemma,
        not_pos=params.not_pos,
        form=params.form,
        not_form=params.not_form,
        bin_size=params.bin_size,
        domain=params.domain,
        genre=params.genre,
        subcorpus_id=params.subcorpus_id,
        text_id=params.text_id,
        dataset_id=params.dataset_id,
        date_source=params.date_source,
        lemma_field=params.lemma_field,
    )
    # Convert int keys to strings for JSON
    return FrequencyResponse(data={str(k): v for k, v in data.items()})


@router.post("/sequence/by-genre", response_model=FrequencyResponse)
def seq_frequency_by_genre(params: SeqFrequencyByGroupParams, db: Session = Depends(get_db)):
    """Get sequence frequency broken down by genre"""
    engine = QueryEngine(db)
    pattern = [item.model_dump(exclude_none=True) for item in params.pattern]
    data = engine.sequence_frequency_by_genre(
        pattern=pattern,
        domain=params.domain,
        period_start=params.period_start,
        period_end=params.period_end,
        normalize=params.normalize,
        per_n_words=params.per_n_words,
        subcorpus_id=params.subcorpus_id,
        text_id=params.text_id,
        dataset_id=params.dataset_id,
        lemma_field=params.lemma_field,
    )
    return FrequencyResponse(data=data)


@router.post("/sequence/by-domain", response_model=FrequencyResponse)
def seq_frequency_by_domain(params: SeqFrequencyByGroupParams, db: Session = Depends(get_db)):
    """Get sequence frequency broken down by domain"""
    engine = QueryEngine(db)
    pattern = [item.model_dump(exclude_none=True) for item in params.pattern]
    data = engine.sequence_frequency_by_domain(
        pattern=pattern,
        period_start=params.period_start,
        period_end=params.period_end,
        normalize=params.normalize,
        per_n_words=params.per_n_words,
        subcorpus_id=params.subcorpus_id,
        text_id=params.text_id,
        dataset_id=params.dataset_id,
        lemma_field=params.lemma_field,
    )
    return FrequencyResponse(data=data)


@router.post("/sequence/by-period", response_model=FrequencyResponse)
def seq_frequency_by_period(params: SeqFrequencyByPeriodParams, db: Session = Depends(get_db)):
    """Get sequence frequency over time periods"""
    engine = QueryEngine(db)
    pattern = [item.model_dump(exclude_none=True) for item in params.pattern]
    data = engine.sequence_frequency_by_period(
        pattern=pattern,
        bin_size=params.bin_size,
        domain=params.domain,
        genre=params.genre,
        subcorpus_id=params.subcorpus_id,
        text_id=params.text_id,
        dataset_id=params.dataset_id,
        date_source=params.date_source,
        lemma_field=params.lemma_field,
    )
    return FrequencyResponse(data={str(k): v for k, v in data.items()})


@router.post("/pos-index", response_model=PosIndexResponse)
def pos_index(params: PosIndexParams, db: Session = Depends(get_db)):
    """Get POS index sorted by frequency"""
    analyzer = FrequencyAnalyzer(db)
    entries = analyzer.pos_index(
        pos=params.pos,
        not_pos=params.not_pos,
        domain=params.domain,
        genre=params.genre,
        period_start=params.period_start,
        period_end=params.period_end,
        subcorpus_id=params.subcorpus_id,
        text_id=params.text_id,
        dataset_id=params.dataset_id,
        limit=params.limit,
    )
    return PosIndexResponse(
        entries=[PosIndexEntry(**e) for e in entries],
        total=len(entries),
    )


@router.post("/lemma-index", response_model=LemmaIndexResponse)
def lemma_index(params: LemmaIndexParams, db: Session = Depends(get_db)):
    """Get lemma index sorted by frequency"""
    analyzer = FrequencyAnalyzer(db)
    entries = analyzer.lemma_index(
        lemma=params.lemma,
        pos=params.pos,
        not_lemma=params.not_lemma,
        not_pos=params.not_pos,
        form=params.form,
        not_form=params.not_form,
        domain=params.domain,
        genre=params.genre,
        period_start=params.period_start,
        period_end=params.period_end,
        subcorpus_id=params.subcorpus_id,
        text_id=params.text_id,
        dataset_id=params.dataset_id,
        limit=params.limit,
        lemma_field=params.lemma_field,
    )
    return LemmaIndexResponse(
        entries=[LemmaIndexEntry(**e) for e in entries],
        total=len(entries),
    )
