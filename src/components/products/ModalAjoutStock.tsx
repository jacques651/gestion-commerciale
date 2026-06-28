// src/components/products/ModalAjoutStock.tsx
import React, { useState } from 'react';
import {
  Modal,
  TextInput,
  Button,
  Group,
  Stack,
  NumberInput,
  Text,
  Alert,
  LoadingOverlay,
  SimpleGrid,
  Flex,
  Divider
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconX,
  IconReceipt,
  IconCoin,
  IconPackage,
  IconCash,
  IconCalendar,
  IconShoppingCart
} from '@tabler/icons-react';
import { stockService } from '../../database/repositories/stockService';

interface ModalAjoutStockProps {
  opened: boolean;
  onClose: () => void;
  produit: {
    idProduit: number;
    code_produit: string;
    designation: string;
    unite_base: string;
    qte_stock: number;
    prix_achat_base: number;
    prix_vente_detail: number;
    commission_pourcentage?: number;
    prix_moyen_pondere?: number;
    [key: string]: any;
  } | null;
  onSuccess: () => void;
}

export const ModalAjoutStock: React.FC<ModalAjoutStockProps> = ({
  opened,
  onClose,
  produit,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [quantite, setQuantite] = useState<number>(1);
  const [prixAchat, setPrixAchat] = useState<number>(0);
  // Initialiser la marge depuis prix_vente_detail - prix_achat_base (marge réelle du produit)
  const getMargeInitiale = (p: typeof produit) => {
    if (!p) return 0;
    const margeReelle = (p.prix_vente_detail || 0) - (p.prix_achat_base || 0);
    return margeReelle > 0 ? margeReelle : 0;
  };
  const [margeFixe, setMargeFixe] = useState<number>(getMargeInitiale(produit));
  const [dateEntree, setDateEntree] = useState<string>(new Date().toISOString().split('T')[0]);
  const [referenceFacture, setReferenceFacture] = useState('');
  const [notes, setNotes] = useState('');

  const prixVenteCalcule = prixAchat > 0 ? prixAchat + margeFixe : (produit?.prix_vente_detail || 0);

  React.useEffect(() => {
    if (opened && produit) {
      setQuantite(1);
      setPrixAchat(produit.prix_achat_base || 0);
      setMargeFixe(getMargeInitiale(produit));
      setDateEntree(new Date().toISOString().split('T')[0]);
      setReferenceFacture('');
      setNotes('');
    }
  }, [opened, produit]);

  const handleSubmit = async () => {
    if (!produit) return;

    if (quantite <= 0) {
      notifications.show({ title: 'Erreur', message: 'Quantité invalide', color: 'red' });
      return;
    }

    if (prixAchat <= 0) {
      notifications.show({ title: 'Erreur', message: 'Prix d\'achat invalide', color: 'red' });
      return;
    }

    setLoading(true);

    try {
      const result = await stockService.entreeStock({
        idProduit: produit.idProduit,
        quantite: quantite,
        prix_achat: prixAchat,
        marge_fixe: margeFixe,
        date_entree: dateEntree,
        reference_facture: referenceFacture || undefined,
        notes: notes || undefined,
        prix_vente: 0
      });

      if (result.success) {
        notifications.show({
          title: '✅ Stock ajouté',
          message: `${quantite} ${produit.unite_base} | PV: ${prixVenteCalcule.toLocaleString()} F`,
          color: 'green'
        });
        onSuccess();
        onClose();
      } else {
        notifications.show({ title: 'Erreur', message: result.message, color: 'red' });
      }
    } catch (error) {
      notifications.show({ 
        title: 'Erreur', 
        message: error instanceof Error ? error.message : 'Erreur', 
        color: 'red' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (!produit) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="md"
      padding="md"
      centered
      radius="lg"
      styles={{
        header: { backgroundColor: '#1a1a2e', padding: '12px 16px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
        title: { color: 'white', fontWeight: 600 },
        body: { padding: '16px' }
      }}
      title={
        <Group gap="xs">
          <IconPackage size={18} color="white" />
          <div>
            <Text fw={600} size="sm" c="white">Ajouter du stock</Text>
            <Text size="xs" opacity={0.7} c="white">{produit.code_produit} - {produit.designation}</Text>
          </div>
        </Group>
      }
    >
      <LoadingOverlay visible={loading} />
      
      <Stack gap="sm">
        {/* Infos stock actuelles */}
        <Flex justify="space-between" wrap="wrap" gap="xs" style={{ fontSize: '11px' }}>
          <Text c="dimmed">Stock actuel: <Text span fw={600}>{produit.qte_stock} {produit.unite_base}</Text></Text>
          <Text c="dimmed">PA (PMP): <Text span fw={600}>{produit.prix_achat_base.toLocaleString()} F</Text></Text>
          <Text c="dimmed">PV actuel: <Text span fw={600}>{produit.prix_vente_detail.toLocaleString()} F</Text></Text>
        </Flex>

        <Divider my={4} />

        {/* Quantité et Prix achat */}
        <SimpleGrid cols={2} spacing="sm">
          <NumberInput
            label="Quantité"
            value={quantite}
            onChange={(val) => setQuantite(typeof val === 'number' ? val : 0)}
            min={1}
            size="sm"
            placeholder="Qté"
            leftSection={<IconPackage size={14} />}
          />
          <NumberInput
            label="Prix achat (FCFA)"
            value={prixAchat}
            onChange={(val) => setPrixAchat(typeof val === 'number' ? val : 0)}
            min={0}
            step={100}
            size="sm"
            placeholder="Prix achat"
            leftSection={<IconCash size={14} />}
          />
        </SimpleGrid>

        {/* Marge et Date */}
        <SimpleGrid cols={2} spacing="sm">
          <NumberInput
            label="Marge fixe (FCFA)"
            value={margeFixe}
            onChange={(val) => setMargeFixe(typeof val === 'number' ? val : 0)}
            min={0}
            step={100}
            size="sm"
            leftSection={<IconCoin size={14} />}
          />
          <TextInput
            label="Date entrée"
            type="date"
            value={dateEntree}
            onChange={(e) => setDateEntree(e.target.value)}
            size="sm"
            leftSection={<IconCalendar size={14} />}
          />
        </SimpleGrid>

        {/* Prix de vente calculé + Nouveau stock prévu */}
        <Alert color="green" variant="light" p="xs" radius="md">
          <Flex justify="space-between" align="center" wrap="wrap" gap="xs">
            <Group gap={4}>
              <IconShoppingCart size={14} color="#2e7d32" />
              <Text size="sm" fw={500}>Nouveau PV:</Text>
            </Group>
            <Text fw={700} size="md" c="blue">{prixVenteCalcule.toLocaleString()} F</Text>
            <Text size="xs" c="dimmed">Stock → {(produit.qte_stock + quantite).toLocaleString()} {produit.unite_base}</Text>
          </Flex>
        </Alert>

        {/* Facture et Notes */}
        <TextInput
          label="Facture"
          placeholder="N° de facture (optionnel)"
          value={referenceFacture}
          onChange={(e) => setReferenceFacture(e.target.value)}
          size="sm"
          leftSection={<IconReceipt size={14} />}
        />

        <TextInput
          label="Notes"
          placeholder="Optionnel"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          size="sm"
        />

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={onClose} size="sm">
            Annuler
          </Button>
          <Button onClick={handleSubmit} loading={loading} color="green" size="sm">
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default ModalAjoutStock;
