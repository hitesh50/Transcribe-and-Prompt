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
    <Paper withBorder radius="lg" p="md" className="panel-surface">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={700}>Session files</Text>
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
          <Text c="dimmed" size="sm">
            No sessions yet. Create one or start recording to begin.
          </Text>
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

