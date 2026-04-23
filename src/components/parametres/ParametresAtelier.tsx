import React, { useEffect, useState, useRef } from "react";
import { Stack, Card, Title, Text, Group, Button, TextInput, Textarea, Divider, Alert, Box, Modal, ThemeIcon, LoadingOverlay, Image, SimpleGrid } from "@mantine/core";
import { IconBuildingStore, IconCheck, IconUpload, IconX, IconPhoto, IconPhone, IconMail, IconId, IconMapPin, IconMessage, IconInfoCircle } from "@tabler/icons-react";
import { getDb } from "../../database/db";

interface ConfigAtelier {
  id: number;
  nom_atelier: string;
  telephone: string;
  adresse: string;
  email: string;
  nif: string;
  message_facture: string;
  logo_base64: string;
}

const ParametresAtelier: React.FC = () => {
  const [config, setConfig] = useState<ConfigAtelier>({
    id: 1, nom_atelier: "", telephone: "", adresse: "", email: "", nif: "", message_facture: "", logo_base64: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const charger = async () => {
      const db = await getDb();
      const data = await db.select<ConfigAtelier[]>("SELECT * FROM configuration_atelier WHERE id = 1");
      if (data.length) setConfig(data[0]);
      setLoading(false);
    };
    charger();
  }, []);

  const choisirLogo = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Fichier trop volumineux (max 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = (event) => setConfig(prev => ({ ...prev, logo_base64: event.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const db = await getDb();
    await db.execute(`INSERT OR REPLACE INTO configuration_atelier (id, nom_atelier, telephone, adresse, email, nif, message_facture, logo_base64, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [config.nom_atelier, config.telephone, config.adresse, config.email, config.nif, config.message_facture, config.logo_base64]);
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  if (loading) return <Card withBorder radius="md" p="lg"><LoadingOverlay visible={true} /><Text>Chargement...</Text></Card>;

  return (
    <Box p="md">
      <Stack gap="lg">
        <Card withBorder radius="md" p="lg" bg="#1b365d">
          <Group justify="space-between">
            <Stack gap={4}><Group gap="xs"><IconBuildingStore size={24} color="white" /><Title order={2} c="white">Paramètres de l'atelier</Title></Group><Text size="sm" c="gray.3">Configuration de l'entreprise</Text></Stack>
            <Group gap="md"><Button variant="light" color="white" leftSection={<IconInfoCircle size={18} />} onClick={() => setInfoModalOpen(true)}>Instructions</Button><ThemeIcon size={48} radius="md" color="white" variant="light"><IconBuildingStore size={28} /></ThemeIcon></Group>
          </Group>
        </Card>

        <Card withBorder radius="md" p="lg">
          <form onSubmit={handleSave}>
            <Stack gap="lg">
              <div><Title order={4}>Informations de l'atelier</Title><Text size="sm" c="dimmed">Ces informations apparaîtront sur les documents</Text></div>
              <Divider />
              <Box><Text fw={500} size="sm" mb="xs">Logo</Text>
                <Group align="flex-end" gap="md">
                  {config.logo_base64 ? (
                    <Box style={{ position: "relative" }}>
                      <Image src={config.logo_base64} w={100} h={100} fit="contain" radius="md" style={{ border: "1px solid #dee2e6", padding: 8 }} />
                      <Button size="xs" color="red" variant="light" onClick={() => setConfig({ ...config, logo_base64: "" })} style={{ position: "absolute", top: -8, right: -8 }} p={4}><IconX size={14} /></Button>
                    </Box>
                  ) : (
                    <Button variant="light" leftSection={<IconPhoto size={16} />} onClick={choisirLogo}>Choisir un logo</Button>
                  )}
                  <Button variant="subtle" leftSection={<IconUpload size={16} />} onClick={choisirLogo} size="sm">Importer</Button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
                </Group>
                <Text size="xs" c="dimmed" mt="xs">PNG, JPG, JPEG (max 2MB)</Text>
              </Box>
              <Divider />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Nom" value={config.nom_atelier} onChange={(e) => setConfig({ ...config, nom_atelier: e.target.value })} leftSection={<IconBuildingStore size={16} />} required />
                <TextInput label="Téléphone" value={config.telephone} onChange={(e) => setConfig({ ...config, telephone: e.target.value })} leftSection={<IconPhone size={16} />} />
                <TextInput label="Email" value={config.email} onChange={(e) => setConfig({ ...config, email: e.target.value })} leftSection={<IconMail size={16} />} type="email" />
                <TextInput label="NIF" value={config.nif} onChange={(e) => setConfig({ ...config, nif: e.target.value })} leftSection={<IconId size={16} />} />
              </SimpleGrid>
              <Textarea label="Adresse" value={config.adresse} onChange={(e) => setConfig({ ...config, adresse: e.target.value })} leftSection={<IconMapPin size={16} />} minRows={2} />
              <Textarea label="Message sur les factures" value={config.message_facture} onChange={(e) => setConfig({ ...config, message_facture: e.target.value })} leftSection={<IconMessage size={16} />} minRows={3} description="Apparaîtra au bas des factures" />
              <Divider />
              <Group justify="flex-end"><Button type="submit" loading={saving} variant="gradient" gradient={{ from: "blue", to: "cyan" }}>Enregistrer</Button></Group>
              {success && <Alert icon={<IconCheck size={16} />} color="green" variant="light">Configuration enregistrée !</Alert>}
            </Stack>
          </form>
        </Card>

        <Modal opened={infoModalOpen} onClose={() => setInfoModalOpen(false)} title="📋 Instructions" size="md" centered styles={{ header: { backgroundColor: "#1b365d", padding: "16px 20px" }, title: { color: "white", fontWeight: 600 }, body: { padding: "20px" } }}>
          <Stack gap="md"><Text size="sm">1. Renseignez les informations de votre entreprise</Text><Text size="sm">2. Téléchargez votre logo (optionnel)</Text><Text size="sm">3. Le message apparaîtra sur les factures</Text><Divider /><Text size="xs" c="dimmed" ta="center">Version 1.0.0</Text></Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default ParametresAtelier;