// src/pages/decomptes/DetailDecompte.tsx
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Stack,
  Title,
  Text,
  Group,
  Table,
  Badge,
  Button,
  Loader,
  Center,
  Paper,
  Flex,
  ThemeIcon,
  SimpleGrid,
  Divider,
  ScrollArea,
  Modal,
  Alert
} from "@mantine/core";
import {
  IconArrowLeft,
  IconPrinter,
  IconUser,
  IconBuildingStore,
  IconCalendar,
  IconFileInvoice,
  IconCash,
  IconPercentage,
  IconTruck,
  IconPackage,
  IconEye,
  IconAlertCircle,
  IconRefresh
} from "@tabler/icons-react";
import { useReactToPrint } from "react-to-print";
import { decompteRepository } from "../../database/repositories/decompteRepository";
import RecuDecompte from "../../components/decomptes/RecuDecompte";

export default function DetailDecompte() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [decompte, setDecompte] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recuModalOpen, setRecuModalOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!id) {
          setError("ID du décompte manquant");
          return;
        }

        const data = await decompteRepository.getById(Number(id));
        
        if (!data) {
          setError("Décompte non trouvé");
          return;
        }
        
        setDecompte(data);
      } catch (error: any) {
        console.error('Erreur chargement décompte:', error);
        setError(error?.message || "Erreur lors du chargement du décompte");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Decompte_${decompte?.code_decompte || id}`,
  });

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center py={60}>
        <Stack align="center" gap="md" style={{ maxWidth: 500 }}>
          <Alert 
            icon={<IconAlertCircle size={16} />} 
            title="Erreur" 
            color="red"
            withCloseButton
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
          <Button 
            leftSection={<IconRefresh size={16} />}
            onClick={() => window.location.reload()}
            variant="light"
          >
            Réessayer
          </Button>
          <Button 
            variant="subtle"
            onClick={() => navigate("/decomptes")}
          >
            Retour à la liste
          </Button>
        </Stack>
      </Center>
    );
  }

  if (!decompte) {
    return (
      <Center py={100}>
        <Card withBorder p="xl" ta="center">
          <IconFileInvoice size={48} color="#ccc" />
          <Text mt="md">Décompte introuvable</Text>
          <Button mt="md" variant="light" onClick={() => navigate("/decomptes")}>
            Retour à la liste
          </Button>
        </Card>
      </Center>
    );
  }

  // Récupérer le taux de commission du décompte (ou 60% par défaut)
  const tauxCommission = decompte.taux_commission || 60;

  // Calcul des totaux avec gestion des valeurs null/undefined
  const totalVente = decompte.details?.reduce((sum: number, d: any) => {
    const qte = d.qte_decompte || 0;
    const prix = d.prix_vente || 0;
    return sum + (qte * prix);
  }, 0) || 0;

  const totalAchat = decompte.details?.reduce((sum: number, d: any) => {
    const qte = d.qte_decompte || 0;
    const prix = d.prix_achat || 0;
    return sum + (qte * prix);
  }, 0) || 0;

  const totalBenefice = totalVente - totalAchat;
  const totalCommission = (totalBenefice * tauxCommission) / 100;
  const totalNet = totalVente - totalCommission;

  const getStatutColor = (statut: string) => {
    const statusMap: Record<string, { color: string; bg: string; label: string }> = {
      "PAYE": { color: "green", bg: "#e8f5e9", label: "Payé" },
      "VALIDE": { color: "green", bg: "#e8f5e9", label: "Validé" },
      "EN_ATTENTE": { color: "orange", bg: "#fff3e0", label: "En attente" },
      "brouillon": { color: "orange", bg: "#fff3e0", label: "Brouillon" },
      "annule": { color: "red", bg: "#ffebee", label: "Annulé" },
    };
    return statusMap[statut] || { color: "gray", bg: "#f5f5f5", label: statut };
  };

  const statutInfo = getStatutColor(decompte.statut);

  // Préparer les données pour le reçu
  const recuDetails = (decompte.details || []).map((d: any) => {
    const qteDecompte = d.qte_decompte || 0;
    const qteAvantDecompte = d.qte_avant_decompte || 0;
    const qteReappro = d.qte_reappro || 0;
    return {
      designation: d.designation || 'Produit',
      categorie: d.categorie || '-',
      unite: d.unite_base || 'pièce',
      qte_decompte: qteDecompte,
      qte: qteDecompte,
      qte_initiale: qteAvantDecompte + qteReappro,
      qte_reappro: qteReappro,
      reliquat: qteAvantDecompte - qteDecompte + qteReappro,
      prix_achat: d.prix_achat || 0,
      prix_vente: d.prix_vente || 0,
      benefice: ((d.prix_vente || 0) - (d.prix_achat || 0)) * qteDecompte,
      total_vente: qteDecompte * (d.prix_vente || 0)
    };
  });

  return (
    <>
      <Stack gap="md" p="md">
        {/* En-tête compact */}
        <Paper
          p="md"
          radius="lg"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            borderBottom: '3px solid #e94560',
          }}
        >
          <Flex justify="space-between" align="center" wrap="wrap">
            <Group gap="md">
              <ThemeIcon size={40} radius="md" color="white" variant="light">
                <IconFileInvoice size={24} />
              </ThemeIcon>
              <div>
                <Title order={3} c="white">Détail du décompte</Title>
                <Text c="gray.3" size="xs">Informations complètes du décompte revendeur</Text>
              </div>
            </Group>
            <Group gap="xs">
              <Button
                variant="light"
                color="white"
                size="xs"
                leftSection={<IconEye size={14} />}
                onClick={() => setRecuModalOpen(true)}
              >
                Voir reçu
              </Button>
              <Button
                variant="light"
                color="white"
                size="xs"
                leftSection={<IconPrinter size={14} />}
                onClick={handlePrint}
              >
                Imprimer
              </Button>
              <Button
                variant="light"
                color="white"
                size="xs"
                leftSection={<IconArrowLeft size={14} />}
                onClick={() => navigate("/decomptes")}
              >
                Retour
              </Button>
            </Group>
          </Flex>
        </Paper>

        {/* Zone imprimable - Version compacte */}
        <div ref={printRef}>
          {/* En-tête pour impression */}
          <div style={{ textAlign: 'center', marginBottom: 16, display: 'none' }}>
            <Title order={2}>Détail du décompte</Title>
            <Text>Date: {new Date().toLocaleDateString('fr-FR')}</Text>
          </div>

          {/* Informations générales compactes */}
          <Card withBorder radius="md" shadow="sm" p="sm">
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
              <Group gap="xs">
                <IconFileInvoice size={14} color="#4a6cf7" />
                <Text size="xs" c="dimmed">Code:</Text>
                <Text size="xs" fw={600}>{decompte.code_decompte || `DC-${decompte.idDecompte}`}</Text>
              </Group>
              <Group gap="xs">
                <IconCalendar size={14} color="#4a6cf7" />
                <Text size="xs" c="dimmed">Date:</Text>
                <Text size="xs">{new Date(decompte.date_decompte).toLocaleDateString('fr-FR')}</Text>
              </Group>
              <Group gap="xs">
                <IconUser size={14} color="#4a6cf7" />
                <Text size="xs" c="dimmed">Revendeur:</Text>
                <Text size="xs" fw={500}>{decompte.NomComplet || 'Inconnu'}</Text>
              </Group>
              <Group gap="xs">
                <IconBuildingStore size={14} color="#4a6cf7" />
                <Text size="xs" c="dimmed">Société:</Text>
                <Text size="xs">{decompte.Societe || "-"}</Text>
              </Group>
              <Group gap="xs">
                <IconPercentage size={14} color="#4a6cf7" />
                <Text size="xs" c="dimmed">Taux commission:</Text>
                <Badge color="orange" variant="light" size="xs">{tauxCommission}%</Badge>
              </Group>
              <Group gap="xs">
                <IconCash size={14} color="#4a6cf7" />
                <Text size="xs" c="dimmed">Statut:</Text>
                <Badge color={statutInfo.color} size="xs" style={{ backgroundColor: statutInfo.bg }}>
                  {statutInfo.label}
                </Badge>
              </Group>
            </SimpleGrid>
            {decompte.observation && (
              <Text size="xs" c="dimmed" mt="xs">
                <strong>Obs:</strong> {decompte.observation}
              </Text>
            )}
            {decompte.notes && (
              <Text size="xs" c="dimmed" mt="xs">
                <strong>Notes:</strong> {decompte.notes}
              </Text>
            )}
          </Card>

          {/* Tableau des produits compact */}
          <Card withBorder radius="md" shadow="sm" p="sm" mt="xs">
            <Flex justify="space-between" align="center" mb="xs">
              <Group gap="xs">
                <IconPackage size={14} color="#4a6cf7" />
                <Text fw={600} size="sm">Produits</Text>
              </Group>
              <Badge color="blue" variant="light" size="xs">
                Commission: {tauxCommission}%
              </Badge>
            </Flex>
            <ScrollArea h={300}>
              <Table striped highlightOnHover withColumnBorders verticalSpacing="xs" horizontalSpacing="xs" style={{ fontSize: '12px' }}>
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: '#1a1a2e' }}>
                    <Table.Th c="white" w={30}>#</Table.Th>
                    <Table.Th c="white">Produit</Table.Th>
                    <Table.Th c="white" ta="center" w={50}>Qté</Table.Th>
                    <Table.Th c="white" ta="right" w={80}>PA</Table.Th>
                    <Table.Th c="white" ta="right" w={80}>PV</Table.Th>
                    <Table.Th c="white" ta="right" w={90}>Bénéf</Table.Th>
                    <Table.Th c="white" ta="right" w={90}>Total</Table.Th>
                    <Table.Th c="white" ta="right" w={90}>Commission</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(decompte.details || []).map((detail: any, idx: number) => {
                    const qte = detail.qte_decompte || 0;
                    const prixAchat = detail.prix_achat || 0;
                    const prixVente = detail.prix_vente || 0;
                    const totalVenteLigne = qte * prixVente;
                    const totalAchatLigne = qte * prixAchat;
                    const beneficeLigne = totalVenteLigne - totalAchatLigne;
                    const commissionLigne = (beneficeLigne * tauxCommission) / 100;

                    return (
                      <Table.Tr key={detail.idDetailRevendeur || idx}>
                        <Table.Td ta="center">{idx + 1}</Table.Td>
                        <Table.Td>
                          <Text size="xs" fw={500}>{detail.designation || 'Produit'}</Text>
                          <Text size="xs" c="dimmed">{detail.code_produit}</Text>
                        </Table.Td>
                        <Table.Td ta="center">{qte}</Table.Td>
                        <Table.Td ta="right">{prixAchat.toLocaleString()}</Table.Td>
                        <Table.Td ta="right" fw={600}>{prixVente.toLocaleString()}</Table.Td>
                        <Table.Td ta="right" c={beneficeLigne >= 0 ? "green" : "red"}>
                          {beneficeLigne.toLocaleString()}
                        </Table.Td>
                        <Table.Td ta="right" fw={700}>{totalVenteLigne.toLocaleString()}</Table.Td>
                        <Table.Td ta="right" c="orange">{commissionLigne.toLocaleString()}</Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            {(!decompte.details || decompte.details.length === 0) && (
              <Text ta="center" c="dimmed" py={30} size="sm">Aucun produit trouvé</Text>
            )}
          </Card>

          {/* Récapitulatif compact */}
          <Card withBorder radius="md" shadow="sm" p="sm" mt="xs">
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="xs">
              <Paper p="xs" withBorder bg="gray.0">
                <Flex justify="space-between" align="center">
                  <Text size="xs" c="dimmed">Total Achat</Text>
                  <Text size="xs" fw={600}>{totalAchat.toLocaleString()} F</Text>
                </Flex>
              </Paper>
              <Paper p="xs" withBorder bg="gray.0">
                <Flex justify="space-between" align="center">
                  <Text size="xs" c="dimmed">Total Vente</Text>
                  <Text size="xs" fw={600}>{totalVente.toLocaleString()} F</Text>
                </Flex>
              </Paper>
              <Paper p="xs" withBorder bg="green.0">
                <Flex justify="space-between" align="center">
                  <Group gap={4}>
                    <IconPercentage size={12} color="#2e7d32" />
                    <Text size="xs" fw={600} c="green.8">Bénéfice</Text>
                  </Group>
                  <Text size="xs" fw={700} c="green.8">{totalBenefice.toLocaleString()} F</Text>
                </Flex>
              </Paper>
              <Paper p="xs" withBorder bg="orange.0">
                <Flex justify="space-between" align="center">
                  <Group gap={4}>
                    <IconCash size={12} color="#ed6c02" />
                    <Text size="xs" fw={600} c="orange.8">Commission ({tauxCommission}%)</Text>
                  </Group>
                  <Text size="xs" fw={700} c="orange.8">{totalCommission.toLocaleString()} F</Text>
                </Flex>
              </Paper>
            </SimpleGrid>
            <Divider my="xs" />
            <Paper p="sm" style={{ backgroundColor: '#e8f5e9', borderRadius: '6px' }}>
              <Flex justify="space-between" align="center">
                <Group gap="xs">
                  <IconTruck size={18} color="#2e7d32" />
                  <Text fw={700} size="sm" c="green.8">Net à reverser</Text>
                </Group>
                <Text fw={800} size="lg" c="green.8">
                  {totalNet.toLocaleString()} FCFA
                </Text>
              </Flex>
            </Paper>
          </Card>
        </div>
      </Stack>

      {/* MODAL REÇU */}
      <Modal
        opened={recuModalOpen}
        onClose={() => setRecuModalOpen(false)}
        size="95%"
        title={`Reçu de décompte - ${decompte?.code_decompte || ''}`}
        centered
        fullScreen
      >
        <RecuDecompte
          numero={decompte.code_decompte}
          date={decompte.date_decompte}
          client={decompte.NomComplet || decompte.Societe || 'Client'}
          details={recuDetails}
          factureOriginale={{ taux_commission_revendeur: tauxCommission }}
        />
        <Group justify="flex-end" mt="md">
          <Button onClick={() => setRecuModalOpen(false)}>Fermer</Button>
        </Group>
      </Modal>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            padding: 0;
            margin: 0;
          }
          .mantine-Paper-root {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </>
  );
}