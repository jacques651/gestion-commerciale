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
    commission_pourcentage: number;
    prix_moyen_pondere?: number;
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
  const [margeFixe, setMargeFixe] = useState<number>(produit?.commission_pourcentage || 5000);
  const [dateEntree, setDateEntree] = useState<string>(new Date().toISOString().split('T')[0]);
  const [referenceFacture, setReferenceFacture] = useState('');
  const [notes, setNotes] = useState('');

  const prixVenteCalcule = prixAchat + margeFixe;

  React.useEffect(() => {
    if (opened && produit) {
      setQuantite(1);
      setPrixAchat(0);
      setMargeFixe(produit.commission_pourcentage || 5000);
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
        header: { backgroundColor: '#1b365d', padding: '12px 16px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
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
          <Text c="dimmed">PMP actuel: <Text span fw={600}>{produit.prix_achat_base.toLocaleString()} F</Text></Text>
          <Text c="dimmed">Marge: <Text span fw={600}>+{margeFixe.toLocaleString()} F</Text></Text>
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

        {/* Prix de vente calculé */}
        {prixAchat > 0 && (
          <Alert color="green" variant="light" p="xs" radius="md">
            <Flex justify="space-between" align="center">
              <Group gap={4}>
                <IconShoppingCart size={14} color="#2e7d32" />
                <Text size="sm" fw={500}>Prix vente détail:</Text>
              </Group>
              <Text fw={700} size="md" c="blue">{prixVenteCalcule.toLocaleString()} F</Text>
            </Flex>
          </Alert>
        )}

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

        <Divider my={4} />

        {/* Boutons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="outline" onClick={onClose} size="sm" leftSection={<IconX size={14} />}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} loading={loading} color="green" size="sm" leftSection={<IconCheck size={14} />}>
            Ajouter
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default ModalAjoutStock;