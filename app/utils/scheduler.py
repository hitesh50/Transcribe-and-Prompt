from __future__ import annotations

import asyncio
import hashlib
import logging
from collections.abc import Awaitable, Callable

from app.state import SessionRegistry

logger = logging.getLogger(__name__)


class SessionInsightScheduler:
    def __init__(
        self,
        *,
        registry: SessionRegistry,
        interval_seconds: int,
        generate_callback: Callable[[str, str], Awaitable[None]],
    ) -> None:
        self.registry = registry
        self.interval_seconds = interval_seconds
        self.generate_callback = generate_callback

    async def ensure_started(self, session_id: str) -> None:
        runtime = await self.registry.ensure_session(session_id)
        if runtime.scheduler_task and not runtime.scheduler_task.done():
            return
        task = asyncio.create_task(self._run(session_id), name=f"insights-{session_id}")
        await self.registry.set_scheduler_task(session_id, task)

    async def _run(self, session_id: str) -> None:
        try:
            while True:
                await asyncio.sleep(self.interval_seconds)
                transcript = await self.registry.get_transcript(session_id)
                if not transcript.strip():
                    continue
                digest = hashlib.sha256(transcript.encode("utf-8")).hexdigest()
                if digest == await self.registry.get_last_insight_digest(session_id):
                    continue
                await self.generate_callback(session_id, transcript)
                await self.registry.set_last_insight_digest(session_id, digest)
        except asyncio.CancelledError:
            raise
        except Exception:  # pragma: no cover - defensive logging
            logger.exception("Insight scheduler failed for session %s", session_id)
        finally:
            await self.registry.clear_scheduler_task(session_id)

