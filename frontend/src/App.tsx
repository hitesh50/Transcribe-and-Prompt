import { useEffect, useState } from "react";
import {
  AppShell,
  Badge,
  Container,
  Group,
  Paper,
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

  return (
    <AppShell
      padding="lg"
      header={{ height: 118 }}
      className="app-shell"
    >
      <AppShell.Header className="app-header">
        <Container size="xl" py="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Badge variant="outline" className="eyebrow">
                Local-first risk review
              </Badge>
              <Title order={1}>LocalRiskInsights</Title>
              <Text c="dimmed" maw={720}>
                Live transcription, rolling session files, and OpenRouter-powered risk summaries in one Docker-first workstation.
              </Text>
            </div>

            <Paper radius="lg" p="sm" className="status-panel">
              <Group gap="xs">
                <Badge color={config?.api_key_configured ? "teal" : "orange"}>
                  {config?.api_key_configured ? "OpenRouter ready" : "API key needed"}
                </Badge>
                <Badge variant="light">
                  {config?.enable_paid_models ? "Paid routing enabled" : "Free models only"}
                </Badge>
              </Group>
            </Paper>
          </Group>

          <Tabs
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
        <Container size="xl" pt={36} pb={32}>
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

