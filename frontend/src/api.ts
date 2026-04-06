import type {
  ConfigResponse,
  ConfigUpdateRequest,
  ModelRefreshResponse,
  PromptRequest,
  PromptResponse,
  SessionCreateResponse,
  SessionDetail,
  SessionSummary,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getConfig(): Promise<ConfigResponse> {
  return request<ConfigResponse>("/api/config");
}

export async function saveConfig(payload: ConfigUpdateRequest): Promise<ConfigResponse> {
  return request<ConfigResponse>("/api/config", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function refreshModels(freeOnly: boolean): Promise<ModelRefreshResponse> {
  return request<ModelRefreshResponse>(`/api/config/models/refresh?free_only=${String(freeOnly)}`, {
    method: "POST",
  });
}

export async function createSession(): Promise<SessionCreateResponse> {
  return request<SessionCreateResponse>("/api/transcribe/sessions", {
    method: "POST",
  });
}

export async function listSessions(): Promise<SessionSummary[]> {
  return request<SessionSummary[]>("/api/transcribe/sessions");
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  return request<SessionDetail>(`/api/transcribe/sessions/${sessionId}`);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await request<void>(`/api/transcribe/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export async function sendPrompt(payload: PromptRequest): Promise<PromptResponse> {
  return request<PromptResponse>("/api/prompt", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

