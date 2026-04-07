import { Badge, Button, Group, Stack, Text } from "@mantine/core";
import { IconMicrophone, IconPlayerStop } from "@tabler/icons-react";

type LiveAudioControlsProps = {
  isRecording: boolean;
  canStart: boolean;
  isBusy: boolean;
  selectedSessionId?: string;
  segmentSeconds: number;
  onStart: () => Promise<void> | void;
  onStop: () => void;
};

export function LiveAudioControls({
  isRecording,
  canStart,
  isBusy,
  selectedSessionId,
  segmentSeconds,
  onStart,
  onStop,
}: LiveAudioControlsProps) {
  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <div>
          <Text fw={700}>Live capture</Text>
          <Text c="dimmed" size="sm" maw={620}>
            Browser audio streams to the backend every few seconds for transcript updates while the session stays open.
          </Text>
        </div>
        <Badge color={isRecording ? "red" : "gray"} variant="light">
          {isRecording ? "Recording" : "Idle"}
        </Badge>
      </Group>

      <Group gap="sm" wrap="wrap" className="control-actions">
        <Button
          leftSection={<IconMicrophone size={16} />}
          onClick={() => void onStart()}
          loading={isBusy}
          disabled={!canStart || isRecording}
          size="md"
        >
          Start capture
        </Button>
        <Button
          variant="light"
          color="gray"
          leftSection={<IconPlayerStop size={16} />}
          onClick={onStop}
          disabled={!isRecording}
          size="md"
        >
          Stop capture
        </Button>
        {selectedSessionId ? (
          <Badge variant="outline" color="gray">
            Active session: {selectedSessionId}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed" className="control-caption">
            A new session will be created automatically when recording starts.
          </Text>
        )}
      </Group>
    </Stack>
  );
}
