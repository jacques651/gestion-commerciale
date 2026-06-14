// src/components/commandes/ListeCommandesRevendeur.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Group, Stack, Title, Card, Text,
  Modal, TextInput, Grid, Paper,
  Loader, ThemeIcon, Flex, ActionIcon,
  ScrollArea, Pagination, Tooltip, Select, Badge, Table, Center, SimpleGrid
} from '@mantine/core';
import {
  IconSearch, IconRefresh, IconPlus, IconReceipt,
  IconX, IconPackage, IconTruck, IconFileInvoice,
  IconCalculator, IconCurrencyFrank, IconTrash, IconUser,
  IconEye, IconList, IconArchive
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';
import FormulaireCommande from './FormulaireCommande';

interface StockRevendeur {
  idStockRevendeur: number;
  idProduit: number;
  idRevendeur: number;
  qte_stock: number;
  prix_achat: number;
  prix_vente: number;
  commission_pourcentage: number;
  produit_designation: string;
  produit_code: string;
  produit_categorie: string;
  client_nom: string;
  client_societe: string;
  client_tel: string;
  quantite_vendue: number;
  code_facture: string;
  date_commande: string;
}

export const ListeCommandesRevendeur: React.FC = () => {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<StockRevendeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedCodeFacture, setSelectedCodeFacture] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<Date | null>(null);
  const [dateFin, setDateFin] = useState<Date | null>(null);
  const [clientsList, setClientsList] = useState<{ value: string; label: string }[]>([]);
  const [codeFacturesList, setCodeFacturesList] = useState<{ value: string; label: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [commandeModalOpened, setCommandeModalOpened] = useState(false);
  const [showNonVendus, setShowNonVendus] = useState(false);
  const [decomptesList, setDecomptesList] = useState<any[]>([]);
  const [showDecomptesModal, setShowDecomptesModal] = useState(false);
  const [selectedClientForDecomptes, setSelectedClientForDecomptes] = useState<any>(null);
  const [decompteLoading, setDecompteLoading] = useState(false);

  const itemsPerPage = 10;

  // Charger les stocks revendeurs
  const chargerStocks = async () => {
    setLoading(true);
    try {
      const db = await getDb();

      const result = await db.select<any[]>(`
        SELECT 
          sr.idStockRevendeur,
          sr.idProduit,
          sr.idRevendeur,
          sr.qte_stock,
          sr.prix_achat,
          sr.prix_vente,
          sr.commission_pourcentage,
          p.designation as produit_designation,
          p.code_produit as produit_code,
          p.categorie as produit_categorie,
          c.NomComplet as client_nom,
          c.Societe as client_societe,
          c.Tel as client_tel,
          c.idClient,
          COALESCE((
            SELECT SUM(dd.qte_decompte) 
            FROM decompte_details dd 
            INNER JOIN decomptes d ON d.idDecompte = dd.idDecompte
            WHERE dd.idProduit = sr.idProduit 
            AND d.idClient = sr.idRevendeur
          ), 0) as quantite_vendue,
          cmd.code_facture,
          cmd.date_commande
        FROM stock_revendeur sr
        INNER JOIN products p ON p.idProduit = sr.idProduit
        INNER JOIN clients c ON c.idClient = sr.idRevendeur
        LEFT JOIN commandes cmd ON cmd.idClient = sr.idRevendeur AND cmd.type_commande = 'REVENDEUR'
        ORDER BY c.NomComplet, p.designation
      `);

      setStocks(result || []);

      // Extraire la liste unique des clients
      const uniqueClients = [...new Map(result.map((item: any) => [item.idRevendeur, {
        value: item.idRevendeur.toString(),
        label: item.client_nom || item.client_societe || 'Revendeur'
      }])).values()];
      setClientsList(uniqueClients);

      // Extraire la liste unique des codes facture (non null)
      const uniqueCodeFactures = [...new Map(result
        .filter((item: any) => item.code_facture)
        .map((item: any) => [item.code_facture, {
          value: item.code_facture,
          label: item.code_facture
        }])).values()];
      setCodeFacturesList(uniqueCodeFactures);

    } catch (error) {
      console.error('Erreur chargement stocks:', error);
      notifications.show({ title: 'Erreur', message: 'Erreur de chargement', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerStocks();
  }, []);

  // Voir les produits non vendus
  const handleVoirProduitsNonVendus = () => {
    setShowNonVendus(true);
  };

  // Voir les décomptes d'un revendeur
  const handleVoirDecomptes = async (clientId: number, clientNom: string) => {
    setDecompteLoading(true);
    try {
      const db = await getDb();
      const decomptes = await db.select<any[]>(`
        SELECT 
          d.idDecompte,
          d.code_decompte,
          d.date_decompte,
          d.montant_vente,
          d.montant_commission,
          d.montant_net,
          d.statut
        FROM decomptes d
        WHERE d.idClient = ?
        ORDER BY d.date_decompte DESC
      `, [clientId]);

      setDecomptesList(decomptes);
      setSelectedClientForDecomptes({ id: clientId, nom: clientNom });
      setShowDecomptesModal(true);
    } catch (error) {
      console.error('Erreur chargement décomptes:', error);
      notifications.show({ title: 'Erreur', message: 'Erreur de chargement', color: 'red' });
    } finally {
      setDecompteLoading(false);
    }
  };

  // Ouvrir le reçu de décompte
  const handleOuvrirReçu = (idDecompte: number) => {
    navigate(`/decomptes/${idDecompte}/print`);
  };

  // Filtrer les stocks
  const stocksFiltres = useMemo(() => {
    let filtered = [...stocks];

    if (showNonVendus) {
      filtered = filtered.filter(s => s.qte_stock > 0);
    }

    if (selectedClient) {
      filtered = filtered.filter(s => s.idRevendeur.toString() === selectedClient);
    }

    if (selectedCodeFacture) {
      filtered = filtered.filter(s => s.code_facture === selectedCodeFacture);
    }

    if (dateDebut) {
      const debut = new Date(dateDebut);
      debut.setHours(0, 0, 0, 0);
      filtered = filtered.filter(s => s.date_commande && new Date(s.date_commande) >= debut);
    }

    if (dateFin) {
      const fin = new Date(dateFin);
      fin.setHours(23, 59, 59, 999);
      filtered = filtered.filter(s => s.date_commande && new Date(s.date_commande) <= fin);
    }

    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.produit_designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.produit_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [stocks, selectedClient, selectedCodeFacture, dateDebut, dateFin, searchTerm, showNonVendus]);

  const stats = {
    totalProduits: stocksFiltres.length,
    totalValeur: stocksFiltres.reduce((sum, s) => sum + (s.qte_stock * s.prix_vente), 0),
    totalBenefice: stocksFiltres.reduce((sum, s) => sum + (s.qte_stock * (s.prix_vente - s.prix_achat)), 0),
    totalCommission: stocksFiltres.reduce((sum, s) => sum + (s.qte_stock * (s.prix_vente - s.prix_achat) * (s.commission_pourcentage / 100)), 0)
  };

  const totalPages = Math.ceil(stocksFiltres.length / itemsPerPage);
  const paginatedStocks = stocksFiltres.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const resetFilters = () => {
    setSelectedClient(null);
    setSelectedCodeFacture(null);
    setDateDebut(null);
    setDateFin(null);
    setSearchTerm('');
    setShowNonVendus(false);
    setCurrentPage(1);
  };

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  if (loading && stocks.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des stocks revendeurs...</Text>
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
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Gestion des décomptes des revendeurs</Title>
                  <Text c="gray.3" size="sm">Gestion des stocks et décomptes revendeurs</Text>
                </div>
              </Group>
            </Stack>
            <Group>
              <Button variant="light" color="white" leftSection={<IconRefresh size={18} />} onClick={chargerStocks}>
                Actualiser
              </Button>
            </Group>
          </Flex>

          <SimpleGrid cols={4} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="white" variant="light" size="lg"><IconPackage size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Produits en stock</Text><Text c="white" fw={700} size="xl">{stats.totalProduits}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="green" variant="light" size="lg"><IconCurrencyFrank size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Valeur stock</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.totalValeur)} FCFA</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="yellow" variant="light" size="lg"><IconCalculator size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Bénéfice potentiel</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.totalBenefice)} FCFA</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="orange" variant="light" size="lg"><IconReceipt size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Commission potentielle</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.totalCommission)} FCFA</Text></div>
              </Group>
            </Card>
          </SimpleGrid>
        </Paper>


       <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group justify="space-between" mb="md">
            <Group><IconSearch size={20} color="#1b365d" /><Title order={3} size="h4">Rechercher</Title></Group>
            <Button variant="light" color="gray" onClick={resetFilters} size="xs" leftSection={<IconX size={14} />}>Réinitialiser</Button>
          </Group>
          <Grid>
            <Grid.Col span={3}>
              <Select
                label="Nom du client"
                placeholder="Sélectionner un client"
                data={clientsList}
                value={selectedClient}
                onChange={setSelectedClient}
                clearable
                searchable
                leftSection={<IconUser size={16} />}
                size="md"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Select
                label="Code facture"
                placeholder="Sélectionner un code facture"
                data={codeFacturesList}
                value={selectedCodeFacture}
                onChange={setSelectedCodeFacture}
                clearable
                searchable
                leftSection={<IconFileInvoice size={16} />}
                size="md"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput
                label="Date début"
                placeholder="AAAA-MM-JJ"
                type="date"
                value={dateDebut instanceof Date ? dateDebut.toISOString().split('T')[0] : dateDebut || ''}
                onChange={(e) => setDateDebut(e.target.value ? new Date(e.target.value) : null)}
                size="md"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput
                label="Date fin"
                placeholder="AAAA-MM-JJ"
                type="date"
                value={dateFin instanceof Date ? dateFin.toISOString().split('T')[0] : dateFin || ''}
                onChange={(e) => setDateFin(e.target.value ? new Date(e.target.value) : null)}
                size="md"
              />
            </Grid.Col>
          </Grid>
          <Grid mt="md">
            <Grid.Col span={12}>
              <TextInput
                label="Recherche produit"
                placeholder="Rechercher par produit ou code produit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftSection={<IconSearch size={16} />}
                size="md"
              />
            </Grid.Col>
          </Grid>
        </Card>
        {/* BOUTONS D'ACTION */}
        <Card withBorder radius="lg" shadow="sm" p="md">
          <Group>
            <Button leftSection={<IconList size={18} />} variant="light" onClick={() => navigate('/decomptes')}>
              Liste des décomptes
            </Button>
            <Button leftSection={<IconArchive size={18} />} variant="light" color="orange" onClick={handleVoirProduitsNonVendus}>
              Voir les produits non vendus
            </Button>
            <Button leftSection={<IconPlus size={18} />} variant="filled" color="green" onClick={() => setCommandeModalOpened(true)}>
              Nouveau décompte
            </Button>
          </Group>
        </Card>

        {/* TABLEAU PRINCIPAL */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          <ScrollArea h="calc(100vh - 550px)">
            <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="xs">
              <Table.Thead>
                <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                  <Table.Th c="white" w={50}>N°</Table.Th>
                  <Table.Th c="white">Nom du client</Table.Th>
                  <Table.Th c="white">Date</Table.Th>
                  <Table.Th c="white">CodeFacture</Table.Th>
                  <Table.Th c="white">Catégorie</Table.Th>
                  <Table.Th c="white">Désignation</Table.Th>
                  <Table.Th c="white" ta="center">Qté Iniciale</Table.Th>
                  <Table.Th c="white" ta="center">Qté vendue</Table.Th>
                  <Table.Th c="white" ta="center">Qté restante</Table.Th>
                  <Table.Th c="white" ta="right">Prix Achat</Table.Th>
                  <Table.Th c="white" ta="right">Prix Vente</Table.Th>
                  <Table.Th c="white" ta="right">Total Achat</Table.Th>
                  <Table.Th c="white" ta="right">Total Vente</Table.Th>
                  <Table.Th c="white" ta="right">Bénéfice</Table.Th>
                  <Table.Th c="white" ta="right">Commission</Table.Th>
                  <Table.Th c="white" ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedStocks.map((stock, index) => {
                  const num = (currentPage - 1) * itemsPerPage + index + 1;
                  const totalAchat = stock.qte_stock * stock.prix_achat;
                  const totalVente = stock.qte_stock * stock.prix_vente;
                  const benefice = totalVente - totalAchat;
                  const commission = benefice * (stock.commission_pourcentage / 100);
                  const qteRestante = stock.qte_stock;

                  return (
                    <Table.Tr key={stock.idStockRevendeur}>
                      <Table.Td>{num}</Table.Td>
                      <Table.Td fw={500}>{stock.client_nom || stock.client_societe || '-'}</Table.Td>
                      <Table.Td>{stock.date_commande ? new Date(stock.date_commande).toLocaleDateString('fr-FR') : '-'}</Table.Td>
                      <Table.Td>{stock.code_facture || '-'}</Table.Td>
                      <Table.Td>{stock.produit_categorie || '-'}</Table.Td>
                      <Table.Td>
                        <Text fw={500} size="sm">{stock.produit_designation}</Text>
                        <Text size="xs" c="dimmed">{stock.produit_code}</Text>
                      </Table.Td>
                      <Table.Td ta="center">{stock.qte_stock + stock.quantite_vendue}</Table.Td>
                      <Table.Td ta="center">{stock.quantite_vendue || 0}</Table.Td>
                      <Table.Td ta="center">
                        <Badge color={qteRestante <= 0 ? 'red' : qteRestante <= 5 ? 'orange' : 'green'} variant="light">
                          {qteRestante}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right">{formatMontant(stock.prix_achat)}</Table.Td>
                      <Table.Td ta="right">{formatMontant(stock.prix_vente)}</Table.Td>
                      <Table.Td ta="right">{formatMontant(totalAchat)}</Table.Td>
                      <Table.Td ta="right">{formatMontant(totalVente)}</Table.Td>
                      <Table.Td ta="right" c="green.7">{formatMontant(benefice)}</Table.Td>
                      <Table.Td ta="right" c="orange">{formatMontant(commission)}</Table.Td>
                      <Table.Td ta="center">
                        <Group gap={4} justify="center">
                          <Tooltip label="Voir décomptes">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="md"
                              onClick={() => handleVoirDecomptes(stock.idRevendeur, stock.client_nom || stock.client_societe)}
                            >
                              <IconReceipt size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Modifier">
                            <ActionIcon variant="light" color="yellow" size="md" disabled>
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Supprimer">
                            <ActionIcon variant="light" color="red" size="md" disabled>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="md" />
            </Group>
          )}

          {stocksFiltres.length === 0 && (
            <Text ta="center" c="dimmed" py={50}>Aucun produit trouvé</Text>
          )}
        </Card>
      </Stack>

      {/* MODAL DÉCOMPTES D'UN REVENDEUR */}
      <Modal
        opened={showDecomptesModal}
        onClose={() => setShowDecomptesModal(false)}
        size="xl"
        title={`Décomptes de ${selectedClientForDecomptes?.nom || ''}`}
      >
        {decompteLoading ? (
          <Center py={50}><Loader /></Center>
        ) : (
          <ScrollArea h={400}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Code</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th ta="right">Montant vente</Table.Th>
                  <Table.Th ta="right">Commission</Table.Th>
                  <Table.Th ta="right">Net</Table.Th>
                  <Table.Th>Statut</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {decomptesList.map((d) => (
                  <Table.Tr key={d.idDecompte}>
                    <Table.Td>{d.code_decompte}</Table.Td>
                    <Table.Td>{new Date(d.date_decompte).toLocaleDateString('fr-FR')}</Table.Td>
                    <Table.Td ta="right">{formatMontant(d.montant_vente)}</Table.Td>
                    <Table.Td ta="right">{formatMontant(d.montant_commission)}</Table.Td>
                    <Table.Td ta="right">{formatMontant(d.montant_net)}</Table.Td>
                    <Table.Td>
                      <Badge color={d.statut === 'PAYE' ? 'green' : 'orange'} variant="light">
                        {d.statut === 'PAYE' ? 'Payé' : 'En attente'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="light" onClick={() => handleOuvrirReçu(d.idDecompte)}>
                        Reçu
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Modal>

      {/* MODAL NOUVELLE COMMANDE REVENDEUR */}
      <FormulaireCommande opened={commandeModalOpened} onClose={() => { setCommandeModalOpened(false); chargerStocks(); }} />
    </>
  );
};

export default ListeCommandesRevendeur;