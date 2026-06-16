// src/components/products/FormulaireProduit.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  NumberInput,
  Select,
  Button,
  Group,
  Stack,
  LoadingOverlay,
  Card,
  SimpleGrid,
  Text,
  Divider,
  Tooltip,
  ActionIcon
} from '@mantine/core';
import {
  IconPackage,
  IconCategory,
  IconTag,
  IconScale,
  IconBuildingStore,
  IconShoppingCart,
  IconPlus,
  IconCoin,
  IconCash
} from '@tabler/icons-react';
import { useProducts } from '../../hooks/useProducts';
import { CreateProductInput } from '../../database/repositories/productRepository';


interface FormulaireProduitProps {
  opened: boolean;
  onClose: () => void;
  editProduct?: any;
}

const useDynamicOptions = () => {
  const [categories, setCategories] = useState<string[]>([
    'Téléphone Simple', 'Smartphone', 'Accessoire', 'Informatique',
    'Électronique', 'Bureau', 'Quincaillerie', 'Outillage',
    'Consommable', 'Textile', 'Alimentaire', 'Autre'
  ]);
  
  const [unites, setUnites] = useState<string[]>([
    'pièce', 'kg', 'litre', 'mètre', 'boîte', 'carton', 'lot', 'paire'
  ]);

  useEffect(() => {
    const savedCategories = localStorage.getItem('custom_categories');
    const savedUnites = localStorage.getItem('custom_unites');
    if (savedCategories) setCategories([...new Set([...categories, ...JSON.parse(savedCategories)])]);
    if (savedUnites) setUnites([...new Set([...unites, ...JSON.parse(savedUnites)])]);
  }, []);

  const addCategory = (newCategory: string) => {
    if (newCategory && !categories.includes(newCategory)) {
      const updated = [...categories, newCategory];
      setCategories(updated);
      localStorage.setItem('custom_categories', JSON.stringify(updated.filter(c => 
        !['Téléphone Simple', 'Smartphone', 'Accessoire', 'Informatique',
          'Électronique', 'Bureau', 'Quincaillerie', 'Outillage',
          'Consommable', 'Textile', 'Alimentaire', 'Autre'].includes(c)
      )));
      return true;
    }
    return false;
  };

  const addUnite = (newUnite: string) => {
    if (newUnite && !unites.includes(newUnite)) {
      const updated = [...unites, newUnite];
      setUnites(updated);
      localStorage.setItem('custom_unites', JSON.stringify(updated.filter(u => 
        !['pièce', 'kg', 'litre', 'mètre', 'boîte', 'carton', 'lot', 'paire'].includes(u)
      )));
      return true;
    }
    return false;
  };

  return { categories, unites, addCategory, addUnite };
};

