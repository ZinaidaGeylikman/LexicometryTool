"""Pydantic schemas for dataset management"""
from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class DatasetCreateParams(BaseModel):
    """Request body for POST /api/datasets"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    query_params: dict[str, Any]


class DatasetResponse(BaseModel):
    """Single dataset response"""
    dataset_id: int
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    token_count: int = 0
    query_params: Optional[Any] = None
    parent_dataset_id: Optional[int] = None

    class Config:
        from_attributes = True


class DatasetListResponse(BaseModel):
    """Response for GET /api/datasets"""
    datasets: list[DatasetResponse]
    total: int
