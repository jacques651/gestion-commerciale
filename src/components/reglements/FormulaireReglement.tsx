import React, { useState, useEffect } from "react";
import { Stack, Card, Title, Text, Group, Button, Select, NumberInput, Textarea, Divider, Alert, Box, Modal, LoadingOverlay, TextInput } from "@mantine/core";
import { IconDeviceFloppy, IconArrowLeft, IconMoneybag, IconInfoCircle, IconCheck, IconAlertCircle, IconCash } from "@tabler/icons-react";
import { getDb } from "../../database/db";

interface Client { idClient: number; nom_complet: string; }
interface FormulaireReglementProps { onSuccess: () => void; onCancel: () => void; }

const FormulaireReglement: React.FC<FormulaireReglementProps> = ({ onSuccess, onCancel }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [formData, setFormData] = useState({ idClient: "", modeReglement: "ESPECES", montant: 0, reference: "", observation: "" });

  useEffect(() => {
    const loadData = async () => {
      const db = await getDb();
      const clientsData = await db.select<Client[]>("SELECT idClient, nom_complet FROM clients WHERE est_actif=1 AND est_supprime=0 ORDER BY nom_complet");
      setClients(clientsData);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!formData.idClient) { setError("Veuillez sélectionner un client"); return; }
    if (formData.montant <= 0) { setError("Le montant est obligatoire"); return; }
    setSaving(true);
    try {
      const db = await getDb();
      const codeReglement = `REG-${Date.now()}`;
      await db.execute(`INSERT INTO reglements (code_reglement, idClient, date_reglement, montant_regle, mode_reglement, reference, observation) VALUES (?, ?, date('now'), ?, ?, ?, ?)`,
        [codeReglement, parseInt(formData.idClient), formData.montant, formData.modeReglement, formData.reference || null, formData.observation || null]);
      setSuccess(true);
      setTimeout(() => onSuccess(), 1500);
    } catch (err: any) { setError(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  if (loading) return <Card withBorder radius="md" p="lg"><LoadingOverlay visible={true} /><Text>Chargement...</Text></Card>;

  return (
    <Box style={{ maxWidth: 600, margin: "0 auto" }} p="sm">
      <Stack gap="md">
        <Card withBorder radius="md" p="sm" bg="#1b365d"><Group justify="space-between"><Group gap="xs"><IconMoneybag size={18} color="white" /><Title order={4} size="h5" c="white">Nouveau règlement</Title></Group><Group gap="xs"><Button variant="subtle" color="white" size="compact-sm" leftSection={<IconInfoCircle size={14} />} onClick={() => setInfoModalOpen(true)}>Aide</Button><Button variant="subtle" color="white" size="compact-sm" leftSection={<IconArrowLeft size={14} />} onClick={onCancel}>Retour</Button></Group></Group></Card>
        <Card withBorder radius="md" p="sm">
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              {success && <Alert icon={<IconCheck size={14} />} color="green" variant="light" p="xs"><Text size="xs">Règlement enregistré !</Text></Alert>}
              {error && <Alert icon={<IconAlertCircle size={14} />} color="red" variant="light" p="xs"><Text size="xs">{error}</Text></Alert>}
              <Select label="Client" placeholder="Sélectionner un client" data={clients.map(c => ({ value: c.idClient.toString(), label: c.nom_complet }))} value={formData.idClient} onChange={(val) => setFormData({ ...formData, idClient: val || "" })} leftSection={<IconMoneybag size={14} />} size="sm" required searchable />
              <Select label="Mode de règlement" data={[{ value: "ESPECES", label: "💰 Espèces" }, { value: "MOBILE_MONEY", label: "📱 Mobile Money" }, { value: "VIREMENT", label: "🏦 Virement" }, { value: "CHEQUE", label: "📝 Chèque" }]} value={formData.modeReglement} onChange={(val) => setFormData({ ...formData, modeReglement: val || "ESPECES" })} size="sm" required />
              <NumberInput label="Montant (FCFA)" value={formData.montant} onChange={(val) => setFormData({ ...formData, montant: Number(val) })} min={0} step={500} size="sm" required leftSection={<IconCash size={14} />} />
              <TextInput label="Référence" placeholder="Numéro de chèque, référence transaction..." value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} size="sm" />
              <Textarea label="Observation" placeholder="Note..." value={formData.observation} onChange={(e) => setFormData({ ...formData, observation: e.target.value })} size="sm" rows={2} />
              <Divider />
              <Group justify="space-between"><Button size="sm" variant="light" color="red" onClick={onCancel}>Annuler</Button><Button size="sm" type="submit" loading={saving} leftSection={<IconDeviceFloppy size={14} />} variant="gradient" gradient={{ from: "blue", to: "cyan" }}>Enregistrer</Button></Group>
            </Stack>
          </form>
        </Card>
        <Modal opened={infoModalOpen} onClose={() => setInfoModalOpen(false)} title="📋 Instructions" size="sm" centered styles={{ header: { backgroundColor: "#1b365d", padding: "10px 12px" }, title: { color: "white", fontWeight: 600, fontSize: 13 }, body: { padding: "12px" } }}><Stack gap="xs"><Text size="xs">1. Sélectionnez le client</Text><Text size="xs">2. Choisissez le mode de règlement</Text><Divider /><Text size="xs" c="dimmed" ta="center">Version 1.0.0</Text></Stack></Modal>
      </Stack>
    </Box>
  );
};

export default FormulaireReglement;