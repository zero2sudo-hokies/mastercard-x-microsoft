"""Foundry (Azure OpenAI v1) client. Keys come from backend/.env via app.config; never log them."""
from functools import lru_cache

from openai import OpenAI

from app.config import settings


@lru_cache(maxsize=1)
def get_client() -> OpenAI:
    return OpenAI(base_url=settings.azure_openai_endpoint, api_key=settings.azure_openai_api_key, timeout=90, max_retries=1)


def chat(messages, tools=None, max_completion_tokens=1500, tool_choice="auto", reasoning_effort=None):
    kwargs = {"tools": tools, "tool_choice": tool_choice} if tools else {}
    if reasoning_effort:
        kwargs["reasoning_effort"] = reasoning_effort
    # gpt-5-mini is a reasoning model: no temperature
    return get_client().chat.completions.create(
        model=settings.azure_openai_deployment, messages=messages, max_completion_tokens=max_completion_tokens, **kwargs
    )
