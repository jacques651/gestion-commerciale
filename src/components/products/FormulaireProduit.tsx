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
  ThemeIcon,
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
  IconAlertCircle,
  IconRefresh,
  IconInfoCircle,
  IconPlus,
  IconCoin,
  IconCash
} from '@tabler/icons-react';
import { useProducts } from '../../hooks/useProducts';
import { CreateProductInput } from '../../database/repositories/productRepository';
import { getNextProductCode } from '../../services/codeGeneratorService';

interface FormulaireProduitProps {
  opened: boolean;
  onClose: () => void;
  editProduct?: any;
}

// Gestionnaire de catégories et unités
const useDynamicOptions = () => {
  const [categories, setCategories] = useState<string[]>([
    'Téléphone Simple', 'Smartphone', 'Accessoire', 'Informatique',
    'Électronique', 'Bureau', 'Quincaillerie', 'Outillage',
    'Consommable', 'Textile', 'Alimentaire', 'Autre'
  ]);
  
  const [unites, setUnites] = useState<string[]>([
    'pièce', 'kg', 'litre', 'mètre', 'boîte', 'carton', 'lot', 'paire'
  ]);

  // Charger depuis localStorage
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

  // Calcul automatique du prix de vente détail (Prix achat + Marge fixe)
  const prixVenteCalcule = formData.prix_achat_base + formData.commission_pourcentage;
  const prixGrosCalcule = Math.round(prixVenteCalcule * 0.9);

  // Mettre à jour automatiquement les prix quand prix achat ou marge change
  useEffect(() => {
    if (!editProduct) {
      setFormData(prev => ({
        ...prev,
        prix_vente_detail: prixVenteCalcule,
        prix_vente_gros: prixGrosCalcule
      }));
    }
  }, [formData.prix_achat_base, formData.commission_pourcentage]);

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
        title={
          <Group gap="sm">
            <IconPackage size={24} color="#228be6" />
            <div>
              <Text fw={700} size="lg">{editProduct ? 'Modifier le produit' : 'Nouveau produit'}</Text>
              <Text size="xs" c="dimmed">
                {editProduct ? 'Modifiez les informations du produit' : 'Créez un nouveau produit dans le catalogue'}
              </Text>
            </div>
          </Group>
        }
        size="lg"
        padding="md"
        centered
        radius="lg"
      >
        <LoadingOverlay visible={generatingCode} />
        
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {/* Section Informations générales */}
            <Card withBorder radius="md" p="md" shadow="sm">
              <Group gap="xs" mb="md">
                <ThemeIcon size="sm" radius="xl" color="blue" variant="light">
                  <IconInfoCircle size={14} />
                </ThemeIcon>
                <Text fw={600} size="sm">Informations générales</Text>
              </Group>
              
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                  label="Code produit"
                  placeholder="Généré automatiquement"
                  value={formData.code_produit}
                  readOnly
                  disabled
                  size="md"
                  leftSection={<IconTag size={16} />}
                  styles={{ input: { backgroundColor: '#f5f5f5', fontFamily: 'monospace', fontWeight: 600 } }}
                  required
                />
                <Group align="flex-end" gap="xs">
                  <Select
                    label="Catégorie"
                    placeholder="Sélectionnez une catégorie"
                    data={categories}
                    value={formData.categorie}
                    onChange={(value) => setFormData({ ...formData, categorie: value || '' })}
                    required
                    size="md"
                    searchable
                    leftSection={<IconCategory size={16} />}
                    style={{ flex: 1 }}
                  />
                  <Tooltip label="Nouvelle catégorie">
                    <ActionIcon 
                      size="md" 
                      variant="light" 
                      color="blue" 
                      mt={22}
                      onClick={() => setCategoryModalOpen(true)}
                    >
                      <IconPlus size={16} />
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
                size="md"
                mt="md"
                leftSection={<IconPackage size={16} />}
              />

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
                <Group align="flex-end" gap="xs">
                  <Select
                    label="Unité de mesure"
                    data={unites}
                    value={formData.unite_base}
                    onChange={(value) => setFormData({ ...formData, unite_base: value || 'pièce' })}
                    size="md"
                    leftSection={<IconScale size={16} />}
                    style={{ flex: 1 }}
                  />
                  <Tooltip label="Nouvelle unité">
                    <ActionIcon 
                      size="md" 
                      variant="light" 
                      color="blue" 
                      mt={22}
                      onClick={() => setUniteModalOpen(true)}
                    >
                      <IconPlus size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <NumberInput
                  label="Stock initial"
                  description="Quantité initiale en stock"
                  placeholder="0"
                  value={formData.qte_stock}
                  onChange={(value) => setFormData({ ...formData, qte_stock: Number(value) || 0 })}
                  min={0}
                  size="md"
                  leftSection={<IconBuildingStore size={16} />}
                />
              </SimpleGrid>
            </Card>

            {/* Section Prix et Marges */}
            <Card withBorder radius="md" p="md" shadow="sm">
              <Group gap="xs" mb="md">
                <ThemeIcon size="sm" radius="xl" color="green" variant="light">
                  <IconShoppingCart size={14} />
                </ThemeIcon>
                <Text fw={600} size="sm">Prix et marges</Text>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <NumberInput
                  label="💰 Prix d'achat (F CFA)"
                  placeholder="0"
                  value={formData.prix_achat_base}
                  onChange={(value) => setFormData({ ...formData, prix_achat_base: Number(value) || 0 })}
                  min={0}
                  step={100}
                  size="md"
                  leftSection={<IconCash size={16} />}
                  required
                />
                <NumberInput
                  label="📈 Marge fixe (F CFA)"
                  description="Sera ajoutée au prix d'achat"
                  value={formData.commission_pourcentage}
                  onChange={(value) => setFormData({ ...formData, commission_pourcentage: Number(value) || 0 })}
                  min={0}
                  step={100}
                  size="md"
                  leftSection={<IconCoin size={16} />}
                />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
                <NumberInput
                  label="💵 Prix vente détail (F CFA)"
                  value={prixVenteCalcule}
                  readOnly
                  size="md"
                  leftSection={<IconShoppingCart size={16} />}
                  styles={{ input: { backgroundColor: '#f0f9f0', fontWeight: 600, color: '#228be6' } }}
                />
                <NumberInput
                  label="🏪 Prix vente gros (F CFA)"
                  value={prixGrosCalcule}
                  readOnly
                  size="md"
                  leftSection={<IconBuildingStore size={16} />}
                  styles={{ input: { backgroundColor: '#f5f5f5', fontWeight: 500 } }}
                />
              </SimpleGrid>

              {/* Affichage de la marge */}
              {formData.prix_achat_base > 0 && (
                <Card withBorder radius="md" mt="md" p="xs" bg={margeUnitaire > 0 ? 'green.0' : 'red.0'}>
                  <SimpleGrid cols={3} spacing="md">
                    <div>
                      <Text size="xs" c="dimmed">Marge unitaire</Text>
                      <Text fw={700} size="sm" c={margeUnitaire > 0 ? 'green' : 'red'}>
                        {margeUnitaire > 0 ? '+' : ''}{margeUnitaire.toLocaleString()} F
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Marge (%)</Text>
                      <Text fw={700} size="sm" c={margePourcentage > 0 ? 'green' : 'red'}>
                        {margePourcentage.toFixed(1)}%
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Marge fixe</Text>
                      <Text fw={700} size="sm" c="blue">
                        {formData.commission_pourcentage?.toLocaleString()} F
                      </Text>
                    </div>
                  </SimpleGrid>
                </Card>
              )}

              <NumberInput
                label="⚠️ Seuil d'alerte stock"
                description="Alerte quand stock en dessous"
                placeholder="10"
                value={formData.seuil_alerte}
                onChange={(value) => setFormData({ ...formData, seuil_alerte: Number(value) || 0 })}
                min={0}
                size="md"
                mt="md"
                leftSection={<IconAlertCircle size={16} />}
              />
            </Card>

            {/* Note explicative */}
            <Card withBorder radius="md" p="xs" bg="blue.0">
              <Group gap="xs">
                <IconInfoCircle size={16} color="#228be6" />
                <Text size="xs" c="dimmed">
                  💡 <strong>Prix vente = Prix achat + Marge fixe</strong> (calcul automatique)
                </Text>
              </Group>
            </Card>

            {/* Boutons d'action */}
            <Divider />
            
            <Group justify="flex-end" gap="sm">
              <Button 
                variant="outline" 
                onClick={onClose} 
                size="md"
                leftSection={<IconRefresh size={16} />}
              >
                Annuler
              </Button>
              <Button 
                type="submit" 
                loading={loading} 
                size="md"
                color={editProduct ? 'blue' : 'green'}
                leftSection={<IconPackage size={16} />}
              >
                {editProduct ? 'Mettre à jour' : 'Créer le produit'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal d'ajout de catégorie */}
      <Modal
        opened={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="Nouvelle catégorie"
        size="sm"
        centered
        padding="md"
      >
        <Stack>
          <TextInput
            label="Nom de la catégorie"
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

      {/* Modal d'ajout d'unité */}
      <Modal
        opened={uniteModalOpen}
        onClose={() => setUniteModalOpen(false)}
        title="Nouvelle unité"
        size="sm"
        centered
        padding="md"
      >
        <Stack>
          <TextInput
            label="Nom de l'unité"
            placeholder="Ex: douzaine, centaine"
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