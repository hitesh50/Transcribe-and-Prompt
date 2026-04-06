from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import httpx

from app.config import SettingsManager
from app.models import ModelOption, PromptResponse

CRO_SYSTEM_PROMPT = """You are the Chief Risk Officer at Invesco Ltd.

Review the transcript with a risk-management lens. Focus on operational, market,
compliance, conduct, technology, liquidity, reputational, and concentration risk.
Highlight emerging issues, uncertainties, and missing controls. Keep the response
practical and concise for an executive reader.
"""


class OpenRouterService:
    def __init__(self, settings_manager: SettingsManager) -> None:
        self.settings_manager = settings_manager

    async def list_models(self, *, free_only: bool) -> list[ModelOption]:
        config = self.settings_manager.load_config()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{config.openrouter.api_base.rstrip('/')}/models",
                headers=self._headers(optional=True),
            )
            response.raise_for_status()

        payload = response.json()
        options: list[ModelOption] = []
        for item in payload.get("data", []):
            model_id = item.get("id")
            if not model_id or not self._supports_text(item):
                continue
            is_free = self._is_free_model(item.get("pricing", {}))
            if free_only and not is_free:
                continue
            options.append(
                ModelOption(
                    id=model_id,
                    name=item.get("name"),
                    context_length=item.get("context_length"),
                    is_free=is_free,
                )
            )
        return sorted(options, key=lambda option: (not option.is_free, option.id.lower()))

    async def generate_prompt_response(
        self,
        *,
        user_prompt: str,
        system_prompt: str | None = None,
        model: str | None = None,
    ) -> PromptResponse:
        selected_model = self._resolve_model(model)
        payload = {
            "model": selected_model,
            "messages": [
                *(
                    [{"role": "system", "content": system_prompt.strip()}]
                    if system_prompt and system_prompt.strip()
                    else []
                ),
                {"role": "user", "content": user_prompt.strip()},
            ],
            "stream": False,
        }
        data = await self._post_chat_completion(payload)
        content = self._extract_message_content(data)
        return PromptResponse(model=selected_model, content=content)

    async def generate_insights(self, session_id: str, transcript: str) -> Path:
        selected_model = self._resolve_model(None)
        payload = {
            "model": selected_model,
            "messages": [
                {"role": "system", "content": CRO_SYSTEM_PROMPT.strip()},
                {
                    "role": "user",
                    "content": (
                        "Analyze the following meeting transcript and provide:\n"
                        "1. Executive summary\n"
                        "2. Top risks and why they matter\n"
                        "3. Missing information or controls to verify\n"
                        "4. Recommended follow-up actions\n\n"
                        f"Transcript:\n{transcript}"
                    ),
                },
            ],
            "stream": False,
        }
        response = await self._post_chat_completion(payload)
        content = self._extract_message_content(response)

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        insights_path = self.settings_manager.resolve_insights_dir() / f"{session_id}_insight_{timestamp}.json"
        insights_payload = {
            "session_id": session_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "model": selected_model,
            "insights_markdown": content,
            "raw_response": response,
        }
        insights_path.write_text(json.dumps(insights_payload, indent=2), encoding="utf-8")
        return insights_path

    async def _post_chat_completion(self, payload: dict[str, Any]) -> dict[str, Any]:
        config = self.settings_manager.load_config()
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{config.openrouter.api_base.rstrip('/')}/chat/completions",
                headers=self._headers(optional=False),
                json=payload,
            )
            response.raise_for_status()
            return response.json()

    def _headers(self, *, optional: bool) -> dict[str, str]:
        api_key = self.settings_manager.get_api_key()
        if not api_key and not optional:
            raise RuntimeError("OPENROUTER_API_KEY is not configured.")

        headers = {
            "Content-Type": "application/json",
            "X-Title": "LocalRiskInsights",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        return headers

    def _resolve_model(self, requested_model: str | None) -> str:
        config = self.settings_manager.load_config()
        allowed = config.openrouter.allowed_models
        model = requested_model or config.openrouter.default_model
        if not config.openrouter.enable_paid_models and not self.settings_manager.is_free_model_id(model):
            free_models = [item for item in allowed if self.settings_manager.is_free_model_id(item)]
            if free_models:
                return free_models[0]
        if model in allowed:
            return model
        if allowed:
            return allowed[0]
        return model

    def _extract_message_content(self, response_payload: dict[str, Any]) -> str:
        choices = response_payload.get("choices", [])
        if not choices:
            return ""
        message = choices[0].get("message", {})
        content = message.get("content", "")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            text_chunks = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    text_chunks.append(item.get("text", ""))
            return "\n".join(chunk for chunk in text_chunks if chunk).strip()
        return str(content)

    def _supports_text(self, model_payload: dict[str, Any]) -> bool:
        architecture = model_payload.get("architecture", {})
        modality = architecture.get("modality")
        if modality:
            return modality == "text"
        modalities = model_payload.get("modalities") or []
        return not modalities or "text" in modalities

    def _is_free_model(self, pricing: dict[str, Any]) -> bool:
        values = []
        for key in ("prompt", "completion", "request"):
            values.append(self._coerce_decimal(pricing.get(key)))
        known_values = [value for value in values if value is not None]
        return bool(known_values) and all(value == Decimal("0") for value in known_values)

    def _coerce_decimal(self, value: Any) -> Decimal | None:
        if value in (None, ""):
            return None
        try:
            return Decimal(str(value))
        except InvalidOperation:
            return None
