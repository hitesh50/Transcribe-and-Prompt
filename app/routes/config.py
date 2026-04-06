from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from app.models import ConfigResponse, ConfigUpdateRequest, ModelRefreshResponse

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("", response_model=ConfigResponse)
async def get_config(request: Request) -> ConfigResponse:
    manager = request.app.state.settings_manager
    return ConfigResponse(config=manager.build_public_config())


@router.post("", response_model=ConfigResponse)
async def save_config(request: Request, payload: ConfigUpdateRequest) -> ConfigResponse:
    manager = request.app.state.settings_manager
    manager.update_config(
        default_model=payload.default_model,
        allowed_models=payload.allowed_models,
        enable_paid_models=payload.enable_paid_models,
        api_key=payload.api_key,
    )
    return ConfigResponse(config=manager.build_public_config())


@router.post("/models/refresh", response_model=ModelRefreshResponse)
async def refresh_models(
    request: Request,
    free_only: bool | None = Query(default=None),
) -> ModelRefreshResponse:
    manager = request.app.state.settings_manager
    service = request.app.state.openrouter_service
    current_config = manager.load_config()
    effective_free_only = free_only if free_only is not None else not current_config.openrouter.enable_paid_models
    try:
        models = await service.list_models(free_only=effective_free_only)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    manager.merge_model_catalog([model.id for model in models], free_only=effective_free_only)
    return ModelRefreshResponse(config=manager.build_public_config(), models=models)
