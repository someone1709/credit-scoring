"""
Credit assessment service. Only the backend should call this, so it isn't exposed to browsers.
It supports a lender's decision and never makes one (Master Brief §14).
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.assessor import MODEL_PATH, Assessor
from app.schemas import ApiError, AssessmentRequest, AssessmentResponse, FieldIssue

logger = logging.getLogger("ml-service")
state: dict[str, Assessor | None] = {"assessor": None}


@asynccontextmanager
async def lifespan(_: FastAPI):
    if MODEL_PATH.exists():
        state["assessor"] = Assessor.load()
        logger.info("Loaded model %s", state["assessor"].model_name)
    else:
        logger.warning("No model at %s. Run `python -m training.train`.", MODEL_PATH)
    yield
    state["assessor"] = None


app = FastAPI(title="BeneScore credit assessment", description="Trained on synthetic data. Not validated on real borrowers.", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
    details = [FieldIssue(field=str(item["loc"][-1]), issue=item["msg"]) for item in error.errors()]
    body = ApiError(error="VALIDATION_ERROR", message="Invalid input", details=details)
    return JSONResponse(status_code=422, content=body.model_dump())


@app.get("/health")
def health() -> dict:
    assessor = state["assessor"]
    return {
        "status": "UP" if assessor else "NO_MODEL",
        "model": assessor.model_name if assessor else None,
        "trained_on": assessor.card["trained_on"] if assessor else None,
    }


@app.post("/assess", response_model=AssessmentResponse, responses={422: {"model": ApiError}, 503: {"model": ApiError}})
def assess(request: AssessmentRequest):
    assessor = state["assessor"]
    if assessor is None:
        body = ApiError(error="MODEL_UNAVAILABLE", message="The model hasn't been trained yet.")
        return JSONResponse(status_code=503, content=body.model_dump())
    return assessor.assess(request)