export const FormulaireProduit: React.FC<FormulaireProduitProps> = ({ opened, onClose, editProduct }) => {
  const { createProduct, updateProduct } = useProducts();
  const { categories, unites, addCategory, addUnite } = useDynamicOptions();
  const [loading, setLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newUnite, setNewUnite] = useState('');
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [uniteModalOpen, setUniteModalOpen] = useState(false);
  
  const [formData, setFormData] = useState<CreateProductInput>({
    code_produit: '',
    categorie: '',
    designation: '',
    unite_base: 'pièce',
    prix_achat_base: 0,
    prix_vente_detail: 0,
    prix_vente_gros: 0,
    seuil_alerte: 10,
    commission_pourcentage: 5000,
    qte_stock: 0,
  });

  // 🔥 Calcul des prix de vente
  const prixVenteCalcule = formData.prix_achat_base + formData.commission_pourcentage;
  const prixGrosCalcule = Math.round(prixVenteCalcule * 0.9);

  // 🔥 Mettre à jour les prix de vente quand le prix d'achat ou la marge changent
  useEffect(() => {
    if (!editProduct) {
      setFormData(prev => ({
        ...prev,
        prix_vente_detail: prixVenteCalcule,
        prix_vente_gros: prixGrosCalcule
      }));
    }
  }, [formData.prix_achat_base, formData.commission_pourcentage]);

  // 🔥 Générer automatiquement le code produit au format PROD-XXXX
  useEffect(() => {
    const generateCode = async () => {
      if (!editProduct && !formData.code_produit && opened) {
        setGeneratingCode(true);
        try {
          const code = await getNextProductCode();
          setFormData(prev => ({ ...prev, code_produit: code }));
        } catch (error) {
          console.error('Erreur génération code:', error);
          // Fallback: utiliser un code temporaire
          setFormData(prev => ({ ...prev, code_produit: `PROD-${Date.now().toString().slice(-4)}` }));
        } finally {
          setGeneratingCode(false);
        }
      }
    };
    generateCode();
  }, [editProduct, opened, formData.code_produit]);

  // 🔥 Remplir le formulaire pour l'édition
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
        seuil_alerte: editProduct.seuil_alerte || 10,
        commission_pourcentage: editProduct.commission_pourcentage || 5000,
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
        seuil_alerte: 10,
        commission_pourcentage: 5000,
        qte_stock: 0,
      });
    }
  }, [editProduct, opened]);

  const margeUnitaire = formData.prix_vente_detail - formData.prix_achat_base;
  const margePourcentage = formData.prix_achat_base > 0 
    ? (margeUnitaire / formData.prix_achat_base) * 100 
    : 0;

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

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      addCategory(newCategory.trim());
      setFormData({ ...formData, categorie: newCategory.trim() });
      setNewCategory('');
      setCategoryModalOpen(false);
    }
  };

  const handleAddUnite = () => {
    if (newUnite.trim()) {
      addUnite(newUnite.trim());
      setFormData({ ...formData, unite_base: newUnite.trim() });
      setNewUnite('');
      setUniteModalOpen(false);
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        size="lg"
        padding="md"
        centered
        radius="lg"
        styles={{
          header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 700 },
          body: { padding: '20px' }
        }}
        title={
          <Group gap="sm">
            <IconPackage size={22} color="white" />
            <div>
              <Text fw={700} size="md" c="white">{editProduct ? 'Modifier le produit' : 'Nouveau produit'}</Text>
              <Text size="xs" opacity={0.7} c="white">
                {editProduct ? 'Modifiez les informations du produit' : 'Créez un nouveau produit dans le catalogue'}
              </Text>
            </div>
          </Group>
        }
      >
        <LoadingOverlay visible={generatingCode} />
        
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {/* Code produit et Catégorie */}
            <SimpleGrid cols={2} spacing="md">
              <TextInput
                label="Code produit"
                value={formData.code_produit}
                readOnly
                disabled
                size="sm"
                leftSection={<IconTag size={14} />}
                styles={{ input: { backgroundColor: '#f5f5f5', fontFamily: 'monospace' } }}
                description="Format: PROD-XXXX (généré automatiquement)"
              />
              <Group align="flex-end" gap="xs">
                <Select
                  label="Catégorie"
                  placeholder="Sélectionner"
                  data={categories}
                  value={formData.categorie}
                  onChange={(value) => setFormData({ ...formData, categorie: value || '' })}
                  required
                  size="sm"
                  searchable
                  leftSection={<IconCategory size={14} />}
                  style={{ flex: 1 }}
                />
                <Tooltip label="Nouvelle catégorie">
                  <ActionIcon size="sm" variant="light" mt={22} onClick={() => setCategoryModalOpen(true)}>
                    <IconPlus size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </SimpleGrid>

            <TextInput
              label="Désignation"
              placeholder="Nom du produit"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              required
              size="sm"
              leftSection={<IconPackage size={14} />}
            />

            <SimpleGrid cols={2} spacing="md">
              <Group align="flex-end" gap="xs">
                <Select
                  label="Unité"
                  data={unites}
                  value={formData.unite_base}
                  onChange={(value) => setFormData({ ...formData, unite_base: value || 'pièce' })}
                  size="sm"
                  leftSection={<IconScale size={14} />}
                  style={{ flex: 1 }}
                />
                <Tooltip label="Nouvelle unité">
                  <ActionIcon size="sm" variant="light" mt={22} onClick={() => setUniteModalOpen(true)}>
                    <IconPlus size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <NumberInput
                label="Stock initial"
                value={formData.qte_stock}
                onChange={(value) => setFormData({ ...formData, qte_stock: Number(value) || 0 })}
                min={0}
                size="sm"
                leftSection={<IconBuildingStore size={14} />}
              />
            </SimpleGrid>

            <Divider label="Prix et marges" labelPosition="center" />

            <SimpleGrid cols={2} spacing="md">
              <NumberInput
                label="Prix d'achat (FCFA)"
                value={formData.prix_achat_base}
                onChange={(value) => setFormData({ ...formData, prix_achat_base: Number(value) || 0 })}
                min={0}
                step={100}
                size="sm"
                leftSection={<IconCash size={14} />}
                required
              />
              <NumberInput
                label="Marge fixe (FCFA)"
                value={formData.commission_pourcentage}
                onChange={(value) => setFormData({ ...formData, commission_pourcentage: Number(value) || 0 })}
                min={0}
                step={100}
                size="sm"
                leftSection={<IconCoin size={14} />}
              />
            </SimpleGrid>

            <SimpleGrid cols={2} spacing="md">
              <NumberInput
                label="Prix vente détail"
                value={prixVenteCalcule}
                readOnly
                size="sm"
                leftSection={<IconShoppingCart size={14} />}
                styles={{ input: { backgroundColor: '#e8f5e9', fontWeight: 600, color: '#2e7d32' } }}
              />
              <NumberInput
                label="Prix vente gros"
                value={prixGrosCalcule}
                readOnly
                size="sm"
                leftSection={<IconBuildingStore size={14} />}
                styles={{ input: { backgroundColor: '#f5f5f5' } }}
              />
            </SimpleGrid>

            {/* Marge */}
            {formData.prix_achat_base > 0 && (
              <SimpleGrid cols={3} spacing="sm">
                <Card p="xs" withBorder>
                  <Text size="xs" c="dimmed">Marge unitaire</Text>
                  <Text fw={700} size="sm" c="green">{margeUnitaire.toLocaleString()} F</Text>
                </Card>
                <Card p="xs" withBorder>
                  <Text size="xs" c="dimmed">Marge (%)</Text>
                  <Text fw={700} size="sm">{margePourcentage.toFixed(1)}%</Text>
                </Card>
                <Card p="xs" withBorder>
                  <Text size="xs" c="dimmed">Seuil alerte</Text>
                  <NumberInput
                    size="xs"
                    value={formData.seuil_alerte}
                    onChange={(value) => setFormData({ ...formData, seuil_alerte: Number(value) || 0 })}
                    min={0}
                    hideControls
                  />
                </Card>
              </SimpleGrid>
            )}

            <Divider />

            <Group justify="flex-end" gap="sm">
              <Button variant="outline" onClick={onClose} size="sm">Annuler</Button>
              <Button type="submit" loading={loading} size="sm" color={editProduct ? 'blue' : 'green'}>
                {editProduct ? 'Mettre à jour' : 'Créer'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal nouvelle catégorie */}
      <Modal opened={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title="Nouvelle catégorie" size="sm" centered padding="md">
        <Stack>
          <TextInput
            label="Nom"
            placeholder="Ex: Électroménager"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            size="sm"
          />
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setCategoryModalOpen(false)} size="sm">Annuler</Button>
            <Button onClick={handleAddCategory} size="sm" color="green">Ajouter</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal nouvelle unité */}
      <Modal opened={uniteModalOpen} onClose={() => setUniteModalOpen(false)} title="Nouvelle unité" size="sm" centered padding="md">
        <Stack>
          <TextInput
            label="Nom"
            placeholder="Ex: douzaine"
            value={newUnite}
            onChange={(e) => setNewUnite(e.target.value)}
            size="sm"
          />
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setUniteModalOpen(false)} size="sm">Annuler</Button>
            <Button onClick={handleAddUnite} size="sm" color="green">Ajouter</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default FormulaireProduit;

async function getNextProductCode(): Promise<string> {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `PROD-${randomSuffix}`;
}
