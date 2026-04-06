from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from app.config import SettingsManager, resolve_path
from app.models import TranscriptSegment
from app.utils.audio import cleanup_paths, decode_audio_bytes_to_wav

logger = logging.getLogger(__name__)


class DiarizationService:
    def __init__(self, settings_manager: SettingsManager) -> None:
        self.settings_manager = settings_manager
        self._pipeline = None

    async def assign_speakers(
        self,
        audio_bytes: bytes,
        segments: list[TranscriptSegment],
    ) -> list[TranscriptSegment]:
        if not segments:
            return []
        if not self._local_model_available():
            return self._fallback_segments(segments)
        try:
            return await asyncio.to_thread(self._assign_speakers_sync, audio_bytes, segments)
        except Exception:  # pragma: no cover - safety path
            logger.exception("Falling back to single-speaker tagging.")
            return self._fallback_segments(segments)

    def _local_model_available(self) -> bool:
        config = self.settings_manager.load_config().transcription
        if not config.local_diarization_model_path.strip():
            return False
        model_path = resolve_path(
            self.settings_manager.root_dir,
            config.local_diarization_model_path,
        )
        return model_path.exists()

    def _load_pipeline(self):
        if self._pipeline is None:
            from pyannote.audio import Pipeline

            config = self.settings_manager.load_config().transcription
            model_path = resolve_path(
                self.settings_manager.root_dir,
                config.local_diarization_model_path,
            )
            self._pipeline = Pipeline.from_pretrained(str(model_path))
        return self._pipeline

    def _assign_speakers_sync(
        self,
        audio_bytes: bytes,
        segments: list[TranscriptSegment],
    ) -> list[TranscriptSegment]:
        source_path, wav_path = decode_audio_bytes_to_wav(audio_bytes)
        try:
            diarization = self._load_pipeline()(str(wav_path))
            speaker_turns: list[tuple[str, float, float]] = []
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                speaker_turns.append((speaker, float(turn.start), float(turn.end)))

            diarized: list[TranscriptSegment] = []
            for segment in segments:
                diarized.append(
                    TranscriptSegment(
                        speaker_id=self._speaker_for_segment(segment.start, segment.end, speaker_turns),
                        start=segment.start,
                        end=segment.end,
                        text=segment.text,
                    )
                )
            return diarized
        finally:
            cleanup_paths(source_path, wav_path)

    def _speaker_for_segment(
        self,
        start: float,
        end: float,
        speaker_turns: list[tuple[str, float, float]],
    ) -> str:
        best_speaker = "Speaker 1"
        best_overlap = 0.0
        for speaker, turn_start, turn_end in speaker_turns:
            overlap = max(0.0, min(end, turn_end) - max(start, turn_start))
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = speaker
        return best_speaker

    def _fallback_segments(self, segments: list[TranscriptSegment]) -> list[TranscriptSegment]:
        return [
            TranscriptSegment(
                speaker_id="Speaker 1",
                start=segment.start,
                end=segment.end,
                text=segment.text,
            )
            for segment in segments
        ]

