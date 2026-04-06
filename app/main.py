from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.config import SettingsManager
from app.routes.config import router as config_router
from app.routes.prompt import router as prompt_router
from app.routes.transcribe import router as transcribe_router, websocket_router
from app.services.diarization_service import DiarizationService
from app.services.openrouter_service import OpenRouterService
from app.services.whisper_service import WhisperService
from app.state import SessionRegistry
from app.utils.scheduler import SessionInsightScheduler


def create_app(
    *,
    config_path: Path | None = None,
    env_path: Path | None = None,
) -> FastAPI:
    settings_manager = SettingsManager(config_path=config_path, env_path=env_path)
    app_config = settings_manager.load_config()
    settings_manager.ensure_storage_dirs(app_config)

    registry = SessionRegistry(
        sessions_dir=settings_manager.resolve_sessions_dir(app_config),
        insights_dir=settings_manager.resolve_insights_dir(app_config),
    )
    openrouter_service = OpenRouterService(settings_manager)
    whisper_service = WhisperService(settings_manager)
    diarization_service = DiarizationService(settings_manager)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await registry.close()

    app = FastAPI(
        title="LocalRiskInsights",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.state.settings_manager = settings_manager
    app.state.session_registry = registry
    app.state.openrouter_service = openrouter_service
    app.state.whisper_service = whisper_service
    app.state.diarization_service = diarization_service

    async def generate_session_insights(session_id: str, transcript: str) -> None:
        await openrouter_service.generate_insights(session_id, transcript)

    app.state.insight_scheduler = SessionInsightScheduler(
        registry=registry,
        interval_seconds=app_config.transcription.insight_interval_seconds,
        generate_callback=generate_session_insights,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(config_router)
    app.include_router(prompt_router)
    app.include_router(transcribe_router)
    app.include_router(websocket_router)

    @app.get("/api/health")
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    static_dir = settings_manager.root_dir / "app" / "static"

    @app.get("/", include_in_schema=False)
    async def serve_root():
        index_path = static_dir / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return JSONResponse({"message": "LocalRiskInsights backend is running."})

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        target = static_dir / full_path
        if target.exists() and target.is_file():
            return FileResponse(target)
        index_path = static_dir / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return JSONResponse({"detail": "Not found"}, status_code=404)

    return app


app = create_app()
