export type AppConfig = {
  api_base: string;
  default_model: string;
  allowed_models: string[];
  enable_paid_models: boolean;
  api_key_configured: boolean;
  segment_seconds: number;
  insight_interval_seconds: number;
};

export type ConfigResponse = {
  config: AppConfig;
};

export type ConfigUpdateRequest = {
  api_key?: string;
  default_model: string;
  allowed_models: string[];
  enable_paid_models: boolean;
};

export type ModelOption = {
  id: string;
  name?: string | null;
  context_length?: number | null;
  is_free: boolean;
};

export type ModelRefreshResponse = {
  config: AppConfig;
  models: ModelOption[];
};

export type InsightSummary = {
  file_name: string;
  path: string;
  created_at: string;
  model?: string | null;
  excerpt?: string | null;
};

export type SessionSummary = {
  session_id: string;
  transcript_path: string;
  created_at: string;
  updated_at: string;
  active: boolean;
  insight_count: number;
};

export type TranscriptSegment = {
  speaker_id: string;
  start: number;
  end: number;
  text: string;
};

export type SessionDetail = SessionSummary & {
  transcript: string;
  insights: InsightSummary[];
};

export type SessionCreateResponse = {
  session: SessionDetail;
};

export type PromptRequest = {
  system_prompt?: string;
  user_prompt: string;
  model?: string;
};

export type PromptResponse = {
  model: string;
  content: string;
};

