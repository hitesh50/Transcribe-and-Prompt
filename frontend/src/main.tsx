import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import App from "./App";
import "./styles.css";

const theme = createTheme({
  primaryColor: "teal",
  defaultRadius: "md",
  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
  headings: {
    fontFamily: '"Iowan Old Style", "Georgia", serif',
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <Notifications position="top-right" />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>,
);
