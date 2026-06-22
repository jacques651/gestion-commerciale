// src/components/debug/DebugPanel.tsx

import React, { useState, useEffect, useRef } from 'react';
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
  Switch,
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
  IconMeteor,
  IconTable,
} from '@tabler/icons-react';
import { debugService, DebugLog, SystemInfo } from '../../services/debugService';

export const DebugPanel: React.FC = () => {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<DebugLog[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DebugLog | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('logs');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    const unsubscribe = debugService.subscribe((newLogs) => {
      setLogs(newLogs);
      applyFilters(newLogs);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    applyFilters(logs);
  }, [filterLevel, filterCategory, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    try {
      const info = await debugService.getSystemInfo();
      setSystemInfo(info);
      
      const allLogs = debugService.getLogs();
      setLogs(allLogs);
      applyFilters(allLogs);
    } catch (error) {
      console.error('Erreur chargement debug:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (logsToFilter: DebugLog[]) => {
    let filtered = [...logsToFilter];

    if (filterLevel) {
      filtered = filtered.filter(l => l.level === filterLevel);
    }

    if (filterCategory) {
      filtered = filtered.filter(l => l.category === filterCategory);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(l =>
        l.message.toLowerCase().includes(term) ||
        l.category.toLowerCase().includes(term)
      );
    }

    setFilteredLogs(filtered);

    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const clearLogs = () => {
    if (confirm('Voulez-vous supprimer tous les logs de débogage ?')) {
      debugService.clearLogs();
    }
  };

  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'error': return 'red';
      case 'warning': return 'orange';
      case 'info': return 'blue';
      case 'debug': return 'gray';
      default: return 'gray';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <IconAlertCircle size={14} />;
      case 'warning': return <IconExclamationCircle size={14} />;
      case 'info': return <IconInfoCircle size={14} />;
      case 'debug': return <IconBug size={14} />;
      default: return null;
    }
  };

  const getLevelLabel = (level: string): string => {
    switch (level) {
      case 'error': return 'Erreur';
      case 'warning': return 'Avertissement';
      case 'info': return 'Information';
      case 'debug': return 'Débogage';
      default: return level;
    }
  };

  const categories = [...new Set(logs.map(l => l.category))];

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getMemoryColor = () => {
    if (!systemInfo) return 'green';
    const match = systemInfo.memoryUsage.match(/(\d+)/);
    if (!match) return 'green';
    const used = parseInt(match[1]);
    if (used > 80) return 'red';
    if (used > 50) return 'orange';
    return 'green';
  };

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
        <Text ml="md">Chargement des données de débogage...</Text>
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
                {logs.length} logs • {filteredLogs.length} affichés
              </Text>
            </div>
          </Group>
          <Group>
            <Tooltip label="Actualiser">
              <ActionIcon variant="light" onClick={loadData}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Supprimer les logs">
              <ActionIcon variant="light" color="red" onClick={clearLogs}>
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Divider />

        {/* Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="logs" leftSection={<IconTerminal size={16} />}>
              Logs
            </Tabs.Tab>
            <Tabs.Tab value="system" leftSection={<IconDatabase size={16} />}>
              Système
            </Tabs.Tab>
          </Tabs.List>

          {/* Tab Logs */}
          <Tabs.Panel value="logs" pt="md">
            <Stack gap="md">
              {/* Filtres */}
              <Group gap="xs" wrap="wrap">
                <Select
                  placeholder="Niveau"
                  data={[
                    { value: '', label: 'Tous les niveaux' },
                    { value: 'error', label: '❌ Erreur' },
                    { value: 'warning', label: '⚠️ Avertissement' },
                    { value: 'info', label: 'ℹ️ Information' },
                    { value: 'debug', label: '🔍 Débogage' },
                  ]}
                  value={filterLevel}
                  onChange={setFilterLevel}
                  size="xs"
                  style={{ width: 150 }}
                  clearable
                />

                <Select
                  placeholder="Catégorie"
                  data={[
                    { value: '', label: 'Toutes les catégories' },
                    ...categories.map(c => ({ value: c, label: c })),
                  ]}
                  value={filterCategory}
                  onChange={setFilterCategory}
                  size="xs"
                  style={{ width: 150 }}
                  clearable
                />

                <TextInput
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  leftSection={<IconSearch size={14} />}
                  size="xs"
                  style={{ flex: 1, minWidth: 150 }}
                />

                <Switch
                  label="Auto-scroll"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.currentTarget.checked)}
                  size="xs"
                />

                <Badge size="sm" variant="light" color="blue">
                  {filteredLogs.length} logs
                </Badge>
              </Group>

              {/* Liste des logs */}
              <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                <ScrollArea h={450} ref={scrollRef}>
                  {filteredLogs.length === 0 ? (
                    <Center py={50}>
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
                          <Table.Th style={{ width: 160 }}>Date</Table.Th>
                          <Table.Th style={{ width: 100 }}>Niveau</Table.Th>
                          <Table.Th style={{ width: 120 }}>Catégorie</Table.Th>
                          <Table.Th>Message</Table.Th>
                          <Table.Th style={{ width: 60 }}>Détails</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {filteredLogs.map((log) => (
                          <Table.Tr key={log.id}>
                            <Table.Td>
                              <Text size="xs" c="dimmed">{formatDate(log.timestamp)}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={getLevelColor(log.level)}
                                variant="light"
                                size="sm"
                                leftSection={getLevelIcon(log.level)}
                              >
                                {getLevelLabel(log.level)}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Badge size="sm" variant="outline" color="gray">
                                {log.category}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{log.message}</Text>
                              {log.details && (
                                <Text size="xs" c="dimmed" lineClamp={1}>
                                  {typeof log.details === 'string' ? log.details : JSON.stringify(log.details).substring(0, 100)}
                                </Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <ActionIcon
                                variant="light"
                                size="sm"
                                onClick={() => {
                                  setSelectedLog(log);
                                  setDetailsModalOpen(true);
                                }}
                              >
                                <IconInfoCircle size={14} />
                              </ActionIcon>
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

          {/* Tab Système */}
          <Tabs.Panel value="system" pt="md">
            {systemInfo && (
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                  <Card withBorder p="md" radius="md">
                    <Group>
                      <ThemeIcon color="blue" variant="light" size="lg">
                        <IconDatabase size={18} />
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">Version de l'application</Text>
                        <Text fw={700} size="lg">v{systemInfo.appVersion}</Text>
                      </div>
                    </Group>
                  </Card>

                  <Card withBorder p="md" radius="md">
                    <Group>
                      <ThemeIcon color="green" variant="light" size="lg">
                        <IconDatabase size={18} />
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">Version de la DB</Text>
                        <Text fw={700} size="lg">{systemInfo.dbVersion || 'Non définie'}</Text>
                      </div>
                    </Group>
                  </Card>

                  <Card withBorder p="md" radius="md">
                    <Group>
                      <ThemeIcon color="grape" variant="light" size="lg">
                        <IconTable size={18} />
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">Tables</Text>
                        <Text fw={700} size="lg">{systemInfo.tablesCount}</Text>
                      </div>
                    </Group>
                  </Card>

                  <Card withBorder p="md" radius="md">
                    <Group>
                      <ThemeIcon color="orange" variant="light" size="lg">
                        <IconDatabase size={18} />
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">Total enregistrements</Text>
                        <Text fw={700} size="lg">{systemInfo.totalRecords.toLocaleString()}</Text>
                      </div>
                    </Group>
                  </Card>

                  <Card withBorder p="md" radius="md">
                    <Group>
                      <ThemeIcon color="teal" variant="light" size="lg">
                        <IconDeviceFloppy size={18} />
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">Dernière sauvegarde</Text>
                        <Text fw={700} size="sm">
                          {systemInfo.lastBackup ? formatDate(systemInfo.lastBackup) : 'Aucune'}
                        </Text>
                      </div>
                    </Group>
                  </Card>

                  <Card withBorder p="md" radius="md">
                    <Group>
                      <ThemeIcon color={getMemoryColor()} variant="light" size="lg">
                        <IconMeteor size={18} />
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">Mémoire utilisée</Text>
                        <Text fw={700} size="lg">{systemInfo.memoryUsage}</Text>
                      </div>
                    </Group>
                  </Card>
                </SimpleGrid>

                <Card withBorder p="md" radius="md">
                  <Text fw={600} size="sm" mb="md">Informations techniques</Text>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <div>
                      <Text size="xs" c="dimmed">Plateforme</Text>
                      <Text size="sm">{systemInfo.platform}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Chemin de la base</Text>
                      <Text size="sm">{systemInfo.dbPath}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Uptime</Text>
                      <Text size="sm">{systemInfo.uptime} minutes</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Statut</Text>
                      <Badge color="green" variant="filled">Opérationnel</Badge>
                    </div>
                  </SimpleGrid>
                </Card>

                <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
                  <Text size="sm">Les logs de débogage sont stockés localement dans votre navigateur.</Text>
                  <Text size="xs" c="dimmed">Ils sont conservés jusqu'à ce que vous les supprimiez manuellement.</Text>
                </Alert>
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Modal Détails */}
      <Modal
        opened={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title="Détails du log"
        size="lg"
        centered
      >
        {selectedLog && (
          <Stack gap="md">
            <Group>
              <Badge
                color={getLevelColor(selectedLog.level)}
                variant="filled"
                size="lg"
                leftSection={getLevelIcon(selectedLog.level)}
              >
                {getLevelLabel(selectedLog.level)}
              </Badge>
              <Badge color="gray" variant="light" size="lg">
                {selectedLog.category}
              </Badge>
            </Group>

            <Divider />

            <div>
              <Text size="xs" c="dimmed">Message</Text>
              <Text size="md" fw={500}>{selectedLog.message}</Text>
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
              <Button variant="light" onClick={() => setDetailsModalOpen(false)}>
                Fermer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Paper>
  );
};

export default DebugPanel;