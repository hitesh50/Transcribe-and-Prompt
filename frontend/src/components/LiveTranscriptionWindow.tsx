import { useEffect, useRef } from "react";
import { Code, Paper, ScrollArea, Stack, Text } from "@mantine/core";

type LiveTranscriptionWindowProps = {
  transcript: string;
};

export function LiveTranscriptionWindow({ transcript }: LiveTranscriptionWindowProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
  }, [transcript]);

  return (
    <Paper withBorder radius="lg" p="md" className="panel-surface">
      <Stack gap="xs">
        <Text fw={700}>Live transcript</Text>
        <ScrollArea h={360} viewportRef={viewportRef}>
          {transcript.trim() ? (
            <Code block className="transcript-code">
              {transcript}
            </Code>
          ) : (
            <Text c="dimmed" size="sm">
              Transcript lines will appear here as chunks complete.
            </Text>
          )}
        </ScrollArea>
      </Stack>
    </Paper>
  );
}

