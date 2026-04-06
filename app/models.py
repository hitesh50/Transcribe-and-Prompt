from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.config import PublicConfig


class ModelOption(BaseModel):
    id: str
    name: str | None = None
    context_length: int | None = None
    is_free: bool = False


class ConfigResponse(BaseModel):
    config: PublicConfig


class ConfigUpdateRequest(BaseModel):
    api_key: str | None = None
    default_model: str
    allowed_models: list[str]
    enable_paid_models: bool = False


class TranscriptSegment(BaseModel):
    speaker_id: str = "Speaker 1"
    start: float
    end: float
    text: str


class TranscriptionBatch(BaseModel):
    session_id: str
    segments: list[TranscriptSegment] = Field(default_factory=list)
    appended_text: str = ""
    received_at: datetime


class InsightSummary(BaseModel):
    file_name: str
    path: str
    created_at: datetime
    model: str | None = None
    excerpt: str | None = None


class SessionSummary(BaseModel):
    session_id: str
    transcript_path: str
    created_at: datetime
    updated_at: datetime
    active: bool = False
    insight_count: int = 0


class SessionDetail(SessionSummary):
    transcript: str = ""
    insights: list[InsightSummary] = Field(default_factory=list)


class SessionCreateResponse(BaseModel):
    session: SessionDetail


class PromptRequest(BaseModel):
    system_prompt: str | None = None
    user_prompt: str
    model: str | None = None


class PromptResponse(BaseModel):
    model: str
    content: str


class ModelRefreshResponse(BaseModel):
    config: PublicConfig
    models: list[ModelOption]

