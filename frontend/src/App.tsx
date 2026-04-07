import { useEffect, useState } from "react";
import {
  AppShell,
  Container,
  Group,
  Tabs,
  Text,
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
      padding="md"
      header={{ height: 68 }}
      className="app-shell"
    >
      <AppShell.Header className="app-header">
        <Container size="xl" py="xs" className="header-container">
          <Group justify="space-between" align="center" gap="md" wrap="nowrap">
            <Text fw={700} className="header-brand">
              INSIGHTS@LOCAL
            </Text>
            <Tabs
              className="app-tabs"
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
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="xl" pt={12} pb={24}>
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
