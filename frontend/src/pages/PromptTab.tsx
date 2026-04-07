import { useEffect, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Grid,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
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
    if (!userPrompt) {
      setUserPrompt(PROMPT_PRESETS[0]);
    }
  }, [userPrompt]);

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
    <Stack gap="xl">
      <Paper withBorder radius="xl" p="xl" className="panel-surface workspace-hero prompt-hero">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" gap="lg">
            <div>
              <Badge variant="outline" className="eyebrow">
                Prompt workspace
              </Badge>
              <Title order={2} className="section-title">
                Shape a sharper ask before you send it to the model.
              </Title>
              <Text c="dimmed" className="section-copy" maw={760}>
                Use the current OpenRouter selection, refine your instructions, and keep the response pane clean enough to compare prompt variants during the same session.
              </Text>
            </div>
            <Paper radius="lg" p="md" className="side-note-card">
              <Stack gap={6}>
                <Text fw={700} size="sm">
                  Active route
                </Text>
                <Badge variant="light" color="teal">
                  {config?.default_model ?? "No model selected"}
                </Badge>
                <Text c="dimmed" size="sm">
                  Adjust model routing in Config if you want a different default or free-only guardrails.
                </Text>
              </Stack>
            </Paper>
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
        </Stack>
      </Paper>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper withBorder radius="xl" p="lg" className="panel-surface prompt-composer">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start" gap="md">
                <div>
                  <Text fw={700} size="lg">
                    Prompt workstation
                  </Text>
                  <Text c="dimmed" size="sm">
                    Keep the system prompt narrow and use the user prompt for the concrete job you want done.
                  </Text>
                </div>
                <Badge variant="outline" color="gray">
                  {userPrompt.trim().split(/\s+/).filter(Boolean).length} words
                </Badge>
              </Group>

              <Textarea
                label="System prompt (optional)"
                autosize
                minRows={4}
                maxRows={10}
                value={systemPrompt}
                onChange={(event) => setSystemPrompt(event.currentTarget.value)}
                placeholder="You are reviewing a meeting transcript for operational, delivery, and compliance risk."
              />
              <Textarea
                label="User prompt"
                autosize
                minRows={8}
                maxRows={14}
                value={userPrompt}
                onChange={(event) => setUserPrompt(event.currentTarget.value)}
                placeholder="Summarize the principal operational risks in the attached transcript."
              />
              <Button
                onClick={() => void handleSubmit()}
                loading={isSubmitting}
                leftSection={<IconSparkles size={16} />}
              >
                Send to model
              </Button>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="lg">
            <Paper withBorder radius="xl" p="lg" className="panel-surface prompt-sidecar">
              <Stack gap="md">
                <Text fw={700} size="lg">
                  Working notes
                </Text>
                <Paper radius="lg" p="md" className="sub-metric-card">
                  <Stack gap={4}>
                    <Text fw={600}>Prompt pattern</Text>
                    <Text c="dimmed" size="sm">
                      Ask for outputs in the same order you want to review them: risks, evidence, then actions.
                    </Text>
                  </Stack>
                </Paper>
                <Paper radius="lg" p="md" className="sub-metric-card">
                  <Stack gap={4}>
                    <Text fw={600}>Keep it concrete</Text>
                    <Text c="dimmed" size="sm">
                      If you need accountability, explicitly request owners, dates, and open questions rather than a general summary.
                    </Text>
                  </Stack>
                </Paper>
                <Paper radius="lg" p="md" className="sub-metric-card">
                  <Stack gap={4}>
                    <Text fw={600}>Model guardrails</Text>
                    <Text c="dimmed" size="sm">
                      {config?.enable_paid_models
                        ? "Paid routing is available, so refresh the model list in Config when you want broader options."
                        : "Free-only routing is active, which keeps the model list narrower and easier to reason about."}
                    </Text>
                  </Stack>
                </Paper>
              </Stack>
            </Paper>

            <Paper withBorder radius="xl" p="lg" className="panel-surface prompt-sidecar">
              <Stack gap="md">
                <Text fw={700} size="lg">
                  Session cues
                </Text>
                <Text c="dimmed" size="sm">
                  This workspace is best used after you have a transcript or a saved insight file open in another tab, so your prompt can stay specific.
                </Text>
                <Group gap="xs" wrap="wrap">
                  <Badge variant="light" color="teal">
                    Local-first
                  </Badge>
                  <Badge variant="light" color="blue">
                    File-backed
                  </Badge>
                  <Badge variant="light" color="grape">
                    Model-selectable
                  </Badge>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>

      <Paper withBorder radius="xl" p="lg" className="panel-surface">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Text fw={700} size="lg">
                Response
              </Text>
              <Text c="dimmed" size="sm">
                Use this pane to compare prompt revisions without leaving the workspace.
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
