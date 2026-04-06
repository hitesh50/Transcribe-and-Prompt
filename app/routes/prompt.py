from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.models import PromptRequest, PromptResponse

router = APIRouter(prefix="/api/prompt", tags=["prompt"])


@router.post("", response_model=PromptResponse)
async def send_prompt(request: Request, payload: PromptRequest) -> PromptResponse:
    service = request.app.state.openrouter_service
    try:
        return await service.generate_prompt_response(
            user_prompt=payload.user_prompt,
            system_prompt=payload.system_prompt,
            model=payload.model,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

