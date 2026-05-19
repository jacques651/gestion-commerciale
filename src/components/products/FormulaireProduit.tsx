// src/components/products/FormulaireProduit.tsx
import React, { useState, useEffect } from 'react';
import { Modal, TextInput, NumberInput, Select, Button, Group, Stack, LoadingOverlay, Card, SimpleGrid } from '@mantine/core';
import { useProducts } from '../../hooks/useProducts';
import { CreateProductInput } from '../../database/repositories/productRepository';
import { getNextProductCode } from '../../services/codeGeneratorService';

interface FormulaireProduitProps {
  opened: boolean;
  onClose: () => void;
  editProduct?: any;
}

export const FormulaireProduit: React.FC<FormulaireProduitProps> = ({ opened, onClose, editProduct }) => {
  const { createProduct, updateProduct } = useProducts();
  const [loading, setLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  
  const [formData, setFormData] = useState<CreateProductInput>({
    code_produit: '',
    categorie: '',
    designation: '',
    unite_base: 'pièce',
    prix_achat_base: 0,
    prix_vente_detail: 0,
    prix_vente_gros: 0,
    seuil_alerte: 0,
    commission_pourcentage: 0,
    qte_stock: 0,
  });

  useEffect(() => {
    const generateCode = async () => {
      if (!editProduct && !formData.code_produit && opened) {
        setGeneratingCode(true);
        try {
          const code = await getNextProductCode();
          setFormData(prev => ({ ...prev, code_produit: code }));
        } catch (error) {
          console.error('Erreur génération code:', error);
        } finally {
          setGeneratingCode(false);
        }
      }
    };
    generateCode();
  }, [editProduct, opened, formData.code_produit]);

  useEffect(() => {
    if (editProduct) {
      setFormData({
        code_produit: editProduct.code_produit || '',
        categorie: editProduct.categorie || '',
        designation: editProduct.designation || '',
        unite_base: editProduct.unite_base || 'pièce',
        prix_achat_base: editProduct.prix_achat_base || 0,
        prix_vente_detail: editProduct.prix_vente_detail || 0,
        prix_vente_gros: editProduct.prix_vente_gros || 0,
        seuil_alerte: editProduct.seuil_alerte || 0,
        commission_pourcentage: editProduct.commission_pourcentage || 0,
        qte_stock: editProduct.qte_stock || 0,
      });
    } else if (opened) {
      setFormData({
        code_produit: '',
        categorie: '',
        designation: '',
        unite_base: 'pièce',
        prix_achat_base: 0,
        prix_vente_detail: 0,
        prix_vente_gros: 0,
        seuil_alerte: 0,
        commission_pourcentage: 0,
        qte_stock: 0,
      });
    }
  }, [editProduct, opened]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (editProduct) {
        await updateProduct(editProduct.idProduit, formData);
      } else {
        await createProduct(formData);
      }
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    'Téléphone Simple', 'Smartphone', 'Accessoire', 'Informatique',
    'Électronique', 'Bureau', 'Quincaillerie', 'Outillage',
    'Consommable', 'Textile', 'Alimentaire', 'Autre'
  ];

  const unites = ['pièce', 'kg', 'litre', 'mètre', 'boîte', 'carton', 'lot', 'paire'];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editProduct ? 'Modifier le produit' : 'Nouveau produit'}
      size="md"
      padding="md"
    >
      <LoadingOverlay visible={generatingCode} />
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <Card withBorder p="sm" radius="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Code produit"
                placeholder="Généré automatiquement"
                value={formData.code_produit}
                readOnly
                disabled
                size="sm"
                styles={{ input: { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } }}
                required
              />
              <Select
                label="Catégorie"
                placeholder="Sélectionnez"
                data={categories}
                value={formData.categorie}
                onChange={(value) => setFormData({ ...formData, categorie: value || '' })}
                required
                size="sm"
                searchable
              />
            </SimpleGrid>

            <TextInput
              label="Désignation"
              placeholder="Nom du produit"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              required
              size="sm"
              mt="sm"
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt="xs">
              <Select
                label="Unité"
                data={unites}
                value={formData.unite_base}
                onChange={(value) => setFormData({ ...formData, unite_base: value || 'pièce' })}
                size="sm"
              />
              <NumberInput
                label="Stock initial"
                placeholder="0"
                value={formData.qte_stock}
                onChange={(value) => setFormData({ ...formData, qte_stock: Number(value) || 0 })}
                min={0}
                size="sm"
              />
            </SimpleGrid>
          </Card>

          <Card withBorder p="sm" radius="md">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <NumberInput
                label="Prix d'achat"
                placeholder="0"
                value={formData.prix_achat_base}
                onChange={(value) => setFormData({ ...formData, prix_achat_base: Number(value) || 0 })}
                min={0}
                step={100}
                size="sm"
              />
              <NumberInput
                label="Prix vente détail"
                placeholder="0"
                value={formData.prix_vente_detail}
                onChange={(value) => setFormData({ ...formData, prix_vente_detail: Number(value) || 0 })}
                min={0}
                step={100}
                size="sm"
                required
              />
              <NumberInput
                label="Prix vente gros"
                placeholder="0"
                value={formData.prix_vente_gros}
                onChange={(value) => setFormData({ ...formData, prix_vente_gros: Number(value) || 0 })}
                min={0}
                step={100}
                size="sm"
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt="xs">
              <NumberInput
                label="Seuil d'alerte"
                placeholder="0"
                value={formData.seuil_alerte}
                onChange={(value) => setFormData({ ...formData, seuil_alerte: Number(value) || 0 })}
                min={0}
                size="sm"
              />
              <NumberInput
                label="Commission (%)"
                placeholder="0"
                value={formData.commission_pourcentage}
                onChange={(value) => setFormData({ ...formData, commission_pourcentage: Number(value) || 0 })}
                min={0}
                max={100}
                step={1}
                size="sm"
              />
            </SimpleGrid>
          </Card>
          
          <Group justify="flex-end" mt="sm">
            <Button variant="outline" onClick={onClose} size="sm">
              Annuler
            </Button>
            <Button type="submit" loading={loading} size="sm">
              {editProduct ? 'Modifier' : 'Créer'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};