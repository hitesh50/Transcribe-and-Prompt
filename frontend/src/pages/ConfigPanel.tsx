import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Group,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
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
    <Paper withBorder radius="lg" p="md" className="panel-surface">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Text fw={600}>Configuration</Text>
          <Group gap="xs" wrap="wrap">
            <Badge variant="light" color={config?.api_key_configured ? "teal" : "orange"}>
              {config?.api_key_configured ? "API key set" : "API key missing"}
            </Badge>
            <Badge variant="light" color="gray">
              {allowedModels.length} models
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
            Refresh models
          </Button>
          <Button onClick={() => void handleSave()} loading={isSaving}>
            Save
          </Button>
        </Group>

        <Text c="dimmed" size="sm">
          Secrets stay in <code>.env</code>. Non-secret runtime settings are saved locally.
        </Text>
      </Stack>
    </Paper>
  );
}
