import { ActionIcon, Badge, Button, Group, Paper, Stack, Text } from "@mantine/core";
import { IconFileText, IconRefresh, IconTrash } from "@tabler/icons-react";
import type { SessionSummary } from "../types";

type SessionFileListProps = {
  sessions: SessionSummary[];
  selectedSessionId?: string;
  isRecording: boolean;
  onCreate: () => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => Promise<void> | void;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function SessionFileList({
  sessions,
  selectedSessionId,
  isRecording,
  onCreate,
  onRefresh,
  onSelect,
  onDelete,
}: SessionFileListProps) {
  return (
    <Paper withBorder radius="xl" p="lg" className="panel-surface session-list-panel">
      <Stack gap="md">
        <Group justify="space-between">
          <div>
            <Text fw={700} size="lg">
              Session files
            </Text>
            <Text c="dimmed" size="sm">
              Keep the working set on the left so you can jump between saved transcripts quickly.
            </Text>
          </div>
          <Group gap="xs">
            <ActionIcon variant="subtle" onClick={() => void onRefresh()} aria-label="Refresh sessions">
              <IconRefresh size={16} />
            </ActionIcon>
            <Button size="xs" onClick={() => void onCreate()} disabled={isRecording}>
              New session
            </Button>
          </Group>
        </Group>

        {sessions.length === 0 ? (
          <div className="empty-state">
            <Text fw={600}>No sessions yet</Text>
            <Text c="dimmed" size="sm">
              Create one manually or start recording to begin the first transcript file.
            </Text>
          </div>
        ) : (
          sessions.map((session) => {
            const isSelected = session.session_id === selectedSessionId;
            return (
              <Paper
                key={session.session_id}
                withBorder
                radius="md"
                p="sm"
                className={isSelected ? "session-card session-card-active" : "session-card"}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Group gap="xs" wrap="wrap">
                      <Badge variant="light" leftSection={<IconFileText size={12} />}>
                        {session.session_id}
                      </Badge>
                      {session.active ? <Badge color="red">Live</Badge> : null}
                      <Badge color="gray" variant="light">
                        {session.insight_count} insight{session.insight_count === 1 ? "" : "s"}
                      </Badge>
                    </Group>
                    <Text fw={600} size="sm">
                      {session.transcript_path.split("/").pop()}
                    </Text>
                    <Text size="sm" c="dimmed">
                      Updated {formatDate(session.updated_at)}
                    </Text>
                  </Stack>
                  <Group gap="xs" wrap="nowrap">
                    <Button
                      variant={isSelected ? "filled" : "light"}
                      size="xs"
                      onClick={() => onSelect(session.session_id)}
                      disabled={isRecording && !isSelected}
                    >
                      View
                    </Button>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => void onDelete(session.session_id)}
                      disabled={isRecording && isSelected}
                      aria-label={`Delete ${session.session_id}`}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            );
          })
        )}
      </Stack>
    </Paper>
  );
}
