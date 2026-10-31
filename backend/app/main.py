import logging
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.session import get_db
from app.api.v1.router import router

settings = get_settings()
app = FastAPI(title="Subscription Management System API", version="1.0.0",
              description="Brightloop subscription management backend. Amounts are decimal strings.")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(router)


@app.exception_handler(IntegrityError)
async def integrity_error(request: Request, exc: IntegrityError):
    return JSONResponse(status_code=409, content={"detail": "Conflicting record or database constraint violation"})


@app.get("/api/v1/health", tags=["Health"])
def health():
    return {"status": "healthy", "service": "subscription-management-backend"}


@app.get("/api/v1/health/ready", tags=["Health"])
def readiness(db: Session = Depends(get_db, scope="function")):
    try:
        db.execute(text("SELECT 1 FROM alembic_version"))
    except Exception:
        raise HTTPException(503, "Database unavailable or migrations have not been applied")
    return {"status": "ready"}
