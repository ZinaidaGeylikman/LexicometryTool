"""API routes for subcorpora management"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..core.database import get_db
from ..models import Subcorpus, Text, Token, subcorpus_texts
from ..schemas.subcorpora import (
    SubcorpusCreate, SubcorpusUpdate, SubcorpusResponse,
    SubcorpusListResponse, SubcorpusTextInfo,
)

router = APIRouter()


def _subcorpus_to_response(sc: Subcorpus) -> SubcorpusResponse:
    return SubcorpusResponse(
        subcorpus_id=sc.subcorpus_id,
        name=sc.name,
        description=sc.description,
        created_at=sc.created_at,
        texts=[
            SubcorpusTextInfo(
                text_id=t.text_id,
                title=t.title,
                filename=t.filename,
            )
            for t in sc.texts
        ],
    )


@router.get("", response_model=SubcorpusListResponse)
def list_subcorpora(db: Session = Depends(get_db)):
    """List all subcorpora"""
    subcorpora = db.query(Subcorpus).order_by(Subcorpus.name).all()
    return SubcorpusListResponse(
        subcorpora=[_subcorpus_to_response(sc) for sc in subcorpora]
    )


@router.post("", response_model=SubcorpusResponse)
def create_subcorpus(params: SubcorpusCreate, db: Session = Depends(get_db)):
    """Create a new subcorpus"""
    existing = db.query(Subcorpus).filter(Subcorpus.name == params.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Subcorpus '{params.name}' already exists")

    sc = Subcorpus(name=params.name, description=params.description)

    if params.text_ids:
        texts = db.query(Text).filter(Text.text_id.in_(params.text_ids)).all()
        sc.texts = texts

    db.add(sc)
    db.commit()
    db.refresh(sc)
    return _subcorpus_to_response(sc)


@router.get("/{subcorpus_id}", response_model=SubcorpusResponse)
def get_subcorpus(subcorpus_id: int, db: Session = Depends(get_db)):
    """Get a single subcorpus with its texts"""
    sc = db.query(Subcorpus).filter(Subcorpus.subcorpus_id == subcorpus_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Subcorpus not found")
    return _subcorpus_to_response(sc)


@router.put("/{subcorpus_id}", response_model=SubcorpusResponse)
def update_subcorpus(subcorpus_id: int, params: SubcorpusUpdate, db: Session = Depends(get_db)):
    """Update a subcorpus"""
    sc = db.query(Subcorpus).filter(Subcorpus.subcorpus_id == subcorpus_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Subcorpus not found")

    if params.name is not None:
        sc.name = params.name
    if params.description is not None:
        sc.description = params.description
    if params.text_ids is not None:
        texts = db.query(Text).filter(Text.text_id.in_(params.text_ids)).all()
        sc.texts = texts

    db.commit()
    db.refresh(sc)
    return _subcorpus_to_response(sc)


@router.get("/{subcorpus_id}/stats")
def subcorpus_stats(subcorpus_id: int, db: Session = Depends(get_db)):
    """Return token count, domain/genre distribution and period range for a subcorpus."""
    sc = db.query(Subcorpus).filter(Subcorpus.subcorpus_id == subcorpus_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Subcorpus not found")

    text_ids = [t.text_id for t in sc.texts]
    if not text_ids:
        return {"token_count": 0, "by_domain": {}, "by_genre": {}, "period_start": None, "period_end": None}

    token_count = db.query(func.count(Token.token_id)).filter(Token.text_id.in_(text_ids)).scalar()

    by_domain = {
        row[0] or "unknown": row[1]
        for row in db.query(Text.domain, func.sum(Text.token_count))
            .filter(Text.text_id.in_(text_ids))
            .group_by(Text.domain).all()
    }
    by_genre = {
        row[0] or "unknown": row[1]
        for row in db.query(Text.genre, func.sum(Text.token_count))
            .filter(Text.text_id.in_(text_ids))
            .group_by(Text.genre).all()
    }

    period = db.query(func.min(Text.period_start), func.max(Text.period_end)).filter(Text.text_id.in_(text_ids)).first()

    return {
        "token_count": token_count,
        "by_domain": by_domain,
        "by_genre": by_genre,
        "period_start": period[0],
        "period_end": period[1],
    }


@router.delete("/{subcorpus_id}")
def delete_subcorpus(subcorpus_id: int, db: Session = Depends(get_db)):
    """Delete a subcorpus"""
    sc = db.query(Subcorpus).filter(Subcorpus.subcorpus_id == subcorpus_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Subcorpus not found")
    db.delete(sc)
    db.commit()
    return {"status": "deleted"}
