from __future__ import annotations

from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def test_paths(tmp_path: Path) -> dict[str, Path]:
    sessions_dir = tmp_path / "sessions"
    insights_dir = tmp_path / "insights"
    config_path = tmp_path / "config.yaml"
    env_path = tmp_path / ".env"

    config_path.write_text(
        yaml.safe_dump(
            {
                "openrouter": {
                    "api_base": "https://openrouter.ai/api/v1",
                    "default_model": "qwen/qwen3.6-plus-preview:free",
                    "allowed_models": [
                        "qwen/qwen3.6-plus-preview:free",
                        "meta-llama/llama-3.3-70b-instruct:free",
                    ],
                    "enable_paid_models": False,
                },
                "transcription": {
                    "segment_seconds": 30,
                    "insight_interval_seconds": 120,
                    "diarization_model": "local-fallback",
                    "whisper_model": "small",
                    "device": "cpu",
                    "compute_type": "int8",
                    "local_diarization_model_path": "",
                },
                "storage": {
                    "sessions_dir": str(sessions_dir),
                    "insights_dir": str(insights_dir),
                },
            },
            sort_keys=False,
        ),
        encoding="utf-8",
    )
    env_path.write_text("OPENROUTER_API_KEY=test-key\n", encoding="utf-8")

    return {
        "config_path": config_path,
        "env_path": env_path,
        "sessions_dir": sessions_dir,
        "insights_dir": insights_dir,
    }


@pytest.fixture
def app_instance(test_paths: dict[str, Path]):
    app = create_app(
        config_path=test_paths["config_path"],
        env_path=test_paths["env_path"],
    )

    async def noop_scheduler(_: str) -> None:
        return None

    app.state.insight_scheduler.ensure_started = noop_scheduler
    return app


@pytest.fixture
def client(app_instance):
    with TestClient(app_instance) as test_client:
        yield test_client

