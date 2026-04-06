from __future__ import annotations

from pathlib import Path

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

