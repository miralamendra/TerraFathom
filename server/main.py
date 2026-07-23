"""
TerraFathom Universal Urban Network Engine — Main entry point.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.router import router as api_router
from config import settings
from storage.filesystem_adapter import FilesystemAdapter
from storage.sqlite_adapter import SQLiteStorageAdapter
from urban_engine.exceptions import UrbanEngineError
from worker import BackgroundWorker

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("urban_engine.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize storage & filesystem adapters
    storage = SQLiteStorageAdapter(settings.db_path)
    storage.initialize()
    app.state.storage = storage

    filesystem = FilesystemAdapter(settings.storage_dir)
    app.state.filesystem = filesystem

    # Initialize worker
    worker = BackgroundWorker(storage, filesystem)
    app.state.worker = worker

    logger.info("Universal Urban Network Engine initialized.")
    yield

    # Shutdown
    worker.shutdown(wait=True)
    storage.close()
    logger.info("Universal Urban Network Engine shut down.")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler
@app.exception_handler(UrbanEngineError)
async def urban_engine_error_handler(request: Request, exc: UrbanEngineError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": exc.code,
            "message": exc.safe_message,
            "detail": exc.detail,
        },
    )


# Standard catch-all error handler
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error_code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred on the server.",
            "detail": str(exc) if settings.debug else None,
        },
    )


# Include main API router
app.include_router(api_router)


@app.get("/")
async def root():
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
