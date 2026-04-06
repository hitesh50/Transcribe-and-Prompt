from __future__ import annotations

from pathlib import Path
from threading import RLock
from typing import Any

import yaml
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = ROOT_DIR / "config.yaml"
DEFAULT_ENV_PATH = ROOT_DIR / ".env"


class OpenRouterConfig(BaseModel):
    api_base: str = "https://openrouter.ai/api/v1"
    default_model: str = "qwen/qwen3.6-plus-preview:free"
    allowed_models: list[str] = Field(
        default_factory=lambda: [
            "qwen/qwen3.6-plus-preview:free",
            "meta-llama/llama-3.3-70b-instruct:free",
        ]
    )
    enable_paid_models: bool = False

    @field_validator("allowed_models")
    @classmethod
    def dedupe_models(cls, value: list[str]) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []
        for model in value:
            if model and model not in seen:
                ordered.append(model)
                seen.add(model)
        return ordered


class TranscriptionConfig(BaseModel):
    segment_seconds: int = 30
    insight_interval_seconds: int = 120
    diarization_model: str = "local-fallback"
    whisper_model: str = "small"
    device: str = "cpu"
    compute_type: str = "int8"
    local_diarization_model_path: str = ""


class StorageConfig(BaseModel):
    sessions_dir: str = "./data/sessions"
    insights_dir: str = "./data/insights"


class AppConfig(BaseModel):
    openrouter: OpenRouterConfig = Field(default_factory=OpenRouterConfig)
    transcription: TranscriptionConfig = Field(default_factory=TranscriptionConfig)
    storage: StorageConfig = Field(default_factory=StorageConfig)


class PublicConfig(BaseModel):
    api_base: str
    default_model: str
    allowed_models: list[str]
    enable_paid_models: bool
    api_key_configured: bool
    segment_seconds: int
    insight_interval_seconds: int


def resolve_path(root_dir: Path, raw_path: str) -> Path:
    path = Path(raw_path)
    return path if path.is_absolute() else (root_dir / path).resolve()


class SettingsManager:
    def __init__(
        self,
        config_path: Path | None = None,
        env_path: Path | None = None,
        root_dir: Path | None = None,
    ) -> None:
        self.root_dir = (root_dir or ROOT_DIR).resolve()
        self.config_path = (config_path or DEFAULT_CONFIG_PATH).resolve()
        self.env_path = (env_path or DEFAULT_ENV_PATH).resolve()
        self._lock = RLock()
        self._cached_config: AppConfig | None = None
        load_dotenv(self.env_path, override=False)

    def load_config(self, *, force_reload: bool = False) -> AppConfig:
        with self._lock:
            if self._cached_config is not None and not force_reload:
                return self._cached_config

            if not self.config_path.exists():
                config = AppConfig()
                self.save_config(config)
                return config

            raw_data = yaml.safe_load(self.config_path.read_text(encoding="utf-8")) or {}
            config = AppConfig.model_validate(raw_data)

            if config.openrouter.default_model not in config.openrouter.allowed_models:
                config.openrouter.allowed_models.insert(0, config.openrouter.default_model)

            self._cached_config = config
            self.ensure_storage_dirs(config)
            return config

    def save_config(self, config: AppConfig) -> AppConfig:
        with self._lock:
            if config.openrouter.default_model not in config.openrouter.allowed_models:
                config.openrouter.allowed_models.insert(0, config.openrouter.default_model)

            payload = config.model_dump(mode="python")
            self.config_path.write_text(
                yaml.safe_dump(payload, sort_keys=False),
                encoding="utf-8",
            )
            self._cached_config = config
            self.ensure_storage_dirs(config)
            return config

    def update_config(
        self,
        *,
        default_model: str | None = None,
        allowed_models: list[str] | None = None,
        enable_paid_models: bool | None = None,
        api_key: str | None = None,
    ) -> AppConfig:
        config = self.load_config(force_reload=True)

        if default_model is not None:
            config.openrouter.default_model = default_model
        if allowed_models is not None:
            config.openrouter.allowed_models = allowed_models
        if enable_paid_models is not None:
            config.openrouter.enable_paid_models = enable_paid_models

        if not config.openrouter.enable_paid_models:
            free_models = [model for model in config.openrouter.allowed_models if self.is_free_model_id(model)]
            if free_models and config.openrouter.default_model not in free_models:
                config.openrouter.default_model = free_models[0]

        if api_key is not None:
            self._write_api_key(api_key)

        return self.save_config(config)

    def ensure_storage_dirs(self, config: AppConfig | None = None) -> None:
        cfg = config or self.load_config()
        self.resolve_sessions_dir(cfg).mkdir(parents=True, exist_ok=True)
        self.resolve_insights_dir(cfg).mkdir(parents=True, exist_ok=True)

    def resolve_sessions_dir(self, config: AppConfig | None = None) -> Path:
        cfg = config or self.load_config()
        return resolve_path(self.root_dir, cfg.storage.sessions_dir)

    def resolve_insights_dir(self, config: AppConfig | None = None) -> Path:
        cfg = config or self.load_config()
        return resolve_path(self.root_dir, cfg.storage.insights_dir)

    def get_api_key(self) -> str | None:
        load_dotenv(self.env_path, override=True)
        from os import getenv

        value = getenv("OPENROUTER_API_KEY", "").strip()
        return value or None

    def api_key_configured(self) -> bool:
        return bool(self.get_api_key())

    def build_public_config(self) -> PublicConfig:
        config = self.load_config()
        return PublicConfig(
            api_base=config.openrouter.api_base,
            default_model=config.openrouter.default_model,
            allowed_models=config.openrouter.allowed_models,
            enable_paid_models=config.openrouter.enable_paid_models,
            api_key_configured=self.api_key_configured(),
            segment_seconds=config.transcription.segment_seconds,
            insight_interval_seconds=config.transcription.insight_interval_seconds,
        )

    def _write_api_key(self, api_key: str) -> None:
        existing: dict[str, str] = {}
        if self.env_path.exists():
            for line in self.env_path.read_text(encoding="utf-8").splitlines():
                if not line or line.lstrip().startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                existing[key.strip()] = value.strip()

        if api_key.strip():
            existing["OPENROUTER_API_KEY"] = api_key.strip()
        else:
            existing.pop("OPENROUTER_API_KEY", None)

        lines = [f"{key}={value}" for key, value in sorted(existing.items())]
        self.env_path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
        load_dotenv(self.env_path, override=True)

    def merge_model_catalog(self, models: list[str], *, free_only: bool) -> AppConfig:
        config = self.load_config(force_reload=True)
        config.openrouter.allowed_models = models
        config.openrouter.enable_paid_models = not free_only
        if config.openrouter.default_model not in models and models:
            config.openrouter.default_model = models[0]
        return self.save_config(config)

    def is_free_model_id(self, model_id: str) -> bool:
        normalized = model_id.strip().lower()
        return normalized.endswith(":free") or normalized == "openrouter/free"


def load_yaml_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
