"""API routes for dataset management"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..queries.dataset_manager import DatasetManager
from ..schemas.datasets import DatasetCreateParams, DatasetResponse, DatasetListResponse

router = APIRouter()


@router.get("", response_model=DatasetListResponse)
def list_datasets(db: Session = Depends(get_db)):
    """List all saved datasets"""
    manager = DatasetManager(db)
    datasets = manager.list_datasets()
    return DatasetListResponse(
        datasets=[DatasetResponse.model_validate(d) for d in datasets],
        total=len(datasets)
    )


@router.post("", response_model=DatasetResponse)
def create_dataset(params: DatasetCreateParams, db: Session = Depends(get_db)):
    """Create a new dataset from query parameters"""
    manager = DatasetManager(db)
    try:
        dataset_id = manager.create_dataset(
            name=params.name,
            query_params=params.query_params,
            description=params.description,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    dataset = manager.get_dataset(dataset_id)
    return DatasetResponse.model_validate(dataset)


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    """Delete a dataset"""
    manager = DatasetManager(db)
    success = manager.delete_dataset(dataset_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"detail": "Dataset deleted"}
