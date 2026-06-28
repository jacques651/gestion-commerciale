// src/components/debug/DebugPanel.tsx

import React, { useState, useEffect, useRef } from 'react';
import { confirm } from '../../utils/confirm';
import {
  Paper,
  Stack,
  Group,
  Text,
  Button,
  Badge,
  Table,
  ScrollArea,
  Select,
  TextInput,
  ActionIcon,
  Tooltip,
  Modal,
  Tabs,
  SimpleGrid,
  Card,
  ThemeIcon,
  Divider,
  Code,
  Alert,
  Center,
  Loader,

} from '@mantine/core';
import {
  IconBug,
  IconRefresh,
  IconTrash,
  IconSearch,
  IconInfoCircle,
  IconAlertCircle,
  IconExclamationCircle,
  IconTerminal,
  IconDatabase,
  IconDeviceFloppy,

  IconTable,
  IconDownload,
  IconCopy,
  IconCheck,
} from '@tabler/icons-react';
import { debugService, DebugLog, SystemInfo } from '../../services/debugService';
import { notifications } from '@mantine/notifications';

export const DebugPanel: React.FC = () => {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<DebugLog[]>([]);
  const [systemInfo, setSystemInfo] = useState<(SystemInfo & { logsEnBase?: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DebugLog | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('logs');
  const [copying, setCopying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    const unsubscribe = debugService.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    applyFilters(logs);
  }, [logs, filterLevel, filterCategory, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Recharger depuis SQLite pour avoir tous les logs persistés
      await debugService.reloadFromDb();
      const info = await debugService.getSystemInfo();
      setSystemInfo(info as any);
      const allLogs = debugService.getLogs();
      setLogs(allLogs);
    } catch (error) {
      console.error('Erreur chargement debug:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (logsToFilter: DebugLog[]) => {
    let filtered = [...logsToFilter];
    if (filterLevel) filtered = filtered.filter(l => l.level === filterLevel);
    if (filterCategory) filtered = filtered.filter(l => l.category === filterCategory);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(l =>
        l.message.toLowerCase().includes(term) ||
        l.category.toLowerCase().includes(term)
      );
    }
    setFilteredLogs(filtered);
  };

  const clearLogs = async () => {
    if (!await confirm('Supprimer tous les logs de débogage (y compris ceux en base) ?', 'Suppression logs')) return;
    await debugService.clearLogs();
    setLogs([]);
    setFilteredLogs([]);
  };

  const handleDownload = async () => {
    await debugService.downloadLogs();
    notifications.show({ title: 'Téléchargement', message: 'Fichier debug.txt téléchargé', color: 'green', icon: <IconCheck size={16} /> });
  };

  const handleCopy = async () => {
    setCopying(true);
    try {
      await debugService.copyToClipboard();
      notifications.show({ title: 'Copié !', message: 'Logs copiés dans le presse-papier', color: 'green', icon: <IconCheck size={16} /> });
    } catch (e) {
      notifications.show({ title: 'Erreur', message: 'Impossible de copier', color: 'red' });
    } finally {
      setCopying(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'red';
      case 'warning': return 'orange';
      case 'info': return 'blue';
      default: return 'gray';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <IconAlertCircle size={14} />;
      case 'warning': return <IconExclamationCircle size={14} />;
      case 'info': return <IconInfoCircle size={14} />;
      default: return <IconBug size={14} />;
    }
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'error': return 'Erreur';
      case 'warning': return 'Avertissement';
      case 'info': return 'Info';
      default: return 'Debug';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch { return dateStr; }
  };

  const stats = debugService.getLogStats();
  const categories = [...new Set(logs.map(l => l.category))].sort();

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
        <Text ml="md">Chargement des logs...</Text>
      </Center>
    );
  }

  return (
    <Paper p="md" radius="lg" withBorder>
      <Stack gap="md">
        {/* En-tête */}
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size={40} radius="md" color="blue" variant="light">
              <IconBug size={24} />
            </ThemeIcon>
            <div>
              <Text size="xl" fw={700}>Centre de débogage</Text>
              <Text size="xs" c="dimmed">
                {logs.length} logs en mémoire
                {(systemInfo as any)?.logsEnBase !== undefined && ` · ${(systemInfo as any).logsEnBase} en base`}
              </Text>
            </div>
          </Group>
          <Group gap="xs">
            <Tooltip label="Copier tous les logs (pour envoyer au développeur)">
              <Button
                leftSection={<IconCopy size={16} />}
                variant="light"
                color="blue"
                size="sm"
                loading={copying}
                onClick={handleCopy}
              >
                Copier les logs
              </Button>
            </Tooltip>
            <Tooltip label="Télécharger en fichier texte">
              <Button
                leftSection={<IconDownload size={16} />}
                variant="light"
                color="green"
                size="sm"
                onClick={handleDownload}
              >
                Télécharger
              </Button>
            </Tooltip>
            <Tooltip label="Actualiser depuis la base">
              <ActionIcon variant="light" onClick={loadData} size="lg">
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Supprimer tous les logs">
              <ActionIcon variant="light" color="red" onClick={clearLogs} size="lg">
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Compteurs rapides */}
        <Group gap="xs">
          <Badge size="lg" color="red" variant="light">
            {stats.levels['error'] || 0} erreurs
          </Badge>
          <Badge size="lg" color="orange" variant="light">
            {stats.levels['warning'] || 0} avertissements
          </Badge>
          <Badge size="lg" color="blue" variant="light">
            {stats.levels['info'] || 0} infos
          </Badge>
          <Badge size="lg" color="gray" variant="light">
            {stats.levels['debug'] || 0} debug
          </Badge>
        </Group>

        <Divider />

        {/* Alerte si erreurs présentes */}
        {(stats.levels['error'] || 0) > 0 && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            <Text size="sm" fw={600}>{stats.levels['error']} erreur(s) détectée(s)</Text>
            <Text size="xs" c="dimmed">
              Utilisez "Copier les logs" ou "Télécharger" pour envoyer ce rapport au développeur.
            </Text>
          </Alert>
        )}

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="logs" leftSection={<IconTerminal size={16} />}>
              Logs ({filteredLogs.length})
            </Tabs.Tab>
            <Tabs.Tab value="system" leftSection={<IconDatabase size={16} />}>
              Système
            </Tabs.Tab>
          </Tabs.List>

          {/* Onglet Logs */}
          <Tabs.Panel value="logs" pt="md">
            <Stack gap="md">
              {/* Filtres */}
              <Group gap="xs" wrap="wrap">
                <Select
                  placeholder="Niveau"
                  data={[
                    { value: 'error', label: '❌ Erreurs' },
                    { value: 'warning', label: '⚠️ Avertissements' },
                    { value: 'info', label: 'ℹ️ Infos' },
                    { value: 'debug', label: '🔍 Debug' },
                  ]}
                  value={filterLevel}
                  onChange={setFilterLevel}
                  size="xs"
                  style={{ width: 160 }}
                  clearable
                />
                <Select
                  placeholder="Catégorie"
                  data={categories.map(c => ({ value: c, label: c }))}
                  value={filterCategory}
                  onChange={setFilterCategory}
                  size="xs"
                  style={{ width: 180 }}
                  clearable
                />
                <TextInput
                  placeholder="Rechercher dans les messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  leftSection={<IconSearch size={14} />}
                  size="xs"
                  style={{ flex: 1, minWidth: 180 }}
                />
              </Group>

              {/* Liste */}
              <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                <ScrollArea h={500} ref={scrollRef}>
                  {filteredLogs.length === 0 ? (
                    <Center py={60}>
                      <Stack align="center" gap="xs">
                        <IconBug size={40} color="#adb5bd" />
                        <Text c="dimmed">Aucun log à afficher</Text>
                        <Text size="xs" c="dimmed">
                          {logs.length === 0 ? 'Aucun log enregistré' : 'Aucun log ne correspond aux filtres'}
                        </Text>
                      </Stack>
                    </Center>
                  ) : (
                    <Table striped highlightOnHover verticalSpacing="xs">
                      <Table.Thead style={{ backgroundColor: '#f8f9fa' }}>
                        <Table.Tr>
                          <Table.Th style={{ width: 155 }}>Date</Table.Th>
                          <Table.Th style={{ width: 120 }}>Niveau</Table.Th>
                          <Table.Th style={{ width: 150 }}>Catégorie</Table.Th>
                          <Table.Th>Message</Table.Th>
                          <Table.Th style={{ width: 50 }}>+</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {filteredLogs.map((log) => (
                          <Table.Tr
                            key={log.id}
                            style={log.level === 'error' ? { backgroundColor: '#fff5f5' } :
                                   log.level === 'warning' ? { backgroundColor: '#fff9f0' } : undefined}
                          >
                            <Table.Td>
                              <Text size="xs" c="dimmed">{formatDate(log.timestamp)}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge color={getLevelColor(log.level)} variant="light" size="sm" leftSection={getLevelIcon(log.level)}>
                                {getLevelLabel(log.level)}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Badge size="sm" variant="outline" color="gray" style={{ maxWidth: 145, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {log.category}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" lineClamp={2}>{log.message}</Text>
                              {log.details && (
                                <Text size="xs" c="dimmed" lineClamp={1}>
                                  {typeof log.details === 'string' ? log.details : JSON.stringify(log.details).substring(0, 120)}
                                </Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              {(log.details || log.stack) && (
                                <ActionIcon variant="subtle" size="sm" onClick={() => { setSelectedLog(log); setDetailsModalOpen(true); }}>
                                  <IconInfoCircle size={14} />
                                </ActionIcon>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </ScrollArea>
              </Paper>
            </Stack>
          </Tabs.Panel>

          {/* Onglet Système */}
          <Tabs.Panel value="system" pt="md">
            {systemInfo && (
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                  <Card withBorder p="md" radius="md">
                    <Group>
                      <ThemeIcon color="blue" variant="light" size="lg"><IconDatabase size={18} /></ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">Version application</Text>
                        <Text fw={700}>v{systemInfo.appVersion}</Text>
                      </div>
                    </Group>
                  </Card>
                  <Card withBorder p="md" radius="md">
                    <Group>
                      <ThemeIcon color="green" variant="light" size="lg"><IconDatabase size={18} /></ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">Version base de données</Text>
                        <Text fw={700}>{systemInfo.dbVersion || 'N/A'}</Text>
                      </div>
                    </Group>
                  </Card>
                  <Card withBorder p="md" radius="md">
                    <Group>
                      <ThemeIcon color="grape" variant="light" size="lg"><IconTable size={18} /></ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">Tables</Text>
                        <Text fw={700}>{systemInfo.tablesCount}</Text>
                      </div>
                    </Group>
                  </Card>
                  <Card withBorder p="md" radius="md">
                    <Group>
                      <ThemeIcon color="orange" variant="light" size="lg"><IconDatabase size={18} /></ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">Enregistrements total</Text>
                        <Text fw={700}>{systemInfo.totalRecords.toLocaleString()}</Text>
                      </div>
                    </Group>
                  </Card>
                  <Card withBorder p="md" radius="md">
                    <Group>
                      <ThemeIcon color="teal" variant="light" size="lg"><IconDeviceFloppy size={18} /></ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">Dernière sauvegarde</Text>
                        <Text fw={700} size="sm">{systemInfo.lastBackup ? formatDate(systemInfo.lastBackup) : 'Aucune'}</Text>
                      </div>
                    </Group>
                  </Card>
                  <Card withBorder p="md" radius="md">
                    <Group>
                      <ThemeIcon color="red" variant="light" size="lg"><IconBug size={18} /></ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">Logs en base SQLite</Text>
                        <Text fw={700}>{(systemInfo as any).logsEnBase ?? '–'}</Text>
                      </div>
                    </Group>
                  </Card>
                </SimpleGrid>

                <Card withBorder p="md" radius="md">
                  <Text fw={600} size="sm" mb="md">Informations techniques</Text>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <div><Text size="xs" c="dimmed">Plateforme</Text><Text size="sm">{systemInfo.platform}</Text></div>
                    <div><Text size="xs" c="dimmed">Base de données</Text><Text size="sm">{systemInfo.dbPath}</Text></div>
                    <div><Text size="xs" c="dimmed">Mémoire JS</Text><Text size="sm">{systemInfo.memoryUsage}</Text></div>
                    <div><Text size="xs" c="dimmed">Uptime</Text><Text size="sm">{systemInfo.uptime} min</Text></div>
                  </SimpleGrid>
                </Card>

                <Card withBorder p="md" radius="md" style={{ borderColor: '#339af0' }}>
                  <Text fw={600} size="sm" mb="xs">📤 Envoyer les logs au développeur</Text>
                  <Text size="sm" c="dimmed" mb="md">
                    En cas de bug, utilisez l'un de ces boutons pour partager les logs avec le développeur.
                    Tous les messages d'erreur et actions sont enregistrés automatiquement dans la base de données.
                  </Text>
                  <Group>
                    <Button leftSection={<IconCopy size={16} />} variant="filled" color="blue" onClick={handleCopy} loading={copying}>
                      Copier dans le presse-papier
                    </Button>
                    <Button leftSection={<IconDownload size={16} />} variant="light" color="green" onClick={handleDownload}>
                      Télécharger en .txt
                    </Button>
                  </Group>
                </Card>
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Modal Détails */}
      <Modal opened={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="Détails du log" size="lg" centered>
        {selectedLog && (
          <Stack gap="md">
            <Group>
              <Badge color={getLevelColor(selectedLog.level)} variant="filled" size="lg" leftSection={getLevelIcon(selectedLog.level)}>
                {getLevelLabel(selectedLog.level)}
              </Badge>
              <Badge color="gray" variant="light" size="lg">{selectedLog.category}</Badge>
            </Group>
            <Divider />
            <div>
              <Text size="xs" c="dimmed">Message</Text>
              <Text fw={500}>{selectedLog.message}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Date</Text>
              <Text size="sm">{formatDate(selectedLog.timestamp)}</Text>
            </div>
            {selectedLog.details && (
              <div>
                <Text size="xs" c="dimmed">Détails</Text>
                <Paper withBorder p="sm" bg="gray.0" radius="md">
                  <Code block style={{ fontSize: 12 }}>
                    {typeof selectedLog.details === 'string'
                      ? selectedLog.details
                      : JSON.stringify(selectedLog.details, null, 2)}
                  </Code>
                </Paper>
              </div>
            )}
            {selectedLog.stack && (
              <div>
                <Text size="xs" c="dimmed">Stack trace</Text>
                <Paper withBorder p="sm" bg="red.0" radius="md">
                  <Code block style={{ fontSize: 11, color: '#721c24' }}>
                    {selectedLog.stack}
                  </Code>
                </Paper>
              </div>
            )}
            <Divider />
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setDetailsModalOpen(false)}>Fermer</Button>
            </Group>
          </Stack>
        )}
        </Modal>
    </Paper>
  );
};

export default DebugPanel;
