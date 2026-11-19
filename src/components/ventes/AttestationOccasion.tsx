// src/components/ventes/AttestationOccasion.tsx
// Attestation d'achat-vente pour matériel d'occasion (téléphone de seconde main),
// conforme au modèle papier : cédant / cessionnaire, matériel, échange, signatures,
// avec clause de décharge et mention « lu et approuvé ».
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, Stack, Group, Button, TextInput, Textarea, Box, Divider, SimpleGrid, Text, NumberInput, SegmentedControl,
} from '@mantine/core';
import { IconPrinter, IconX, IconDeviceFloppy } from '@tabler/icons-react';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';
import { printHtml } from '../../utils/fileExport';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../contexts/AuthContext';
import { attestationRepository } from '../../database/repositories/attestationRepository';
import { journalCaisseService } from '../../services/journalCaisseService';

interface AttestationOccasionProps {
  opened: boolean;
  onClose: () => void;
  vente?: any | null;
  onSaved?: () => void; // appelé après enregistrement, pour rafraîchir la liste
}

const AttestationOccasion: React.FC<AttestationOccasionProps> = ({ opened, onClose, vente, onSaved }) => {
  const { config } = useAtelierConfig();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [sens, setSens] = useState<'ACHAT' | 'VENTE'>('ACHAT');

  // Cédant (Je soussigné) — la personne qui cède le téléphone
  const [cedantNom, setCedantNom] = useState('');
  const [cedantDomicile, setCedantDomicile] = useState('');
  const [cedantTel, setCedantTel] = useState('');
  const [cedantDoc, setCedantDoc] = useState('');
  const [cedantRef, setCedantRef] = useState('');

  // Cessionnaire (Cédé à) — celui qui reçoit (par défaut : le commerce)
  const [cessNom, setCessNom] = useState('');
  const [cessDomicile, setCessDomicile] = useState('');
  const [cessTel, setCessTel] = useState('');
  const [cessDoc, setCessDoc] = useState('');
  const [cessRef, setCessRef] = useState('');

  // Objet de l'acte
  const [materiel, setMateriel] = useState('');
  const [enEchange, setEnEchange] = useState('');
  const [montant, setMontant] = useState<number>(0);
  const [faitA, setFaitA] = useState('');
  const [dateActe, setDateActe] = useState('');
  const [nbExemplaires, setNbExemplaires] = useState('deux (02)');

  useEffect(() => {
    if (!opened) return;
    setSavedId(null);
    setSens('ACHAT');
    // Le commerce est par défaut le cessionnaire (cas d'un achat d'occasion)
    setCessNom(config?.nom_atelier || '');
    setCessDomicile(config?.adresse || '');
    setCessTel(config?.telephone || '');
    setCessDoc(config?.ifu || '');
    setCessRef('');
    // Pré-remplissage depuis la vente si disponible
    setCedantNom(vente?.client_nom || vente?.nom_prenom || '');
    setCedantTel(vente?.client_tel || vente?.contact || vente?.Tel || '');
    const m = Number(vente?.montant_ttc ?? vente?.montant_total ?? 0);
    setMontant(m);
    setEnEchange(m ? `la somme de ${m.toLocaleString('fr-FR')} FCFA` : '');
    const d = vente?.date_vente ? new Date(vente.date_vente) : new Date();
    setDateActe(isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR'));
  }, [opened, vente, config]);

  const line = (v: string) =>
    `<span style="border-bottom:1px dotted #333;display:inline-block;min-width:60%;">${v || '&nbsp;'}</span>`;

  const handleSave = async () => {
    if (savedId) return;
    setSaving(true);
    try {
      const { id } = await attestationRepository.create({
        idVente: vente?.idVente ?? null,
        cedant_nom: cedantNom, cedant_domicile: cedantDomicile, cedant_tel: cedantTel, cedant_doc: cedantDoc, cedant_ref: cedantRef,
        cess_nom: cessNom, cess_domicile: cessDomicile, cess_tel: cessTel, cess_doc: cessDoc, cess_ref: cessRef,
        materiel, en_echange: enEchange, montant, sens, fait_a: faitA, date_acte: dateActe, nb_exemplaires: nbExemplaires,
        created_by: user?.nom,
      });
      setSavedId(id);

      // Mouvement de caisse : ACHAT = sortie (le commerce paie), VENTE = entrée (le commerce encaisse)
      try {
        if (montant > 0) {
          const libelle = `Occasion ${sens === 'VENTE' ? 'vente' : 'achat'} - ${materiel || 'téléphone'}${cedantNom ? ` (${cedantNom})` : ''}`;
          if (sens === 'VENTE') {
            await journalCaisseService.ajouterEntree({ categorie: 'AUTRE_ENTREE', designation: libelle, montant, reference: cedantRef || undefined });
          } else {
            await journalCaisseService.ajouterSortie({ categorie: 'AUTRE_SORTIE', designation: libelle, montant, reference: cedantRef || undefined, force: true });
          }
        }
      } catch (e) {
        console.warn('Journal de caisse non mis à jour (attestation occasion):', e);
      }

      notifications.show({ title: 'Attestation enregistrée', message: 'Ajoutée à la liste des attestations', color: 'green' });
      onSaved?.();
    } catch (e) {
      notifications.show({ title: 'Erreur', message: "Enregistrement impossible", color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const contenu = printRef.current;
    if (!contenu) return;
    printHtml(contenu.innerHTML, "Attestation d'achat-vente", `
      body { font-family: Arial, sans-serif; color:#111; padding:40px; line-height:2; font-size:14px; }
      h1 { text-align:center; font-size:18px; text-decoration:underline; letter-spacing:1px; margin-bottom:28px; }
      .l { margin:4px 0; }
      .sec { margin-top:14px; }
      .decharge { font-style:italic; text-align:justify; margin-top:16px; line-height:1.5; font-size:12.5px; }
      .sign { display:flex; justify-content:space-between; margin-top:50px; }
      .sign div { width:45%; text-align:center; }
      .mention { margin-top:24px; }
    `);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Attestation d'achat-vente (téléphone d'occasion)" size="xl" centered>
      <Stack gap="sm">
        <SegmentedControl
          fullWidth
          value={sens}
          onChange={(v) => setSens(v as 'ACHAT' | 'VENTE')}
          data={[
            { label: 'Achat (le commerce achète)', value: 'ACHAT' },
            { label: 'Vente (le commerce vend)', value: 'VENTE' },
          ]}
        />
        <Text size="xs" c="dimmed">
          {sens === 'ACHAT'
            ? 'Le commerce achète un téléphone d\'occasion → sortie de caisse.'
            : 'Le commerce vend un téléphone d\'occasion → entrée de caisse.'}
        </Text>
        <Text fw={600} size="sm">Cédant (Je soussigné)</Text>
        <SimpleGrid cols={2}>
          <TextInput label="Nom / Je soussigné" value={cedantNom} onChange={(e) => setCedantNom(e.currentTarget.value)} />
          <TextInput label="Domicilié à" value={cedantDomicile} onChange={(e) => setCedantDomicile(e.currentTarget.value)} />
          <TextInput label="Numéro de téléphone" value={cedantTel} onChange={(e) => setCedantTel(e.currentTarget.value)} />
          <TextInput label="Document d'identification N°" value={cedantDoc} onChange={(e) => setCedantDoc(e.currentTarget.value)} />
          <TextInput label="Références" value={cedantRef} onChange={(e) => setCedantRef(e.currentTarget.value)} />
        </SimpleGrid>

        <Text fw={600} size="sm" mt="xs">Cessionnaire (Certifie avoir cédé à)</Text>
        <SimpleGrid cols={2}>
          <TextInput label="Nom" value={cessNom} onChange={(e) => setCessNom(e.currentTarget.value)} />
          <TextInput label="Domicilié à" value={cessDomicile} onChange={(e) => setCessDomicile(e.currentTarget.value)} />
          <TextInput label="Numéro de téléphone" value={cessTel} onChange={(e) => setCessTel(e.currentTarget.value)} />
          <TextInput label="Document d'identification" value={cessDoc} onChange={(e) => setCessDoc(e.currentTarget.value)} />
          <TextInput label="Références" value={cessRef} onChange={(e) => setCessRef(e.currentTarget.value)} />
        </SimpleGrid>

        <Textarea label="Le matériel décrit ci-après" value={materiel} onChange={(e) => setMateriel(e.currentTarget.value)}
          placeholder="Marque, modèle, IMEI, couleur, état constaté…" autosize minRows={2} mt="xs" />
        <SimpleGrid cols={2}>
          <NumberInput label="Montant (FCFA)" value={montant} thousandSeparator=" " min={0}
            onChange={(v) => { const n = Number(v) || 0; setMontant(n); setEnEchange(n ? `la somme de ${n.toLocaleString('fr-FR')} FCFA` : ''); }} />
          <TextInput label="En échange de" value={enEchange} onChange={(e) => setEnEchange(e.currentTarget.value)} />
          <TextInput label="Fait à" value={faitA} onChange={(e) => setFaitA(e.currentTarget.value)} />
          <TextInput label="Le (date)" value={dateActe} onChange={(e) => setDateActe(e.currentTarget.value)} />
          <TextInput label="En autant d'exemplaires que de parties, soit" value={nbExemplaires} onChange={(e) => setNbExemplaires(e.currentTarget.value)} />
        </SimpleGrid>

        <Divider label="Aperçu" labelPosition="center" />

        {/* Zone imprimable conforme au modèle */}
        <Box ref={printRef} p="md" style={{ border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
          <h1>ATTESTATION D'ACHAT-VENTE</h1>

          <div className="l" dangerouslySetInnerHTML={{ __html: `Je soussigné : ${line(cedantNom)}` }} />
          <div className="l" dangerouslySetInnerHTML={{ __html: `Domicilié : ${line(cedantDomicile)}` }} />
          <div className="l" dangerouslySetInnerHTML={{ __html: `Numéro de téléphone : ${line(cedantTel)}` }} />
          <div className="l" dangerouslySetInnerHTML={{ __html: `Document d'identification N° : ${line(cedantDoc)}` }} />
          <div className="l" dangerouslySetInnerHTML={{ __html: `Références : ${line(cedantRef)}` }} />

          <div className="sec l" dangerouslySetInnerHTML={{ __html: `Certifie avoir cédé à : ${line(cessNom)}` }} />
          <div className="l" dangerouslySetInnerHTML={{ __html: `Domicilié : ${line(cessDomicile)}` }} />
          <div className="l" dangerouslySetInnerHTML={{ __html: `Numéro de téléphone : ${line(cessTel)}` }} />
          <div className="l" dangerouslySetInnerHTML={{ __html: `Document d'identification : ${line(cessDoc)}` }} />
          <div className="l" dangerouslySetInnerHTML={{ __html: `Références : ${line(cessRef)}` }} />

          <div className="sec l" dangerouslySetInnerHTML={{ __html: `Le matériel décrit ci-après : ${line(materiel)}` }} />
          <div className="l" dangerouslySetInnerHTML={{ __html: `En échange de : ${line(enEchange)}` }} />

          <div className="decharge">
            Décharge : le cédant reconnaît avoir remis volontairement le matériel ci-dessus décrit, déclare en être le
            légitime propriétaire et garantit qu'il n'est ni volé ni frappé d'aucune opposition. Le cessionnaire l'accepte
            en l'état après vérification. La présente cession est ferme et définitive et décharge le cessionnaire de toute
            réclamation ultérieure.
          </div>

          <div className="sec l" dangerouslySetInnerHTML={{ __html:
            `Fait à ${line(faitA)} le ${line(dateActe)}. Pour valoir et servir ce que de droit, en autant d'exemplaires que de parties, soit ${line(nbExemplaires)}.` }} />

          <div className="mention">Date et signature avec mention « lu et approuvé » :</div>
          <div className="sign">
            <div>ACHETEUR</div>
            <div>VENDEUR</div>
          </div>
        </Box>

        <Group justify="flex-end" mt="sm">
          <Button variant="light" color="gray" leftSection={<IconX size={16} />} onClick={onClose}>Fermer</Button>
          <Button variant="light" color="teal" leftSection={<IconDeviceFloppy size={16} />} onClick={handleSave} loading={saving} disabled={!!savedId}>
            {savedId ? 'Enregistrée' : "Enregistrer l'attestation"}
          </Button>
          <Button leftSection={<IconPrinter size={16} />} onClick={handlePrint}>Imprimer l'attestation</Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default AttestationOccasion;
