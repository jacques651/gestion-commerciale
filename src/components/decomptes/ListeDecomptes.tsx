// src/components/decomptes/ListeDecomptes.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Title,
  Table,
  Badge,
  Loader,
  Center,
  Group,
  Text,
  Paper,
  ThemeIcon,
  SimpleGrid,
  TextInput,
  Button,
  Pagination,
  ActionIcon,
  ScrollArea,
  Modal,
  Divider,
  Alert,
  Grid,
  Checkbox,
  Select,
  Flex,
  Tooltip
} from '@mantine/core';
import {
  IconReceipt,
  IconSearch,
  IconRefresh,
  IconPrinter,
  IconPlus,
  IconAlertCircle,
  IconTruck,
  IconFileInvoice,
  IconPencil,
  IconTrash,
  IconCalendar,
  IconX,
  IconEye
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { decompteRepository } from '../../database/repositories/decompteRepository';
import { clientRepository } from '../../database/repositories/clientRepository';
import { getDb } from '../../database/db';
import { useNavigate } from 'react-router-dom';

// Interface pour les détails du décompte (produits)
interface DecompteDetail {
  idDetailRevendeur: number;
  idDecompte: number;
  idProduit: number;
  qte_decompte: number;
  prix_achat: number;
  prix_vente: number;
  commission_pourcentage: number;
  designation: string;
  total: number;
  codeFacture: string;
  categorie: string;
  qteInitiale: number;
  qteVendue: number;
  qteRestante: number;
  prixAchat: number;
  prixVente: number;
  totalAchat: number;
  totalVente: number;
  benefice: number;
  commission: number;
  produit_designation?: string;
  produit_categorie?: string;
}

// Interface pour le décompte avec ses détails
interface Decompte {
  idDecompte: number;
  idClient: number;
  code_decompte: string;
  date_decompte: string;
  montant_achat: number;
  montant_vente: number;
  montant_benefice: number;
  montant_commission: number;
  montant_net: number;
  statut: 'brouillon' | 'valide' | 'paye' | 'annule';
  observation?: string;
  periode_debut?: string;
  periode_fin?: string;
  notes?: string;
  NomComplet?: string;
  Societe?: string;
  details?: DecompteDetail[];
}

interface Client {
  idClient: number;
  NomComplet: string;
  code_client?: string;
  TypeClient?: string;
}

interface Statistiques {
  total: number;
  totalValide: number;
  totalPaye: number;
  totalAnnule: number;
  totalBrouillon: number;
  montantTotal: number;
  montantTotalVente: number;
  montantTotalCommission: number;
  montantTotalBenefice: number;
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

const formatDateTimeCustom = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
};

export default function ListeDecomptes() {
  const navigate = useNavigate();
  const [decomptes, setDecomptes] = useState<Decompte[]>([]);
  const [filteredDecomptes, setFilteredDecomptes] = useState<Decompte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchNom, setSearchNom] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [filterCodeFacture, setFilterCodeFacture] = useState<string | null>(null);
  const [statutFilter, setStatutFilter] = useState<string | null>(null);
  const [revendeurFilter, setRevendeurFilter] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDecompte, setSelectedDecompte] = useState<Decompte | null>(null);
  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [revendeurs, setRevendeurs] = useState<Client[]>([]);
  const [codeFactureOptions, setCodeFactureOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [statistiques, setStatistiques] = useState<Statistiques>({
    total: 0,
    totalValide: 0,
    totalPaye: 0,
    totalAnnule: 0,
    totalBrouillon: 0,
    montantTotal: 0,
    montantTotalVente: 0,
    montantTotalCommission: 0,
    montantTotalBenefice: 0
  });

  const itemsPerPage = 15;

  // Fonctions de navigation
  const handleViewReceipt = (decompte: Decompte) => {
    navigate(`/decomptes/${decompte.idDecompte}/reçu`);
  };

  const handleEdit = (decompte: Decompte) => {
    navigate(`/decomptes/${decompte.idDecompte}/modifier`);
  };

  const handleViewDetail = (decompte: Decompte) => {
    setSelectedDecompte(decompte);
    setDetailModalOpened(true);
  };

  const handlePrint = (decompte: Decompte) => {
    navigate(`/decomptes/${decompte.idDecompte}/print`);
  };

  // Chargement initial
  useEffect(() => {
    loadRevendeurs();
    loadDecomptes();
  }, []);

  // Filtrage
  useEffect(() => {
    let filtered = [...decomptes];

    if (searchNom) {
      const term = searchNom.toLowerCase();
      filtered = filtered.filter(d =>
        d.NomComplet?.toLowerCase().includes(term)
      );
    }

    if (searchCode) {
      const term = searchCode.toLowerCase();
      filtered = filtered.filter(d =>
        d.code_decompte?.toLowerCase().includes(term)
      );
    }

    if (filterCodeFacture) {
      filtered = filtered.filter(d =>
        d.details?.some(detail =>
          detail.codeFacture === filterCodeFacture
        )
      );
    }

    if (statutFilter) {
      filtered = filtered.filter(d => d.statut === statutFilter);
    }

    if (revendeurFilter) {
      filtered = filtered.filter(d => d.idClient === Number(revendeurFilter));
    }

    if (dateDebut) {
      const start = new Date(dateDebut);
      start.setHours(0, 0, 0);
      filtered = filtered.filter(d => {
        const date = new Date(d.date_decompte);
        return date >= start;
      });
    }

    if (dateFin) {
      const end = new Date(dateFin);
      end.setHours(23, 59, 59);
      filtered = filtered.filter(d => {
        const date = new Date(d.date_decompte);
        return date <= end;
      });
    }

    setFilteredDecomptes(filtered);
    setCurrentPage(1);
    calculerStatistiques(filtered);
  }, [decomptes, searchNom, searchCode, filterCodeFacture, statutFilter, revendeurFilter, dateDebut, dateFin]);

  const loadRevendeurs = async () => {
    try {
      const data = await clientRepository.getByType("revendeur");
      setRevendeurs(data);
    } catch (error) {
      console.error('Erreur chargement revendeurs:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger la liste des revendeurs',
        color: 'red'
      });
    }
  };

  const getDecompteDetails = async (idDecompte: number): Promise<DecompteDetail[]> => {
    try {
      const db = await getDb();

      const details = await db.select<any[]>(
        `
        SELECT 
          dd.*,
          p.designation as produit_designation,
          p.code_produit,
          p.categorie as produit_categorie,
          p.prix_achat_base,
          p.prix_vente_gros,
          p.commission_pourcentage as produit_commission,
          COALESCE(
            (
              SELECT sr.qte_stock 
              FROM stock_revendeur sr 
              WHERE sr.idRevendeur = d.idClient 
                AND sr.idProduit = dd.idProduit
            ), 
            0
          ) as stock_actuel_revendeur
        FROM decompte_details dd
        INNER JOIN products p ON p.idProduit = dd.idProduit
        INNER JOIN decomptes d ON d.idDecompte = dd.idDecompte
        WHERE dd.idDecompte = ?
        `,
        [idDecompte]
      );

      return details.map(d => {
        const prixAchat = d.prix_achat || d.prix_achat_base || 0;
        const prixVente = d.prix_vente || d.prix_vente_gros || 0;
        const qteDecompte = d.qte_decompte || 0;
        const stockActuel = d.stock_actuel_revendeur || 0;
        const qteInitiale = stockActuel + qteDecompte;
        const totalAchat = prixAchat * qteDecompte;
        const totalVente = d.total || (prixVente * qteDecompte);
        const benefice = totalVente - totalAchat;
        const commission = benefice * ((d.commission_pourcentage || d.produit_commission || 0) / 100);
        const codeFacture = `F_${String(d.idDecompte).padStart(6, '0')}`;

        return {
          idDetailRevendeur: d.idDetailRevendeur,
          idDecompte: d.idDecompte,
          idProduit: d.idProduit,
          qte_decompte: qteDecompte,
          prix_achat: prixAchat,
          prix_vente: prixVente,
          commission_pourcentage: d.commission_pourcentage || d.produit_commission || 0,
          designation: d.produit_designation || d.designation || 'Produit',
          total: totalVente,
          codeFacture: codeFacture,
          categorie: d.produit_categorie || 'Non catégorisé',
          qteInitiale: qteInitiale,
          qteVendue: qteDecompte,
          qteRestante: qteInitiale - qteDecompte,
          prixAchat: prixAchat,
          prixVente: prixVente,
          totalAchat: totalAchat,
          totalVente: totalVente,
          benefice: benefice,
          commission: commission,
          produit_designation: d.produit_designation,
          produit_categorie: d.produit_categorie
        };
      });
    } catch (error) {
      console.error('Erreur chargement détails:', error);
      return [];
    }
  };

  const loadDecomptes = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await decompteRepository.getAll();

      const enrichedData = await Promise.all(
        data.map(async (decompte: any) => {
          try {
            const details = await getDecompteDetails(decompte.idDecompte);
            return {
              ...decompte,
              details: details || []
            };
          } catch (error) {
            console.error(`Erreur chargement détails pour décompte ${decompte.idDecompte}:`, error);
            return {
              ...decompte,
              details: []
            };
          }
        })
      );

      setDecomptes(enrichedData);

      const codes = new Set<string>();
      enrichedData.forEach((d: Decompte) => {
        d.details?.forEach((detail: DecompteDetail) => {
          if (detail.codeFacture) {
            codes.add(detail.codeFacture);
          }
        });
      });
      const codeOptions = Array.from(codes).sort().map((code: string) => ({
        value: code,
        label: code
      }));
      setCodeFactureOptions(codeOptions);

      const stats = {
        total: enrichedData.length,
        totalValide: enrichedData.filter((d: Decompte) => d.statut === 'valide').length,
        totalPaye: enrichedData.filter((d: Decompte) => d.statut === 'paye').length,
        totalAnnule: enrichedData.filter((d: Decompte) => d.statut === 'annule').length,
        totalBrouillon: enrichedData.filter((d: Decompte) => d.statut === 'brouillon').length,
        montantTotal: enrichedData.reduce((sum: number, d: Decompte) => sum + (d.montant_net || 0), 0),
        montantTotalVente: enrichedData.reduce((sum: number, d: Decompte) => sum + (d.montant_vente || 0), 0),
        montantTotalCommission: enrichedData.reduce((sum: number, d: Decompte) => sum + (d.montant_commission || 0), 0),
        montantTotalBenefice: enrichedData.reduce((sum: number, d: Decompte) => sum + (d.montant_benefice || 0), 0)
      };
      setStatistiques(stats);

    } catch (error: any) {
      console.error('Erreur chargement décomptes:', error);
      setError(error?.message || 'Impossible de charger les décomptes');
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les décomptes',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculerStatistiques = (data: Decompte[]) => {
    const totalValide = data.filter(d => d.statut === 'valide').length;
    const totalPaye = data.filter(d => d.statut === 'paye').length;
    const totalAnnule = data.filter(d => d.statut === 'annule').length;
    const totalBrouillon = data.filter(d => d.statut === 'brouillon').length;
    const montantTotal = data.reduce((sum, d) => sum + (d.montant_net || 0), 0);
    const montantTotalVente = data.reduce((sum, d) => sum + (d.montant_vente || 0), 0);
    const montantTotalCommission = data.reduce((sum, d) => sum + (d.montant_commission || 0), 0);
    const montantTotalBenefice = data.reduce((sum, d) => sum + (d.montant_benefice || 0), 0);

    setStatistiques({
      total: data.length,
      totalValide,
      totalPaye,
      totalAnnule,
      totalBrouillon,
      montantTotal,
      montantTotalVente,
      montantTotalCommission,
      montantTotalBenefice
    });
  };

  const formatMontant = (value: number) => {
    return (value || 0).toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'valide': return 'green';
      case 'paye': return 'blue';
      case 'annule': return 'red';
      case 'brouillon': return 'orange';
      default: return 'gray';
    }
  };

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case 'valide': return 'Validé';
      case 'paye': return 'Payé';
      case 'annule': return 'Annulé';
      case 'brouillon': return 'Brouillon';
      default: return statut;
    }
  };

  // ✅ Utiliser formatDateCustom au lieu de format de date-fns
  const formatDate = (dateStr: string) => {
    return formatDateCustom(dateStr);
  };

  const formatDateHeure = (dateStr: string) => {
    return formatDateTimeCustom(dateStr);
  };

  const resetFilters = () => {
    setSearchNom('');
    setSearchCode('');
    setFilterCodeFacture(null);
    setStatutFilter(null);
    setRevendeurFilter(null);
    setDateDebut('');
    setDateFin('');
    setCurrentPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(paginatedDecomptes.map(d => d.idDecompte));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, id]);
    } else {
      setSelectedItems(selectedItems.filter(item => item !== id));
    }
  };

  const handleDelete = async (idDecompte: number) => {
    if (!window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer ce décompte ?\n\nCette action est irréversible et restaurera les stocks.')) {
      return;
    }

    setLoading(true);

    try {
      await decompteRepository.delete(idDecompte);

      notifications.show({
        title: '✅ Succès',
        message: 'Décompte supprimé avec succès.',
        color: 'green',
        autoClose: 3000
      });

      setTimeout(() => {
        loadDecomptes();
      }, 500);

    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);

      let errorMessage = 'Impossible de supprimer ce décompte.';

      if (error?.message?.includes('database is locked')) {
        errorMessage = '⚠️ La base de données est verrouillée. Veuillez rafraîchir la page et réessayer.';
      } else if (error?.message) {
        errorMessage = error.message;
      }

      notifications.show({
        title: '❌ Erreur',
        message: errorMessage,
        color: 'red',
        autoClose: 5000
      });

      setTimeout(() => {
        loadDecomptes();
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(filteredDecomptes.length / itemsPerPage);
  const paginatedDecomptes = filteredDecomptes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (error) {
    return (
      <Stack p="md">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Erreur"
          color="red"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
          <Button
            variant="light"
            color="red"
            mt="md"
            leftSection={<IconRefresh size={16} />}
            onClick={loadDecomptes}
          >
            Réessayer
          </Button>
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {/* En-tête */}
      <Paper
        p="xl"
        radius="lg"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          borderBottom: '3px solid #e94560'
        }}
      >
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="md">
              <ThemeIcon size={45} radius="md" color="red" variant="filled">
                <IconReceipt size={28} />
              </ThemeIcon>
              <div>
                <Title order={1} c="white" size="h2" fw={700}>
                  GESTION DES DECOMPTES DES REVENDEURS
                </Title>
              </div>
            </Group>
            <Group>
              <Button
                variant="light"
                color="gray"
                leftSection={<IconRefresh size={18} />}
                onClick={loadDecomptes}
                loading={loading}
                size="sm"
              >
                Actualiser
              </Button>
              <Button
                color="red"
                leftSection={<IconPlus size={18} />}
                onClick={() => navigate('/decomptes/nouveau')}
                size="sm"
              >
                Nouveau décompte
              </Button>
            </Group>
          </Group>

          {/* Barre de recherche et filtres */}
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="md" withBorder={false}>
            <Grid align="flex-end">
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <TextInput
                  placeholder="Nom du client"
                  value={searchNom}
                  onChange={(e) => setSearchNom(e.target.value)}
                  size="sm"
                  label={<Text c="gray.2" size="sm" fw={500}>Rechercher</Text>}
                  leftSection={<IconSearch size={16} color="rgba(255,255,255,0.6)" />}
                  styles={{
                    input: {
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      '&::placeholder': {
                        color: 'rgba(255,255,255,0.5)'
                      },
                      '&:focus': {
                        borderColor: '#e94560'
                      }
                    },
                    label: {
                      color: 'rgba(255,255,255,0.9)'
                    }
                  }}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <TextInput
                  placeholder="Code décompte"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  size="sm"
                  label={<Text c="gray.2" size="sm" fw={500}>Code décompte</Text>}
                  leftSection={<IconFileInvoice size={16} color="rgba(255,255,255,0.6)" />}
                  styles={{
                    input: {
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      '&::placeholder': {
                        color: 'rgba(255,255,255,0.5)'
                      },
                      '&:focus': {
                        borderColor: '#e94560'
                      }
                    },
                    label: {
                      color: 'rgba(255,255,255,0.9)'
                    }
                  }}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <Select
                  placeholder="Sélectionner un code facture"
                  clearable
                  searchable
                  data={codeFactureOptions}
                  value={filterCodeFacture}
                  onChange={setFilterCodeFacture}
                  size="sm"
                  label={<Text c="gray.2" size="sm" fw={500}>Code facture</Text>}
                  leftSection={<IconFileInvoice size={16} color="rgba(255,255,255,0.6)" />}
                  styles={{
                    input: {
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      '&::placeholder': {
                        color: 'rgba(255,255,255,0.5)'
                      },
                      '&:focus': {
                        borderColor: '#e94560'
                      }
                    },
                    label: {
                      color: 'rgba(255,255,255,0.9)'
                    },
                    dropdown: {
                      backgroundColor: '#1a1a2e',
                      borderColor: 'rgba(255,255,255,0.15)'
                    },
                    option: {
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.1)'
                      }
                    }
                  }}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <Select
                  placeholder="Statut"
                  clearable
                  data={[
                    { value: 'brouillon', label: '📝 Brouillon' },
                    { value: 'valide', label: '✅ Validé' },
                    { value: 'paye', label: '💳 Payé' },
                    { value: 'annule', label: '❌ Annulé' }
                  ]}
                  value={statutFilter}
                  onChange={setStatutFilter}
                  size="sm"
                  label={<Text c="gray.2" size="sm" fw={500}>Statut</Text>}
                  styles={{
                    input: {
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      '&::placeholder': {
                        color: 'rgba(255,255,255,0.5)'
                      },
                      '&:focus': {
                        borderColor: '#e94560'
                      }
                    },
                    label: {
                      color: 'rgba(255,255,255,0.9)'
                    },
                    dropdown: {
                      backgroundColor: '#1a1a2e',
                      borderColor: 'rgba(255,255,255,0.15)'
                    },
                    option: {
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.1)'
                      }
                    }
                  }}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <Select
                  placeholder="Revendeur"
                  clearable
                  searchable
                  data={revendeurs.map(r => ({
                    value: r.idClient.toString(),
                    label: r.NomComplet
                  }))}
                  value={revendeurFilter}
                  onChange={setRevendeurFilter}
                  size="sm"
                  label={<Text c="gray.2" size="sm" fw={500}>Revendeur</Text>}
                  styles={{
                    input: {
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      '&::placeholder': {
                        color: 'rgba(255,255,255,0.5)'
                      },
                      '&:focus': {
                        borderColor: '#e94560'
                      }
                    },
                    label: {
                      color: 'rgba(255,255,255,0.9)'
                    },
                    dropdown: {
                      backgroundColor: '#1a1a2e',
                      borderColor: 'rgba(255,255,255,0.15)'
                    },
                    option: {
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.1)'
                      }
                    }
                  }}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 2 }}>
                <TextInput
                  type="date"
                  placeholder="Du"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  size="sm"
                  label={<Text c="gray.2" size="sm" fw={500}>Du</Text>}
                  leftSection={<IconCalendar size={16} color="rgba(255,255,255,0.6)" />}
                  styles={{
                    input: {
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      '&::placeholder': {
                        color: 'rgba(255,255,255,0.5)'
                      },
                      '&:focus': {
                        borderColor: '#e94560'
                      }
                    },
                    label: {
                      color: 'rgba(255,255,255,0.9)'
                    }
                  }}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 2 }}>
                <TextInput
                  type="date"
                  placeholder="Au"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  size="sm"
                  label={<Text c="gray.2" size="sm" fw={500}>Au</Text>}
                  leftSection={<IconCalendar size={16} color="rgba(255,255,255,0.6)" />}
                  styles={{
                    input: {
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      '&::placeholder': {
                        color: 'rgba(255,255,255,0.5)'
                      },
                      '&:focus': {
                        borderColor: '#e94560'
                      }
                    },
                    label: {
                      color: 'rgba(255,255,255,0.9)'
                    }
                  }}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 2 }}>
                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconX size={16} />}
                  onClick={resetFilters}
                  size="sm"
                  fullWidth
                  style={{ marginBottom: 2 }}
                >
                  Réinitialiser
                </Button>
              </Grid.Col>
            </Grid>
          </Card>
        </Stack>
      </Paper>

      {/* Liste des décomptes - AVEC FUSION DE CELLULES */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        {loading ? (
          <Center py={100}>
            <Loader size="xl" />
          </Center>
        ) : filteredDecomptes.length === 0 ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <IconReceipt size={48} color="#868e96" />
              <Text c="dimmed" size="lg" fw={500}>
                Aucun décompte trouvé
              </Text>
              <Text c="dimmed" size="sm">
                {searchNom || searchCode || filterCodeFacture || statutFilter || revendeurFilter || dateDebut || dateFin
                  ? 'Aucun décompte ne correspond aux filtres appliqués'
                  : 'Commencez par créer un nouveau décompte'}
              </Text>
              {(searchNom || searchCode || filterCodeFacture || statutFilter || revendeurFilter || dateDebut || dateFin) && (
                <Button variant="subtle" size="xs" onClick={resetFilters}>
                  Réinitialiser les filtres
                </Button>
              )}
              {!searchNom && !searchCode && !filterCodeFacture && !statutFilter && !revendeurFilter && !dateDebut && !dateFin && (
                <Button
                  variant="light"
                  color="blue"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => navigate('/decomptes/nouveau')}
                >
                  Créer un décompte
                </Button>
              )}
            </Stack>
          </Center>
        ) : (
          <>
            <ScrollArea h={550}>
              <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="xs">
                <Table.Thead>
                  <Table.Tr style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                    <Table.Th style={{ width: 30, textAlign: 'center', color: 'white' }}>
                      <Checkbox
                        checked={selectedItems.length === paginatedDecomptes.length && paginatedDecomptes.length > 0}
                        onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                        styles={{ input: { backgroundColor: 'rgba(255,255,255,0.2)' } }}
                      />
                    </Table.Th>
                    <Table.Th style={{ width: 35, textAlign: 'center', fontSize: 11, color: 'white' }}>N°</Table.Th>
                    <Table.Th style={{ fontSize: 11, color: 'white' }}>Nom du client</Table.Th>
                    <Table.Th style={{ fontSize: 11, color: 'white' }}>Date</Table.Th>
                    <Table.Th style={{ fontSize: 11, color: 'white' }}>CodeFacture</Table.Th>
                    <Table.Th style={{ fontSize: 11, color: 'white' }}>Catégorie</Table.Th>
                    <Table.Th style={{ fontSize: 11, color: 'white' }}>Désignation</Table.Th>
                    <Table.Th style={{ fontSize: 11, textAlign: 'center', color: 'white' }}>Qté initiale</Table.Th>
                    <Table.Th style={{ fontSize: 11, textAlign: 'center', color: 'white' }}>Qté vendue</Table.Th>
                    <Table.Th style={{ fontSize: 11, textAlign: 'center', color: 'white' }}>Qté restante</Table.Th>
                    <Table.Th style={{ fontSize: 11, textAlign: 'right', color: 'white' }}>Prix Achat</Table.Th>
                    <Table.Th style={{ fontSize: 11, textAlign: 'right', color: 'white' }}>Prix Vente</Table.Th>
                    <Table.Th style={{ fontSize: 11, textAlign: 'right', color: 'white' }}>Total Achat</Table.Th>
                    <Table.Th style={{ fontSize: 11, textAlign: 'right', color: 'white' }}>Total Vente</Table.Th>
                    <Table.Th style={{ fontSize: 11, textAlign: 'right', color: 'white' }}>Bénéfice</Table.Th>
                    <Table.Th style={{ fontSize: 11, textAlign: 'right', color: 'white' }}>Commission</Table.Th>
                    <Table.Th style={{ fontSize: 11, textAlign: 'center', color: 'white' }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedDecomptes.map((decompte, idx) => {
                    const num = (currentPage - 1) * itemsPerPage + idx + 1;

                    if (decompte.details && decompte.details.length > 0) {
                      // AVEC FUSION DE CELLULES - les infos communes sont fusionnées
                      return decompte.details.map((detail, detailIdx) => {
                        const benefice = detail.totalVente - detail.totalAchat;
                        const commission = detail.commission;
                        const totalDetails = decompte.details!.length;

                        return (
                          <Table.Tr key={`${decompte.idDecompte}-${detail.idDetailRevendeur || detailIdx}`}>
                            {detailIdx === 0 && (
                              <>
                                <Table.Td ta="center" rowSpan={totalDetails}>
                                  <Checkbox
                                    checked={selectedItems.includes(decompte.idDecompte)}
                                    onChange={(e) => handleSelectItem(decompte.idDecompte, e.currentTarget.checked)}
                                  />
                                </Table.Td>
                                <Table.Td ta="center" fw={600} rowSpan={totalDetails}>
                                  {num}
                                </Table.Td>
                                <Table.Td rowSpan={totalDetails}>
                                  {decompte.NomComplet || 'Inconnu'}
                                </Table.Td>
                                <Table.Td rowSpan={totalDetails}>
                                  {formatDate(decompte.date_decompte)}
                                </Table.Td>
                              </>
                            )}
                            <Table.Td>
                              <Badge variant="outline" color="blue" size="xs">
                                {detail.codeFacture}
                              </Badge>
                            </Table.Td>
                            <Table.Td>{detail.categorie || '-'}</Table.Td>
                            <Table.Td>{detail.designation || '-'}</Table.Td>
                            <Table.Td ta="center">{detail.qteInitiale}</Table.Td>
                            <Table.Td ta="center">{detail.qteVendue}</Table.Td>
                            <Table.Td ta="center">{detail.qteRestante}</Table.Td>
                            <Table.Td ta="right">{formatMontant(detail.prixAchat)}</Table.Td>
                            <Table.Td ta="right">{formatMontant(detail.prixVente)}</Table.Td>
                            <Table.Td ta="right">{formatMontant(detail.totalAchat)}</Table.Td>
                            <Table.Td ta="right">{formatMontant(detail.totalVente)}</Table.Td>
                            <Table.Td ta="right" fw={600} c={benefice >= 0 ? 'green' : 'red'}>
                              {formatMontant(benefice)}
                            </Table.Td>
                            <Table.Td ta="right" c={commission >= 0 ? 'green' : 'red'}>
                              {formatMontant(commission)}
                            </Table.Td>
                            {detailIdx === 0 && (
                              <Table.Td ta="center" rowSpan={totalDetails}>
                                <Group gap="4px" justify="center">
                                  <Tooltip label="Voir les détails">
                                    <ActionIcon
                                      variant="subtle"
                                      color="gray"
                                      size="sm"
                                      onClick={() => handleViewDetail(decompte)}
                                    >
                                      <IconEye size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Voir le reçu">
                                    <ActionIcon
                                      variant="subtle"
                                      color="teal"
                                      size="sm"
                                      onClick={() => handleViewReceipt(decompte)}
                                    >
                                      <IconReceipt size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Modifier">
                                    <ActionIcon
                                      variant="subtle"
                                      color="blue"
                                      size="sm"
                                      onClick={() => handleEdit(decompte)}
                                    >
                                      <IconPencil size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Supprimer">
                                    <ActionIcon
                                      variant="subtle"
                                      color="red"
                                      size="sm"
                                      onClick={() => handleDelete(decompte.idDecompte)}
                                    >
                                      <IconTrash size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Table.Td>
                            )}
                          </Table.Tr>
                        );
                      });
                    } else {
                      // Cas sans détails - une seule ligne
                      return (
                        <Table.Tr key={decompte.idDecompte}>
                          <Table.Td ta="center">
                            <Checkbox
                              checked={selectedItems.includes(decompte.idDecompte)}
                              onChange={(e) => handleSelectItem(decompte.idDecompte, e.currentTarget.checked)}
                            />
                          </Table.Td>
                          <Table.Td ta="center" fw={600}>{num}</Table.Td>
                          <Table.Td>{decompte.NomComplet || 'Inconnu'}</Table.Td>
                          <Table.Td>{formatDate(decompte.date_decompte)}</Table.Td>
                          <Table.Td>-</Table.Td>
                          <Table.Td>-</Table.Td>
                          <Table.Td>-</Table.Td>
                          <Table.Td ta="center">-</Table.Td>
                          <Table.Td ta="center">-</Table.Td>
                          <Table.Td ta="center">-</Table.Td>
                          <Table.Td ta="right">-</Table.Td>
                          <Table.Td ta="right">-</Table.Td>
                          <Table.Td ta="right">-</Table.Td>
                          <Table.Td ta="right">-</Table.Td>
                          <Table.Td ta="right">-</Table.Td>
                          <Table.Td ta="right">-</Table.Td>
                          <Table.Td ta="center">
                            <Group gap="4px" justify="center">
                              <Tooltip label="Voir les détails">
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  size="sm"
                                  onClick={() => handleViewDetail(decompte)}
                                >
                                  <IconEye size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Voir le reçu">
                                <ActionIcon
                                  variant="subtle"
                                  color="teal"
                                  size="sm"
                                  onClick={() => handleViewReceipt(decompte)}
                                >
                                  <IconReceipt size={16} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Modifier">
                                <ActionIcon
                                  variant="subtle"
                                  color="blue"
                                  size="sm"
                                  onClick={() => handleEdit(decompte)}
                                >
                                  <IconPencil size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Supprimer">
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  size="sm"
                                  onClick={() => handleDelete(decompte.idDecompte)}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    }
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            {totalPages > 1 && (
              <Group justify="center" p="md">
                <Pagination
                  total={totalPages}
                  value={currentPage}
                  onChange={setCurrentPage}
                  size="sm"
                />
              </Group>
            )}
          </>
        )}
      </Card>

      {/* Pied de page */}
      <Paper withBorder p="sm" radius="lg">
        <Flex justify="space-between" align="center" wrap="wrap" gap="xs">
          <Group gap="lg">
            <Text size="xs" c="dimmed">
              Total: <strong>{filteredDecomptes.length}</strong> décomptes
            </Text>
            {selectedItems.length > 0 && (
              <Text size="xs" c="blue">
                {selectedItems.length} sélectionné(s)
              </Text>
            )}
          </Group>
          <Group gap="xs">
            <Badge color="green" size="sm">
              Validés: {statistiques.totalValide}
            </Badge>
            <Badge color="blue" size="sm">
              Payés: {statistiques.totalPaye}
            </Badge>
            <Badge color="orange" size="sm">
              Brouillons: {statistiques.totalBrouillon}
            </Badge>
            <Badge color="red" size="sm">
              Annulés: {statistiques.totalAnnule}
            </Badge>
          </Group>
        </Flex>
      </Paper>

      {/* Modal Détails */}
      <Modal
        opened={detailModalOpened}
        onClose={() => setDetailModalOpened(false)}
        title="Détails du décompte"
        size="xl"
        centered
        styles={{
          header: {
            backgroundColor: '#1b365d',
            padding: '16px 20px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
          },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        {selectedDecompte && (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed">Code décompte</Text>
                <Text fw={600}>{selectedDecompte.code_decompte || 'N/A'}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed">Date</Text>
                <Text fw={600}>{formatDateHeure(selectedDecompte.date_decompte)}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed">Statut</Text>
                <Badge color={getStatutColor(selectedDecompte.statut)}>
                  {getStatutLabel(selectedDecompte.statut)}
                </Badge>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed">Revendeur</Text>
                <Group gap="xs">
                  <IconTruck size={14} color="#868e96" />
                  <Text fw={600}>{selectedDecompte.NomComplet || 'Inconnu'}</Text>
                </Group>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed">Montant net</Text>
                <Text fw={700} c="blue">{formatMontant(selectedDecompte.montant_net || 0)} FCFA</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed">Bénéfice</Text>
                <Text fw={700} c={selectedDecompte.montant_benefice >= 0 ? 'green' : 'red'}>
                  {formatMontant(selectedDecompte.montant_benefice || 0)} FCFA
                </Text>
              </Paper>
            </SimpleGrid>

            <Divider label="Produits décomptés" labelPosition="center" />

            {selectedDecompte.details && selectedDecompte.details.length > 0 ? (
              <ScrollArea h={300}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr style={{ backgroundColor: '#f8f9fa' }}>
                      <Table.Th style={{ fontSize: 11 }}>CodeFacture</Table.Th>
                      <Table.Th style={{ fontSize: 11 }}>Catégorie</Table.Th>
                      <Table.Th style={{ fontSize: 11 }}>Désignation</Table.Th>
                      <Table.Th style={{ fontSize: 11, textAlign: 'center' }}>Qté vendue</Table.Th>
                      <Table.Th style={{ fontSize: 11, textAlign: 'right' }}>Prix Vente</Table.Th>
                      <Table.Th style={{ fontSize: 11, textAlign: 'right' }}>Total Vente</Table.Th>
                      <Table.Th style={{ fontSize: 11, textAlign: 'right' }}>Bénéfice</Table.Th>
                      <Table.Th style={{ fontSize: 11, textAlign: 'right' }}>Commission</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedDecompte.details.map((detail) => {
                      const benefice = detail.totalVente - detail.totalAchat;
                      const commission = detail.commission;

                      return (
                        <Table.Tr key={detail.idDetailRevendeur || Math.random()}>
                          <Table.Td>
                            <Badge variant="outline" color="blue" size="xs">
                              {detail.codeFacture}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{detail.categorie || '-'}</Table.Td>
                          <Table.Td>{detail.designation || '-'}</Table.Td>
                          <Table.Td ta="center">{detail.qteVendue}</Table.Td>
                          <Table.Td ta="right">{formatMontant(detail.prixVente)}</Table.Td>
                          <Table.Td ta="right" fw={600}>{formatMontant(detail.totalVente)}</Table.Td>
                          <Table.Td ta="right" c={benefice >= 0 ? 'green' : 'red'}>
                            {formatMontant(benefice)}
                          </Table.Td>
                          <Table.Td ta="right" c={commission >= 0 ? 'green' : 'red'}>
                            {formatMontant(commission)}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            ) : (
              <Text c="dimmed" ta="center">Aucun produit décompté</Text>
            )}

            {selectedDecompte.observation && (
              <>
                <Divider />
                <div>
                  <Text size="xs" c="dimmed">Observation</Text>
                  <Text>{selectedDecompte.observation}</Text>
                </div>
              </>
            )}

            {selectedDecompte.periode_debut && selectedDecompte.periode_fin && (
              <>
                <Divider />
                <SimpleGrid cols={2} spacing="md">
                  <Paper withBorder p="sm" radius="md">
                    <Text size="xs" c="dimmed">Période début</Text>
                    <Text fw={500}>{formatDate(selectedDecompte.periode_debut)}</Text>
                  </Paper>
                  <Paper withBorder p="sm" radius="md">
                    <Text size="xs" c="dimmed">Période fin</Text>
                    <Text fw={500}>{formatDate(selectedDecompte.periode_fin)}</Text>
                  </Paper>
                </SimpleGrid>
              </>
            )}

            <Divider />

            <Group justify="flex-end">
              <Button
                variant="light"
                color="teal"
                leftSection={<IconPrinter size={16} />}
                onClick={() => {
                  setDetailModalOpened(false);
                  handlePrint(selectedDecompte);
                }}
              >
                Imprimer
              </Button>
              <Button variant="light" onClick={() => setDetailModalOpened(false)}>
                Fermer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}