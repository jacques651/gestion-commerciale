import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Button, Group, MantineProvider, Stack, Text } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';import '@mantine/notifications/styles.css';
import '../src/styles/theme-kit.css';import '../src/styles/theme-gestion-commerciale.css';
import { theme } from '../src/theme';
import ListeVentes from '../src/components/ventes/ListeVentes';
import JournalCaisse from '../src/components/caisse/JournalCaisse';
import Dashboard from '../src/components/dashboard/Dashboard';
import TableauBordFinancier from '../src/components/finances/TableauBordFinancier';
import RapportsVente from '../src/components/caisse/RapportsVente';
import HistoriqueActivite from '../src/components/historique/HistoriqueActivite';
import { useGlobalModalDrag } from '../src/hooks/useDraggable';
const screens={ListeVentes,JournalCaisse,Dashboard,TableauBordFinancier,RapportsVente,HistoriqueActivite};
function Preview(){
  const [screen,setScreen]=useState<keyof typeof screens>('ListeVentes');const [dark,setDark]=useState(false);useGlobalModalDrag();
  document.documentElement.dataset.theme=dark?'dark':'light';const Screen=screens[screen];
  return <MantineProvider theme={theme} forceColorScheme={dark?'dark':'light'}><Notifications/><MemoryRouter>
    <Stack p="sm" gap="sm"><Text fw={700}>Intégration 3.7 — banc isolé, aucune base connectée</Text>
      <Group gap="xs"><Button size="xs" onClick={()=>setDark(value=>!value)}>Mode {dark?'clair':'sombre'}</Button>
        {(Object.keys(screens) as (keyof typeof screens)[]).map(name=><Button size="xs" variant="default" key={name} onClick={()=>setScreen(name)}>{name}</Button>)}
      </Group><Screen/>
    </Stack>
  </MemoryRouter></MantineProvider>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
