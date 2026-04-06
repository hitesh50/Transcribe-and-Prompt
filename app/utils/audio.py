from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path


def decode_audio_bytes_to_wav(audio_bytes: bytes, *, input_suffix: str = ".webm") -> tuple[Path, Path]:
    with tempfile.NamedTemporaryFile(delete=False, suffix=input_suffix) as source_file:
        source_file.write(audio_bytes)
        source_path = Path(source_file.name)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav_file:
        wav_path = Path(wav_file.name)

    try:
        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(source_path),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "wav",
            str(wav_path),
        ]
        subprocess.run(command, check=True, capture_output=True)
        return source_path, wav_path
    except Exception:
        cleanup_paths(source_path, wav_path)
        raise


def cleanup_paths(*paths: Path) -> None:
    for path in paths:
        path.unlink(missing_ok=True)
