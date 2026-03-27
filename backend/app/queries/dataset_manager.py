"""
Dataset management - create and query sub-corpora
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
from ..models import Dataset, DatasetToken, Token, Text
from .query_engine import QueryEngine, QueryResult
import json


class DatasetManager:
    """Manage temporary and saved datasets"""

    def __init__(self, db: Session):
        self.db = db
        self.query_engine = QueryEngine(db)

    def create_dataset(
        self,
        name: str,
        query_params: Dict[str, Any],
        description: Optional[str] = None,
        is_temporary: bool = False,
        user_id: Optional[int] = None,
    ) -> int:
        """
        Create a dataset from query results

        Args:
            name: Dataset name
            query_params: Dictionary of query parameters used to create dataset
            description: Optional description
            is_temporary: If True, dataset can be auto-deleted later
            user_id: User who created it (for RBAC)

        Returns:
            dataset_id

        Example:
            dataset_id = manager.create_dataset(
                name="roi_contexts",
                query_params={
                    'lemma': 'roi',
                    'genre': 'romance',
                    'context_before': 10,
                    'context_after': 10
                },
                description="All occurrences of 'roi' in romances with context"
            )
        """
        # Execute query to get results
        context_before = query_params.pop('context_before', 5)
        context_after = query_params.pop('context_after', 5)

        results = self.query_engine.query(
            context_before=context_before,
            context_after=context_after,
            **query_params
        )

        # Create dataset record
        dataset = Dataset(
            name=name,
            description=description,
            created_by_user_id=user_id,
            is_temporary=is_temporary,
            query_params=json.dumps({
                **query_params,
                'context_before': context_before,
                'context_after': context_after
            }),
            token_count=len(results)
        )

        self.db.add(dataset)
        self.db.flush()  # Get dataset_id

        # Add tokens to dataset
        for result in results:
            dataset_token = DatasetToken(
                dataset_id=dataset.dataset_id,
                token_id=result.token_id,
                context_start_position=result.position - context_before,
                context_end_position=result.position + context_after,
                match_position=result.position
            )
            self.db.add(dataset_token)

        self.db.commit()

        return dataset.dataset_id

    def query_dataset(
        self,
        dataset_id: int,
        # Query parameters (same as regular query)
        lemma: Optional[str] = None,
        pos: Optional[str] = None,
        not_lemma: Optional[str] = None,
        not_pos: Optional[str] = None,
        context_before: int = 0,
        context_after: int = 0,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> List[QueryResult]:
        """
        Query within a saved dataset

        This allows refining queries on a sub-corpus
        """
        return self.query_engine.query(
            lemma=lemma,
            pos=pos,
            not_lemma=not_lemma,
            not_pos=not_pos,
            context_before=context_before,
            context_after=context_after,
            limit=limit,
            offset=offset,
            dataset_id=dataset_id
        )

    def create_nested_dataset(
        self,
        name: str,
        parent_dataset_id: int,
        query_params: Dict[str, Any],
        description: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> int:
        """
        Create a dataset from another dataset (nested query)

        Example:
            # First dataset: all "roi" with context
            ds1 = manager.create_dataset(
                name="roi_contexts",
                query_params={'lemma': 'roi', 'context_before': 10, 'context_after': 10}
            )

            # Nested dataset: find "dire" within roi contexts
            ds2 = manager.create_nested_dataset(
                name="dire_in_roi_contexts",
                parent_dataset_id=ds1,
                query_params={'lemma': 'dire'}
            )
        """
        # Query the parent dataset
        context_before = query_params.pop('context_before', 5)
        context_after = query_params.pop('context_after', 5)

        results = self.query_dataset(
            dataset_id=parent_dataset_id,
            context_before=context_before,
            context_after=context_after,
            **query_params
        )

        # Create new dataset
        dataset = Dataset(
            name=name,
            description=description,
            created_by_user_id=user_id,
            parent_dataset_id=parent_dataset_id,
            query_params=json.dumps({
                **query_params,
                'context_before': context_before,
                'context_after': context_after,
                'parent_dataset_id': parent_dataset_id
            }),
            token_count=len(results)
        )

        self.db.add(dataset)
        self.db.flush()

        # Add tokens
        for result in results:
            dataset_token = DatasetToken(
                dataset_id=dataset.dataset_id,
                token_id=result.token_id,
                context_start_position=result.position - context_before,
                context_end_position=result.position + context_after,
                match_position=result.position
            )
            self.db.add(dataset_token)

        self.db.commit()

        return dataset.dataset_id

    def get_dataset(self, dataset_id: int) -> Optional[Dataset]:
        """Get dataset by ID"""
        return self.db.query(Dataset).filter(
            Dataset.dataset_id == dataset_id
        ).first()

    def get_dataset_by_name(self, name: str) -> Optional[Dataset]:
        """Get dataset by name"""
        return self.db.query(Dataset).filter(
            Dataset.name == name
        ).first()

    def list_datasets(
        self,
        user_id: Optional[int] = None,
        include_temporary: bool = False
    ) -> List[Dataset]:
        """List all datasets"""
        query = self.db.query(Dataset)

        if user_id is not None:
            query = query.filter(Dataset.created_by_user_id == user_id)

        if not include_temporary:
            query = query.filter(Dataset.is_temporary == False)

        return query.order_by(Dataset.created_at.desc()).all()

    def delete_dataset(self, dataset_id: int) -> bool:
        """Delete a dataset"""
        dataset = self.get_dataset(dataset_id)
        if not dataset:
            return False

        self.db.delete(dataset)
        self.db.commit()
        return True

    def delete_temporary_datasets(self) -> int:
        """Delete all temporary datasets, return count deleted"""
        count = self.db.query(Dataset).filter(
            Dataset.is_temporary == True
        ).delete()
        self.db.commit()
        return count
