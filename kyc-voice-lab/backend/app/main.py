"""FastAPI application entrypoint for KYC Voice Lab."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_v1_router
from app.core.config import settings
from app.db.seed import seed_customers
from app.db.session import SessionLocal, engine
from app.models.models import Base

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("kyc-voice-lab")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist and initial synthetic customers are seeded
    logger.info("Initializing SQLite database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_customers(db)
        logger.info("Database initialized and verified.")
    finally:
        db.close()

    yield
    logger.info("Shutting down KYC Voice Lab backend.")


app = FastAPI(
    title="KYC Voice Lab API",
    description="Automated local-first speech-to-text KYC verification proof-of-concept.",
    version="1.0.0",
    lifespan=lifespan,
)

# Restrict CORS to configured origins (Next.js frontend development origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix="/api/v1")


@app.get("/", tags=["Root"])
def root():
    return {
        "service": "KYC Voice Lab API",
        "version": "1.0.0",
        "status": "running",
        "docs_url": "/docs",
    }
