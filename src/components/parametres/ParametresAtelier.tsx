// src/components/parametres/ParametresAtelier.tsx

import React, { useEffect, useState, useRef } from "react";
import { confirm } from '../../utils/confirm';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Button,
  TextInput,
  Textarea,
  Divider,
  Alert,
  Box,
  Modal,
  ThemeIcon,
  LoadingOverlay,
  Image,
  Paper,
  Flex,
  Badge,
  Tooltip,
  ActionIcon,
  Grid,
  Switch,
} from "@mantine/core";
import {
  IconBuildingStore,
  IconCheck,
  IconUpload,
  IconX,
  IconPhoto,
  IconPhone,
  IconMail,
  IconId,
  IconMapPin,
  IconMessage,
  IconInfoCircle,
  IconRefresh,
  IconEye,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { getDb } from "../../database/db";
import { notifications } from "@mantine/notifications";
import { tvaService } from "../../services/tvaService";
import ParametresImpression from "./ParametresImpression";
import RestaurationAncienneBase from "./RestaurationAncienneBase";

interface ConfigAtelier {
  id: number;
  nom_atelier: string;
  forme_juridique: string;
  telephone: string;
  adresse: string;
  adresse_postale: string;
  adresse_cadastrale: string;
  email: string;
  ifu: string;
  rccm: string;
  compte_bancaire: string;
  regime_fiscal: string;
  service_impots: string;
  message_facture: string;
  logo_base64: string;
  tva_active: number;
}

const EMPTY_CONFIG: ConfigAtelier = {
  id: 1,
  nom_atelier: "",
  forme_juridique: "",
  telephone: "",
  adresse: "",
  adresse_postale: "",
  adresse_cadastrale: "",
  email: "",
  ifu: "",
  rccm: "",
  compte_bancaire: "",
  regime_fiscal: "",
  service_impots: "",
  message_facture: "",
  logo_base64: "",
  tva_active: 0,
};

const ParametresAtelier: React.FC = () => {
  const [config, setConfig] = useState<ConfigAtelier>(EMPTY_CONFIG);
  // Taux de TVA réellement configuré : plus de 18 % codé en dur dans les libellés.
  const [tauxTVA, setTauxTVA] = useState<number>(18);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const charger = async () => {
      try {
        const db = await getDb();
        const data = await db.select<any[]>(
          "SELECT * FROM configuration_atelier WHERE id = 1"
        );
        if (data.length) setConfig({ ...EMPTY_CONFIG, ...data[0] });
        // Lecture du taux réellement configuré pour l'affichage des libellés
        const cfgTva = await tvaService.get(true);
        setTauxTVA(cfgTva.taux);
      } catch (error) {
        notifications.show({
          title: "Erreur",
          message: "Impossible de charger la configuration",
          color: "red",
        });
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  const choisirLogo = () => fileInputRef.current?.click();
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      notifications.show({
        title: "Erreur",
        message: "Fichier trop volumineux (max 2MB)",
        color: "red",
      });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setConfig(prev => ({ ...prev, logo_base64: event.target?.result as string }));
      setIsDirty(true);
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (field: keyof ConfigAtelier, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!config.nom_atelier.trim()) {
      notifications.show({
        title: "Erreur",
        message: "Le nom de l'atelier est obligatoire",
        color: "red",
      });
      return;
    }

    setSaving(true);
    try {
      const db = await getDb();
      await db.execute(
        `INSERT OR REPLACE INTO configuration_atelier
         (id, nom_atelier, forme_juridique, telephone, adresse, adresse_postale, adresse_cadastrale,
          email, ifu, rccm, compte_bancaire, regime_fiscal, service_impots,
          message_facture, logo_base64, tva_active, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          config.nom_atelier,
          config.forme_juridique,
          config.telephone,
          config.adresse,
          config.adresse_postale,
          config.adresse_cadastrale,
          config.email,
          config.ifu,
          config.rccm,
          config.compte_bancaire,
          config.regime_fiscal,
          config.service_impots,
          config.message_facture,
          config.logo_base64,
          config.tva_active,
        ]
      );
      
      // Synchroniser la TVA via la source de vérité unique (tvaService).
      // Important : on ne transmet PAS de taux ici. L'ancien code écrivait
      // un taux de 0 lorsque la TVA était désactivée, ce qui effaçait
      // définitivement le taux configuré. Le taux se règle dans l'écran
      // dédié à la TVA ; ici on ne change que l'activation.
      await tvaService.set(config.tva_active === 1);
      
      notifications.show({
        title: "✅ Succès",
        message: "Configuration enregistrée avec succès",
        color: "green",
      });
      
      setSuccess(true);
      setIsDirty(false);
      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      notifications.show({
        title: "❌ Erreur",
        message: "Impossible d'enregistrer la configuration",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!await confirm("Voulez-vous vraiment réinitialiser la configuration ?", "Réinitialisation")) return;
    
    try {
      const db = await getDb();
      const data = await db.select<any[]>(
        "SELECT * FROM configuration_atelier WHERE id = 1"
      );
      if (data.length) {
        setConfig({ ...EMPTY_CONFIG, ...data[0] });
        setIsDirty(false);
        notifications.show({
          title: "✅ Succès",
          message: "Configuration réinitialisée",
          color: "blue",
        });
      }
    } catch (error) {
      notifications.show({
        title: "Erreur",
        message: "Impossible de réinitialiser",
        color: "red",
      });
    }
  };

  if (loading) {
    return (
      <Card withBorder radius="md" p="xl" ta="center">
        <LoadingOverlay visible={true} />
        <Text>Chargement de la configuration...</Text>
      </Card>
    );
  }

  return (
    <Box p="md">
      <Stack gap="md">
        {/* EN-TÊTE */}
        <Paper className="tk-page-tools tk-page-tools--fiche"
          p="md"
          radius="lg"
          style={{ position: "relative", overflow: "hidden" }}
        >
          <Flex justify="space-between" align="center" wrap="wrap" style={{ position: "relative", zIndex: 1 }}>
            <Group gap="sm">
              <ThemeIcon size={40} radius="md" variant="gradient" gradient={{ from: "#4a6cf7", to: "#6c5ce7" }}>
                <IconBuildingStore size={20} />
              </ThemeIcon>
              <Stack gap={0}>
                <Title order={2} c="white" style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                  Configuration de l'atelier
                </Title>
                <Group gap="xs">
                  <Badge size="xs" variant="light" color="blue">
                    {config.nom_atelier || "Non configuré"}
                  </Badge>
                  {isDirty && (
                    <Badge size="xs" variant="light" color="orange">
                      Modifications
                    </Badge>
                  )}
                  {success && (
                    <Badge size="xs" variant="light" color="green">
                      ✅ Sauvegardé
                    </Badge>
                  )}
                </Group>
              </Stack>
            </Group>
            <Group gap="xs">
              <Tooltip label="Aperçu">
                <ActionIcon variant="light" color="white" onClick={() => setPreviewModalOpen(true)} size="sm">
                  <IconEye size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Réinitialiser">
                <ActionIcon variant="light" color="white" onClick={handleReset} size="sm">
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Instructions">
                <ActionIcon variant="light" color="white" onClick={() => setInfoModalOpen(true)} size="sm">
                  <IconInfoCircle size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Flex>
        </Paper>

        {/* FORMULAIRE */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <form onSubmit={handleSave}>
            <Stack gap="md">
              {/* Logo */}
              <Box>
                <Group gap="xs" mb="xs">
                  <IconPhoto size={16} color="#1b365d" />
                  <Title order={5} size="h5">
                    Logo
                  </Title>
                  <Badge size="xs" variant="light" color="gray">
                    Optionnel
                  </Badge>
                </Group>

                <Group align="flex-end" gap="md">
                  {config.logo_base64 ? (
                    <Box style={{ position: "relative" }}>
                      <Paper withBorder p="xs" radius="md">
                        <Image src={config.logo_base64} w={70} h={70} fit="contain" radius="sm" />
                      </Paper>
                      <Tooltip label="Supprimer">
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => {
                            setConfig({ ...config, logo_base64: "" });
                            setIsDirty(true);
                          }}
                          style={{ position: "absolute", top: -8, right: -8 }}
                          size="sm"
                        >
                          <IconX size={12} />
                        </ActionIcon>
                      </Tooltip>
                    </Box>
                  ) : (
                    <Button variant="light" leftSection={<IconPhoto size={14} />} onClick={choisirLogo} size="xs">
                      Choisir un logo
                    </Button>
                  )}
                  <Button variant="subtle" leftSection={<IconUpload size={14} />} onClick={choisirLogo} size="xs">
                    Importer
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
                </Group>
              </Box>

              <Divider />

              {/* Identification */}
              <Box>
                <Group gap="xs" mb="xs">
                  <IconBuildingStore size={16} color="#1b365d" />
                  <Title order={5} size="h5">Identification de l'entreprise</Title>
                  <Badge size="xs" variant="light" color="red">Obligatoire</Badge>
                </Group>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 8 }}>
                    <TextInput 
                      label="Nom / Raison sociale" 
                      placeholder="Nom de l'entreprise"
                      value={config.nom_atelier} 
                      onChange={(e) => handleChange("nom_atelier", e.target.value)}
                      leftSection={<IconBuildingStore size={14} />} 
                      required 
                      size="xs" 
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput 
                      label="Forme juridique" 
                      placeholder="SARL, SA, EI..."
                      value={config.forme_juridique} 
                      onChange={(e) => handleChange("forme_juridique", e.target.value)}
                      leftSection={<IconId size={14} />} 
                      size="xs" 
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput 
                      label="IFU (Identifiant Financier Unique)" 
                      placeholder="N° IFU"
                      value={config.ifu} 
                      onChange={(e) => handleChange("ifu", e.target.value)}
                      leftSection={<IconId size={14} />} 
                      size="xs" 
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput 
                      label="N° RCCM" 
                      placeholder="Registre du Commerce"
                      value={config.rccm} 
                      onChange={(e) => handleChange("rccm", e.target.value)}
                      leftSection={<IconId size={14} />} 
                      size="xs" 
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput 
                      label="Téléphone" 
                      placeholder="Numéro de téléphone"
                      value={config.telephone} 
                      onChange={(e) => handleChange("telephone", e.target.value)}
                      leftSection={<IconPhone size={14} />} 
                      size="xs" 
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput 
                      label="Email" 
                      placeholder="Adresse email"
                      value={config.email} 
                      onChange={(e) => handleChange("email", e.target.value)}
                      leftSection={<IconMail size={14} />} 
                      type="email" 
                      size="xs" 
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea 
                      label="Adresse géographique" 
                      placeholder="Quartier, rue, ville..."
                      value={config.adresse} 
                      onChange={(e) => handleChange("adresse", e.target.value)}
                      minRows={2} 
                      size="xs" 
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput 
                      label="Adresse postale (BP)" 
                      placeholder="Ex : BP 1234 Ouagadougou"
                      value={config.adresse_postale} 
                      onChange={(e) => handleChange("adresse_postale", e.target.value)}
                      leftSection={<IconMapPin size={14} />} 
                      size="xs" 
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput 
                      label="Adresse cadastrale" 
                      placeholder="N° ilot / lot"
                      value={config.adresse_cadastrale} 
                      onChange={(e) => handleChange("adresse_cadastrale", e.target.value)}
                      leftSection={<IconMapPin size={14} />} 
                      size="xs" 
                    />
                  </Grid.Col>
                </Grid>
              </Box>

              <Divider />

              {/* Informations fiscales */}
              <Box>
                <Group gap="xs" mb="xs">
                  <IconId size={16} color="#1b365d" />
                  <Title order={5} size="h5">Informations fiscales</Title>
                  <Badge size="xs" variant="light" color="orange">Facture normalisée</Badge>
                </Group>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput 
                      label="Régime d'imposition" 
                      placeholder="Ex : RSI, RNI, Forfait..."
                      value={config.regime_fiscal} 
                      onChange={(e) => handleChange("regime_fiscal", e.target.value)}
                      leftSection={<IconId size={14} />} 
                      size="xs" 
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput 
                      label="Service des impôts de rattachement" 
                      placeholder="Ex : DGE, CIME Ouaga 1..."
                      value={config.service_impots} 
                      onChange={(e) => handleChange("service_impots", e.target.value)}
                      leftSection={<IconId size={14} />} 
                      size="xs" 
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <TextInput 
                      label="Références bancaires (compte)" 
                      placeholder="Ex : Coris Bank – 01234567890"
                      value={config.compte_bancaire} 
                      onChange={(e) => handleChange("compte_bancaire", e.target.value)}
                      leftSection={<IconId size={14} />} 
                      size="xs" 
                    />
                  </Grid.Col>
                </Grid>
              </Box>

              <Divider />

              {/* Message facture */}
              <Box>
                <Group gap="xs" mb="xs">
                  <IconMessage size={16} color="#1b365d" />
                  <Title order={5} size="h5">
                    Message sur les factures
                  </Title>
                  <Badge size="xs" variant="light" color="gray">
                    Optionnel
                  </Badge>
                </Group>

                <Textarea
                  placeholder="Message en bas des factures..."
                  value={config.message_facture}
                  onChange={(e) => handleChange("message_facture", e.target.value)}
                  minRows={2}
                  size="xs"
                />
              </Box>

              {/* ✅ TVA - Section mise en évidence */}
              <Box p="md" style={{ backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                <Group justify="space-between" align="center">
                  <Box>
                    <Group gap="xs">
                      <Text size="sm" fw={600}>TVA (Taxe sur la Valeur Ajoutée)</Text>
                      <Badge 
                        size="xs" 
                        color={config.tva_active ? 'green' : 'gray'}
                        variant="filled"
                      >
                        {config.tva_active ? `Activée (${tauxTVA}%)` : 'Désactivée'}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" mt={2}>
                      {config.tva_active
                        ? `✅ La TVA ${tauxTVA}% sera appliquée sur toutes les factures et ventes`
                        : '⛔ Les prix seront affichés et facturés hors taxe (HT)'
                      }
                    </Text>
                  </Box>
                  <Switch
                    checked={config.tva_active === 1}
                    onChange={(e) => handleChange("tva_active", e.currentTarget.checked ? 1 : 0)}
                    color={config.tva_active ? 'green' : 'gray'}
                    size="md"
                    label={config.tva_active ? 'TVA ON' : 'TVA OFF'}
                    labelPosition="left"
                  />
                </Group>
              </Box>

              <Divider />

              {/* Actions */}
              <Group justify="space-between" wrap="wrap">
                <Text size="xs" c="dimmed">
                  {isDirty ? "⚠️ Modifications non sauvegardées" : "✅ Aucune modification"}
                </Text>
                <Group gap="xs">
                  <Button variant="light" onClick={handleReset} leftSection={<IconRefresh size={14} />} size="xs">
                    Réinitialiser
                  </Button>
                  <Button
                    type="submit"
                    loading={saving}
                    variant="gradient"
                    gradient={{ from: "blue", to: "cyan" }}
                    size="xs"
                    leftSection={<IconDeviceFloppy size={14} />}
                    disabled={!isDirty}
                  >
                    Enregistrer
                  </Button>
                </Group>
              </Group>

              {success && (
                <Alert icon={<IconCheck size={14} />} color="green" variant="light" withCloseButton onClose={() => setSuccess(false)}>
                  <Text size="sm" fw={500}>Configuration enregistrée avec succès !</Text>
                </Alert>
              )}
            </Stack>
          </form>
        </Card>

        {/* Paramètres d'impression : format papier par défaut appliqué
            à tous les documents (factures, reçus, journaux, rapports). */}
        <ParametresImpression />

        {/* MODAL INSTRUCTIONS */}
        <Modal
          opened={infoModalOpen}
          onClose={() => setInfoModalOpen(false)}
          title={
            <Group gap="xs">
              <IconInfoCircle size={18} color="white" />
              <Text c="white" fw={600}>📋 Instructions</Text>
            </Group>
          }
          size="sm"
          centered
          styles={{
            header: {
              backgroundColor: "#1a1a2e",
              padding: "12px 16px",
              borderTopLeftRadius: "12px",
              borderTopRightRadius: "12px",
            },
            title: { color: "white", fontWeight: 600, flex: 1, fontSize: "1rem" },
            body: { padding: "16px" },
          }}
        >
          <Stack gap="sm">
            <Paper withBorder p="sm" radius="md" bg="gray.0">
              <Group gap="sm">
                <ThemeIcon color="blue" size="xs" radius="xl">
                  <IconCheck size={10} />
                </ThemeIcon>
                <Text size="xs" fw={500}>Informations de l'entreprise</Text>
              </Group>
            </Paper>
            <Paper withBorder p="sm" radius="md" bg="gray.0">
              <Group gap="sm">
                <ThemeIcon color="blue" size="xs" radius="xl">
                  <IconCheck size={10} />
                </ThemeIcon>
                <Text size="xs" fw={500}>Logo (optionnel)</Text>
              </Group>
            </Paper>
            <Paper withBorder p="sm" radius="md" bg="gray.0">
              <Group gap="sm">
                <ThemeIcon color="blue" size="xs" radius="xl">
                  <IconCheck size={10} />
                </ThemeIcon>
                <Text size="xs" fw={500}>Message sur les factures</Text>
              </Group>
            </Paper>
            <Paper withBorder p="sm" radius="md" bg="gray.0">
              <Group gap="sm">
                <ThemeIcon color="green" size="xs" radius="xl">
                  <IconCheck size={10} />
                </ThemeIcon>
                <Text size="xs" fw={500}>Activer/Désactiver la TVA</Text>
              </Group>
            </Paper>
            <Divider />
            <Text size="xs" c="dimmed" ta="center">
              Version 3.0.0
            </Text>
          </Stack>
        </Modal>

        {/* MODAL APERÇU */}
        <Modal
          opened={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          title={
            <Group gap="xs">
              <IconEye size={18} color="white" />
              <Text c="white" fw={600}>👁️ Aperçu</Text>
            </Group>
          }
          size="sm"
          centered
          styles={{
            header: {
              backgroundColor: "#1a1a2e",
              padding: "12px 16px",
              borderTopLeftRadius: "12px",
              borderTopRightRadius: "12px",
            },
            title: { color: "white", fontWeight: 600, flex: 1, fontSize: "1rem" },
            body: { padding: "16px" },
          }}
        >
          <Stack gap="sm">
            <Paper withBorder p="md" radius="md">
              <Group align="center">
                {config.logo_base64 ? (
                  <Image src={config.logo_base64} w={50} h={50} fit="contain" />
                ) : (
                  <ThemeIcon size={50} radius="md" color="gray" variant="light">
                    <IconBuildingStore size={24} />
                  </ThemeIcon>
                )}
                <Box ml="sm">
                  <Text fw={700} size="sm">{config.nom_atelier || "Nom de l'atelier"}</Text>
                  {config.adresse && <Text size="xs" c="dimmed">{config.adresse}</Text>}
                  {config.telephone && <Text size="xs" c="dimmed">Tél : {config.telephone}</Text>}
                </Box>
              </Group>
            </Paper>
            {config.ifu && <Text size="xs">IFU : {config.ifu}</Text>}
            {config.rccm && <Text size="xs">RCCM : {config.rccm}</Text>}
            <Text size="xs" c="dimmed">
              TVA : {config.tva_active ? `✅ Activée (${tauxTVA}%)` : '⛔ Désactivée'}
            </Text>
          </Stack>
        </Modal>
        <RestaurationAncienneBase />
      </Stack>
    </Box>
  );
};

export default ParametresAtelier;