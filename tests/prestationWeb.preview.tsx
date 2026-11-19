/** Composants et façade réels ; seule la session est injectée, serveur sur une COPIE SQLite. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, MantineProvider, Stack, Text } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '../src/styles/theme-kit.css';
import '../src/styles/theme-gestion-commerciale.css';
import { theme } from '../src/theme';
import GestionPrestations from '../src/components/ventes/GestionPrestations';
import { useGlobalModalDrag } from '../src/hooks/useDraggable';
function Preview() {
  const [dark,setDark]=useState(false); useGlobalModalDrag();
  document.documentElement.dataset.theme=dark?'dark':'light';
  return <MantineProvider theme={theme} forceColorScheme={dark?'dark':'light'}><Notifications />
    <Stack p="sm" gap="sm"><Text fw={700}>Prestations web — copie SQLite isolée, véritable API Node</Text>
      <Button size="xs" onClick={()=>setDark(value=>!value)}>Mode {dark?'clair':'sombre'}</Button>
      <GestionPrestations /></Stack>
  </MantineProvider>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
