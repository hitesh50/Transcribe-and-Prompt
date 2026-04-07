import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Grid,
  Group,
  Paper,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAdjustments, IconCloudLock, IconRoute2 } from "@tabler/icons-react";
import { refreshModels, saveConfig } from "../api";
import type { AppConfig } from "../types";

type ConfigPanelProps = {
  config: AppConfig | null;
  onConfigSaved: (config: AppConfig) => void;
};

export function ConfigPanel({ config, onConfigSaved }: ConfigPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [allowedModels, setAllowedModels] = useState<string[]>([]);
  const [enablePaidModels, setEnablePaidModels] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!config) {
      return;
    }
    setDefaultModel(config.default_model);
    setAllowedModels(config.allowed_models);
    setEnablePaidModels(config.enable_paid_models);
  }, [config]);

  async function handleSave() {
    if (!defaultModel) {
      notifications.show({
        color: "red",
        message: "Pick a model before saving configuration.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await saveConfig({
        api_key: apiKey.trim() ? apiKey.trim() : undefined,
        default_model: defaultModel,
        allowed_models: allowedModels,
        enable_paid_models: enablePaidModels,
      });
      onConfigSaved(response.config);
      setApiKey("");
      notifications.show({
        color: "teal",
        message: "Configuration saved.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        message: error instanceof Error ? error.message : "Failed to save configuration.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRefreshModels() {
    setIsRefreshing(true);
    try {
      const response = await refreshModels(!enablePaidModels);
      const models = response.models.map((model) => model.id);
      setAllowedModels(models);
      setDefaultModel((currentModel) => (models.includes(currentModel) ? currentModel : models[0] ?? ""));
      onConfigSaved(response.config);
      notifications.show({
        color: "teal",
        message: `Loaded ${models.length} model option${models.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      notifications.show({
        color: "red",
        message: error instanceof Error ? error.message : "Unable to refresh models.",
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <Stack gap="xl">
      <Paper withBorder radius="xl" p="xl" className="panel-surface workspace-hero config-hero">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start" gap="lg">
            <div>
              <Badge variant="outline" className="eyebrow">
                Config workspace
              </Badge>
              <Title order={2} className="section-title">
                Keep keys, routing, and model selection easy to inspect at a glance.
              </Title>
              <Text c="dimmed" className="section-copy" maw={760}>
                Secrets stay in <code>.env</code>, while model preferences live in <code>config.yaml</code>. This panel is tuned to make those boundaries obvious so local handoff stays simple.
              </Text>
            </div>
            <Paper radius="lg" p="md" className="side-note-card">
              <Stack gap={6}>
                <Text fw={700} size="sm">
                  Current default model
                </Text>
                <Badge variant="light" color="teal">
                  {config?.default_model ?? "Not selected"}
                </Badge>
                <Text c="dimmed" size="sm">
                  Refresh the model list when you want to pull a fresh catalog from OpenRouter.
                </Text>
              </Stack>
            </Paper>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Paper radius="lg" p="md" className="metric-card">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text className="metric-label">API status</Text>
                  <Text className="metric-value">{config?.api_key_configured ? "Configured" : "Missing"}</Text>
                </div>
                <IconCloudLock size={20} className="metric-icon" />
              </Group>
              <Text size="sm" c="dimmed">
                {config?.api_key_configured
                  ? "A saved key is already available for prompts and insight generation."
                  : "Add a key below to enable OpenRouter requests from this machine."}
              </Text>
            </Paper>
            <Paper radius="lg" p="md" className="metric-card">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text className="metric-label">Routing mode</Text>
                  <Text className="metric-value">{enablePaidModels ? "Expanded" : "Free only"}</Text>
                </div>
                <IconRoute2 size={20} className="metric-icon" />
              </Group>
              <Text size="sm" c="dimmed">
                Keep paid models disabled for tighter guardrails, or enable them when you want broader routing choices.
              </Text>
            </Paper>
            <Paper radius="lg" p="md" className="metric-card">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text className="metric-label">Loaded models</Text>
                  <Text className="metric-value">{allowedModels.length}</Text>
                </div>
                <IconAdjustments size={20} className="metric-icon" />
              </Group>
              <Text size="sm" c="dimmed">
                Refresh the catalog to repopulate this list with the current free-only or expanded route selection.
              </Text>
            </Paper>
          </SimpleGrid>
        </Stack>
      </Paper>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper withBorder radius="xl" p="lg" className="panel-surface">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start" gap="md">
                <div>
                  <Text fw={700} size="lg">
                    OpenRouter configuration
                  </Text>
                  <Text c="dimmed" size="sm">
                    Save connection settings, choose your default model, and decide whether paid routing should stay available.
                  </Text>
                </div>
                <Group gap="xs">
                  {config?.api_key_configured ? (
                    <Badge color="teal" variant="light">
                      API key detected
                    </Badge>
                  ) : (
                    <Badge color="orange" variant="light">
                      API key missing
                    </Badge>
                  )}
                  <Badge variant="outline" color="gray">
                    {config?.segment_seconds ?? 30}s chunks
                  </Badge>
                  <Badge variant="outline" color="gray">
                    {config?.insight_interval_seconds ?? 120}s insights
                  </Badge>
                </Group>
              </Group>

              <PasswordInput
                label="OpenRouter API key"
                placeholder={config?.api_key_configured ? "Leave blank to keep the saved key" : "sk-or-v1-..."}
                value={apiKey}
                onChange={(event) => setApiKey(event.currentTarget.value)}
              />

              <Select
                searchable
                label="Default model"
                data={allowedModels}
                value={defaultModel}
                onChange={(value) => setDefaultModel(value ?? "")}
                nothingFoundMessage="No models loaded"
              />

              <Switch
                checked={enablePaidModels}
                onChange={(event) => setEnablePaidModels(event.currentTarget.checked)}
                label="Enable paid models"
                description="Turn this off to keep routing on free OpenRouter models only."
              />

              <Group>
                <Button
                  variant="light"
                  onClick={() => void handleRefreshModels()}
                  loading={isRefreshing}
                >
                  Refresh available models
                </Button>
                <Button onClick={() => void handleSave()} loading={isSaving}>
                  Save configuration
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="lg">
            <Paper withBorder radius="xl" p="lg" className="panel-surface">
              <Stack gap="sm">
                <Text fw={700} size="lg">
                  Routing notes
                </Text>
                <Paper radius="lg" p="md" className="sub-metric-card">
                  <Stack gap={4}>
                    <Text fw={600}>Free-only mode</Text>
                    <Text c="dimmed" size="sm">
                      Best when you want a smaller catalog and a more predictable handoff to other local users.
                    </Text>
                  </Stack>
                </Paper>
                <Paper radius="lg" p="md" className="sub-metric-card">
                  <Stack gap={4}>
                    <Text fw={600}>Refreshing models</Text>
                    <Text c="dimmed" size="sm">
                      Use refresh after changing the paid-model toggle so the model list lines up with the route you intend to allow.
                    </Text>
                  </Stack>
                </Paper>
              </Stack>
            </Paper>

            <Paper withBorder radius="xl" p="lg" className="panel-surface">
              <Stack gap="sm">
                <Text fw={700} size="lg">
                  Storage boundaries
                </Text>
                <Text c="dimmed" size="sm">
                  Keys stay out of version control, while the rest of the runtime configuration remains readable and portable for local deployment.
                </Text>
                <Group gap="xs" wrap="wrap">
                  <Badge variant="light" color="teal">
                    <code>.env</code> for secrets
                  </Badge>
                  <Badge variant="light" color="blue">
                    <code>config.yaml</code> for routing
                  </Badge>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
