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
  Text,
  Divider,
  Tooltip,
  ActionIcon,
  Grid} from '@mantine/core';
import {
  IconPackage,
  IconCategory,
  IconTag,
  IconScale,
  IconBuildingStore,
  IconShoppingCart,
  IconPlus,
  IconCash,
  IconChartBar
} from '@tabler/icons-react';
import { useProducts } from '../../hooks/useProducts';

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

  const methodesGestion = ['PMP', 'FIFO', 'LIFO', 'Date de péremption'];

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

  return { categories, unites, methodesGestion, addCategory, addUnite };
};

export const FormulaireProduit: React.FC<FormulaireProduitProps> = ({ opened, onClose, editProduct }) => {
  const { createProduct, updateProduct } = useProducts();
  const { categories, unites, methodesGestion, addCategory, addUnite } = useDynamicOptions();
  const [loading, setLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newUnite, setNewUnite] = useState('');
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [uniteModalOpen, setUniteModalOpen] = useState(false);
  
  const [formData, setFormData] = useState<any>({
    code_produit: '',
    designation: '',
    categorie: '',
    unite_base: 'pièce',
    prix_achat_base: 0,
    prix_vente_detail: 0,
    prix_vente_gros: 0,
    qte_stock: 0,
    seuil_alerte: 10,
    prix_moyen_pondere: 0,
    methode_gestion_stock: 'PMP'
  });

  // 🔥 Générer automatiquement le code produit au format PROD-XXXX
  useEffect(() => {
    const generateCode = async () => {
      if (!editProduct && !formData.code_produit && opened) {
        setGeneratingCode(true);
        try {
          const code = await getNextProductCode();
          setFormData((prev: any) => ({ ...prev, code_produit: code }));
        } catch (error) {
          console.error('Erreur génération code:', error);
          setFormData((prev: any) => ({ ...prev, code_produit: `PROD-${Date.now().toString().slice(-4)}` }));
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
        designation: editProduct.designation || '',
        categorie: editProduct.categorie || '',
        unite_base: editProduct.unite_base || 'pièce',
        prix_achat_base: editProduct.prix_achat_base || 0,
        prix_vente_detail: editProduct.prix_vente_detail || 0,
        prix_vente_gros: editProduct.prix_vente_gros || 0,
        qte_stock: editProduct.qte_stock || 0,
        seuil_alerte: editProduct.seuil_alerte || 10,
        prix_moyen_pondere: editProduct.prix_moyen_pondere || 0,
        methode_gestion_stock: editProduct.methode_gestion_stock || 'PMP'
      });
    } else if (opened) {
      setFormData({
        code_produit: '',
        designation: '',
        categorie: '',
        unite_base: 'pièce',
        prix_achat_base: 0,
        prix_vente_detail: 0,
        prix_vente_gros: 0,
        qte_stock: 0,
        seuil_alerte: 10,
        prix_moyen_pondere: 0,
        methode_gestion_stock: 'PMP'
      });
    }
  }, [editProduct, opened]);

  // Calcul des marges pour affichage
  const margeUnitaire = (formData.prix_vente_detail || 0) - (formData.prix_achat_base || 0);
  const margePourcentage = (formData.prix_achat_base || 0) > 0 
    ? (margeUnitaire / (formData.prix_achat_base || 0)) * 100 
    : 0;

  const margeGrosUnitaire = (formData.prix_vente_gros || 0) - (formData.prix_achat_base || 0);
  const margeGrosPourcentage = (formData.prix_achat_base || 0) > 0 
    ? (margeGrosUnitaire / (formData.prix_achat_base || 0)) * 100 
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
        size="xl"
        padding="md"
        centered
        radius="lg"
        styles={{
          header: { 
            backgroundColor: '#1a1a2e', 
            padding: '14px 24px', 
            borderTopLeftRadius: '12px', 
            borderTopRightRadius: '12px' 
          },
          title: { color: 'white', fontWeight: 700, width: '100%' },
          body: { padding: '20px 24px' }
        }}
        title={
          <Group justify="space-between" style={{ width: '100%' }}>
            <Group gap="sm">
              <IconPackage size={24} color="white" />
              <div>
                <Text fw={700} size="lg" c="white">
                  {editProduct ? 'Modifier le produit' : 'Nouveau produit'}
                </Text>
                <Text size="xs" opacity={0.7} c="white">
                  {editProduct ? 'Modifiez les informations du produit' : 'Créez un nouveau produit dans le catalogue'}
                </Text>
              </div>
            </Group>
            <TextInput
              label="Code produit"
              value={formData.code_produit}
              readOnly
              disabled
              size="sm"
              leftSection={<IconTag size={14} />}
              styles={{ 
                input: { 
                  backgroundColor: 'rgba(255,255,255,0.15)', 
                  fontFamily: 'monospace',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.2)',
                  width: '160px',
                  fontSize: '14px'
                },
                label: { color: 'rgba(255,255,255,0.7)', fontSize: '12px' }
              }}
              description="Format: PROD-XXXX"
            />
          </Group>
        }
      >
        <LoadingOverlay visible={generatingCode} />
        
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            {/* Ligne 1: Catégorie + Désignation + Unité */}
            <Grid align="flex-end">
              <Grid.Col span={4}>
                <Group align="flex-end" gap="xs">
                  <Select
                    label="Catégorie"
                    placeholder="Sélectionner"
                    data={categories}
                    value={formData.categorie}
                    onChange={(value) => setFormData({ ...formData, categorie: value || '' })}
                    size="sm"
                    searchable
                    leftSection={<IconCategory size={16} />}
                    style={{ flex: 1 }}
                  />
                  <Tooltip label="Nouvelle catégorie">
                    <ActionIcon size="md" variant="light" onClick={() => setCategoryModalOpen(true)} style={{ marginBottom: 2 }}>
                      <IconPlus size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Grid.Col>
              <Grid.Col span={5}>
                <TextInput
                  label="Désignation"
                  placeholder="Nom du produit"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  required
                  size="sm"
                  leftSection={<IconPackage size={16} />}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <Group align="flex-end" gap="xs">
                  <Select
                    label="Unité de base"
                    data={unites}
                    value={formData.unite_base}
                    onChange={(value) => setFormData({ ...formData, unite_base: value || 'pièce' })}
                    size="sm"
                    leftSection={<IconScale size={16} />}
                    style={{ flex: 1 }}
                  />
                  <Tooltip label="Nouvelle unité">
                    <ActionIcon size="md" variant="light" onClick={() => setUniteModalOpen(true)} style={{ marginBottom: 2 }}>
                      <IconPlus size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Grid.Col>
            </Grid>

            {/* Ligne 2: Stock + Seuil + Méthode */}
            <Grid>
              <Grid.Col span={4}>
                <NumberInput
                  label="Quantité en stock"
                  value={formData.qte_stock}
                  onChange={(value) => setFormData({ ...formData, qte_stock: Number(value) || 0 })}
                  min={0}
                  size="sm"
                  leftSection={<IconBuildingStore size={16} />}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <NumberInput
                  label="Seuil d'alerte"
                  value={formData.seuil_alerte}
                  onChange={(value) => setFormData({ ...formData, seuil_alerte: Number(value) || 0 })}
                  min={0}
                  size="sm"
                  leftSection={<IconChartBar size={16} />}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Select
                  label="Méthode de gestion"
                  data={methodesGestion}
                  value={formData.methode_gestion_stock}
                  onChange={(value) => setFormData({ ...formData, methode_gestion_stock: value || 'PMP' })}
                  size="sm"
                  leftSection={<IconChartBar size={16} />}
                />
              </Grid.Col>
            </Grid>

            <Divider size="xs" />

            {/* Ligne 3: Prix */}
            <Grid>
              <Grid.Col span={3}>
                <NumberInput
                  label="Prix d'achat (FCFA)"
                  value={formData.prix_achat_base}
                  onChange={(value) => setFormData({ ...formData, prix_achat_base: Number(value) || 0 })}
                  min={0}
                  step={100}
                  size="sm"
                  leftSection={<IconCash size={16} />}
                  required
                  styles={{ input: { backgroundColor: '#f5f5f5' } }}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <NumberInput
                  label="Prix vente détail (FCFA)"
                  value={formData.prix_vente_detail}
                  onChange={(value) => setFormData({ ...formData, prix_vente_detail: Number(value) || 0 })}
                  min={0}
                  step={100}
                  size="sm"
                  leftSection={<IconShoppingCart size={16} />}
                  required
                  styles={{ input: { fontWeight: 600, color: '#2e7d32' } }}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <NumberInput
                  label="Prix vente gros (FCFA)"
                  value={formData.prix_vente_gros}
                  onChange={(value) => setFormData({ ...formData, prix_vente_gros: Number(value) || 0 })}
                  min={0}
                  step={100}
                  size="sm"
                  leftSection={<IconBuildingStore size={16} />}
                  required
                  styles={{ input: { fontWeight: 600, color: '#1565c0' } }}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <NumberInput
                  label="Prix moyen pondéré"
                  value={formData.prix_moyen_pondere}
                  onChange={(value) => setFormData({ ...formData, prix_moyen_pondere: Number(value) || 0 })}
                  min={0}
                  size="sm"
                  leftSection={<IconCash size={16} />}
                  disabled
                  styles={{ input: { backgroundColor: '#f5f5f5', fontWeight: 500 } }}
                />
              </Grid.Col>
            </Grid>

            {/* Marges calculées */}
            {(formData.prix_achat_base || 0) > 0 && (
              <Grid mt={4}>
                <Grid.Col span={6}>
                  <Card p="xs" withBorder shadow="none" bg="green.0" style={{ padding: '8px 14px' }}>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed" fw={600}>Marge détail</Text>
                      <Group gap="md">
                        <Text size="md" fw={700} c={margeUnitaire >= 0 ? 'green' : 'red'}>
                          {margeUnitaire.toLocaleString()} FCFA
                        </Text>
                        <Text size="sm" fw={600} c={margePourcentage >= 0 ? 'green' : 'red'}>
                          ({margePourcentage.toFixed(1)}%)
                        </Text>
                      </Group>
                    </Group>
                  </Card>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Card p="xs" withBorder shadow="none" bg="blue.0" style={{ padding: '8px 14px' }}>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed" fw={600}>Marge gros</Text>
                      <Group gap="md">
                        <Text size="md" fw={700} c={margeGrosUnitaire >= 0 ? 'green' : 'red'}>
                          {margeGrosUnitaire.toLocaleString()} FCFA
                        </Text>
                        <Text size="sm" fw={600} c={margeGrosPourcentage >= 0 ? 'green' : 'red'}>
                          ({margeGrosPourcentage.toFixed(1)}%)
                        </Text>
                      </Group>
                    </Group>
                  </Card>
                </Grid.Col>
              </Grid>
            )}

            <Divider size="xs" />

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