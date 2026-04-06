from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.models import InsightSummary, SessionDetail, SessionSummary, TranscriptionBatch


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def build_session_id() -> str:
    return utcnow().strftime("session-%Y%m%d-%H%M%S-") + uuid4().hex[:8]


@dataclass(slots=True)
class SessionRuntime:
    session_id: str
    transcript_path: Path
    created_at: datetime
    updated_at: datetime
    subscribers: set[asyncio.Queue[str]] = field(default_factory=set)
    scheduler_task: asyncio.Task[None] | None = None
    active_connections: int = 0
    last_insight_digest: str | None = None


class SessionRegistry:
    def __init__(self, sessions_dir: Path, insights_dir: Path) -> None:
        self.sessions_dir = sessions_dir
        self.insights_dir = insights_dir
        self._lock = asyncio.Lock()
        self._sessions: dict[str, SessionRuntime] = {}

    async def create_session(self) -> SessionDetail:
        async with self._lock:
            session_id = build_session_id()
            transcript_path = self.sessions_dir / f"{session_id}.txt"
            transcript_path.touch(exist_ok=False)
            now = utcnow()
            self._sessions[session_id] = SessionRuntime(
                session_id=session_id,
                transcript_path=transcript_path,
                created_at=now,
                updated_at=now,
            )
        return await self.get_session_detail(session_id)

    async def ensure_session(self, session_id: str) -> SessionRuntime:
        async with self._lock:
            runtime = self._sessions.get(session_id)
            if runtime is not None:
                return runtime

            transcript_path = self.sessions_dir / f"{session_id}.txt"
            if not transcript_path.exists():
                transcript_path.touch(exist_ok=False)

            stat = transcript_path.stat()
            runtime = SessionRuntime(
                session_id=session_id,
                transcript_path=transcript_path,
                created_at=datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc),
                updated_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
            )
            self._sessions[session_id] = runtime
            return runtime

    async def get_session_detail(self, session_id: str) -> SessionDetail:
        runtime = await self.ensure_session(session_id)
        transcript = runtime.transcript_path.read_text(encoding="utf-8") if runtime.transcript_path.exists() else ""
        return SessionDetail(
            session_id=session_id,
            transcript_path=str(runtime.transcript_path),
            created_at=runtime.created_at,
            updated_at=runtime.updated_at,
            active=runtime.active_connections > 0,
            insight_count=len(self._list_insight_paths(session_id)),
            transcript=transcript,
            insights=self._list_insights(session_id),
        )

    async def list_sessions(self) -> list[SessionSummary]:
        sessions: list[SessionSummary] = []
        known_paths = {runtime.transcript_path for runtime in self._sessions.values()}
        for path in self.sessions_dir.glob("*.txt"):
            if path not in known_paths:
                session_id = path.stem
                await self.ensure_session(session_id)

        async with self._lock:
            runtimes = list(self._sessions.values())

        for runtime in sorted(runtimes, key=lambda item: item.updated_at, reverse=True):
            sessions.append(
                SessionSummary(
                    session_id=runtime.session_id,
                    transcript_path=str(runtime.transcript_path),
                    created_at=runtime.created_at,
                    updated_at=runtime.updated_at,
                    active=runtime.active_connections > 0,
                    insight_count=len(self._list_insight_paths(runtime.session_id)),
                )
            )
        return sessions

    async def append_transcription(self, batch: TranscriptionBatch) -> SessionDetail:
        runtime = await self.ensure_session(batch.session_id)
        if batch.appended_text.strip():
            existing = runtime.transcript_path.read_text(encoding="utf-8") if runtime.transcript_path.exists() else ""
            separator = "\n" if existing and not existing.endswith("\n") else ""
            runtime.transcript_path.write_text(
                f"{existing}{separator}{batch.appended_text}\n",
                encoding="utf-8",
            )
            runtime.updated_at = batch.received_at
            await self.broadcast(
                batch.session_id,
                {
                    "type": "transcript",
                    "session_id": batch.session_id,
                    "received_at": batch.received_at.isoformat(),
                    "segments": [segment.model_dump(mode="json") for segment in batch.segments],
                    "text": batch.appended_text,
                },
            )
        return await self.get_session_detail(batch.session_id)

    async def delete_session(self, session_id: str) -> None:
        async with self._lock:
            runtime = self._sessions.pop(session_id, None)

        if runtime and runtime.scheduler_task:
            runtime.scheduler_task.cancel()

        transcript_path = self.sessions_dir / f"{session_id}.txt"
        if transcript_path.exists():
            transcript_path.unlink()

        for path in self._list_insight_paths(session_id):
            path.unlink(missing_ok=True)

    async def subscribe(self, session_id: str) -> asyncio.Queue[str]:
        runtime = await self.ensure_session(session_id)
        queue: asyncio.Queue[str] = asyncio.Queue()
        runtime.subscribers.add(queue)
        return queue

    async def unsubscribe(self, session_id: str, queue: asyncio.Queue[str]) -> None:
        runtime = await self.ensure_session(session_id)
        runtime.subscribers.discard(queue)

    async def broadcast(self, session_id: str, payload: dict[str, Any]) -> None:
        runtime = await self.ensure_session(session_id)
        encoded = json.dumps(payload)
        for queue in list(runtime.subscribers):
            queue.put_nowait(encoded)

    async def mark_connection_open(self, session_id: str) -> None:
        runtime = await self.ensure_session(session_id)
        runtime.active_connections += 1
        runtime.updated_at = utcnow()

    async def mark_connection_closed(self, session_id: str) -> None:
        runtime = await self.ensure_session(session_id)
        runtime.active_connections = max(0, runtime.active_connections - 1)
        runtime.updated_at = utcnow()

    async def get_transcript(self, session_id: str) -> str:
        runtime = await self.ensure_session(session_id)
        if not runtime.transcript_path.exists():
            return ""
        return runtime.transcript_path.read_text(encoding="utf-8")

    async def get_last_insight_digest(self, session_id: str) -> str | None:
        runtime = await self.ensure_session(session_id)
        return runtime.last_insight_digest

    async def set_last_insight_digest(self, session_id: str, digest: str) -> None:
        runtime = await self.ensure_session(session_id)
        runtime.last_insight_digest = digest

    async def set_scheduler_task(self, session_id: str, task: asyncio.Task[None]) -> None:
        runtime = await self.ensure_session(session_id)
        runtime.scheduler_task = task

    async def clear_scheduler_task(self, session_id: str) -> None:
        runtime = await self.ensure_session(session_id)
        runtime.scheduler_task = None

    async def close(self) -> None:
        async with self._lock:
            tasks = [runtime.scheduler_task for runtime in self._sessions.values() if runtime.scheduler_task]
        for task in tasks:
            task.cancel()

    def _list_insight_paths(self, session_id: str) -> list[Path]:
        pattern = f"{session_id}_insight_*.json"
        return sorted(self.insights_dir.glob(pattern), reverse=True)

    def _list_insights(self, session_id: str) -> list[InsightSummary]:
        insights: list[InsightSummary] = []
        for path in self._list_insight_paths(session_id):
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                raw = {}
            insights.append(
                InsightSummary(
                    file_name=path.name,
                    path=str(path),
                    created_at=datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc),
                    model=raw.get("model"),
                    excerpt=(raw.get("insights_markdown") or raw.get("content") or "")[:220] or None,
                )
            )
        return insights

