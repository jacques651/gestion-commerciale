// src/components/commandes/ListeCommandesRevendeur.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Group, Stack, Title, Card, Text,
  Modal, TextInput, Paper,
  Loader, ThemeIcon, Flex, ActionIcon,
  ScrollArea, Pagination, Tooltip, Select, Badge, Table, SimpleGrid,
  Avatar
} from '@mantine/core';
import {
  IconSearch, IconRefresh, IconTruck, 
  IconUser, IconCurrencyFrank,
  IconFileInvoice, IconEye, IconReceipt, 
  IconX, IconList
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';

interface CommandeRevendeur {
  idCommande: number;
  code_commande: string;
  idClient: number;
  date_commande: string;
  montant_ht: number;
  montant_ttc: number;
  statut: string;
  NomComplet: string;
  Societe: string;
  Tel: string;
  code_facture?: string;
  date_facture?: string;
  idFactureRevendeur?: number;
}

// ✅ Fonction de formatage de date personnalisée (sans date-fns)
const formatDateCustom = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
};

export const ListeCommandesRevendeur: React.FC = () => {
  const navigate = useNavigate();
  const [commandes, setCommandes] = useState<CommandeRevendeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [clientsList, setClientsList] = useState<{ value: string; label: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCommande, setSelectedCommande] = useState<CommandeRevendeur | null>(null);
  const [detailsOpened, setDetailsOpened] = useState(false);

  const itemsPerPage = 10;

  const chargerCommandes = async () => {
    setLoading(true);
    try {
      const db = await getDb();

      const result = await db.select<any[]>(`
        SELECT 
          c.idCommande,
          c.code_commande,
          c.idClient,
          c.date_commande,
          c.montant_ht,
          c.montant_ttc,
          c.statut,
          cl.NomComplet,
          cl.Societe,
          cl.Tel,
          fr.code_facture,
          fr.date_facture,
          fr.idFactureRevendeur
        FROM commandes c
        INNER JOIN clients cl ON cl.idClient = c.idClient
        LEFT JOIN factures_revendeur fr ON fr.idCommande = c.idCommande
        WHERE c.type_commande = 'REVENDEUR'
        ORDER BY c.date_commande DESC
      `);

      setCommandes(result || []);

      const uniqueClients = [...new Map(result.map((item: any) => [item.idClient, {
        value: item.idClient.toString(),
        label: item.NomComplet || item.Societe || 'Revendeur'
      }])).values()];
      setClientsList(uniqueClients);

    } catch (error) {
      console.error('Erreur chargement commandes:', error);
      notifications.show({ title: 'Erreur', message: 'Erreur de chargement', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerCommandes();
  }, []);

  const handleViewDetails = async (idCommande: number) => {
    try {
      const db = await getDb();
      const details = await db.select<any[]>(`
        SELECT 
          cd.idDetail,
          cd.idProduit,
          cd.qte_commande,
          cd.prix_unitaire_vente,
          p.code_produit,
          p.designation
        FROM commande_details cd
        INNER JOIN products p ON p.idProduit = cd.idProduit
        WHERE cd.idCommande = ?
      `, [idCommande]);
      
      const commande = commandes.find(c => c.idCommande === idCommande);
      if (commande) {
        setSelectedCommande({ ...commande, details: details || [] } as any);
        setDetailsOpened(true);
      }
    } catch (error) {
      notifications.show({ title: 'Erreur', message: 'Impossible de charger les détails', color: 'red' });
    }
  };

  const handleGenererFacture = async (idCommande: number) => {
    try {
      const { factureRevendeurRepository } = await import('../../database/repositories/factureRevendeurRepository');
      await factureRevendeurRepository.createFromCommande(idCommande);
      notifications.show({ title: 'Succès', message: 'Facture générée avec succès', color: 'green' });
      await chargerCommandes();
    } catch (error) {
      console.error('Erreur génération facture:', error);
      notifications.show({ title: 'Erreur', message: 'Impossible de générer la facture', color: 'red' });
    }
  };

  const handleVoirFacture = (idFactureRevendeur: number) => {
    if (idFactureRevendeur) {
      navigate(`/factures-revendeur/${idFactureRevendeur}`);
    }
  };

  const commandesFiltres = useMemo(() => {
    let filtered = [...commandes];

    if (selectedClient) {
      filtered = filtered.filter(c => c.idClient.toString() === selectedClient);
    }

    if (dateDebut) {
      const debut = new Date(dateDebut);
      debut.setHours(0, 0, 0, 0);
      filtered = filtered.filter(c => new Date(c.date_commande) >= debut);
    }

    if (dateFin) {
      const fin = new Date(dateFin);
      fin.setHours(23, 59, 59, 999);
      filtered = filtered.filter(c => new Date(c.date_commande) <= fin);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.code_commande?.toLowerCase().includes(term) ||
        c.NomComplet?.toLowerCase().includes(term) ||
        c.Societe?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [commandes, selectedClient, dateDebut, dateFin, searchTerm]);

  const stats = {
    total: commandes.length,
    montantTotal: commandes.reduce((sum, c) => sum + (c.montant_ttc || 0), 0),
    avecFacture: commandes.filter(c => c.code_facture).length,
    sansFacture: commandes.filter(c => !c.code_facture).length
  };

  const totalPages = Math.ceil(commandesFiltres.length / itemsPerPage);
  const paginatedCommandes = commandesFiltres.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const resetFilters = () => {
    setSelectedClient(null);
    setDateDebut('');
    setDateFin('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'CONFIRMEE':
        return <Badge color="green" variant="light" size="sm">Confirmée</Badge>;
      case 'EN_COURS':
        return <Badge color="yellow" variant="light" size="sm">En cours</Badge>;
      case 'LIVREE':
        return <Badge color="blue" variant="light" size="sm">Livrée</Badge>;
      case 'ANNULEE':
        return <Badge color="red" variant="light" size="sm">Annulée</Badge>;
      default:
        return <Badge variant="light" size="sm">{statut}</Badge>;
    }
  };

  if (loading && commandes.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des commandes revendeurs...</Text>
      </Card>
    );
  }

  return (
    <>
      <Stack gap="lg" p="md">
        {/* EN-TÊTE */}
        <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
          <Flex justify="space-between" align="center" wrap="wrap">
            <Stack gap={4}>
              <Group gap="md">
                <ThemeIcon size={50} radius="md" color="white" variant="light">
                  <IconTruck size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Commandes Revendeurs</Title>
                  <Text c="gray.3" size="sm">Gestion des commandes des revendeurs</Text>
                </div>
              </Group>
            </Stack>
            <Group>
              <Button variant="light" color="white" leftSection={<IconRefresh size={18} />} onClick={chargerCommandes}>
                Actualiser
              </Button>
            </Group>
          </Flex>

          <SimpleGrid cols={4} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="white" variant="light" size="lg"><IconTruck size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Total commandes</Text><Text c="white" fw={700} size="xl">{stats.total}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="green" variant="light" size="lg"><IconCurrencyFrank size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Montant total</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.montantTotal)} F</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="blue" variant="light" size="lg"><IconFileInvoice size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Avec facture</Text><Text c="white" fw={700} size="xl">{stats.avecFacture}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="orange" variant="light" size="lg"><IconReceipt size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Sans facture</Text><Text c="white" fw={700} size="xl">{stats.sansFacture}</Text></div>
              </Group>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* FILTRES + BOUTONS */}
        <Card withBorder radius="lg" shadow="sm" p="sm">
          <Group grow align="flex-end" gap="xs">
            {/* Revendeur */}
            <Select
              label="Revendeur"
              placeholder="Sélectionner"
              data={clientsList}
              value={selectedClient}
              onChange={setSelectedClient}
              clearable
              searchable
              leftSection={<IconUser size={14} />}
              size="xs"
              styles={{ input: { fontSize: '12px' }, label: { fontSize: '11px' } }}
            />
            
            {/* Recherche */}
            <TextInput
              label="Recherche"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftSection={<IconSearch size={14} />}
              size="xs"
              styles={{ input: { fontSize: '12px' }, label: { fontSize: '11px' } }}
            />
            
            {/* Date début */}
            <TextInput
              label="Début"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              size="xs"
              styles={{ input: { fontSize: '12px' }, label: { fontSize: '11px' } }}
            />
            
            {/* Date fin */}
            <TextInput
              label="Fin"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              size="xs"
              styles={{ input: { fontSize: '12px' }, label: { fontSize: '11px' } }}
            />
            
            {/* BOUTONS D'ACTION */}
            <Group gap="xs" align="flex-end" style={{ paddingBottom: 2 }}>
              <Button 
                leftSection={<IconList size={14} />} 
                variant="light" 
                color="blue" 
                onClick={() => navigate('/commandes')} 
                size="xs"
              >
                Toutes
              </Button>
              <Button 
                leftSection={<IconFileInvoice size={14} />} 
                variant="light" 
                color="orange" 
                onClick={() => navigate('/factures-revendeur')} 
                size="xs"
              >
                Factures
              </Button>
              <Button 
                variant="light" 
                color="red" 
                onClick={resetFilters} 
                size="xs" 
                leftSection={<IconX size={14} />}
              >
                Effacer
              </Button>
            </Group>
          </Group>
        </Card>

        {/* TABLEAU PRINCIPAL */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          <ScrollArea h="calc(100vh - 500px)">
            <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                  <Table.Th c="white" w={50}>N°</Table.Th>
                  <Table.Th c="white">Revendeur</Table.Th>
                  <Table.Th c="white" w={120}>Date</Table.Th>
                  <Table.Th c="white" w={120}>Code commande</Table.Th>
                  <Table.Th c="white" ta="right" w={120}>Montant TTC</Table.Th>
                  <Table.Th c="white">Code facture</Table.Th>
                  <Table.Th c="white">Statut</Table.Th>
                  <Table.Th c="white" ta="center" w={220}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedCommandes.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={8} align="center">
                      <Stack align="center" py={50}>
                        <IconTruck size={50} color="#ccc" />
                        <Text c="dimmed">Aucune commande revendeur trouvée</Text>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  paginatedCommandes.map((commande, index) => {
                    const num = (currentPage - 1) * itemsPerPage + index + 1;
                    return (
                      <Table.Tr key={commande.idCommande}>
                        <Table.Td>
                          <Text fw={600} size="sm">{num}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="sm">
                            <Avatar size="sm" radius="xl" color="green">
                              {(commande.NomComplet || 'R').charAt(0).toUpperCase()}
                            </Avatar>
                            <div>
                              <Text fw={500} size="sm">{commande.NomComplet || '-'}</Text>
                              <Text size="xs" c="dimmed">{commande.Societe || ''}</Text>
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {formatDateCustom(commande.date_commande)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={600} size="sm">{commande.code_commande}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} size="sm" c="blue">
                            {formatMontant(commande.montant_ttc)} F
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c={commande.code_facture ? 'green' : 'dimmed'}>
                            {commande.code_facture || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {getStatusBadge(commande.statut)}
                        </Table.Td>
                        <Table.Td ta="center">
                          <Group gap={4} justify="center">
                            <Tooltip label="Voir détails">
                              <ActionIcon
                                variant="light"
                                color="blue"
                                size="md"
                                onClick={() => handleViewDetails(commande.idCommande)}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>

                            {commande.code_facture && commande.idFactureRevendeur && (
                              <Tooltip label="Voir facture">
                                <ActionIcon
                                  variant="light"
                                  color="grape"
                                  size="md"
                                  onClick={() => handleVoirFacture(commande.idFactureRevendeur!)}
                                >
                                  <IconFileInvoice size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )}

                            {!commande.code_facture && (
                              <Tooltip label="Générer facture">
                                <ActionIcon
                                  variant="light"
                                  color="green"
                                  size="md"
                                  onClick={() => handleGenererFacture(commande.idCommande)}
                                >
                                  <IconReceipt size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="md" />
            </Group>
          )}
        </Card>
      </Stack>

      {/* MODAL DÉTAILS COMMANDE */}
      <Modal
        opened={detailsOpened}
        onClose={() => setDetailsOpened(false)}
        title={`Détails de la commande ${(selectedCommande as any)?.code_commande}`}
        size="xl"
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {selectedCommande && (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <div>
                <Text size="sm" c="dimmed">Revendeur</Text>
                <Text fw={500}>{selectedCommande.NomComplet}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Société</Text>
                <Text fw={500}>{selectedCommande.Societe || '-'}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Téléphone</Text>
                <Text fw={500}>{selectedCommande.Tel || '-'}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Date</Text>
                <Text fw={500}>{formatDateCustom(selectedCommande.date_commande)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Code facture</Text>
                <Text fw={500}>{selectedCommande.code_facture || '-'}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Statut</Text>
                {getStatusBadge(selectedCommande.statut)}
              </div>
            </SimpleGrid>

            <div>
              <Text fw={700} mb="sm">Produits commandés</Text>
              <ScrollArea style={{ maxHeight: 300 }}>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Code</Table.Th>
                      <Table.Th>Désignation</Table.Th>
                      <Table.Th ta="right">Quantité</Table.Th>
                      <Table.Th ta="right">Prix unitaire</Table.Th>
                      <Table.Th ta="right">Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(selectedCommande as any).details?.map((detail: any, idx: number) => (
                      <Table.Tr key={idx}>
                        <Table.Td><Text size="sm">{detail.code_produit}</Text></Table.Td>
                        <Table.Td><Text size="sm">{detail.designation}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm">{detail.qte_commande}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm">{formatMontant(detail.prix_unitaire_vente)} F</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm" fw={500}>{formatMontant(detail.qte_commande * detail.prix_unitaire_vente)} F</Text></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </div>

            <div style={{ borderTop: '1px solid var(--mantine-color-gray-3)', paddingTop: 16 }}>
              <Group justify="flex-end">
                <div>
                  <Text size="sm" c="dimmed">Montant total TTC</Text>
                  <Text fw={700} size="xl" c="blue">
                    {formatMontant(selectedCommande.montant_ttc)} FCFA
                  </Text>
                </div>
              </Group>
            </div>
          </Stack>
        )}
      </Modal>
    </>
  );
};

export default ListeCommandesRevendeur;