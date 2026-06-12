// src/pages/decomptes/ListeDecomptes.tsx
import { useEffect, useState } from "react";
import {
  Card,
  Title,
  Group,
  Table,
  TextInput,
  ActionIcon,
  Badge,
  Stack,
  Button,
  Loader,
  Center,
  Text,
  Pagination,
  Paper,
  Flex,
  ThemeIcon,
  ScrollArea,
  SimpleGrid
} from "@mantine/core";
import {
  IconSearch,
  IconEye,
  IconPrinter,
  IconTrash,
  IconCheck,
  IconRefresh,
  IconPlus,
  IconFileInvoice,
  IconCalendar,
  IconUser
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";
import { useDecomptes } from "../../hooks/useDecomptes";

export default function ListeDecomptes() {
  const navigate = useNavigate();
  const {
    decomptes,
    loading,
    deleteDecompte,
    updateStatut,
    rechercher,
    refresh
  } = useDecomptes();

  const [recherche, setRecherche] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (recherche.trim() === "") {
      refresh();
    } else {
      rechercher(recherche);
    }
    setCurrentPage(1);
  }, [recherche, refresh, rechercher]);

  const totalPages = Math.ceil(decomptes.length / itemsPerPage);
  const paginatedDecomptes = decomptes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Statistiques
  const stats = {
    total: decomptes.length,
    totalVentes: decomptes.reduce((sum, d) => sum + (d.montant_vente || 0), 0),
    totalCommission: decomptes.reduce((sum, d) => sum + (d.montant_commission || 0), 0),
    enAttente: decomptes.filter(d => d.statut !== "PAYE").length
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Supprimer ce décompte ?")) return;
    try {
      await deleteDecompte(id);
      notifications.show({
        title: "Succès",
        message: "Décompte supprimé",
        color: "green"
      });
    } catch {
      notifications.show({
        title: "Erreur",
        message: "Suppression impossible",
        color: "red"
      });
    }
  };

  const handlePaye = async (id: number) => {
    try {
      await updateStatut(id, "PAYE");
      notifications.show({
        title: "Succès",
        message: "Décompte marqué payé",
        color: "green"
      });
    } catch {
      notifications.show({
        title: "Erreur",
        message: "Mise à jour impossible",
        color: "red"
      });
    }
  };

  const formatMontant = (value: any): string => {
    if (value === undefined || value === null) return "0";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return "0";
    return num.toLocaleString('fr-FR');
  };

  const getStatutColor = (statut: string): string => {
    switch (statut) {
      case "PAYE":
        return "green";
      case "EN_ATTENTE":
        return "orange";
      case "PARTIEL":
        return "yellow";
      case "ANNULE":
        return "red";
      default:
        return "gray";
    }
  };

  const getStatutLabel = (statut: string): string => {
    switch (statut) {
      case "PAYE":
        return "Payé";
      case "EN_ATTENTE":
        return "En attente";
      case "PARTIEL":
        return "Partiel";
      case "ANNULE":
        return "Annulé";
      default:
        return statut || "Inconnu";
    }
  };

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
      </Center>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {/* En-tête avec gradient */}
      <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
        <Flex justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <ThemeIcon size={50} radius="md" color="white" variant="light">
              <IconFileInvoice size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">Décomptes Revendeurs</Title>
              <Text c="gray.3" size="sm">Gestion des décomptes et commissions</Text>
            </div>
          </Group>
          <Button
            variant="light"
            color="white"
            leftSection={<IconPlus size={18} />}
            onClick={() => navigate("/decomptes/nouveau")}
          >
            Nouveau Décompte
          </Button>
        </Flex>

        {/* Cartes statistiques */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="white" variant="light" size="lg">
                <IconFileInvoice size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Total décomptes</Text>
                <Text c="white" fw={700} size="xl">{stats.total}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="blue" variant="light" size="lg">
                <IconFileInvoice size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">En attente</Text>
                <Text c="white" fw={700} size="xl">{stats.enAttente}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="green" variant="light" size="lg">
                <IconFileInvoice size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Total ventes</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(stats.totalVentes)} FCFA</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="orange" variant="light" size="lg">
                <IconFileInvoice size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Total commissions</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(stats.totalCommission)} FCFA</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* Barre de recherche */}
      <Card withBorder radius="lg" shadow="sm" p="lg">
        <Group grow>
          <TextInput
            placeholder="Rechercher par code, revendeur ou date..."
            leftSection={<IconSearch size={16} />}
            value={recherche}
            onChange={(e) => setRecherche(e.currentTarget.value)}
            size="md"
          />
          <Button 
            variant="light" 
            onClick={refresh} 
            leftSection={<IconRefresh size={16} />}
          >
            Actualiser
          </Button>
        </Group>
      </Card>

      {/* Tableau des décomptes */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        <ScrollArea h="calc(100vh - 450px)">
          <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                <Table.Th c="white">Code</Table.Th>
                <Table.Th c="white">Date</Table.Th>
                <Table.Th c="white">Revendeur</Table.Th>
                <Table.Th c="white" ta="right">Ventes</Table.Th>
                <Table.Th c="white" ta="right">Commission</Table.Th>
                <Table.Th c="white" ta="right">Net à verser</Table.Th>
                <Table.Th c="white">Statut</Table.Th>
                <Table.Th c="white" ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody>
              {paginatedDecomptes.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8} align="center">
                    <Stack align="center" py={50}>
                      <IconFileInvoice size={48} color="#ccc" />
                      <Text c="dimmed">Aucun décompte trouvé</Text>
                      <Button variant="light" onClick={refresh} size="xs">
                        Actualiser
                      </Button>
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              ) : (
                paginatedDecomptes.map((d) => (
                  <Table.Tr key={d.idDecompte}>
                    <Table.Td>
                      <Text fw={600} size="sm">{d.code_decompte || `DC-${d.idDecompte}`}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <IconCalendar size={12} color="#adb5bd" />
                        <Text size="sm">
                          {d.date_decompte 
                            ? new Date(d.date_decompte).toLocaleDateString('fr-FR')
                            : '-'}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="sm">
                        <IconUser size={14} color="#1b365d" />
                        <Text size="sm" fw={500}>{d.NomComplet || '-'}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" c="blue" fw={600}>
                        {formatMontant(d.montant_vente)} FCFA
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" c="orange">
                        {formatMontant(d.montant_commission)} FCFA
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" c="green" fw={700}>
                        {formatMontant(d.montant_net)} FCFA
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge 
                        color={getStatutColor(d.statut)} 
                        variant="light"
                        size="sm"
                      >
                        {getStatutLabel(d.statut)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="center">
                        <ActionIcon
                          variant="light"
                          color="blue"
                          size="md"
                          onClick={() => navigate(`/decomptes/${d.idDecompte}`)}
                          title="Voir détails"
                        >
                          <IconEye size={18} />
                        </ActionIcon>
                        
                        <ActionIcon
                          variant="light"
                          color="teal"
                          size="md"
                          onClick={() => navigate(`/decomptes/${d.idDecompte}/print`)}
                          title="Imprimer / PDF"
                        >
                          <IconPrinter size={18} />
                        </ActionIcon>
                        
                        {d.statut !== "PAYE" && (
                          <ActionIcon
                            variant="light"
                            color="green"
                            size="md"
                            onClick={() => handlePaye(d.idDecompte)}
                            title="Marquer comme payé"
                          >
                            <IconCheck size={18} />
                          </ActionIcon>
                        )}
                        
                        <ActionIcon
                          variant="light"
                          color="red"
                          size="md"
                          onClick={() => handleDelete(d.idDecompte)}
                          title="Supprimer"
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination 
              total={totalPages} 
              value={currentPage} 
              onChange={setCurrentPage} 
              size="md"
              color="blue"
            />
          </Group>
        )}
      </Card>
    </Stack>
  );
}