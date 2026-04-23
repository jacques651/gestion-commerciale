import React, { useState, useEffect } from "react";
import { Stack, Card, Title, Text, Group, Button, TextInput, NumberInput, Select, Divider, Alert, Box, Modal } from "@mantine/core";
import { IconDeviceFloppy, IconArrowLeft, IconPackage, IconInfoCircle, IconCheck, IconAlertCircle, IconCategory } from "@tabler/icons-react";
import { getDb } from "../../database/db";

interface Produit { idProduit?: number; code_produit: string; categorie: string; designation: string; unite_base: string; prix_achat_base: number; prix_vente_detail: number; prix_vente_gros: number; seuil_alerte: number; }
interface FormulaireProduitProps { produit?: Produit; onSuccess: () => void; onCancel: () => void; }

const FormulaireProduit: React.FC<FormulaireProduitProps> = ({ produit, onSuccess, onCancel }) => {
  const [codeProduit, setCodeProduit] = useState("");
  const [categorie, setCategorie] = useState("");
  const [designation, setDesignation] = useState("");
  const [uniteBase, setUniteBase] = useState("pièce");
  const [prixAchat, setPrixAchat] = useState<number | undefined>(0);
  const [prixDetail, setPrixDetail] = useState<number | undefined>(0);
  const [prixGros, setPrixGros] = useState<number | undefined>(0);
  const [seuilAlerte, setSeuilAlerte] = useState<number | undefined>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  const unitesOptions = [{ value: "pièce", label: "Pièce" }, { value: "m", label: "Mètre" }, { value: "kg", label: "Kilogramme" }];

  useEffect(() => {
    if (produit) {
      setCodeProduit(produit.code_produit); setCategorie(produit.categorie); setDesignation(produit.designation); setUniteBase(produit.unite_base);
      setPrixAchat(produit.prix_achat_base); setPrixDetail(produit.prix_vente_detail); setPrixGros(produit.prix_vente_gros); setSeuilAlerte(produit.seuil_alerte);
    } else { setCodeProduit(`PRD-${Date.now()}`); }
  }, [produit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess(false);
    if (!designation.trim()) { setError("La désignation est obligatoire"); return; }
    if (!prixDetail || prixDetail <= 0) { setError("Le prix de détail est obligatoire"); return; }
    setLoading(true);
    try {
      const db = await getDb();
      if (produit?.idProduit) {
        await db.execute("UPDATE products SET code_produit=?, categorie=?, designation=?, unite_base=?, prix_achat_base=?, prix_vente_detail=?, prix_vente_gros=?, seuil_alerte=? WHERE idProduit=?", [codeProduit, categorie || null, designation, uniteBase, prixAchat || 0, prixDetail, prixGros || 0, seuilAlerte || 0, produit.idProduit]);
      } else {
        await db.execute("INSERT INTO products (code_produit, categorie, designation, unite_base, prix_achat_base, prix_vente_detail, prix_vente_gros, seuil_alerte, qte_stock, est_supprime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)", [codeProduit, categorie || null, designation, uniteBase, prixAchat || 0, prixDetail, prixGros || 0, seuilAlerte || 0]);
      }
      setSuccess(true);
      setTimeout(() => onSuccess(), 1500);
    } catch (err: any) { setError(err.message || "Erreur"); }
    finally { setLoading(false); }
  };

  return (
    <Box style={{ maxWidth: 600, margin: "0 auto" }} p="sm">
      <Stack gap="md">
        <Card withBorder radius="md" p="sm" bg="#1b365d"><Group justify="space-between"><Group gap="xs"><IconPackage size={18} color="white" /><Title order={4} size="h5" c="white">{produit ? "Modifier" : "Nouveau produit"}</Title></Group><Group gap="xs"><Button variant="subtle" color="white" size="compact-sm" leftSection={<IconInfoCircle size={14} />} onClick={() => setInfoModalOpen(true)}>Aide</Button><Button variant="subtle" color="white" size="compact-sm" leftSection={<IconArrowLeft size={14} />} onClick={onCancel}>Retour</Button></Group></Group></Card>
        <Card withBorder radius="md" p="sm">
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              {success && <Alert icon={<IconCheck size={14} />} color="green" variant="light" p="xs"><Text size="xs">Produit enregistré !</Text></Alert>}
              {error && <Alert icon={<IconAlertCircle size={14} />} color="red" variant="light" p="xs"><Text size="xs">{error}</Text></Alert>}
              <TextInput label="Code produit" value={codeProduit} disabled size="sm" />
              <TextInput label="Désignation" placeholder="Nom du produit" value={designation} onChange={(e) => setDesignation(e.target.value)} leftSection={<IconPackage size={14} />} size="sm" required />
              <TextInput label="Catégorie" placeholder="Ex: Téléphone" value={categorie} onChange={(e) => setCategorie(e.target.value)} leftSection={<IconCategory size={14} />} size="sm" />
              <Select label="Unité de base" data={unitesOptions} value={uniteBase} onChange={(val) => setUniteBase(val || "pièce")} size="sm" />
              <NumberInput label="Prix d'achat (FCFA)" value={prixAchat} onChange={(val) => setPrixAchat(Number(val))} min={0} step={100} size="sm" />
              <NumberInput label="Prix de vente détail (FCFA)" value={prixDetail} onChange={(val) => setPrixDetail(Number(val))} min={0} step={100} size="sm" required />
              <NumberInput label="Prix de vente gros (FCFA)" value={prixGros} onChange={(val) => setPrixGros(Number(val))} min={0} step={100} size="sm" />
              <NumberInput label="Seuil d'alerte" value={seuilAlerte} onChange={(val) => setSeuilAlerte(Number(val))} min={0} step={1} size="sm" />
              <Divider />
              <Group justify="space-between"><Button size="sm" variant="light" color="red" onClick={onCancel}>Annuler</Button><Button size="sm" type="submit" loading={loading} leftSection={<IconDeviceFloppy size={14} />} variant="gradient" gradient={{ from: "blue", to: "cyan" }}>{produit ? "Mettre à jour" : "Enregistrer"}</Button></Group>
            </Stack>
          </form>
        </Card>
        <Modal opened={infoModalOpen} onClose={() => setInfoModalOpen(false)} title="📋 Instructions" size="sm" centered styles={{ header: { backgroundColor: "#1b365d", padding: "10px 12px" }, title: { color: "white", fontWeight: 600, fontSize: 13 }, body: { padding: "12px" } }}><Stack gap="xs"><Text size="xs">1. Saisissez les informations du produit</Text><Divider /><Text size="xs" c="dimmed" ta="center">Version 1.0.0</Text></Stack></Modal>
      </Stack>
    </Box>
  );
};

export default FormulaireProduit;