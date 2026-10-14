import logging
import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import areas, banks, meta, recommend, roi

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("navigator")

app = FastAPI(title="Underserved Market Navigator API", version="2.0")


@app.middleware("http")
async def log_and_guard(request: Request, call_next):
    """Log method, path, status, ms (never bodies or keys) and turn any crash into a plain 500."""
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("unhandled error on %s %s", request.method, request.url.path)
        response = JSONResponse({"detail": "Something went wrong"}, status_code=500)
    log.info("%s %s %s %.0fms", request.method, request.url.path, response.status_code, (time.perf_counter() - start) * 1000)
    return response


AI_PATHS = ("/api/chat", "/api/plan")
_ai_calls: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def limit_ai_calls(request: Request, call_next):
    """Per-IP hourly cap on the Foundry-backed routes. In memory: resets on restart, per instance."""
    if request.method == "POST" and request.url.path.startswith(AI_PATHS):
        # behind a host proxy (Azure, Render) the client is the first X-Forwarded-For entry
        ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (request.client.host if request.client else "?")
        now, calls = time.time(), _ai_calls[ip]
        while calls and now - calls[0] > 3600:
            calls.popleft()
        if len(calls) >= settings.ai_requests_per_hour:
            return JSONResponse({"detail": "Too many AI requests from this address. Try again in a little while."}, status_code=429)
        calls.append(now)
    return await call_next(request)


# added last so CORS is outermost: its headers land on every response, 429s and 500s included
app.add_middleware(CORSMiddleware, allow_origins=list(settings.allowed_origins), allow_methods=["GET", "POST"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    """Contract errors are {"detail": "message"}, so flatten pydantic's list into one line."""
    err = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in err.get("loc", []) if p not in ("body", "query", "path"))
    return JSONResponse({"detail": f"{field}: {err.get('msg', 'invalid input')}".strip(": ")}, status_code=422)


for module in (meta, areas, recommend, roi, banks):
    app.include_router(module.router)

for name in ("chat", "plan"):
    try:
        module = __import__(f"app.routers.{name}", fromlist=["router"])
        app.include_router(module.router)
    except ImportError:
        pass  # P3 not merged yet
