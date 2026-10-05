from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core_py.db import init_db

from .routers import orders, patterns

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Leather Pattern Studio API",
    version="1.0",
    description=(
        "REST API for generating and storing parametric leather cutting "
        "patterns. See /docs for the interactive schema, or "
        "docs/API.md in the repo for the design rationale (versioning, "
        "error shape, idempotency)."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo project — a real deployment would pin this
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logging.getLogger("lps.api").exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "detail": "something went wrong"},
    )


@app.get("/healthz", tags=["meta"])
def healthz():
    return {"status": "ok"}


app.include_router(patterns.router)
app.include_router(orders.router)
