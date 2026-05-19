// src/components/parametres/ConfigCommerce.tsx
import React, { useState, useEffect } from 'react';
import {
  Card, Title, Text, Select, Button, Stack, Group, Switch, Divider,
  Alert, LoadingOverlay, SimpleGrid, ThemeIcon, Paper, Flex, 
  Badge, Tooltip,
  ActionIcon} from '@mantine/core';
import {
  IconCheck, IconBuildingStore, IconCash, IconPackage, IconShoppingBag,
  IconReceipt, IconCreditCard, IconBuildingBank, IconPackages, IconSettings,
  IconRefresh, IconInfoCircle, IconArrowBackUp,
  IconGavel
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';

interface TypeCommerce {
  id_type_commerce: number;
  code_type: string;
  libelle: string;
  description: string;
  parametres_par_defaut: string;
  est_actif: number;
}

interface ConfigParametres {
  tva_default: number;
  devise: string;
  gestion_stock: boolean;
  gestion_commandes: boolean;
  gestion_factures: boolean;
  gestion_reglements: boolean;
  multi_magasins: boolean;
  lots_tracabilite: boolean;
  remises_auto: boolean;
}

export const ConfigCommerce: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<TypeCommerce[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [parametres, setParametres] = useState<ConfigParametres>({
    tva_default: 18,
    devise: 'FCFA',
    gestion_stock: true,
    gestion_commandes: true,
    gestion_factures: true,
    gestion_reglements: true,
    multi_magasins: false,
    lots_tracabilite: false,
    remises_auto: false,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const db = await getDb();
    
    try {
      const typesData = await db.select<any[]>(`
        SELECT * FROM config_types_commerce WHERE est_actif = 1
      `);
      setTypes(typesData as TypeCommerce[]);
      
      const currentConfig = await db.select<any[]>(`
        SELECT * FROM config_commerce WHERE id = 1
      `);
      
      if (currentConfig && currentConfig.length > 0) {
        const config = currentConfig[0];
        setSelectedType(config.id_type_commerce?.toString() || null);
        
        if (config.parametres) {
          try {
            const params = JSON.parse(config.parametres);
            setParametres(prev => ({ ...prev, ...params }));
          } catch (e) {
            console.error('Erreur parsing paramètres', e);
          }
        }
      } else if (typesData && typesData.length > 0) {
        setSelectedType(typesData[0].id_type_commerce.toString());
      }
      
      const generalConfig = await db.select<any[]>(`
        SELECT taux_tva_default, devise FROM config_generale WHERE id_config = 1
      `);
      
      if (generalConfig && generalConfig.length > 0) {
        setParametres(prev => ({
          ...prev,
          tva_default: generalConfig[0].taux_tva_default || 18,
          devise: generalConfig[0].devise || 'FCFA',
        }));
      }
      
    } catch (error) {
      console.error('Erreur chargement:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors du chargement de la configuration',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (value: string | null) => {
    if (!value) return;
    const type = types.find(t => t.id_type_commerce.toString() === value);
    if (type && type.parametres_par_defaut) {
      try {
        const params = JSON.parse(type.parametres_par_defaut);
        setParametres(prev => ({ ...prev, ...params }));
      } catch (e) {
        console.error('Erreur parsing paramètres par défaut', e);
      }
    }
    setSelectedType(value);
  };

  const handleSave = async () => {
    if (!selectedType) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez sélectionner un type de commerce',
        color: 'red',
      });
      return;
    }
    
    setSaving(true);
    const db = await getDb();
    
    try {
      await db.execute(`
        INSERT OR REPLACE INTO config_commerce (id, id_type_commerce, modules_actifs, parametres, updated_at)
        VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [parseInt(selectedType), JSON.stringify([]), JSON.stringify(parametres)]);
      
      await db.execute(`
        UPDATE config_generale SET 
          taux_tva_default = ?,
          devise = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id_config = 1
      `, [parametres.tva_default, parametres.devise]);
      
      notifications.show({
        title: 'Succès',
        message: 'Configuration sauvegardée avec succès',
        color: 'green',
      });
      
      setTimeout(() => {
        if (window.confirm('Redémarrer l\'application pour appliquer tous les changements ?')) {
          window.location.reload();
        }
      }, 1000);
      
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la sauvegarde',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const typeOptions = types.map(t => ({
    value: t.id_type_commerce.toString(),
    label: t.libelle,
    description: t.description,
  }));

  const moduleConfigs = [
    { key: 'gestion_stock', label: 'Gestion des stocks', icon: <IconPackage size={18} />, description: 'Suivi des quantités et alertes', color: 'blue' },
    { key: 'gestion_commandes', label: 'Gestion des commandes', icon: <IconShoppingBag size={18} />, description: 'Commandes clients', color: 'orange' },
    { key: 'gestion_factures', label: 'Gestion des factures', icon: <IconReceipt size={18} />, description: 'Émission de factures', color: 'teal' },
    { key: 'gestion_reglements', label: 'Gestion des règlements', icon: <IconCreditCard size={18} />, description: 'Suivi des paiements', color: 'green' },
    { key: 'multi_magasins', label: 'Multi-magasins', icon: <IconBuildingBank size={18} />, description: 'Plusieurs points de vente', color: 'violet' },
    { key: 'lots_tracabilite', label: 'Traçabilité par lots', icon: <IconPackages size={18} />, description: 'Gestion des lots', color: 'grape' },
    { key: 'remises_auto', label: 'Remises automatiques', icon: <IconArrowBackUp size={18} />, description: 'Remises selon quantité', color: 'cyan' },
  ];

  if (loading) {
    return (
      <Card withBorder p="xl" ta="center">
        <LoadingOverlay visible={true} />
        <Text>Chargement de la configuration...</Text>
      </Card>
    );
  }

  return (
    <Paper p="md" radius="lg">
      <Stack gap="lg">
        {/* EN-TÊTE */}
        <Paper
          p="xl"
          radius="lg"
          style={{
            background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Flex justify="space-between" align="center" wrap="wrap">
            <Stack gap={4}>
              <Group gap="md">
                <ThemeIcon size={50} radius="md" color="white" variant="light">
                  <IconSettings size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Configuration Commerce</Title>
                  <Text c="gray.3" size="sm">Personnalisez votre application selon votre activité</Text>
                </div>
              </Group>
            </Stack>
            <Group>
              <Tooltip label="Actualiser">
                <ActionIcon variant="light" color="white" onClick={loadConfig} size="lg">
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Flex>
        </Paper>

        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Stack gap="xl">
            {/* Type de commerce */}
            <div>
              <Group gap="xs" mb="md">
                <IconBuildingStore size={20} color="#1b365d" />
                <Title order={3} size="h4">Type d'activité</Title>
                <Badge size="sm" variant="light" color="blue">Étape 1</Badge>
              </Group>
              <Text size="sm" c="dimmed" mb="md">
                Choisissez le type de commerce qui correspond à votre activité.
                Les paramètres seront automatiquement adaptés.
              </Text>
              
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                {typeOptions.map((type) => (
                  <Card
                    key={type.value}
                    withBorder
                    p="md"
                    radius="md"
                    style={{
                      cursor: 'pointer',
                      border: selectedType === type.value ? '2px solid #1b365d' : '1px solid #e5e7eb',
                      backgroundColor: selectedType === type.value ? '#eef3f9' : 'white',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => handleTypeChange(type.value)}
                  >
                    <Group gap="sm">
                      <ThemeIcon 
                        color={selectedType === type.value ? 'adminBlue' : 'gray'} 
                        variant="light" 
                        size="lg"
                      >
                        <IconBuildingStore size={18} />
                      </ThemeIcon>
                      <div style={{ flex: 1 }}>
                        <Text fw={600} size="sm">{type.label}</Text>
                        <Text size="xs" c="dimmed">{type.description}</Text>
                      </div>
                      {selectedType === type.value && (
                        <ThemeIcon color="green" size="sm" radius="xl">
                          <IconCheck size={12} />
                        </ThemeIcon>
                      )}
                    </Group>
                  </Card>
                ))}
              </SimpleGrid>
            </div>

            <Divider />

            {/* Paramètres généraux */}
            <div>
              <Group gap="xs" mb="md">
                <IconCash size={20} color="#1b365d" />
                <Title order={3} size="h4">Paramètres généraux</Title>
                <Badge size="sm" variant="light" color="green">Étape 2</Badge>
              </Group>
              
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Select
                  label="TVA par défaut"
                  description="Taux de TVA appliqué par défaut"
                  value={parametres.tva_default?.toString()}
                  onChange={(val) => setParametres(prev => ({ ...prev, tva_default: parseInt(val || '18') }))}
                  data={[
                    { value: '0', label: '0% (Exonéré)' },
                    { value: '5', label: '5%' },
                    { value: '10', label: '10%' },
                    { value: '18', label: '18%' },
                    { value: '20', label: '20%' },
                  ]}
                  size="md"
                />
                <Select
                  label="Devise"
                  description="Monnaie utilisée pour les transactions"
                  value={parametres.devise}
                  onChange={(val) => setParametres(prev => ({ ...prev, devise: val || 'FCFA' }))}
                  data={[
                    { value: 'FCFA', label: 'FCFA (Franc CFA)' },
                    { value: 'EUR', label: 'Euro (€)' },
                    { value: 'USD', label: 'Dollar ($)' },
                  ]}
                  size="md"
                />
              </SimpleGrid>
            </div>

            <Divider />

            {/* Modules */}
            <div>
              <Group gap="xs" mb="md">
                <IconPackage size={20} color="#1b365d" />
                <Title order={3} size="h4">Activation des modules</Title>
                <Badge size="sm" variant="light" color="orange">Étape 3</Badge>
              </Group>
              <Text size="sm" c="dimmed" mb="md">
                Activez ou désactivez les modules selon vos besoins.
              </Text>
              
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                {moduleConfigs.map((module) => (
                  <Card
                    key={module.key}
                    withBorder
                    p="md"
                    radius="md"
                    style={{
                      backgroundColor: parametres[module.key as keyof ConfigParametres] ? '#eef3f9' : 'white'
                    }}
                  >
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon color={module.color} variant="light" size="lg">
                        {module.icon}
                      </ThemeIcon>
                      <div style={{ flex: 1 }}>
                        <Text fw={600} size="sm">{module.label}</Text>
                        <Text size="xs" c="dimmed">{module.description}</Text>
                      </div>
                      <Switch
                        checked={parametres[module.key as keyof ConfigParametres] as boolean}
                        onChange={(e) => setParametres(prev => ({ 
                          ...prev, 
                          [module.key]: e.currentTarget.checked 
                        }))}
                        size="md"
                        color={module.color}
                      />
                    </Group>
                  </Card>
                ))}
              </SimpleGrid>
            </div>

            {/* Alert info */}
            <Alert 
              icon={<IconInfoCircle size={16} />} 
              color="blue" 
              variant="light"
              radius="md"
            >
              <Group gap="xs">
                <ThemeIcon color="blue" size="sm" radius="xl">
                  <IconCheck size={12} />
                </ThemeIcon>
                <Text size="sm">
                  Après validation, l'application sera reconfigurée selon vos besoins.
                  Un redémarrage sera nécessaire pour appliquer tous les changements.
                </Text>
              </Group>
            </Alert>

            {/* Boutons action */}
            <Group justify="flex-end">
              <Button 
                variant="light" 
                onClick={loadConfig}
                leftSection={<IconRefresh size={16} />}
                size="md"
              >
                Actualiser
              </Button>
              <Button 
                onClick={handleSave} 
                loading={saving}
                variant="gradient"
                gradient={{ from: "blue", to: "cyan" }}
                size="md"
                leftSection={<IconGavel size={16} />}
              >
                Appliquer la configuration
              </Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Paper>
  );
};

export default ConfigCommerce;