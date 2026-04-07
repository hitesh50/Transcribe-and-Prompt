import { useEffect, useRef } from "react";
import { Badge, Code, Group, Paper, ScrollArea, Stack, Text } from "@mantine/core";

type LiveTranscriptionWindowProps = {
  transcript: string;
};

export function LiveTranscriptionWindow({ transcript }: LiveTranscriptionWindowProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const lineCount = transcript.trim() ? transcript.trim().split(/\n+/).length : 0;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
  }, [transcript]);

  return (
    <Paper withBorder radius="xl" p="lg" className="panel-surface transcript-panel">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={700} size="lg">
              Live transcript
            </Text>
            <Text c="dimmed" size="sm">
              New chunks appear here as they complete on the backend.
            </Text>
          </div>
          <Badge variant="light" color="teal">
            {lineCount} line{lineCount === 1 ? "" : "s"}
          </Badge>
        </Group>
        <ScrollArea h={380} viewportRef={viewportRef}>
          {transcript.trim() ? (
            <Code block className="transcript-code">
              {transcript}
            </Code>
          ) : (
            <div className="empty-state transcript-empty">
              <Text fw={600}>Transcript waiting for audio</Text>
              <Text c="dimmed" size="sm">
                Start a recording or open a saved session to see transcript lines appear here.
              </Text>
            </div>
          )}
        </ScrollArea>
      </Stack>
    </Paper>
  );
}
