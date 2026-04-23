// src/components/commandes/ListeCommandes.tsx
import React, { useEffect, useState } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Button,
  TextInput,
  Table,
  Badge,
  ActionIcon,
  LoadingOverlay,
  Box,
  Pagination,
  Tooltip,
  Modal,
  Divider,
  ThemeIcon,
  SimpleGrid,
  Select,
} from '@mantine/core';
import {
  IconShoppingBag,
  IconPlus,
  IconEye,
  IconSearch,
  IconRefresh,
  IconInfoCircle,
  IconCalendar,
  IconCash,
  IconFileInvoice,
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import FormulaireCommande from './FormulaireCommande';
import FicheCommande from './FicheCommande';

interface Commande {
  idCommande: number;
  code_commande: string;
  idClient: number;
  client_nom: string;
  type_commande: string;
  date_commande: string;
  objet: string;
  montant_ht: number;
  montant_ttc: number;
  statut: string;
  code_facture: string;
  date_facture: string;
  total_paye: number;
}

const ListeCommandes: React.FC = () => {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [statutFiltre, setStatutFiltre] = useState<string | null>(null);
  const [typeFiltre, setTypeFiltre] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [vueForm, setVueForm] = useState(false);
  const [selectedCommande, setSelectedCommande] = useState<Commande | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const itemsPerPage = 10;

  const chargerCommandes = async () => {
    setLoading(true);
    const db = await getDb();
    const result = await db.select<Commande[]>(`
      SELECT 
        c.*, 
        cl.nom_complet as client_nom,
        COALESCE(SUM(p.montant), 0) as total_paye
      FROM commandes c
      JOIN clients cl ON c.idClient = cl.idClient
      LEFT JOIN paiements_commandes p ON p.commande_id = c.idCommande
      WHERE c.statut != 'ANNULEE'
      GROUP BY c.idCommande
      ORDER BY c.date_commande DESC
    `);
    
    // Calculer le statut basé sur le paiement
    const commandesAvecStatut = result.map(c => ({
      ...c,
      statut: calculerStatut(c.total_paye, c.montant_ttc)
    }));
    
    setCommandes(commandesAvecStatut);
    setLoading(false);
  };

  const calculerStatut = (totalPaye: number, totalCommande: number): string => {
    if (totalPaye >= totalCommande) return 'PAYEE';
    if (totalPaye > 0) return 'PARTIELLE';
    return 'NON_PAYEE';
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'NON_PAYEE':
        return { label: 'Non payée', color: 'red' };
      case 'PARTIELLE':
        return { label: 'Partiellement payée', color: 'orange' };
      case 'PAYEE':
        return { label: 'Payée', color: 'green' };
      default:
        return { label: statut, color: 'gray' };
    }
  };

  const getTypeLabel = (type: string) => {
    return type === 'SIMPLE' ? '📦 Simple' : '🔄 Revendeur';
  };

  useEffect(() => {
    chargerCommandes();
  }, []);

  const genererFacture = async (id: number) => {
    const db = await getDb();
    const codeFacture = `FAC-${Date.now()}`;
    await db.execute(`
      UPDATE commandes 
      SET code_facture = ?, date_facture = date('now')
      WHERE idCommande = ?
    `, [codeFacture, id]);
    chargerCommandes();
    alert(`Facture ${codeFacture} générée avec succès`);
  };

  const handleReset = () => {
    setRecherche('');
    setStatutFiltre(null);
    setTypeFiltre(null);
    chargerCommandes();
    setCurrentPage(1);
  };

  const statutsOptions = [
    { value: 'NON_PAYEE', label: '🔴 Non payée' },
    { value: 'PARTIELLE', label: '🟡 Partiellement payée' },
    { value: 'PAYEE', label: '🟢 Payée' },
  ];

  const typesOptions = [
    { value: 'SIMPLE', label: '📦 Simple' },
    { value: 'REVENDEUR', label: '🔄 Revendeur' },
  ];

  const commandesFiltrees = commandes.filter(c => {
    const matchRecherche = c.code_commande.toLowerCase().includes(recherche.toLowerCase()) ||
                          c.client_nom.toLowerCase().includes(recherche.toLowerCase());
    const matchStatut = !statutFiltre || c.statut === statutFiltre;
    const matchType = !typeFiltre || c.type_commande === typeFiltre;
    return matchRecherche && matchStatut && matchType;
  });

  const totalPages = Math.ceil(commandesFiltrees.length / itemsPerPage);
  const paginatedData = commandesFiltrees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalMontant = commandesFiltrees.reduce((sum, c) => sum + c.montant_ttc, 0);
  const totalPaye = commandesFiltrees.reduce((sum, c) => sum + (c.total_paye || 0), 0);
  const totalReste = totalMontant - totalPaye;

  if (vueForm) {
    return (
      <FormulaireCommande
        onSuccess={() => {
          setVueForm(false);
          chargerCommandes();
        }}
        onCancel={() => setVueForm(false)}
      />
    );
  }

  if (showDetail && selectedCommande) {
    return (
      <FicheCommande
        commandeId={selectedCommande.idCommande}
        onBack={() => {
          setShowDetail(false);
          setSelectedCommande(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative">
        <LoadingOverlay visible={true} />
        <Text>Chargement des commandes...</Text>
      </Card>
    );
  }

  return (
    <Box p="md">
      <Stack gap="lg">
        {/* HEADER */}
        <Card withBorder radius="md" p="lg" bg="#1b365d">
          <Group justify="space-between">
            <Stack gap={4}>
              <Group gap="xs">
                <IconShoppingBag size={24} color="white" />
                <Title order={2} c="white">Commandes</Title>
              </Group>
              <Text size="sm" c="gray.3">
                Gestion des commandes clients
              </Text>
            </Stack>
            <Group gap="md">
              <Button
                variant="light"
                color="white"
                leftSection={<IconInfoCircle size={18} />}
                onClick={() => setInfoModalOpen(true)}
              >
                Instructions
              </Button>
              <ThemeIcon size={48} radius="md" color="white" variant="light">
                <IconShoppingBag size={28} />
              </ThemeIcon>
            </Group>
          </Group>
        </Card>

        {/* STATS KPI */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Card withBorder radius="md" p="md">
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Total commandes
              </Text>
              <ThemeIcon size={30} radius="md" color="blue" variant="light">
                <IconShoppingBag size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl" c="blue">
              {commandes.length}
            </Text>
          </Card>

          <Card withBorder radius="md" p="md" bg="green.0">
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Total payé
              </Text>
              <ThemeIcon size={30} radius="md" color="green" variant="light">
                <IconCash size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl" c="green">
              {totalPaye.toLocaleString()} FCFA
            </Text>
          </Card>

          <Card withBorder radius="md" p="md" bg="red.0">
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Reste à payer
              </Text>
              <ThemeIcon size={30} radius="md" color="red" variant="light">
                <IconCash size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl" c="red">
              {totalReste.toLocaleString()} FCFA
            </Text>
          </Card>
        </SimpleGrid>

        {/* BARRE D'OUTILS */}
        <Card withBorder radius="md" p="md">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Group>
              <TextInput
                placeholder="Rechercher par code ou client..."
                leftSection={<IconSearch size={16} />}
                value={recherche}
                onChange={(e) => {
                  setRecherche(e.target.value);
                  setCurrentPage(1);
                }}
                size="sm"
                style={{ width: 250 }}
              />
              <Select
                placeholder="Statut"
                data={[{ value: '', label: 'Tous' }, ...statutsOptions]}
                value={statutFiltre}
                onChange={setStatutFiltre}
                size="sm"
                style={{ width: 150 }}
                clearable
              />
              <Select
                placeholder="Type"
                data={[{ value: '', label: 'Tous' }, ...typesOptions]}
                value={typeFiltre}
                onChange={setTypeFiltre}
                size="sm"
                style={{ width: 130 }}
                clearable
              />
            </Group>
            <Group>
              <Tooltip label="Actualiser">
                <ActionIcon variant="light" onClick={handleReset} size="lg">
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setVueForm(true)}
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
              >
                Nouvelle commande
              </Button>
            </Group>
          </Group>
        </Card>

        {/* TABLEAU DES COMMANDES */}
        <Card withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover>
              <Table.Thead style={{ backgroundColor: '#1b365d' }}>
                <Table.Tr>
                  <Table.Th style={{ color: 'white' }}>Code</Table.Th>
                  <Table.Th style={{ color: 'white' }}>Client</Table.Th>
                  <Table.Th style={{ color: 'white' }}>Date</Table.Th>
                  <Table.Th style={{ color: 'white' }}>Type</Table.Th>
                  <Table.Th style={{ color: 'white', textAlign: 'right' }}>Montant</Table.Th>
                  <Table.Th style={{ color: 'white', textAlign: 'center' }}>Statut</Table.Th>
                  <Table.Th style={{ color: 'white', textAlign: 'center' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedData.map((c) => {
                  const statutBadge = getStatutBadge(c.statut);
                  return (
                    <Table.Tr key={c.idCommande}>
                      <Table.Td>
                        <Badge color="gray" variant="light" size="sm">
                          {c.code_commande}
                        </Badge>
                      </Table.Td>
                      <Table.Td fw={500}>{c.client_nom}</Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <IconCalendar size={12} />
                          <Text size="sm">{new Date(c.date_commande).toLocaleDateString('fr-FR')}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>{getTypeLabel(c.type_commande)}</Table.Td>
                      <Table.Td ta="right" fw={600}>
                        {c.montant_ttc.toLocaleString()} FCFA
                      </Table.Td>
                      <Table.Td ta="center">
                        <Badge color={statutBadge.color} variant="light" size="sm">
                          {statutBadge.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6} justify="center">
                          <Tooltip label="Voir détail">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="blue"
                              onClick={() => {
                                setSelectedCommande(c);
                                setShowDetail(true);
                              }}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          {!c.code_facture && (
                            <Tooltip label="Générer facture">
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color="teal"
                                onClick={() => genererFacture(c.idCommande)}
                              >
                                <IconFileInvoice size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>

          {/* PAGINATION */}
          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination
                value={currentPage}
                onChange={setCurrentPage}
                total={totalPages}
                color="blue"
                size="sm"
              />
            </Group>
          )}
        </Card>

        {/* MODAL INSTRUCTIONS */}
        <Modal
          opened={infoModalOpen}
          onClose={() => setInfoModalOpen(false)}
          title="📋 Instructions"
          size="md"
          centered
          styles={{
            header: {
              backgroundColor: '#1b365d',
              padding: '16px 20px',
            },
            title: {
              color: 'white',
              fontWeight: 600,
            },
            body: {
              padding: '20px',
            },
          }}
        >
          <Stack gap="md">
            <Text size="sm">1. Utilisez le bouton "Nouvelle commande" pour créer une commande</Text>
            <Text size="sm">2. Deux types de commandes : Simple et Revendeur</Text>
            <Text size="sm">3. Le statut évolue automatiquement selon les paiements :</Text>
            <Text size="sm">   • Non payée : aucun paiement reçu</Text>
            <Text size="sm">   • Partiellement payée : paiement partiel reçu</Text>
            <Text size="sm">   • Payée : paiement total reçu</Text>
            <Text size="sm">4. Cliquez sur l'icône 👁️ pour voir le détail</Text>
            <Text size="sm">5. Cliquez sur l'icône 📄 pour générer la facture</Text>
            <Divider />
            <Text size="xs" c="dimmed" ta="center">
              Version 1.0.0 - Gestion Commerciale
            </Text>
          </Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default ListeCommandes;