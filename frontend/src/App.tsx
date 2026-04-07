import { useEffect, useState } from "react";
import {
  AppShell,
  Badge,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAdjustments,
  IconMessageCircle2,
  IconWaveSine,
} from "@tabler/icons-react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { getConfig } from "./api";
import { ConfigPanel } from "./pages/ConfigPanel";
import { PromptTab } from "./pages/PromptTab";
import { TranscribeTab } from "./pages/TranscribeTab";
import type { AppConfig } from "./types";

const routes = [
  { value: "/transcribe", label: "Transcribe", icon: IconWaveSine },
  { value: "/prompt", label: "Prompt", icon: IconMessageCircle2 },
  { value: "/config", label: "Config", icon: IconAdjustments },
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    void loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const response = await getConfig();
      setConfig(response.config);
    } catch (error) {
      notifications.show({
        color: "red",
        message: error instanceof Error ? error.message : "Unable to load configuration.",
      });
    }
  }

  const currentTab = routes.some((route) => location.pathname.startsWith(route.value))
    ? routes.find((route) => location.pathname.startsWith(route.value))?.value
    : "/transcribe";

  const overviewItems = [
    {
      label: "OpenRouter",
      value: config?.api_key_configured ? "Connected" : "Needs API key",
      tone: config?.api_key_configured ? "teal" : "orange",
      detail: config?.api_key_configured ? "Ready for prompts and insights" : "Save a key in Config to unlock summaries",
    },
    {
      label: "Routing",
      value: config?.enable_paid_models ? "Paid + free" : "Free only",
      tone: config?.enable_paid_models ? "blue" : "teal",
      detail: config?.default_model ?? "No default model selected yet",
    },
    {
      label: "Cadence",
      value: `${config?.segment_seconds ?? 30}s capture`,
      tone: "grape",
      detail: `Insights every ${config?.insight_interval_seconds ?? 120}s while a session stays active`,
    },
  ];

  return (
    <AppShell
      padding="lg"
      header={{ height: 120 }}
      className="app-shell"
    >
      <AppShell.Header className="app-header">
        <Container size="xl" py="md" className="header-container">
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <div>
              <Text fw={700} className="header-brand">
                LocalRiskInsights
              </Text>
              <Text size="sm" c="dimmed">
                Local audio capture, file-backed transcripts, and guided risk review.
              </Text>
            </div>

            <Group gap="xs">
              <Badge color={config?.api_key_configured ? "teal" : "orange"} variant="light">
                {config?.api_key_configured ? "OpenRouter ready" : "API key needed"}
              </Badge>
              <Badge variant="light" color={config?.enable_paid_models ? "blue" : "teal"}>
                {config?.enable_paid_models ? "Paid routing enabled" : "Free models only"}
              </Badge>
              {config?.default_model ? (
                <Badge color={config?.api_key_configured ? "teal" : "orange"}>
                  {config.default_model}
                </Badge>
              ) : null}
            </Group>
          </Group>

          <Tabs
            className="app-tabs"
            mt="md"
            value={currentTab}
            onChange={(value) => {
              if (value) {
                navigate(value);
              }
            }}
          >
            <Tabs.List>
              {routes.map((route) => {
                const Icon = route.icon;
                return (
                  <Tabs.Tab key={route.value} value={route.value} leftSection={<Icon size={16} />}>
                    {route.label}
                  </Tabs.Tab>
                );
              })}
            </Tabs.List>
          </Tabs>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="xl" pt={32} pb={36}>
          <Paper radius="xl" p="xl" className="shell-hero">
            <Group justify="space-between" align="flex-start" gap="xl">
              <div className="shell-copy">
                <Badge variant="outline" className="eyebrow">
                  Local-first risk review
                </Badge>
                <Title order={1} className="shell-title">
                  Clearer transcripts, calmer routing, and tidy session trails.
                </Title>
                <Text className="shell-subtitle" maw={720}>
                  Keep capture, prompt work, and model configuration inside one app shell. The interface is tuned for long-running sessions, quick refreshes, and lightweight local handoff.
                </Text>
              </div>

              <Paper radius="xl" p="md" className="status-panel">
                <Stack gap="sm">
                  <Text fw={700} size="sm" className="panel-overline">
                    Workspace posture
                  </Text>
                  {overviewItems.map((item) => (
                    <Group key={item.label} justify="space-between" align="flex-start" wrap="nowrap">
                      <div>
                        <Text size="sm" fw={600}>
                          {item.label}
                        </Text>
                        <Text size="xs" c="dimmed" maw={260}>
                          {item.detail}
                        </Text>
                      </div>
                      <Badge color={item.tone} variant="light">
                        {item.value}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              </Paper>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 3 }} mt="xl" spacing="md">
              <Paper radius="lg" p="md" className="hero-metric">
                <Text className="metric-label">Capture rhythm</Text>
                <Text className="metric-value">{config?.segment_seconds ?? 30}s</Text>
                <Text size="sm" c="dimmed">
                  Browser audio is batched into predictable chunks for transcription.
                </Text>
              </Paper>
              <Paper radius="lg" p="md" className="hero-metric">
                <Text className="metric-label">Insight interval</Text>
                <Text className="metric-value">{config?.insight_interval_seconds ?? 120}s</Text>
                <Text size="sm" c="dimmed">
                  Review notes are written to disk on a steady background cadence.
                </Text>
              </Paper>
              <Paper radius="lg" p="md" className="hero-metric">
                <Text className="metric-label">Operating mode</Text>
                <Text className="metric-value">{config?.enable_paid_models ? "Expanded" : "Guardrailed"}</Text>
                <Text size="sm" c="dimmed">
                  Stay on free models only, or widen routing when you need more headroom.
                </Text>
              </Paper>
            </SimpleGrid>
          </Paper>

          <Routes>
            <Route path="/" element={<Navigate to="/transcribe" replace />} />
            <Route path="/transcribe" element={<TranscribeTab config={config} />} />
            <Route path="/prompt" element={<PromptTab config={config} />} />
            <Route
              path="/config"
              element={<ConfigPanel config={config} onConfigSaved={setConfig} />}
            />
          </Routes>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
