// src/components/factures/ListeFacturesRevendeur.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Group, Badge, ActionIcon, Stack, Title, Card, Text, Tooltip,
  Pagination, TextInput, Paper, Box, SimpleGrid,
  Loader, ThemeIcon, Flex, Modal, Center
} from '@mantine/core';
import {
  IconPrinter, IconDownload, IconSearch, IconRefresh, IconFileInvoice,
  IconTruck, IconCurrencyFrank, IconReceipt, IconCash, IconAlertCircle,
  IconList, IconListDetails
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';
import NouveauDecompte from '../decomptes/NouveauDecompte';
import { generateFactureRevendeurCode } from '../../services/codeGeneratorService';

interface FactureRevendeur {
  idFactureRevendeur: number;
  code_facture: string;
  idRevendeur: number;
  date_facture: string;
  montant_ht: number;
  montant_ttc: number;
  commission: number;
  statut: string;
  client_nom?: string;
  client_societe?: string;
}

export const ListeFacturesRevendeur: React.FC = () => {
  const navigate = useNavigate();
  const [factures, setFactures] = useState<FactureRevendeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [decompteModalOpened, setDecompteModalOpened] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState<FactureRevendeur | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  const itemsPerPage = 10;

  const chargerFactures = async () => {
    console.log("🔍 Début chargement des factures...");
    setLoading(true);
    setError(null);
    
    try {
      const db = await getDb();
      
      const tables = await db.select<{ name: string }[]>(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='factures_revendeur'
      `);
      
      if (tables.length === 0) {
        setFactures([]);
        setError("La table factures_revendeur n'existe pas encore.");
        setLoading(false);
        return;
      }
      
      const result = await db.select<any[]>(`
        SELECT 
          fr.idFactureRevendeur,
          fr.code_facture,
          fr.idRevendeur,
          fr.date_facture,
          fr.montant_ht,
          fr.montant_ttc,
          fr.commission,
          fr.statut,
          cl.NomComplet as client_nom,
          cl.Societe as client_societe
        FROM factures_revendeur fr
        LEFT JOIN clients cl ON fr.idRevendeur = cl.idClient
        ORDER BY fr.date_facture DESC
      `);
      
      setFactures(result || []);
      
    } catch (error) {
      console.error('Erreur chargement factures:', error);
      setError(error instanceof Error ? error.message : 'Erreur de chargement');
      setFactures([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Générer un code facture pour une facture qui n'en a pas
  const genererCodeFacture = async (idFactureRevendeur: number): Promise<string> => {
    try {
      const code = await generateFactureRevendeurCode();
      const db = await getDb();
      await db.execute(
        `UPDATE factures_revendeur SET code_facture = ? WHERE idFactureRevendeur = ?`,
        [code, idFactureRevendeur]
      );
      console.log(`✅ Code facture généré: ${code}`);
      return code;
    } catch (error) {
      console.error('Erreur génération code facture:', error);
      throw error;
    }
  };

  useEffect(() => {
    chargerFactures();
  }, []);

  const chargerDetailsFacture = async (idFactureRevendeur: number): Promise<any[]> => {
    try {
      const db = await getDb();
      
      const tables = await db.select<{ name: string }[]>(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='factures_revendeur_details'
      `);
      
      if (tables.length === 0) {
        return [];
      }
      
      const details = await db.select<any[]>(`
        SELECT 
          frd.idDetailFactureRevendeur as idDetail,
          frd.idProduit,
          frd.qte_commande,
          frd.prix_achat_base,
          frd.prix_unitaire_vente,
          p.designation,
          p.code_produit,
          p.categorie,
          p.unite_base
        FROM factures_revendeur_details frd
        INNER JOIN products p ON p.idProduit = frd.idProduit
        WHERE frd.idFactureRevendeur = ?
      `, [idFactureRevendeur]);
      
      return details;
    } catch (error) {
      console.error('Erreur chargement détails:', error);
      return [];
    }
  };

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE': return <Badge color="orange" variant="light">En attente</Badge>;
      case 'PAYEE': return <Badge color="green" variant="light">Payée</Badge>;
      case 'ANNULEE': return <Badge color="red" variant="light">Annulée</Badge>;
      default: return <Badge color="gray" variant="light">{statut || 'EN_ATTENTE'}</Badge>;
    }
  };

  const handleVoirFacture = (facture: FactureRevendeur) => {
    navigate(`/factures-revendeur/${facture.idFactureRevendeur}`);
  };

  const handleImprimer = (facture: FactureRevendeur) => {
    navigate(`/factures-revendeur/${facture.idFactureRevendeur}/print`);
  };

  const handleTelecharger = (facture: FactureRevendeur) => {
    const printWindow = window.open(`/factures-revendeur/${facture.idFactureRevendeur}/print`, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  };

  // 🔥 Créer le décompte - avec vérification/génération du code facture
  const handleCreerDecompte = async (facture: FactureRevendeur) => {
    setLoadingDetails(true);
    try {
      // Si la facture n'a pas de code, en générer un
      let factureAvecDetails = { ...facture };
      
      if (!facture.code_facture || facture.code_facture === 'FR-XXXX') {
        const newCode = await genererCodeFacture(facture.idFactureRevendeur);
        factureAvecDetails.code_facture = newCode;
      }
      
      const details = await chargerDetailsFacture(facture.idFactureRevendeur);
      
      setSelectedFacture({
        ...factureAvecDetails,
        details: details
      } as any);
      setDecompteModalOpened(true);
    } catch (error) {
      console.error('Erreur:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les détails de la facture',
        color: 'red'
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleVoirDecomptes = () => {
    navigate('/decomptes');
  };

  const facturesFiltrees = factures.filter(f =>
    f.code_facture?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.client_nom?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(facturesFiltrees.length / itemsPerPage);
  const paginatedFactures = facturesFiltrees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = {
    total: factures.length,
    totalMontant: factures.reduce((sum, f) => sum + (f.montant_ttc || 0), 0),
    totalCommission: factures.reduce((sum, f) => sum + (f.commission || 0), 0),
    enAttente: factures.filter(f => f.statut === 'EN_ATTENTE' || !f.statut).length,
    payees: factures.filter(f => f.statut === 'PAYEE').length
  };

  if (loading) {
    return (
      <Center style={{ height: '70vh' }}>
        <Stack align="center">
          <Loader size="xl" />
          <Text mt="md">Chargement des factures revendeurs...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Center style={{ height: '70vh' }}>
        <Card withBorder p="xl" radius="lg" w={500}>
          <Stack align="center">
            <IconAlertCircle size={50} color="red" />
            <Title order={3} c="red">Erreur</Title>
            <Text ta="center" c="dimmed">{error}</Text>
            <Button variant="light" color="blue" leftSection={<IconRefresh size={16} />} onClick={chargerFactures} mt="md">
              Réessayer
            </Button>
          </Stack>
        </Card>
      </Center>
    );
  }

  return (
    <>
      <Stack gap="lg" p="md">
        <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
          <Flex justify="space-between" align="center" wrap="wrap">
            <Stack gap={4}>
              <Group gap="md">
                <ThemeIcon size={50} radius="md" color="white" variant="light">
                  <IconFileInvoice size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Factures Revendeurs</Title>
                  <Text c="gray.3" size="sm">Gestion des factures et décomptes</Text>
                </div>
              </Group>
            </Stack>
            <Group>
              <Button 
                variant="light" 
                color="teal" 
                leftSection={<IconListDetails size={18} />} 
                onClick={handleVoirDecomptes}
              >
                Liste des décomptes
              </Button>
              <Button variant="light" color="white" leftSection={<IconRefresh size={18} />} onClick={chargerFactures}>
                Actualiser
              </Button>
            </Group>
          </Flex>

          {factures.length > 0 && (
            <SimpleGrid cols={4} spacing="md" mt="xl">
              <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
                <Group><ThemeIcon color="white" variant="light" size="lg"><IconFileInvoice size={20} /></ThemeIcon>
                  <div><Text c="white" size="xs">Total factures</Text><Text c="white" fw={700} size="xl">{stats.total}</Text></div>
                </Group>
              </Card>
              <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
                <Group><ThemeIcon color="green" variant="light" size="lg"><IconCurrencyFrank size={20} /></ThemeIcon>
                  <div><Text c="white" size="xs">Montant total</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.totalMontant)} FCFA</Text></div>
                </Group>
              </Card>
              <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
                <Group><ThemeIcon color="orange" variant="light" size="lg"><IconReceipt size={20} /></ThemeIcon>
                  <div><Text c="white" size="xs">Commission totale</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.totalCommission)} FCFA</Text></div>
                </Group>
              </Card>
              <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
                <Group><ThemeIcon color="yellow" variant="light" size="lg"><IconTruck size={20} /></ThemeIcon>
                  <div><Text c="white" size="xs">En attente</Text><Text c="white" fw={700} size="xl">{stats.enAttente}</Text></div>
                </Group>
              </Card>
            </SimpleGrid>
          )}
        </Paper>

        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group justify="space-between">
            <TextInput
              placeholder="Rechercher par code facture ou client..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              size="md"
              style={{ width: 350 }}
            />
            <Button variant="filled" color="orange" leftSection={<IconRefresh size={16} />} onClick={async () => {
              setSearchTerm('');
              setCurrentPage(1);
              await chargerFactures();
            }}>
              Réinitialiser
            </Button>
          </Group>
        </Card>

        {/* Barre d'actions supplémentaires */}
        <Card withBorder radius="lg" shadow="sm" p="md">
          <Group justify="center" gap="md">
            <Button 
              variant="light" 
              color="blue" 
              leftSection={<IconFileInvoice size={18} />} 
              onClick={() => navigate('/commandes-revendeur')}
            >
              Commandes Revendeurs
            </Button>
            <Button 
              variant="light" 
              color="green" 
              leftSection={<IconTruck size={18} />} 
              onClick={() => navigate('/stock-revendeurs')}
            >
              Stocks Revendeurs
            </Button>
            <Button 
              variant="light" 
              color="orange" 
              leftSection={<IconListDetails size={18} />} 
              onClick={handleVoirDecomptes}
            >
              Tous les décomptes
            </Button>
          </Group>
        </Card>

        <Card withBorder radius="lg" shadow="sm" p={0}>
          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                  <Table.Th c="white" style={{ width: 150 }}>Code facture</Table.Th>
                  <Table.Th c="white">Revendeur</Table.Th>
                  <Table.Th c="white" style={{ width: 120 }}>Date</Table.Th>
                  <Table.Th c="white" ta="right" style={{ width: 150 }}>Montant TTC</Table.Th>
                  <Table.Th c="white" ta="right" style={{ width: 150 }}>Commission</Table.Th>
                  <Table.Th c="white" ta="center" style={{ width: 100 }}>Statut</Table.Th>
                  <Table.Th c="white" ta="center" style={{ width: 250 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedFactures.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={7} align="center">
                      <Stack align="center" py={50}>
                        <IconFileInvoice size={50} color="#ccc" />
                        <Text c="dimmed">Aucune facture revendeur trouvée</Text>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  paginatedFactures.map((f) => (
                    <Table.Tr key={f.idFactureRevendeur}>
                      <Table.Td>
                        <Text fw={600} size="sm" c={f.code_facture ? 'green' : 'dimmed'}>
                          {f.code_facture || 'FR-XXXX'}
                        </Text>
                      </Table.Td>
                      <Table.Td fw={500}>{f.client_nom || f.client_societe || '-'}</Table.Td>
                      <Table.Td>{new Date(f.date_facture).toLocaleDateString('fr-FR')}</Table.Td>
                      <Table.Td ta="right"><Text fw={700} c="green">{formatMontant(f.montant_ttc)} FCFA</Text></Table.Td>
                      <Table.Td ta="right"><Text c="orange">{formatMontant(f.commission)} FCFA</Text></Table.Td>
                      <Table.Td ta="center">{getStatutBadge(f.statut)}</Table.Td>
                      <Table.Td ta="center">
                        <Group gap={4} justify="center">
                          <Tooltip label="Voir facture">
                            <ActionIcon variant="light" color="blue" size="md" onClick={() => handleVoirFacture(f)}>
                              <IconFileInvoice size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Créer un décompte">
                            <ActionIcon 
                              variant="light" 
                              color="green" 
                              size="md" 
                              onClick={() => handleCreerDecompte(f)}
                            >
                              <IconCash size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Voir décomptes du revendeur">
                            <ActionIcon 
                              variant="light" 
                              color="orange" 
                              size="md" 
                              onClick={() => navigate(`/decomptes?client=${f.idRevendeur}`)}
                            >
                              <IconList size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Imprimer">
                            <ActionIcon variant="light" color="teal" size="md" onClick={() => handleImprimer(f)}>
                              <IconPrinter size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Télécharger">
                            <ActionIcon variant="light" color="grape" size="md" onClick={() => handleTelecharger(f)}>
                              <IconDownload size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Box>

          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="md" />
            </Group>
          )}
        </Card>
      </Stack>

      <Modal
        opened={decompteModalOpened}
        onClose={() => {
          setDecompteModalOpened(false);
          setSelectedFacture(null);
          chargerFactures();
        }}
        size="95%"
        title={`Nouveau décompte - Facture ${selectedFacture?.code_facture || ''}`}
        centered
        fullScreen
      >
        {loadingDetails ? (
          <Center py={50}>
            <Loader />
            <Text ml="md">Chargement des détails de la facture...</Text>
          </Center>
        ) : (
          selectedFacture && (
            <NouveauDecompte
              onSuccess={() => {
                setDecompteModalOpened(false);
                setSelectedFacture(null);
                chargerFactures();
                notifications.show({
                  title: '✅ Succès',
                  message: `Décompte créé pour la facture ${selectedFacture.code_facture}`,
                  color: 'green'
                });
              }}
              onCancel={() => {
                setDecompteModalOpened(false);
                setSelectedFacture(null);
              }}
              facturePredefinie={{
                idFactureRevendeur: selectedFacture.idFactureRevendeur,
                code_facture: selectedFacture.code_facture,
                idRevendeur: selectedFacture.idRevendeur,
                date_facture: selectedFacture.date_facture,
                montant_ht: selectedFacture.montant_ht,
                montant_ttc: selectedFacture.montant_ttc,
                commission: selectedFacture.commission,
                statut: selectedFacture.statut,
                client_nom: selectedFacture.client_nom,
                client_societe: selectedFacture.client_societe,
                details: (selectedFacture as any).details || []
              }}
            />
          )
        )}
      </Modal>
    </>
  );
};

export default ListeFacturesRevendeur;