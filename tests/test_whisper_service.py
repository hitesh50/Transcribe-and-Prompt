from __future__ import annotations

from pathlib import Path

from app.config import SettingsManager
from app.services.whisper_service import WhisperService


class FakeSegment:
    def __init__(self, start: float, end: float, text: str) -> None:
        self.start = start
        self.end = end
        self.text = text


class FakeWhisperModel:
    def transcribe(self, _: str, **__: object):
        return [FakeSegment(0.0, 2.5, "Hello world")], {"language": "en"}


async def test_whisper_service_maps_segments(monkeypatch, test_paths: dict[str, Path]) -> None:
    manager = SettingsManager(
        config_path=test_paths["config_path"],
        env_path=test_paths["env_path"],
    )
    manager.ensure_storage_dirs()
    service = WhisperService(manager)

    input_path = test_paths["sessions_dir"] / "chunk.webm"
    wav_path = test_paths["sessions_dir"] / "chunk.wav"
    input_path.write_bytes(b"fake")
    wav_path.write_bytes(b"fake")

    monkeypatch.setattr(service, "_load_model", lambda: FakeWhisperModel())
    monkeypatch.setattr(
        "app.services.whisper_service.decode_audio_bytes_to_wav",
        lambda _: (input_path, wav_path),
    )

    result = await service.transcribe_chunk(b"audio")

    assert len(result) == 1
    assert result[0].text == "Hello world"
    assert result[0].speaker_id == "Speaker 1"
