import { useEffect, useRef, useState } from "react";
import { Grid, Group, Paper, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { createSession, deleteSession, getSession, listSessions } from "../api";
import { InsightList } from "../components/InsightList";
import { LiveAudioControls } from "../components/LiveAudioControls";
import { LiveTranscriptionWindow } from "../components/LiveTranscriptionWindow";
import { SessionFileList } from "../components/SessionFileList";
import type { AppConfig, SessionDetail, SessionSummary } from "../types";

type TranscribeTabProps = {
  config: AppConfig | null;
};

type SnapshotEvent = SessionDetail;

type TranscriptEvent = {
  type: "transcript";
  session_id: string;
  received_at: string;
  text: string;
};

export function TranscribeTab({ config }: TranscribeTabProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const isStoppingRef = useRef(false);

  useEffect(() => {
    void refreshSessions();
    return () => {
      teardownLiveConnections();
    };
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      setSessionDetail(null);
      return;
    }
    void loadSessionDetail(selectedSessionId);
  }, [selectedSessionId]);

  function teardownLiveConnections() {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    websocketRef.current?.close();
    websocketRef.current = null;
  }

  async function refreshSessions() {
    const nextSessions = await listSessions();
    setSessions(nextSessions);
    if (!selectedSessionId && nextSessions.length > 0) {
      setSelectedSessionId(nextSessions[0].session_id);
    }
    if (selectedSessionId && !nextSessions.some((session) => session.session_id === selectedSessionId)) {
      setSelectedSessionId(nextSessions[0]?.session_id);
    }
  }

  async function loadSessionDetail(sessionId: string) {
    const detail = await getSession(sessionId);
    setSessionDetail(detail);
  }

  function openEventSource(sessionId: string) {
    eventSourceRef.current?.close();
    const source = new EventSource(`/api/transcribe/sessions/${sessionId}/stream`);

    source.addEventListener("snapshot", (event) => {
      const snapshot = JSON.parse((event as MessageEvent<string>).data) as SnapshotEvent;
      setSessionDetail(snapshot);
    });

    source.addEventListener("transcript", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as TranscriptEvent;
      setSessionDetail((current) => {
        if (!current || current.session_id !== sessionId) {
          return current;
        }
        return {
          ...current,
          transcript: current.transcript
            ? `${current.transcript.trimEnd()}\n${payload.text}`
            : payload.text,
        };
      });
      void refreshSessions();
    });

    source.onerror = () => {
      source.close();
    };

    eventSourceRef.current = source;
  }

  async function ensureSession(): Promise<string> {
    if (selectedSessionId) {
      return selectedSessionId;
    }
    const response = await createSession();
    setSelectedSessionId(response.session.session_id);
    setSessionDetail(response.session);
    await refreshSessions();
    return response.session.session_id;
  }

  function buildWebSocketUrl(sessionId: string) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}/ws/transcribe/${sessionId}`;
  }

  function resolveMimeType() {
    const preferredTypes = ["audio/webm;codecs=opus", "audio/webm"];
    for (const mimeType of preferredTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    return undefined;
  }

  async function startRecording() {
    if (!config) {
      notifications.show({ color: "orange", message: "Load configuration before recording." });
      return;
    }

    setIsBusy(true);
    try {
      const sessionId = await ensureSession();
      openEventSource(sessionId);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = resolveMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const websocket = new WebSocket(buildWebSocketUrl(sessionId));
      websocket.binaryType = "arraybuffer";

      websocket.onmessage = () => {
        void refreshSessions();
      };

      recorder.ondataavailable = async (event) => {
        if (event.data.size === 0 || websocket.readyState !== WebSocket.OPEN) {
          return;
        }
        const payload = await event.data.arrayBuffer();
        websocket.send(payload);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        if (isStoppingRef.current) {
          websocket.close();
          isStoppingRef.current = false;
        }
        setIsRecording(false);
      };

      websocket.onopen = () => {
        recorder.start(config.segment_seconds * 1000);
        setIsRecording(true);
      };

      websocket.onerror = () => {
        notifications.show({
          color: "red",
          message: "Live transcription socket failed.",
        });
        setIsRecording(false);
      };

      websocketRef.current = websocket;
      mediaRecorderRef.current = recorder;
    } catch (error) {
      notifications.show({
        color: "red",
        message: error instanceof Error ? error.message : "Unable to start recording.",
      });
      setIsRecording(false);
    } finally {
      setIsBusy(false);
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      isStoppingRef.current = true;
      recorder.stop();
      return;
    }
    websocketRef.current?.close();
    websocketRef.current = null;
    setIsRecording(false);
  }

  async function handleCreateSession() {
    const response = await createSession();
    setSelectedSessionId(response.session.session_id);
    setSessionDetail(response.session);
    await refreshSessions();
  }

  async function handleDeleteSession(sessionId: string) {
    await deleteSession(sessionId);
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(undefined);
      setSessionDetail(null);
      teardownLiveConnections();
    }
    await refreshSessions();
  }

  async function handleSelectSession(sessionId: string) {
    if (isRecording) {
      notifications.show({
        color: "orange",
        message: "Stop recording before switching sessions.",
      });
      return;
    }
    setSelectedSessionId(sessionId);
    openEventSource(sessionId);
    await loadSessionDetail(sessionId);
  }

  async function handleRefreshInsights() {
    if (!selectedSessionId) {
      return;
    }
    await loadSessionDetail(selectedSessionId);
    await refreshSessions();
  }

  return (
    <Stack gap="lg">
      <Paper withBorder radius="xl" p="lg" className="panel-surface">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={700} size="lg">
                Transcription workspace
              </Text>
              <Text c="dimmed" size="sm">
                Docker-first live audio capture with file-based transcripts and background risk insight generation.
              </Text>
            </div>
            <Text c="dimmed" size="sm">
              Speaker labels use a local fallback unless you provide an offline diarization model path.
            </Text>
          </Group>

          <LiveAudioControls
            isRecording={isRecording}
            canStart={Boolean(config)}
            isBusy={isBusy}
            selectedSessionId={selectedSessionId}
            segmentSeconds={config?.segment_seconds ?? 30}
            onStart={startRecording}
            onStop={stopRecording}
          />
        </Stack>
      </Paper>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <SessionFileList
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            isRecording={isRecording}
            onCreate={handleCreateSession}
            onRefresh={refreshSessions}
            onSelect={handleSelectSession}
            onDelete={handleDeleteSession}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="lg">
            <LiveTranscriptionWindow transcript={sessionDetail?.transcript ?? ""} />
            <InsightList
              insights={sessionDetail?.insights ?? []}
              canRefresh={Boolean(selectedSessionId)}
              onRefresh={handleRefreshInsights}
            />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
