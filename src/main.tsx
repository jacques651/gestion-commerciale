// src/main.tsx

import ReactDOM from "react-dom/client";
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import { theme } from "./theme";
import { colorSchemeManager, defaultColorScheme } from "./theme/themeScheme";

// Import des styles Mantine (OBLIGATOIRE)
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';

// Police Inter en local (@fontsource)
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';

// Thème « Vert-ardoise » (toujours en dernier)
import './styles/theme-kit.css';
import './styles/theme-gestion-commerciale.css';

// Configuration de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <MantineProvider theme={theme} defaultColorScheme={defaultColorScheme} colorSchemeManager={colorSchemeManager}>
      <Notifications position="top-right" zIndex={1000} />
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MantineProvider>
  </ErrorBoundary>
);