"""Pydantic schemas for frequency analysis"""
from pydantic import BaseModel, Field
from typing import Optional
from .queries import SequencePatternItem


class FrequencyByGroupParams(BaseModel):
    """Request body for frequency by genre/domain"""
    lemma: Optional[str] = None
    pos: Optional[str] = None
    not_lemma: Optional[str] = None
    not_pos: Optional[str] = None
    form: Optional[str] = None
    not_form: Optional[str] = None
    domain: Optional[str] = None
    genre: Optional[str] = None
    period_start: Optional[int] = None
    period_end: Optional[int] = None
    normalize: bool = False
    per_n_words: int = Field(default=10000, ge=1)
    subcorpus_id: Optional[int] = None
    text_id: Optional[int] = None
    dataset_id: Optional[int] = None
    lemma_field: str = "dmf"  # "dmf" | "source"


class FrequencyByPeriodParams(BaseModel):
    """Request body for frequency by period"""
    lemma: Optional[str] = None
    pos: Optional[str] = None
    not_lemma: Optional[str] = None
    not_pos: Optional[str] = None
    form: Optional[str] = None
    not_form: Optional[str] = None
    bin_size: int = Field(default=50, ge=10, le=200)
    domain: Optional[str] = None
    genre: Optional[str] = None
    subcorpus_id: Optional[int] = None
    text_id: Optional[int] = None
    dataset_id: Optional[int] = None
    date_source: str = "composition"  # "composition" | "manuscript"
    lemma_field: str = "dmf"  # "dmf" | "source"


class FrequencyResponse(BaseModel):
    """Response mapping labels to counts or rates"""
    data: dict[str, float]


class SeqFrequencyByGroupParams(BaseModel):
    """Request body for sequence frequency by genre/domain"""
    pattern: list[SequencePatternItem]
    domain: Optional[str] = None
    period_start: Optional[int] = None
    period_end: Optional[int] = None
    normalize: bool = False
    per_n_words: int = Field(default=10000, ge=1)
    subcorpus_id: Optional[int] = None
    text_id: Optional[int] = None
    dataset_id: Optional[int] = None
    lemma_field: str = "dmf"  # "dmf" | "source"


class SeqFrequencyByPeriodParams(BaseModel):
    """Request body for sequence frequency by period"""
    pattern: list[SequencePatternItem]
    bin_size: int = Field(default=50, ge=10, le=200)
    domain: Optional[str] = None
    genre: Optional[str] = None
    subcorpus_id: Optional[int] = None
    text_id: Optional[int] = None
    dataset_id: Optional[int] = None
    date_source: str = "composition"  # "composition" | "manuscript"
    lemma_field: str = "dmf"  # "dmf" | "source"


class LemmaIndexParams(BaseModel):
    """Request body for POST /api/frequency/lemma-index"""
    lemma: Optional[str] = None
    pos: Optional[str] = None
    not_lemma: Optional[str] = None
    not_pos: Optional[str] = None
    form: Optional[str] = None
    not_form: Optional[str] = None
    domain: Optional[str] = None
    genre: Optional[str] = None
    period_start: Optional[int] = None
    period_end: Optional[int] = None
    subcorpus_id: Optional[int] = None
    text_id: Optional[int] = None
    dataset_id: Optional[int] = None
    limit: int = Field(default=10000, ge=1, le=100000)
    lemma_field: str = "dmf"  # "dmf" | "source"


class LemmaIndexEntry(BaseModel):
    lemma: str
    pos: Optional[str] = None
    count: int


class LemmaIndexResponse(BaseModel):
    entries: list[LemmaIndexEntry]
    total: int


class PosIndexParams(BaseModel):
    """Request body for POST /api/frequency/pos-index"""
    pos: Optional[str] = None
    not_pos: Optional[str] = None
    domain: Optional[str] = None
    genre: Optional[str] = None
    period_start: Optional[int] = None
    period_end: Optional[int] = None
    subcorpus_id: Optional[int] = None
    text_id: Optional[int] = None
    dataset_id: Optional[int] = None
    limit: int = Field(default=10000, ge=1, le=100000)


class PosIndexEntry(BaseModel):
    pos: str
    count: int


class PosIndexResponse(BaseModel):
    entries: list[PosIndexEntry]
    total: int


class CorpusStatsResponse(BaseModel):
    """Response for GET /api/stats"""
    total_tokens: int
    total_texts: int
    unique_lemmas: int
    tokens_by_domain: dict[str, int]
    tokens_by_genre: dict[str, int]
    texts_by_domain: dict[str, int]
    texts_by_genre: dict[str, int]
