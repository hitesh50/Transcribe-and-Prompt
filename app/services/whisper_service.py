from __future__ import annotations

import asyncio
import logging

from app.config import SettingsManager
from app.models import TranscriptSegment
from app.utils.audio import cleanup_paths, decode_audio_bytes_to_wav

logger = logging.getLogger(__name__)


class WhisperService:
    def __init__(self, settings_manager: SettingsManager) -> None:
        self.settings_manager = settings_manager
        self._model = None

    async def transcribe_chunk(self, audio_bytes: bytes) -> list[TranscriptSegment]:
        return await asyncio.to_thread(self._transcribe_chunk_sync, audio_bytes)

    def _load_model(self):
        if self._model is None:
            from faster_whisper import WhisperModel

            config = self.settings_manager.load_config().transcription
            self._model = WhisperModel(
                config.whisper_model,
                device=config.device,
                compute_type=config.compute_type,
            )
        return self._model

    def _transcribe_chunk_sync(self, audio_bytes: bytes) -> list[TranscriptSegment]:
        source_path, wav_path = decode_audio_bytes_to_wav(audio_bytes)
        try:
            model = self._load_model()
            segments, _ = model.transcribe(
                str(wav_path),
                beam_size=1,
                vad_filter=True,
                condition_on_previous_text=False,
            )
            transcript_segments: list[TranscriptSegment] = []
            for segment in segments:
                text = segment.text.strip()
                if not text:
                    continue
                transcript_segments.append(
                    TranscriptSegment(
                        speaker_id="Speaker 1",
                        start=float(segment.start),
                        end=float(segment.end),
                        text=text,
                    )
                )
            return transcript_segments
        finally:
            cleanup_paths(source_path, wav_path)
