"""Pydantic schemas for text management"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TextMetadataUpdate(BaseModel):
    """Request body for updating text metadata"""
    title: Optional[str] = None
    domain: Optional[str] = None
    genre: Optional[str] = None
    period_start: Optional[int] = None
    period_end: Optional[int] = None
    ms_date_start: Optional[int] = None
    ms_date_end: Optional[int] = None


class TextResponse(BaseModel):
    """Single text response"""
    text_id: int
    filename: str
    title: Optional[str] = None
    domain: Optional[str] = None
    genre: Optional[str] = None
    period_start: Optional[int] = None
    period_end: Optional[int] = None
    ms_date_start: Optional[int] = None
    ms_date_end: Optional[int] = None
    format_type: Optional[str] = None
    token_count: int = 0
    date_added: Optional[datetime] = None

    class Config:
        from_attributes = True


class TextListResponse(BaseModel):
    """Response for GET /api/texts"""
    texts: list[TextResponse]
    total: int
