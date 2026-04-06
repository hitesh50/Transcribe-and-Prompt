from __future__ import annotations

from app.models import TranscriptSegment


def test_full_transcription_flow_creates_session_file(client, app_instance) -> None:
    async def fake_transcribe_chunk(_: bytes):
        return [TranscriptSegment(speaker_id="Speaker 1", start=0.0, end=2.0, text="Risk committee update")]

    async def fake_assign_speakers(_: bytes, segments: list[TranscriptSegment]):
        return segments

    app_instance.state.whisper_service.transcribe_chunk = fake_transcribe_chunk
    app_instance.state.diarization_service.assign_speakers = fake_assign_speakers

    session_response = client.post("/api/transcribe/sessions")
    session_id = session_response.json()["session"]["session_id"]

    with client.websocket_connect(f"/ws/transcribe/{session_id}") as websocket:
        websocket.send_bytes(b"audio-chunk")
        payload = websocket.receive_json()

    assert payload["type"] == "ack"

    detail_response = client.get(f"/api/transcribe/sessions/{session_id}")
    assert detail_response.status_code == 200
    transcript = detail_response.json()["transcript"]
    assert "Risk committee update" in transcript

