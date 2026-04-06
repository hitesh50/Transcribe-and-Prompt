from __future__ import annotations

from app.models import PromptResponse


def test_prompt_endpoint_returns_model_response(client, app_instance) -> None:
    async def fake_generate_prompt_response(**_: object) -> PromptResponse:
        return PromptResponse(model="qwen/qwen3.6-plus-preview:free", content="Mocked response")

    app_instance.state.openrouter_service.generate_prompt_response = fake_generate_prompt_response

    response = client.post(
        "/api/prompt",
        json={
            "system_prompt": "Be concise.",
            "user_prompt": "Summarize the transcript.",
        },
    )

    assert response.status_code == 200
    assert response.json()["content"] == "Mocked response"

