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
  Pagination
} from "@mantine/core";
import {
  IconSearch,
  IconEye,
  IconPrinter,
  IconTrash,
  IconCheck,
  IconRefresh,
  IconPlus
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

  // Pagination
  const totalPages = Math.ceil(decomptes.length / itemsPerPage);
  const paginatedDecomptes = decomptes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
    return `${num.toLocaleString('fr-FR')} FCFA`;
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
      <Group justify="space-between">
        <Title order={2}>📋 Décomptes Revendeurs</Title>
        <Button
          onClick={() => navigate("/decomptes/nouveau")}
          variant="filled"
          color="blue"
          leftSection={<IconPlus size={16} />}
        >
          Nouveau Décompte
        </Button>
      </Group>

      <Card withBorder radius="md" shadow="sm">
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

      <Card withBorder radius="md" shadow="sm" p="md">
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
                  <Text c="dimmed" py="xl">Aucun décompte trouvé</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              paginatedDecomptes.map((d) => (
                <Table.Tr key={d.idDecompte}>
                  <Table.Td>
                    <Text fw={500} size="sm">{d.code_decompte || '-'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {/* ✅ CORRECTION : date_decompte au lieu de date_decompte */}
                      {d.date_decompte 
                        ? new Date(d.date_decompte).toLocaleDateString('fr-FR')
                        : '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>{d.NomComplet || '-'}</Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c="blue" fw={600}>
                      {formatMontant(d.montant_vente)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c="orange">
                      {formatMontant(d.montant_commission)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c="green" fw={700}>
                      {formatMontant(d.montant_net)}
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
                        size="lg"
                        onClick={() => navigate(`/decomptes/${d.idDecompte}`)}
                        title="Voir détails"
                      >
                        <IconEye size={18} />
                      </ActionIcon>
                      
                      <ActionIcon
                        variant="light"
                        color="teal"
                        size="lg"
                        onClick={() => navigate(`/decomptes/${d.idDecompte}/print`)}
                        title="Imprimer / PDF"
                      >
                        <IconPrinter size={18} />
                      </ActionIcon>
                      
                      {d.statut !== "PAYE" && (
                        <ActionIcon
                          variant="light"
                          color="green"
                          size="lg"
                          onClick={() => handlePaye(d.idDecompte)}
                          title="Marquer comme payé"
                        >
                          <IconCheck size={18} />
                        </ActionIcon>
                      )}
                      
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="lg"
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

        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination 
              total={totalPages} 
              value={currentPage} 
              onChange={setCurrentPage} 
              size="md"
            />
          </Group>
        )}
      </Card>
    </Stack>
  );
}