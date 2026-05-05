"""
Database models for corpus data
"""
from sqlalchemy import Column, Integer, String, ForeignKey, Index, DateTime, Boolean, JSON, Table
from sqlalchemy import Text as SAText
from sqlalchemy.orm import relationship
from datetime import datetime
from ..core.database import Base


# Many-to-many junction table for subcorpora <-> texts
subcorpus_texts = Table(
    "subcorpus_texts",
    Base.metadata,
    Column("subcorpus_id", Integer, ForeignKey("subcorpora.subcorpus_id"), primary_key=True),
    Column("text_id", Integer, ForeignKey("texts.text_id"), primary_key=True),
)


class User(Base):
    """User accounts (for future RBAC)"""
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="researcher")  # admin, researcher, viewer
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Relationships
    texts = relationship("Text", back_populates="added_by")
    datasets = relationship("Dataset", back_populates="created_by")


class Text(Base):
    """Text metadata - represents one source text"""
    __tablename__ = "texts"

    text_id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), unique=True, nullable=False, index=True)
    title = Column(String(500))
    author = Column(String(500))

    # Two-level classification
    domain = Column(String(100), index=True)  # fiction, law, religious, etc.
    genre = Column(String(100), index=True)   # romance, epic, hagiography, etc.

    # Temporal metadata — composition dates
    period_start = Column(Integer, index=True)  # Year
    period_end = Column(Integer, index=True)    # Year
    # Manuscript dates (when the specific copy was made)
    ms_date_start = Column(Integer, nullable=True)
    ms_date_end = Column(Integer, nullable=True)

    # Provenance
    date_added = Column(DateTime, default=datetime.utcnow)
    added_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    # Additional metadata
    format_type = Column(String(20))  # format1, format2, format3
    token_count = Column(Integer, default=0)
    notes = Column(SAText)

    # Relationships
    tokens = relationship("Token", back_populates="text", cascade="all, delete-orphan")
    added_by = relationship("User", back_populates="texts")
    subcorpora = relationship("Subcorpus", secondary="subcorpus_texts", back_populates="texts")

    # Indexes
    __table_args__ = (
        Index('idx_domain_genre', 'domain', 'genre'),
        Index('idx_period', 'period_start', 'period_end'),
    )


class Token(Base):
    """Individual word tokens"""
    __tablename__ = "tokens"

    token_id = Column(Integer, primary_key=True, index=True)
    text_id = Column(Integer, ForeignKey("texts.text_id"), nullable=False, index=True)
    position = Column(Integer, nullable=False)  # Position in text (0-indexed)

    # Linguistic annotations
    token = Column(String(255), nullable=False, index=True)  # Word form
    lemma = Column(String(255), nullable=False, index=True)  # Lemma (source annotation, e.g. TL)
    lemma_dmf = Column(String(255), nullable=True, index=True)  # Lemma normalized to DMF headword
    pos = Column(String(20), nullable=False, index=True)     # UD POS tag

    # Citation information (e.g., line number "42" or manuscript ref "1_r1l8")
    citation = Column(String(50))  # Line number or manuscript reference

    # Relationships
    text = relationship("Text", back_populates="tokens")

    # Indexes for performance
    __table_args__ = (
        Index('idx_lemma_pos', 'lemma', 'pos'),
        Index('idx_lemma_dmf_pos', 'lemma_dmf', 'pos'),
        Index('idx_text_position', 'text_id', 'position'),
    )


class Dataset(Base):
    """Saved datasets (sub-corpora from query results)"""
    __tablename__ = "datasets"

    dataset_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(SAText)

    # Provenance
    created_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Dataset properties
    is_temporary = Column(Boolean, default=False)
    parent_dataset_id = Column(Integer, ForeignKey("datasets.dataset_id"), nullable=True)

    # Store the query that created this dataset
    query_params = Column(JSON)

    # Statistics
    token_count = Column(Integer, default=0)

    # Relationships
    created_by = relationship("User", back_populates="datasets")
    parent_dataset = relationship("Dataset", remote_side=[dataset_id])
    dataset_tokens = relationship("DatasetToken", back_populates="dataset", cascade="all, delete-orphan")


class DatasetToken(Base):
    """Tokens belonging to a dataset (with context information)"""
    __tablename__ = "dataset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.dataset_id"), nullable=False, index=True)
    token_id = Column(Integer, ForeignKey("tokens.token_id"), nullable=False, index=True)

    # Context information
    context_start_position = Column(Integer)  # Position of first token in context window
    context_end_position = Column(Integer)    # Position of last token in context window
    match_position = Column(Integer)          # Position of the matched token

    # Relationships
    dataset = relationship("Dataset", back_populates="dataset_tokens")
    token = relationship("Token")

    __table_args__ = (
        Index('idx_dataset_token', 'dataset_id', 'token_id'),
    )


class Subcorpus(Base):
    """Named group of texts (subcorpus)"""
    __tablename__ = "subcorpora"

    subcorpus_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False)
    description = Column(SAText, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    texts = relationship("Text", secondary="subcorpus_texts", back_populates="subcorpora")
