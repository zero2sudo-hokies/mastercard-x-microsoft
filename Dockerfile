# Navigator API (FastAPI). Build from the repo root:  docker build -t navigator-api .
FROM python:3.11-slim
WORKDIR /srv/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY data/p3/roi-inputs.json /srv/data/p3/roi-inputs.json
ENV PYTHONUNBUFFERED=1 PORT=8000
EXPOSE 8000
# secrets (AZURE_OPENAI_*) and ALLOWED_ORIGINS come from the host's environment, never the image.
# The AI tools call this same server, so API_BASE follows the port the host assigns.
CMD ["sh", "-c", "API_BASE=http://127.0.0.1:${PORT} exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
