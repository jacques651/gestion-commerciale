// src/components/decomptes/NouveauDecompte.tsx
import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Title,
  Text,
  Paper,
  ThemeIcon,
  Group,
  Button,
  Loader,
  Center,
  Alert,
  Select,
  TextInput,
  NumberInput,
  Table,
  ActionIcon,
  Badge,
  ScrollArea,
  Divider,
  Flex
} from '@mantine/core';
import {
  IconReceipt,
  IconPlus,
  IconTrash,
  IconAlertCircle,
  IconUser,
  IconPackage,
  IconArrowLeft
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { getDb } from '../../database/db';
import { clientRepository } from '../../database/repositories/clientRepository';
import { decompteRepository } from '../../database/repositories/decompteRepository';
import { journalCaisseService } from '../../services/journalCaisseService';
import { format } from 'date-fns';

interface NouveauDecompteProps {
  decompteId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface Produit {
  idProduit: number;
  designation: string;
  code_produit: string;
  categorie: string;
  prix_achat: number;
  prix_vente: number;
  commission_pourcentage: number;
  qte_stock: number;
  unite_base?: string;
}

interface DecompteDetail {
  idProduit: number;
  designation: string;
  code_produit: string;
  categorie: string;
  prix_achat: number;
  prix_vente: number;
  commission_pourcentage: number;
  qte_stock: number;
  qte_decompte: number;
  total: number;
  unite_base?: string;
}

export default function NouveauDecompte({ decompteId, onSuccess, onCancel }: NouveauDecompteProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // États pour le formulaire
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string>('');
  const [revendeurs, setRevendeurs] = useState<{ value: string; label: string }[]>([]);
  const [observation, setObservation] = useState('');
  
  // États pour les produits
  const [produitsDisponibles, setProduitsDisponibles] = useState<Produit[]>([]);
  const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);
  const [quantite, setQuantite] = useState<number>(1);
  const [details, setDetails] = useState<DecompteDetail[]>([]);
  
  // États pour le chargement des données en modification
  const [loadingDecompte, setLoadingDecompte] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Chargement initial
  useEffect(() => {
    loadRevendeurs();
    if (decompteId) {
      loadDecompteToEdit(decompteId);
    } else {
      setLoading(false);
    }
  }, [decompteId]);

  const loadRevendeurs = async () => {
    try {
      const data = await clientRepository.getByType("revendeur");
      setRevendeurs(data.map(c => ({
        value: c.idClient.toString(),
        label: c.NomComplet || c.Societe || 'Revendeur sans nom'
      })));
    } catch (error) {
      console.error('Erreur chargement revendeurs:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les revendeurs',
        color: 'red'
      });
    }
  };

  const loadDecompteToEdit = async (id: number) => {
    try {
      setLoadingDecompte(true);
      setIsEditMode(true);
      
      const db = await getDb();
      
      const decompteData = await db.select<any[]>(
        `SELECT d.*, c.NomComplet 
         FROM decomptes d
         INNER JOIN clients c ON c.idClient = d.idClient
         WHERE d.idDecompte = ?`,
        [id]
      );
      
      if (decompteData.length === 0) {
        setError('Décompte non trouvé');
        setLoading(false);
        return;
      }
      
      const decompte = decompteData[0];
      setSelectedClientId(decompte.idClient);
      setSelectedClientName(decompte.NomComplet);
      setObservation(decompte.observation || '');
      
      const detailsData = await db.select<any[]>(
        `
        SELECT 
          dd.*,
          p.designation,
          p.code_produit,
          p.categorie,
          p.unite_base,
          p.commission_pourcentage,
          COALESCE(
            (
              SELECT sr.qte_stock 
              FROM stock_revendeur sr 
              WHERE sr.idRevendeur = d.idClient 
                AND sr.idProduit = dd.idProduit
            ), 
            0
          ) as qte_stock
        FROM decompte_details dd
        INNER JOIN products p ON p.idProduit = dd.idProduit
        INNER JOIN decomptes d ON d.idDecompte = dd.idDecompte
        WHERE dd.idDecompte = ?
        `,
        [id]
      );
      
      const detailsFormatted = detailsData.map(d => ({
        idProduit: d.idProduit,
        designation: d.designation || d.produit_designation || 'Produit',
        code_produit: d.code_produit || '',
        categorie: d.categorie || 'Non catégorisé',
        prix_achat: d.prix_achat || 0,
        prix_vente: d.prix_vente || 0,
        commission_pourcentage: d.commission_pourcentage || 0,
        qte_stock: d.qte_stock || 0,
        qte_decompte: d.qte_decompte || 0,
        total: (d.prix_vente || 0) * (d.qte_decompte || 0),
        unite_base: d.unite_base || 'pièce'
      }));
      
      setDetails(detailsFormatted);
      await loadProduitsForClient(decompte.idClient);
      setLoading(false);
      
    } catch (error) {
      console.error('Erreur chargement décompte:', error);
      setError('Impossible de charger le décompte à modifier');
      setLoading(false);
    } finally {
      setLoadingDecompte(false);
    }
  };

  const loadProduitsForClient = async (clientId: number) => {
    try {
      const db = await getDb();
      
      const produits = await db.select<any[]>(
        `
        SELECT 
          p.idProduit,
          p.designation,
          p.code_produit,
          p.categorie,
          p.prix_achat_base,
          p.prix_vente_gros,
          p.commission_pourcentage,
          p.unite_base,
          sr.qte_stock
        FROM stock_revendeur sr
        INNER JOIN products p ON p.idProduit = sr.idProduit
        WHERE sr.idRevendeur = ?
          AND sr.qte_stock > 0
        ORDER BY p.designation
        `,
        [clientId]
      );
      
      const produitsFormatted = produits.map(p => ({
        idProduit: p.idProduit,
        designation: p.designation || 'Produit',
        code_produit: p.code_produit || '',
        categorie: p.categorie || 'Non catégorisé',
        prix_achat: p.prix_achat_base || 0,
        prix_vente: p.prix_vente_gros || 0,
        commission_pourcentage: p.commission_pourcentage || 0,
        qte_stock: p.qte_stock || 0,
        unite_base: p.unite_base || 'pièce'
      }));
      
      setProduitsDisponibles(produitsFormatted);
      
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    }
  };

  const handleClientChange = async (value: string | null) => {
    if (!value) {
      setSelectedClientId(null);
      setSelectedClientName('');
      setProduitsDisponibles([]);
      setDetails([]);
      return;
    }
    
    const clientId = parseInt(value);
    setSelectedClientId(clientId);
    
    const client = revendeurs.find(r => r.value === value);
    setSelectedClientName(client?.label || '');
    
    await loadProduitsForClient(clientId);
    
    if (!isEditMode) {
      setDetails([]);
    }
  };

  const addProduit = () => {
    if (!selectedProduit) {
      notifications.show({
        title: 'Erreur',
        message: 'Sélectionnez un produit',
        color: 'red'
      });
      return;
    }
    
    if (quantite <= 0) {
      notifications.show({
        title: 'Erreur',
        message: 'La quantité doit être supérieure à 0',
        color: 'red'
      });
      return;
    }
    
    if (quantite > selectedProduit.qte_stock) {
      notifications.show({
        title: 'Stock insuffisant',
        message: `Stock disponible: ${selectedProduit.qte_stock}`,
        color: 'red'
      });
      return;
    }
    
    const existing = details.find(d => d.idProduit === selectedProduit.idProduit);
    if (existing) {
      const nouvelleQuantite = existing.qte_decompte + quantite;
      if (nouvelleQuantite > existing.qte_stock) {
        notifications.show({
          title: 'Stock insuffisant',
          message: `Stock disponible: ${existing.qte_stock}`,
          color: 'red'
        });
        return;
      }
      
      setDetails(details.map(d => 
        d.idProduit === selectedProduit.idProduit
          ? {
              ...d,
              qte_decompte: nouvelleQuantite,
              total: d.prix_vente * nouvelleQuantite
            }
          : d
      ));
    } else {
      setDetails([...details, {
        ...selectedProduit,
        qte_decompte: quantite,
        total: selectedProduit.prix_vente * quantite
      }]);
    }
    
    setSelectedProduit(null);
    setQuantite(1);
  };

  const removeProduit = (idProduit: number) => {
    setDetails(details.filter(d => d.idProduit !== idProduit));
  };

  const updateQuantite = (idProduit: number, qte: number) => {
    if (qte <= 0) {
      removeProduit(idProduit);
      return;
    }
    
    const produit = details.find(d => d.idProduit === idProduit);
    if (!produit) return;
    
    if (qte > produit.qte_stock) {
      notifications.show({
        title: 'Stock insuffisant',
        message: `Stock disponible: ${produit.qte_stock}`,
        color: 'red'
      });
      return;
    }
    
    setDetails(details.map(d =>
      d.idProduit === idProduit
        ? { ...d, qte_decompte: qte, total: d.prix_vente * qte }
        : d
    ));
  };

  const handleSubmit = async () => {
    if (!selectedClientId) {
      notifications.show({
        title: 'Erreur',
        message: 'Sélectionnez un revendeur',
        color: 'red'
      });
      return;
    }
    
    if (details.length === 0) {
      notifications.show({
        title: 'Erreur',
        message: 'Ajoutez au moins un produit',
        color: 'red'
      });
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const decompteInput = {
        idClient: selectedClientId,
        observation: observation || undefined,
        periode_debut: format(new Date(), 'yyyy-MM-dd'),
        periode_fin: format(new Date(), 'yyyy-MM-dd'),
        notes: undefined
      };
      
      const detailsInput = details.map(d => ({
        idProduit: d.idProduit,
        qte_decompte: d.qte_decompte
      }));
      
      // Créer le décompte
      const idDecompte = await decompteRepository.create(decompteInput, detailsInput);
      
      // ✅ ENREGISTRER DANS LE JOURNAL DE CAISSE (SORTIE D'ARGENT)
      try {
        const montantNetARegler = montantNet; // Net à reverser au revendeur
        
        await journalCaisseService.ajouterDecompteRevendeur({
          montant: montantNetARegler,
          idDecompte: idDecompte,
          codeDecompte: `DCP-${idDecompte}`,
          revendeurNom: selectedClientName
        });
        console.log('✅ Journal de caisse mis à jour pour le décompte', idDecompte);
      } catch (journalError) {
        console.error('Erreur journal de caisse:', journalError);
        // Ne pas bloquer si le journal échoue
      }
      
      notifications.show({
        title: '✅ Succès',
        message: isEditMode ? 'Décompte modifié avec succès' : 'Décompte créé avec succès',
        color: 'green'
      });
      
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/decomptes');
      }
      
    } catch (error: any) {
      console.error('Erreur création décompte:', error);
      setError(error?.message || 'Erreur lors de la création du décompte');
      notifications.show({
        title: '❌ Erreur',
        message: error?.message || 'Erreur lors de la création du décompte',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const totalVente = details.reduce((sum, d) => sum + d.total, 0);
  const totalAchat = details.reduce((sum, d) => sum + (d.prix_achat * d.qte_decompte), 0);
  const totalBenefice = totalVente - totalAchat;
  const totalCommission = details.reduce((sum, d) => sum + ((d.prix_vente - d.prix_achat) * d.qte_decompte * (d.commission_pourcentage / 100)), 0);
  const montantNet = totalVente - totalCommission;

  if (loading || loadingDecompte) {
    return (
      <Center py={100}>
        <Loader size="xl" />
        <Text ml="md" c="dimmed">Chargement...</Text>
      </Center>
    );
  }

  return (
    <Stack gap="md" p="md">
      {/* En-tête */}
      <Paper p="lg" radius="lg" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        <Group justify="space-between">
          <Group gap="md">
            <ThemeIcon size={40} radius="md" color="red" variant="filled">
              <IconReceipt size={24} />
            </ThemeIcon>
            <div>
              <Title order={2} c="white">
                {isEditMode ? 'Modifier le décompte' : 'Nouveau décompte'}
              </Title>
              <Text c="gray.3" size="sm">
                {isEditMode ? 'Modifier un décompte existant' : 'Créer un nouveau décompte pour un revendeur'}
              </Text>
            </div>
          </Group>
          <Button
            variant="light"
            color="gray"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/decomptes')}
          >
            Retour
          </Button>
        </Group>
      </Paper>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Erreur" color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Sélection du revendeur */}
      <Card withBorder radius="lg" shadow="sm" p="lg">
        <Select
          label="Revendeur"
          placeholder="Sélectionnez un revendeur"
          searchable
          clearable
          data={revendeurs}
          value={selectedClientId?.toString() || null}
          onChange={handleClientChange}
          leftSection={<IconUser size={16} />}
          required
          disabled={isEditMode}
        />
        {selectedClientName && (
          <Text size="sm" c="dimmed" mt="xs">
            Revendeur sélectionné: <strong>{selectedClientName}</strong>
          </Text>
        )}
      </Card>

      {/* Ajout de produits */}
      {selectedClientId && (
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group gap="sm" mb="md">
            <ThemeIcon color="blue" variant="light" size="sm">
              <IconPackage size={14} />
            </ThemeIcon>
            <Text fw={600}>Ajouter des produits</Text>
            <Badge color="green" variant="light">{produitsDisponibles.length} produits en stock</Badge>
          </Group>

          <Group align="flex-end" gap="sm">
            <Select
              placeholder="Rechercher un produit..."
              searchable
              clearable
              data={produitsDisponibles.map(p => ({
                value: p.idProduit.toString(),
                label: `${p.code_produit} - ${p.designation} (${p.qte_stock} ${p.unite_base})`
              }))}
              value={selectedProduit?.idProduit?.toString() || null}
              onChange={(value) => {
                const produit = produitsDisponibles.find(p => p.idProduit.toString() === value);
                setSelectedProduit(produit || null);
              }}
              style={{ flex: 1 }}
              size="sm"
            />
            <NumberInput
              placeholder="Qté"
              value={quantite}
              onChange={(val) => setQuantite(Number(val) || 0)}
              min={1}
              max={selectedProduit?.qte_stock || 999}
              style={{ width: 100 }}
              size="sm"
            />
            <Button
              color="green"
              leftSection={<IconPlus size={16} />}
              onClick={addProduit}
              disabled={!selectedProduit}
              size="sm"
            >
              Ajouter
            </Button>
          </Group>

          {produitsDisponibles.length === 0 && (
            <Text c="dimmed" size="sm" mt="md" ta="center">
              Aucun produit en stock pour ce revendeur
            </Text>
          )}
        </Card>
      )}

      {/* Liste des produits du décompte */}
      {details.length > 0 && (
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group gap="sm" mb="md">
            <ThemeIcon color="orange" variant="light" size="sm">
              <IconReceipt size={14} />
            </ThemeIcon>
            <Text fw={600}>Produits du décompte</Text>
            <Badge color="orange" variant="light">{details.length} produits</Badge>
          </Group>

          <ScrollArea h={300}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#f8f9fa' }}>
                  <Table.Th>Code</Table.Th>
                  <Table.Th>Désignation</Table.Th>
                  <Table.Th>Catégorie</Table.Th>
                  <Table.Th ta="center">Stock</Table.Th>
                  <Table.Th ta="center">Qté</Table.Th>
                  <Table.Th ta="right">PA</Table.Th>
                  <Table.Th ta="right">PV</Table.Th>
                  <Table.Th ta="right">Total</Table.Th>
                  <Table.Th ta="center">Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {details.map((detail) => (
                  <Table.Tr key={detail.idProduit}>
                    <Table.Td><Text size="xs" fw={500}>{detail.code_produit}</Text></Table.Td>
                    <Table.Td><Text size="xs">{detail.designation}</Text></Table.Td>
                    <Table.Td><Badge variant="light" size="xs">{detail.categorie}</Badge></Table.Td>
                    <Table.Td ta="center">
                      <Badge color={detail.qte_stock <= 0 ? 'red' : 'green'} size="xs">
                        {detail.qte_stock}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <NumberInput
                        value={detail.qte_decompte}
                        onChange={(val) => updateQuantite(detail.idProduit, Number(val) || 0)}
                        min={1}
                        max={detail.qte_stock}
                        size="xs"
                        style={{ width: 70 }}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td ta="right">{detail.prix_achat.toLocaleString()} F</Table.Td>
                    <Table.Td ta="right" fw={600} c="blue">{detail.prix_vente.toLocaleString()} F</Table.Td>
                    <Table.Td ta="right" fw={700} c="green">{detail.total.toLocaleString()} F</Table.Td>
                    <Table.Td ta="center">
                      <ActionIcon color="red" onClick={() => removeProduit(detail.idProduit)} size="sm" variant="subtle">
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          <Divider my="sm" />

          {/* Résumé */}
          <Flex justify="space-between" align="center" wrap="wrap" gap="xs">
            <Group gap="xs">
              <Badge size="sm" variant="light" color="blue">Total Vente: {totalVente.toLocaleString()} F</Badge>
              <Badge size="sm" variant="light" color="green">Bénéfice: {totalBenefice.toLocaleString()} F</Badge>
              <Badge size="sm" variant="light" color="orange">Commission: {totalCommission.toLocaleString()} F</Badge>
              <Badge size="sm" variant="filled" color="green">Net: {montantNet.toLocaleString()} F</Badge>
            </Group>
          </Flex>
        </Card>
      )}

      {/* Observation */}
      <Card withBorder radius="lg" shadow="sm" p="lg">
        <TextInput
          label="Observation"
          placeholder="Ajouter une observation (optionnel)"
          value={observation}
          onChange={(e) => setObservation(e.currentTarget.value)}
        />
      </Card>

      {/* Boutons d'action */}
      <Group justify="flex-end" gap="sm">
        <Button
          variant="light"
          onClick={() => {
            if (onCancel) onCancel();
            else navigate('/decomptes');
          }}
          disabled={saving}
        >
          Annuler
        </Button>
        <Button
          color="green"
          leftSection={<IconReceipt size={16} />}
          onClick={handleSubmit}
          loading={saving}
          disabled={details.length === 0 || !selectedClientId}
        >
          {isEditMode ? 'Modifier' : 'Créer'} le décompte
        </Button>
      </Group>
    </Stack>
  );
}