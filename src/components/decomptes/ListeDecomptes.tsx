// src/components/decomptes/ListeDecomptes.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Group, Stack, Title, Card, Text,
  Modal, TextInput, Paper,
  Loader, ThemeIcon, Flex, ActionIcon,
  ScrollArea, Pagination, Tooltip, Select, Badge, Table, SimpleGrid
} from '@mantine/core';
import {
  IconSearch, IconRefresh, IconReceipt,
  IconX, IconEye,
  IconPrinter, IconFilter, IconList, IconPlus} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';
import NouveauDecompte from './NouveauDecompte';
import ListeCommandesRevendeur from '../commandes/ListeCommandesRevendeur';

interface DetailDecompte {
  idDecompte: number;
  code_decompte: string;
  date_decompte: string;
  client_nom: string;
  client_societe: string;
  client_tel: string;
  produit_designation: string;
  produit_categorie: string;
  code_facture: string;
  quantite_decompte: number;
  quantite_vendue: number;
  quantite_restante: number;
  prix_achat: number;
  prix_vente: number;
  total_achat: number;
  total_vente: number;
  benefice: number;
  commission: number;
}

export const ListeDecomptes: React.FC = () => {
  const navigate = useNavigate();
  const [details, setDetails] = useState<DetailDecompte[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedCodeFacture, setSelectedCodeFacture] = useState<string | null>(null);
  const [clientsList, setClientsList] = useState<{ value: string; label: string }[]>([]);
  const [codeFacturesList, setCodeFacturesList] = useState<{ value: string; label: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [nouveauDecompteModalOpen, setNouveauDecompteModalOpen] = useState(false);
  const [stocksRevendeurModalOpen, setStocksRevendeurModalOpen] = useState(false);

  const itemsPerPage = 15;

  // Charger les détails des décomptes
  const chargerDetailsDecomptes = async () => {
    setLoading(true);
    try {
      const db = await getDb();

      const result = await db.select<any[]>(`
        SELECT 
          d.idDecompte,
          d.code_decompte,
          d.date_decompte,
          c.NomComplet as client_nom,
          c.Societe as client_societe,
          c.Tel as client_tel,
          p.designation as produit_designation,
          p.categorie as produit_categorie,
          p.code_produit,
          cmd.code_facture,
          dd.qte_decompte as quantite_decompte,
          dd.prix_achat,
          dd.prix_vente,
          dd.commission_pourcentage,
          COALESCE((
            SELECT SUM(cd.qte_commande)
            FROM commande_details cd
            INNER JOIN commandes cmd2 ON cmd2.idCommande = cd.idCommande
            WHERE cd.idProduit = dd.idProduit AND cmd2.idClient = d.idClient
          ), 0) as quantite_vendue,
          COALESCE(sr.qte_stock, 0) as quantite_restante,
          (dd.qte_decompte * dd.prix_achat) as total_achat,
          (dd.qte_decompte * dd.prix_vente) as total_vente,
          ((dd.qte_decompte * dd.prix_vente) - (dd.qte_decompte * dd.prix_achat)) as benefice,
          ((dd.qte_decompte * dd.prix_vente) - (dd.qte_decompte * dd.prix_achat)) * (dd.commission_pourcentage / 100) as commission
        FROM decomptes d
        INNER JOIN decompte_details dd ON dd.idDecompte = d.idDecompte
        INNER JOIN clients c ON c.idClient = d.idClient
        INNER JOIN products p ON p.idProduit = dd.idProduit
        LEFT JOIN commandes cmd ON cmd.idClient = d.idClient AND cmd.type_commande = 'REVENDEUR'
        LEFT JOIN stock_revendeur sr ON sr.idProduit = dd.idProduit AND sr.idRevendeur = d.idClient
        ORDER BY d.date_decompte DESC, p.designation
      `);

      setDetails(result || []);

      const uniqueClients = [...new Map(result.map((item: any) => [item.idDecompte, {
        value: item.client_nom || item.client_societe || 'Client',
        label: item.client_nom || item.client_societe || 'Client'
      }])).values()];
      setClientsList(uniqueClients);

      const uniqueCodeFactures = [...new Map(result
        .filter((item: any) => item.code_facture)
        .map((item: any) => [item.code_facture, {
          value: item.code_facture,
          label: item.code_facture
        }])).values()];
      setCodeFacturesList(uniqueCodeFactures);

    } catch (error) {
      console.error('Erreur chargement détails décomptes:', error);
      notifications.show({ title: 'Erreur', message: 'Erreur de chargement', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerDetailsDecomptes();
  }, []);

  // Filtrer les détails
  const detailsFiltres = useMemo(() => {
    let filtered = [...details];

    if (selectedClient) {
      filtered = filtered.filter(d => d.client_nom === selectedClient || d.client_societe === selectedClient);
    }

    if (selectedCodeFacture) {
      filtered = filtered.filter(d => d.code_facture === selectedCodeFacture);
    }

    if (searchTerm) {
      filtered = filtered.filter(d =>
        d.produit_designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.client_nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.client_societe?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code_facture?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [details, selectedClient, selectedCodeFacture, searchTerm]);

  const stats = {
    totalProduits: detailsFiltres.length,
    totalVente: detailsFiltres.reduce((sum, d) => sum + (d.total_vente || 0), 0),
    totalCommission: detailsFiltres.reduce((sum, d) => sum + (d.commission || 0), 0),
    totalBenefice: detailsFiltres.reduce((sum, d) => sum + (d.benefice || 0), 0)
  };

  const totalPages = Math.ceil(detailsFiltres.length / itemsPerPage);
  const paginatedDetails = detailsFiltres.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const resetFilters = () => {
    setSelectedClient(null);
    setSelectedCodeFacture(null);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const handleNouveauDecompteSuccess = () => {
    setNouveauDecompteModalOpen(false);
    chargerDetailsDecomptes();
    notifications.show({
      title: '✅ Succès',
      message: 'Décompte créé avec succès',
      color: 'green'
    });
  };

  const handleNouveauDecompteCancel = () => {
    setNouveauDecompteModalOpen(false);
  };

  if (loading && details.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des décomptes...</Text>
      </Card>
    );
  }

  return (
    <>
      <Stack gap="lg" p="md">
        {/* EN-TÊTE */}
        <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
          <Flex justify="space-between" align="center" wrap="wrap">
            <Group gap="md">
              <ThemeIcon size={50} radius="md" color="white" variant="light">
                <IconReceipt size={30} />
              </ThemeIcon>
              <div>
                <Title order={1} c="white" style={{ fontSize: '1.5rem' }}>GESTION DES DÉCOMPTES DES REVENDEURS</Title>
                <Text c="gray.3" size="sm">Suivi des ventes et commissions par revendeur</Text>
              </div>
            </Group>
            <Button variant="light" color="white" leftSection={<IconRefresh size={18} />} onClick={chargerDetailsDecomptes}>
              Actualiser
            </Button>
          </Flex>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Text c="white" size="xs">Total produits</Text>
              <Text c="white" fw={700} size="xl">{stats.totalProduits}</Text>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Text c="white" size="xs">Montant total ventes</Text>
              <Text c="white" fw={700} size="xl">{formatMontant(stats.totalVente)} F</Text>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Text c="white" size="xs">Commission totale</Text>
              <Text c="white" fw={700} size="xl">{formatMontant(stats.totalCommission)} F</Text>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Text c="white" size="xs">Bénéfice total</Text>
              <Text c="white" fw={700} size="xl">{formatMontant(stats.totalBenefice)} F</Text>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* BARRE DE RECHERCHE ET BOUTONS */}
        <Card withBorder radius="lg" shadow="sm" p="md">
          <Stack gap="md">
            <Group grow>
              <TextInput
                placeholder="Rechercher par client, produit ou code facture..."
                leftSection={<IconSearch size={16} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="sm"
              />
              <Button
                variant={showFilters ? "filled" : "light"}
                color={showFilters ? "blue" : "gray"}
                leftSection={<IconFilter size={16} />}
                onClick={() => setShowFilters(!showFilters)}
                size="sm"
              >
                Filtres
              </Button>
              <Button variant="outline" color="gray" onClick={resetFilters} size="sm" leftSection={<IconX size={14} />}>
                Réinitialiser
              </Button>
            </Group>

            <Group grow>
              <Button 
                leftSection={<IconList size={16} />} 
                variant="light" 
                onClick={() => setStocksRevendeurModalOpen(true)} 
                size="sm"
              >
                Stocks revendeurs
              </Button>
              <Button
                leftSection={<IconPlus size={16} />}
                variant="filled"
                color="green"
                onClick={() => setNouveauDecompteModalOpen(true)}
                size="sm"
              >
                Nouveau décompte
              </Button>
              <Button leftSection={<IconPrinter size={16} />} variant="light" color="blue" size="sm">
                Imprimer
              </Button>
            </Group>

            {/* PANEL DES FILTRES */}
            {showFilters && (
              <Paper withBorder p="md" radius="md" mt="md" bg="gray.0">
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                  <Select
                    label="Nom du client"
                    placeholder="Tous les clients"
                    data={clientsList}
                    value={selectedClient}
                    onChange={setSelectedClient}
                    clearable
                    searchable
                    size="xs"
                  />
                  <Select
                    label="Code facture"
                    placeholder="Tous les codes"
                    data={codeFacturesList}
                    value={selectedCodeFacture}
                    onChange={setSelectedCodeFacture}
                    clearable
                    searchable
                    size="xs"
                  />
                  <TextInput
                    label="Date début"
                    type="date"
                    size="xs"
                  />
                  <TextInput
                    label="Date fin"
                    type="date"
                    size="xs"
                  />
                </SimpleGrid>
                <Group justify="flex-end" mt="md">
                  <Button size="xs" variant="outline" onClick={resetFilters}>Tout effacer</Button>
                </Group>
              </Paper>
            )}
          </Stack>
        </Card>

        {/* TABLEAU PRINCIPAL */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          <ScrollArea h="calc(100vh - 480px)" type="auto">
            <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="xs">
              <Table.Thead style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                <Table.Tr>
                  <Table.Th style={{ color: 'white', fontSize: '10px', textAlign: 'center' }}>N°</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px' }}>Nom du client</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px' }}>Date</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px' }}>CodeFacture</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px' }}>Catégorie</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px' }}>Désignation</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px', textAlign: 'center' }}>Qté ini</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px', textAlign: 'center' }}>Qté vendue</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px', textAlign: 'center' }}>Qté rest</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px', textAlign: 'right' }}>PA</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px', textAlign: 'right' }}>PV</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px', textAlign: 'right' }}>Total Achat</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px', textAlign: 'right' }}>Total Vente</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px', textAlign: 'right' }}>Bénéfice</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px', textAlign: 'right' }}>Commission</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '10px', textAlign: 'center' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedDetails.map((detail, index) => {
                  const num = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <Table.Tr key={`${detail.idDecompte}-${index}`}>
                      <Table.Td ta="center">
                        <Text size="xs" fw={600}>{num}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label={detail.client_tel}>
                          <Text size="xs" fw={500} lineClamp={1}>{detail.client_nom || detail.client_societe || '-'}</Text>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{new Date(detail.date_decompte).toLocaleDateString('fr-FR')}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">{detail.code_facture || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light" color="gray">{detail.produit_categorie || '-'}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={500} lineClamp={1}>{detail.produit_designation}</Text>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Badge size="xs" variant="light" color="gray">{detail.quantite_decompte}</Badge>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Badge size="xs" variant="light" color="blue">{detail.quantite_vendue || 0}</Badge>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Badge size="xs" color={detail.quantite_restante <= 0 ? 'red' : detail.quantite_restante <= 5 ? 'orange' : 'green'} variant="light">
                          {detail.quantite_restante || 0}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs">{formatMontant(detail.prix_achat)}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs" fw={600}>{formatMontant(detail.prix_vente)}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs">{formatMontant(detail.total_achat)}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs">{formatMontant(detail.total_vente)}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs" c="green">{formatMontant(detail.benefice)}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs" c="orange">{formatMontant(detail.commission)}</Text>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Group gap={4} justify="center" wrap="nowrap">
                          <Tooltip label="Voir détails">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="sm"
                              onClick={() => navigate(`/decomptes/${detail.idDecompte}`)}
                            >
                              <IconEye size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Imprimer reçu">
                            <ActionIcon
                              variant="light"
                              color="green"
                              size="sm"
                              onClick={() => navigate(`/decomptes/${detail.idDecompte}/print`)}
                            >
                              <IconPrinter size={14} />
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

          {detailsFiltres.length === 0 && (
            <Text ta="center" c="dimmed" py={40}>Aucun décompte trouvé</Text>
          )}

          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="sm" />
            </Group>
          )}
        </Card>
      </Stack>

      {/* MODAL NOUVEAU DÉCOMPTE */}
      <Modal
        opened={nouveauDecompteModalOpen}
        onClose={() => setNouveauDecompteModalOpen(false)}
        size="1000px"
        centered
        padding="md"
        radius="lg"
        styles={{
          body: { padding: 0 },
          content: { backgroundColor: '#f5f7fa' }
        }}
      >
        <NouveauDecompte
          onSuccess={handleNouveauDecompteSuccess}
          onCancel={handleNouveauDecompteCancel}
        />
      </Modal>

      {/* MODAL STOCKS REVENDEURS */}
      <Modal
        opened={stocksRevendeurModalOpen}
        onClose={() => setStocksRevendeurModalOpen(false)}
        size="95%"
        fullScreen
        padding={0}
        styles={{
          body: { padding: 0 },
          content: { backgroundColor: '#f5f7fa' }
        }}
      >
        <ListeCommandesRevendeur />
      </Modal>
    </>
  );
};

export default ListeDecomptes;