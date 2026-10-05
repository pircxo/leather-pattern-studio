from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException

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
    allow_origins=os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException):
    codes = {404: "not_found", 409: "conflict", 422: "validation_error"}
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={"error": codes.get(exc.status_code, "request_error"), "detail": str(exc.detail)},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    detail = "; ".join(
        f"{'.'.join(str(part) for part in error['loc'][1:])}: {error['msg']}"
        for error in exc.errors()
    )
    return JSONResponse(status_code=422, content={"error": "validation_error", "detail": detail})


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
