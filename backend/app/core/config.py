"""
Application configuration
"""
from pydantic_settings import BaseSettings
from pathlib import Path

# Resolve paths relative to the backend/ directory
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # backend/


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "Medieval French Corpus Tool"
    VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = f"sqlite:///{_BACKEND_DIR / 'data' / 'corpus.db'}"

    # Security (for future RBAC)
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Paths
    DATA_DIR: Path = _BACKEND_DIR / "data"
    UPLOAD_DIR: Path = _BACKEND_DIR / "data" / "uploads"
    EXPORT_DIR: Path = _BACKEND_DIR / "data" / "exports"

    # Query limits
    MAX_RESULTS: int = 10000
    DEFAULT_CONTEXT_WINDOW: int = 5

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# Ensure directories exist
settings.DATA_DIR.mkdir(exist_ok=True)
settings.UPLOAD_DIR.mkdir(exist_ok=True)
settings.EXPORT_DIR.mkdir(exist_ok=True)
