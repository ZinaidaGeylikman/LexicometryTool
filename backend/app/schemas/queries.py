"""Pydantic schemas for query operations"""
from pydantic import BaseModel, Field
from typing import Optional, Any


class QueryParams(BaseModel):
    """Request body for POST /api/query"""
    lemma: Optional[str] = None
    pos: Optional[str] = None
    not_lemma: Optional[str] = None
    not_pos: Optional[str] = None
    form: Optional[str] = None
    not_form: Optional[str] = None
    domain: Optional[str] = None
    genre: Optional[str] = None
    not_domain: Optional[str] = None
    not_genre: Optional[str] = None
    period_start: Optional[int] = None
    period_end: Optional[int] = None
    context_before: int = Field(default=5, ge=0, le=50)
    context_after: int = Field(default=5, ge=0, le=50)
    limit: int = Field(default=50, ge=1, le=10000)
    offset: int = Field(default=0, ge=0)
    dataset_id: Optional[int] = None
    subcorpus_id: Optional[int] = None
    text_id: Optional[int] = None
    lemma_field: str = "dmf"  # "dmf" | "source"


class ContextToken(BaseModel):
    """A single token in a context window"""
    position: int
    token: str
    lemma: str
    pos: str


class QueryResultItem(BaseModel):
    """Single query result with context"""
    token_id: int
    text_id: int
    text_title: str
    text_filename: str
    position: int
    token: str
    lemma: str
    pos: str
    citation: Optional[str] = None
    context_before: list[ContextToken]
    context_after: list[ContextToken]
    domain: Optional[str] = None
    genre: Optional[str] = None
    period_start: Optional[int] = None
    period_end: Optional[int] = None


class QueryResponse(BaseModel):
    """Response for POST /api/query"""
    results: list[QueryResultItem]
    total: int
    limit: int
    offset: int


class SequencePatternItem(BaseModel):
    """One slot in a sequence pattern"""
    lemma: Optional[str] = None
    pos: Optional[str] = None
    not_lemma: Optional[str] = None
    not_pos: Optional[str] = None
    form: Optional[str] = None
    not_form: Optional[str] = None


class SequenceQueryParams(BaseModel):
    """Request body for POST /api/query/sequence"""
    pattern: list[SequencePatternItem]
    domain: Optional[str] = None
    genre: Optional[str] = None
    period_start: Optional[int] = None
    period_end: Optional[int] = None
    dataset_id: Optional[int] = None
    subcorpus_id: Optional[int] = None
    text_id: Optional[int] = None
    context_before: int = Field(default=5, ge=0, le=50)
    context_after: int = Field(default=5, ge=0, le=50)
    limit: int = Field(default=50, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)
    lemma_field: str = "dmf"  # "dmf" | "source"


class SequenceResultItem(BaseModel):
    """One matched sequence"""
    tokens: list[QueryResultItem]


class SequenceQueryResponse(BaseModel):
    """Response for POST /api/query/sequence"""
    results: list[SequenceResultItem]
    total: int
    limit: int
    offset: int
