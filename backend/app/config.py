"""Settings from backend/.env. Never log these values."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")


@dataclass(frozen=True)
class Settings:
    azure_openai_endpoint: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    azure_openai_api_key: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    azure_openai_deployment: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini")
    # 127.0.0.1, not localhost: avoids a slow IPv6 lookup on Windows when the AI tools call the API
    api_base: str = os.getenv("API_BASE", "http://127.0.0.1:8000")
    # browser origins allowed to call the API, comma separated (add the GitHub Pages origin when hosted)
    allowed_origins: tuple = tuple(o.strip().rstrip("/") for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip())
    # Foundry calls per client IP per hour on /api/chat and /api/plan, so a public URL can't run up the bill
    ai_requests_per_hour: int = int(os.getenv("AI_REQUESTS_PER_HOUR", "30"))

    @property
    def ai_configured(self) -> bool:
        return bool(self.azure_openai_endpoint and self.azure_openai_api_key and "<your-resource>" not in self.azure_openai_endpoint)

    def __repr__(self):  # keep the key out of logs and tracebacks
        return f"Settings(deployment={self.azure_openai_deployment!r}, ai_configured={self.ai_configured})"


settings = Settings()
