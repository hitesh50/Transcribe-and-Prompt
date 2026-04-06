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
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <div>
          <Text fw={700}>Live capture</Text>
          <Text c="dimmed" size="sm">
            Browser audio is chunked into {segmentSeconds}-second WebM segments and streamed to the backend.
          </Text>
        </div>
        <Badge color={isRecording ? "red" : "gray"} variant="light">
          {isRecording ? "Recording" : "Idle"}
        </Badge>
      </Group>

      <Group>
        <Button
          leftSection={<IconMicrophone size={16} />}
          onClick={() => void onStart()}
          loading={isBusy}
          disabled={!canStart || isRecording}
        >
          Start
        </Button>
        <Button
          variant="light"
          color="gray"
          leftSection={<IconPlayerStop size={16} />}
          onClick={onStop}
          disabled={!isRecording}
        >
          Stop
        </Button>
        {selectedSessionId ? (
          <Text size="sm" c="dimmed">
            Active session: {selectedSessionId}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            A new session will be created automatically when recording starts.
          </Text>
        )}
      </Group>
    </Stack>
  );
}
