from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from app.models import SessionCreateResponse, SessionDetail, SessionSummary, TranscriptionBatch, TranscriptSegment

router = APIRouter(prefix="/api/transcribe", tags=["transcribe"])
websocket_router = APIRouter(tags=["transcribe"])


def _format_timestamp(seconds: float) -> str:
    total_seconds = max(0, int(seconds))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def _build_appended_text(segments: list[TranscriptSegment]) -> str:
    return "\n".join(
        f"[{_format_timestamp(segment.start)}] {segment.speaker_id}: {segment.text}"
        for segment in segments
    )


@router.post("/sessions", response_model=SessionCreateResponse)
async def create_session(request: Request) -> SessionCreateResponse:
    registry = request.app.state.session_registry
    scheduler = request.app.state.insight_scheduler
    session = await registry.create_session()
    await scheduler.ensure_started(session.session_id)
    return SessionCreateResponse(session=session)


@router.get("/sessions", response_model=list[SessionSummary])
async def list_sessions(request: Request) -> list[SessionSummary]:
    registry = request.app.state.session_registry
    return await registry.list_sessions()


@router.get("/sessions/{session_id}", response_model=SessionDetail)
async def get_session(request: Request, session_id: str) -> SessionDetail:
    registry = request.app.state.session_registry
    return await registry.get_session_detail(session_id)


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(request: Request, session_id: str) -> None:
    registry = request.app.state.session_registry
    await registry.delete_session(session_id)


@router.get("/sessions/{session_id}/stream")
async def stream_session(request: Request, session_id: str) -> StreamingResponse:
    registry = request.app.state.session_registry
    await registry.ensure_session(session_id)

    async def event_stream():
        snapshot = await registry.get_session_detail(session_id)
        yield (
            "event: snapshot\n"
            f"data: {json.dumps(snapshot.model_dump(mode='json'))}\n\n"
        )
        queue = await registry.subscribe(session_id)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"event: transcript\ndata: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            await registry.unsubscribe(session_id, queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@websocket_router.websocket("/ws/transcribe/{session_id}")
async def transcribe_websocket(websocket: WebSocket, session_id: str) -> None:
    registry = websocket.app.state.session_registry
    scheduler = websocket.app.state.insight_scheduler
    whisper_service = websocket.app.state.whisper_service
    diarization_service = websocket.app.state.diarization_service

    await websocket.accept()
    await registry.ensure_session(session_id)
    await scheduler.ensure_started(session_id)
    await registry.mark_connection_open(session_id)

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
            audio_bytes = message.get("bytes")
            if not audio_bytes:
                continue

            raw_segments = await whisper_service.transcribe_chunk(audio_bytes)
            diarized_segments = await diarization_service.assign_speakers(audio_bytes, raw_segments)
            batch = TranscriptionBatch(
                session_id=session_id,
                segments=diarized_segments,
                appended_text=_build_appended_text(diarized_segments),
                received_at=datetime.now(timezone.utc),
            )
            await registry.append_transcription(batch)
            await websocket.send_json(
                {
                    "type": "ack",
                    "session_id": session_id,
                    "segment_count": len(diarized_segments),
                }
            )
    except WebSocketDisconnect:
        return
    except Exception as exc:
        await websocket.send_json({"type": "error", "detail": str(exc)})
        raise
    finally:
        await registry.mark_connection_closed(session_id)
