from __future__ import annotations

from pathlib import Path

import yaml

from app.config import SettingsManager


def test_settings_manager_loads_defaults_and_secret(test_paths: dict[str, Path]) -> None:
    manager = SettingsManager(
        config_path=test_paths["config_path"],
        env_path=test_paths["env_path"],
    )

    config = manager.load_config()

    assert config.openrouter.default_model == "qwen/qwen3.6-plus-preview:free"
    assert manager.api_key_configured() is True
    assert manager.resolve_sessions_dir().exists()
    assert manager.resolve_insights_dir().exists()


def test_settings_manager_keeps_repo_defaults_and_writes_local_override(tmp_path: Path) -> None:
    root_dir = tmp_path
    base_config_path = root_dir / "config.yaml"
    env_path = root_dir / ".env"

    base_config_path.write_text(
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
                    "sessions_dir": "./data/sessions",
                    "insights_dir": "./data/insights",
                },
            },
            sort_keys=False,
        ),
        encoding="utf-8",
    )
    env_path.write_text("", encoding="utf-8")

    manager = SettingsManager(root_dir=root_dir, env_path=env_path)

    config = manager.load_config()

    assert config.openrouter.allowed_models == [
        "qwen/qwen3.6-plus-preview:free",
        "meta-llama/llama-3.3-70b-instruct:free",
    ]
    assert manager.config_path == (root_dir / "data" / "config.local.yaml").resolve()
    assert manager.base_config_path == base_config_path.resolve()
    assert manager.config_path.exists() is False

    manager.update_config(
        default_model="qwen/qwen3.6-plus-preview:free",
        allowed_models=["qwen/qwen3.6-plus-preview:free"],
    )

    assert manager.config_path.exists() is True
    local_override = yaml.safe_load(manager.config_path.read_text(encoding="utf-8"))
    base_config = yaml.safe_load(base_config_path.read_text(encoding="utf-8"))

    assert local_override["openrouter"]["allowed_models"] == ["qwen/qwen3.6-plus-preview:free"]
    assert base_config["openrouter"]["allowed_models"] == [
        "qwen/qwen3.6-plus-preview:free",
        "meta-llama/llama-3.3-70b-instruct:free",
    ]
