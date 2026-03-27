"""Pydantic schemas for subcorpora"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SubcorpusTextInfo(BaseModel):
    text_id: int
    title: Optional[str] = None
    filename: str


class SubcorpusCreate(BaseModel):
    name: str
    description: Optional[str] = None
    text_ids: list[int] = []


class SubcorpusUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    text_ids: Optional[list[int]] = None


class SubcorpusResponse(BaseModel):
    subcorpus_id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    texts: list[SubcorpusTextInfo]


class SubcorpusListResponse(BaseModel):
    subcorpora: list[SubcorpusResponse]
