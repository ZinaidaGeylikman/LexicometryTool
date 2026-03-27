"""
FastAPI application entry point
"""
import json
import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .core.config import settings
from .core.database import get_db, init_db
from .queries import FrequencyAnalyzer
from .models.corpus import Token
from .parsers.lemma_normalizer import normalize_lemma, reload_manual_map

_TOKEN_CORRECTIONS_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "token_corrections.json"
)

def _load_token_corrections() -> dict:
    try:
        with open(os.path.normpath(_TOKEN_CORRECTIONS_PATH), encoding="utf-8") as f:
            raw = json.load(f)
        return {k: v for k, v in raw.items() if not k.startswith("_")}
    except FileNotFoundError:
        return {}
from .api.texts import router as texts_router
from .api.queries import router as queries_router
from .api.frequency import router as frequency_router
from .api.datasets import router as datasets_router
from .api.subcorpora import router as subcorpora_router

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG
)

# CORS middleware (for React frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(texts_router, prefix="/api/texts", tags=["texts"])
app.include_router(queries_router, prefix="/api/query", tags=["queries"])
app.include_router(frequency_router, prefix="/api/frequency", tags=["frequency"])
app.include_router(datasets_router, prefix="/api/datasets", tags=["datasets"])
app.include_router(subcorpora_router, prefix="/api/subcorpora", tags=["subcorpora"])


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()
    print(f"✓ {settings.APP_NAME} v{settings.VERSION} started")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check"""
    return {"status": "healthy"}


@app.get("/api/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get corpus statistics"""
    analyzer = FrequencyAnalyzer(db)
    return analyzer.corpus_statistics()


@app.post("/api/admin/renormalize")
async def renormalize_lemmas(db: Session = Depends(get_db)):
    """Re-apply lemma_normalizations.json and token_corrections.json to all tokens."""
    reload_manual_map()
    corrections = _load_token_corrections()
    changed = 0

    # Step 1: lemma-level DMF normalization
    distinct = db.query(Token.lemma).distinct().all()
    for (lemma,) in distinct:
        new_dmf = normalize_lemma(lemma)
        count = (
            db.query(Token)
            .filter(Token.lemma == lemma, Token.lemma_dmf != new_dmf)
            .update({Token.lemma_dmf: new_dmf}, synchronize_session=False)
        )
        changed += count

    # Step 2: token-level corrections from token_corrections.json
    for source_lemma, rules in corrections.items():
        pos_override = rules.get("_pos")
        form_overrides = {k: v for k, v in rules.items() if not k.startswith("_")}

        if pos_override:
            count = (
                db.query(Token)
                .filter(Token.lemma == source_lemma, Token.pos != pos_override)
                .update({Token.pos: pos_override}, synchronize_session=False)
            )
            changed += count

        for forms_str, dmf in form_overrides.items():
            forms = [f.strip() for f in forms_str.split("/")]
            count = (
                db.query(Token)
                .filter(Token.lemma == source_lemma,
                        Token.token.in_(forms),
                        Token.lemma_dmf != dmf)
                .update({Token.lemma_dmf: dmf}, synchronize_session=False)
            )
            changed += count

    db.commit()
    return {"updated_tokens": changed}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
