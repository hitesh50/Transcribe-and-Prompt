from __future__ import annotations

from pathlib import Path

from app.config import SettingsManager
from app.models import TranscriptSegment
from app.services.diarization_service import DiarizationService


async def test_diarization_service_falls_back_to_single_speaker(test_paths: dict[str, Path]) -> None:
    manager = SettingsManager(
        config_path=test_paths["config_path"],
        env_path=test_paths["env_path"],
    )
    service = DiarizationService(manager)

    segments = [
        TranscriptSegment(speaker_id="", start=0.0, end=1.0, text="First line"),
        TranscriptSegment(speaker_id="", start=1.0, end=2.0, text="Second line"),
    ]

    result = await service.assign_speakers(b"audio", segments)

    assert [segment.speaker_id for segment in result] == ["Speaker 1", "Speaker 1"]

