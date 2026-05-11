"""API routes for text management"""
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from ..core.database import get_db
from ..core.config import settings
from ..core.corpus_manager import CorpusManager
from ..schemas.texts import TextResponse, TextMetadataUpdate, TextListResponse

router = APIRouter()


@router.get("", response_model=TextListResponse)
def list_texts(db: Session = Depends(get_db)):
    """List all loaded texts"""
    manager = CorpusManager(db)
    texts = manager.list_texts()
    return TextListResponse(
        texts=[TextResponse.model_validate(t) for t in texts],
        total=len(texts)
    )


@router.get("/{text_id}", response_model=TextResponse)
def get_text(text_id: int, db: Session = Depends(get_db)):
    """Get a single text by ID"""
    manager = CorpusManager(db)
    text = manager.get_text(text_id)
    if not text:
        raise HTTPException(status_code=404, detail="Text not found")
    return TextResponse.model_validate(text)


@router.put("/{text_id}", response_model=TextResponse)
def update_text(text_id: int, data: TextMetadataUpdate, db: Session = Depends(get_db)):
    """Update text metadata"""
    manager = CorpusManager(db)
    success = manager.update_text_metadata(
        text_id,
        title=data.title,
        author=data.author,
        source_db=data.source_db,
        source_db_url=data.source_db_url,
        domain=data.domain,
        genre=data.genre,
        period_start=data.period_start,
        period_end=data.period_end,
        ms_date_start=data.ms_date_start,
        ms_date_end=data.ms_date_end,
        force_update_fields=data.model_fields_set,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Text not found")
    text = manager.get_text(text_id)
    return TextResponse.model_validate(text)


@router.delete("/{text_id}")
def delete_text(text_id: int, db: Session = Depends(get_db)):
    """Delete a text and all its tokens"""
    manager = CorpusManager(db)
    success = manager.delete_text(text_id)
    if not success:
        raise HTTPException(status_code=404, detail="Text not found")
    return {"detail": "Text deleted"}


@router.post("/upload", response_model=TextResponse)
def upload_text(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    author: Optional[str] = Form(None),
    source_db: Optional[str] = Form(None),
    source_db_url: Optional[str] = Form(None),
    domain: Optional[str] = Form(None),
    genre: Optional[str] = Form(None),
    period_start: Optional[int] = Form(None),
    period_end: Optional[int] = Form(None),
    ms_date_start: Optional[int] = Form(None),
    ms_date_end: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    """Upload and load an XML-TEI file"""
    # Save uploaded file
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, file.filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Load into database
    manager = CorpusManager(db)
    try:
        text_id = manager.load_text(
            filepath,
            title=title,
            author=author,
            source_db=source_db,
            source_db_url=source_db_url,
            domain=domain,
            genre=genre,
            period_start=period_start,
            period_end=period_end,
            ms_date_start=ms_date_start,
            ms_date_end=ms_date_end,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    text = manager.get_text(text_id)
    return TextResponse.model_validate(text)
