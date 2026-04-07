import { useEffect, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconCopy, IconSparkles } from "@tabler/icons-react";
import { sendPrompt } from "../api";
import type { AppConfig } from "../types";

type PromptTabProps = {
  config: AppConfig | null;
};

const PROMPT_PRESETS = [
  "Summarize the principal operational risks in the attached transcript.",
  "Identify concrete follow-up actions, owners, and due dates implied by this meeting.",
  "List ambiguous decisions or unresolved risks that need clarification before execution.",
];

export function PromptTab({ config }: PromptTabProps) {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [responseText, setResponseText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

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

  async function handleCopyResponse() {
    if (!responseText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(responseText);
      setCopied(true);
      notifications.show({
        color: "teal",
        message: "Response copied to the clipboard.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        message: error instanceof Error ? error.message : "Unable to copy the response.",
      });
    }
  }

  return (
    <Stack gap="lg">
      <Paper withBorder radius="lg" p="md" className="panel-surface prompt-composer">
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Text fw={600}>Prompt</Text>
            <Group gap="xs" wrap="wrap">
              <Badge variant="light" color="gray">
                {config?.default_model ?? "No model"}
              </Badge>
              <Badge variant="light" color="gray">
                {userPrompt.trim() ? userPrompt.trim().split(/\s+/).filter(Boolean).length : 0} words
              </Badge>
            </Group>
          </Group>

          <Group gap="xs" wrap="wrap">
            {PROMPT_PRESETS.map((prompt) => (
              <Button
                key={prompt}
                variant={prompt === userPrompt ? "filled" : "light"}
                size="compact-sm"
                onClick={() => setUserPrompt(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </Group>

          <Textarea
            label="System prompt (optional)"
            autosize
            minRows={3}
            maxRows={8}
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.currentTarget.value)}
          />
          <Textarea
            label="User prompt"
            autosize
            minRows={6}
            maxRows={12}
            value={userPrompt}
            onChange={(event) => setUserPrompt(event.currentTarget.value)}
          />
          <Button
            onClick={() => void handleSubmit()}
            loading={isSubmitting}
            leftSection={<IconSparkles size={16} />}
          >
            Send
          </Button>
        </Stack>
      </Paper>

      <Paper withBorder radius="lg" p="md" className="panel-surface">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Text fw={600}>
                Response
              </Text>
            </div>
            <ActionIcon
              variant="light"
              color={copied ? "teal" : "gray"}
              onClick={() => void handleCopyResponse()}
              disabled={!responseText}
              aria-label="Copy response"
            >
              {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
            </ActionIcon>
          </Group>
          {responseText ? (
            <Text className="response-body">{responseText}</Text>
          ) : (
            <div className="empty-state">
              <Text fw={600}>No response yet</Text>
              <Text c="dimmed" size="sm">
                Send a prompt when you are ready. The model output will appear here with the current routing settings.
              </Text>
            </div>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
