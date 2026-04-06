import { useEffect, useState } from "react";
import { Badge, Button, Group, Paper, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { sendPrompt } from "../api";
import type { AppConfig } from "../types";

type PromptTabProps = {
  config: AppConfig | null;
};

export function PromptTab({ config }: PromptTabProps) {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [responseText, setResponseText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userPrompt) {
      setUserPrompt("Summarize the principal operational risks in the attached transcript.");
    }
  }, [userPrompt]);

  async function handleSubmit() {
    if (!userPrompt.trim()) {
      notifications.show({ color: "red", message: "Enter a user prompt before sending." });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await sendPrompt({
        system_prompt: systemPrompt.trim() || undefined,
        user_prompt: userPrompt.trim(),
        model: config?.default_model,
      });
      setResponseText(response.content);
    } catch (error) {
      notifications.show({
        color: "red",
        message: error instanceof Error ? error.message : "Prompt request failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Stack gap="lg">
      <Paper withBorder radius="xl" p="lg" className="panel-surface">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={700} size="lg">
                Prompt workstation
              </Text>
              <Text c="dimmed" size="sm">
                Craft system and user instructions, then send them to the currently selected OpenRouter model.
              </Text>
            </div>
            <Badge variant="light">{config?.default_model ?? "No model selected"}</Badge>
          </Group>

          <Textarea
            label="System prompt (optional)"
            minRows={4}
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.currentTarget.value)}
          />
          <Textarea
            label="User prompt"
            minRows={8}
            value={userPrompt}
            onChange={(event) => setUserPrompt(event.currentTarget.value)}
          />
          <Button onClick={() => void handleSubmit()} loading={isSubmitting}>
            Send to model
          </Button>
        </Stack>
      </Paper>

      <Paper withBorder radius="xl" p="lg" className="panel-surface">
        <Stack gap="sm">
          <Text fw={700}>Response</Text>
          {responseText ? (
            <Text className="response-body">{responseText}</Text>
          ) : (
            <Text c="dimmed" size="sm">
              The model response will appear here.
            </Text>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

