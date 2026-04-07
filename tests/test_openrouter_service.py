from __future__ import annotations

from pathlib import Path

import httpx

from app.config import SettingsManager
from app.services.openrouter_service import OpenRouterService


async def test_openrouter_service_builds_prompt_payload(monkeypatch, test_paths: dict[str, Path]) -> None:
    manager = SettingsManager(
        config_path=test_paths["config_path"],
        env_path=test_paths["env_path"],
    )
    service = OpenRouterService(manager)
    captured: dict[str, object] = {}

    async def fake_post(self, url: str, headers: dict[str, str], json: dict[str, object]):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return httpx.Response(
            status_code=200,
            request=httpx.Request("POST", url),
            json={
                "choices": [
                    {
                        "message": {
                            "content": "Operational risk is elevated.",
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    response = await service.generate_prompt_response(
        user_prompt="What are the top risks?",
        system_prompt="Be concise.",
        model="qwen/qwen3.6-plus-preview:free",
    )

    assert response.content == "Operational risk is elevated."
    assert str(captured["url"]).endswith("/chat/completions")
    payload = captured["json"]
    assert isinstance(payload, dict)
    assert payload["model"] == "qwen/qwen3.6-plus-preview:free"
    assert payload["messages"][0]["role"] == "system"


def test_openrouter_service_accepts_text_output_modalities(test_paths: dict[str, Path]) -> None:
    manager = SettingsManager(
        config_path=test_paths["config_path"],
        env_path=test_paths["env_path"],
    )
    service = OpenRouterService(manager)

    assert service._supports_text(
        {
            "architecture": {
                "modality": "text+image+video->text",
                "output_modalities": ["text"],
            }
        }
    )
    assert service._supports_text(
        {
            "architecture": {
                "modality": "text->text",
            }
        }
    )
    assert not service._supports_text(
        {
            "architecture": {
                "modality": "text->image",
                "output_modalities": ["image"],
            }
        }
    )
