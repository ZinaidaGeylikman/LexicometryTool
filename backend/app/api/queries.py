"""API routes for corpus queries"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..queries.query_engine import QueryEngine
from ..schemas.queries import (
    QueryParams, QueryResponse, QueryResultItem, ContextToken,
    SequenceQueryParams, SequenceQueryResponse, SequenceResultItem,
)

router = APIRouter()


def _result_to_item(r) -> QueryResultItem:
    """Convert a QueryResult dataclass to a Pydantic model"""
    return QueryResultItem(
        token_id=r.token_id,
        text_id=r.text_id,
        text_title=r.text_title,
        text_filename=r.text_filename,
        position=r.position,
        token=r.token,
        lemma=r.lemma,
        pos=r.pos,
        citation=r.citation,
        context_before=[ContextToken(**t) for t in r.context_before],
        context_after=[ContextToken(**t) for t in r.context_after],
        domain=r.domain,
        genre=r.genre,
        period_start=r.period_start,
        period_end=r.period_end,
    )


@router.post("", response_model=QueryResponse)
def query_corpus(params: QueryParams, db: Session = Depends(get_db)):
    """Search the corpus by lemma, POS, and other filters"""
    engine = QueryEngine(db)
    results = engine.query(
        lemma=params.lemma,
        pos=params.pos,
        not_lemma=params.not_lemma,
        not_pos=params.not_pos,
        form=params.form,
        not_form=params.not_form,
        domain=params.domain,
        genre=params.genre,
        not_domain=params.not_domain,
        not_genre=params.not_genre,
        period_start=params.period_start,
        period_end=params.period_end,
        context_before=params.context_before,
        context_after=params.context_after,
        limit=params.limit,
        offset=params.offset,
        dataset_id=params.dataset_id,
        subcorpus_id=params.subcorpus_id,
        text_id=params.text_id,
        lemma_field=params.lemma_field,
    )

    # Get total count for pagination
    total = engine.query_count(
        lemma=params.lemma,
        pos=params.pos,
        not_lemma=params.not_lemma,
        not_pos=params.not_pos,
        form=params.form,
        not_form=params.not_form,
        domain=params.domain,
        genre=params.genre,
        not_domain=params.not_domain,
        not_genre=params.not_genre,
        period_start=params.period_start,
        period_end=params.period_end,
        dataset_id=params.dataset_id,
        subcorpus_id=params.subcorpus_id,
        text_id=params.text_id,
        lemma_field=params.lemma_field,
    )

    return QueryResponse(
        results=[_result_to_item(r) for r in results],
        total=total,
        limit=params.limit,
        offset=params.offset,
    )


@router.post("/count")
def query_count(params: QueryParams, db: Session = Depends(get_db)):
    """Get count of matching tokens without fetching results"""
    engine = QueryEngine(db)
    total = engine.query_count(
        lemma=params.lemma,
        pos=params.pos,
        not_lemma=params.not_lemma,
        not_pos=params.not_pos,
        form=params.form,
        not_form=params.not_form,
        domain=params.domain,
        genre=params.genre,
        not_domain=params.not_domain,
        not_genre=params.not_genre,
        period_start=params.period_start,
        period_end=params.period_end,
        dataset_id=params.dataset_id,
        subcorpus_id=params.subcorpus_id,
        text_id=params.text_id,
        lemma_field=params.lemma_field,
    )
    return {"total": total}


@router.post("/sequence", response_model=SequenceQueryResponse)
def query_sequence(params: SequenceQueryParams, db: Session = Depends(get_db)):
    """Search for token sequences matching a pattern"""
    engine = QueryEngine(db)
    pattern = [item.model_dump(exclude_none=True) for item in params.pattern]

    total, page_results = engine.query_sequence(
        pattern=pattern,
        domain=params.domain,
        genre=params.genre,
        period_start=params.period_start,
        period_end=params.period_end,
        dataset_id=params.dataset_id,
        subcorpus_id=params.subcorpus_id,
        text_id=params.text_id,
        context_before=params.context_before,
        context_after=params.context_after,
        limit=params.limit,
        offset=params.offset,
        lemma_field=params.lemma_field,
    )

    items = [
        SequenceResultItem(tokens=[_result_to_item(r) for r in seq])
        for seq in page_results
    ]

    return SequenceQueryResponse(
        results=items,
        total=total,
        limit=params.limit,
        offset=params.offset,
    )
