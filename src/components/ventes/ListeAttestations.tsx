// src/components/ventes/ListeAttestations.tsx
// Liste des attestations d'achat-vente : tri par date récente, recherche + filtres,
// et par ligne : imprimer, télécharger en PDF (choix de l'emplacement), annuler / rétablir.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, TextInput, Group, Badge, ActionIcon, Tooltip, Text, Stack,
  Loader, Modal, Button, Textarea, ScrollArea, Grid, Title,
} from '@mantine/core';
import {
  IconSearch, IconPrinter, IconDownload, IconBan, IconArrowBackUp, IconRefresh, IconFileText,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { attestationRepository, Attestation } from '../../database/repositories/attestationRepository';
import { attestationHtml, ATTESTATION_PRINT_STYLES, attestationPdfBlob } from '../../utils/attestationDocument';
import { printHtml, saveFile } from '../../utils/fileExport';
import { useAuth } from '../../contexts/AuthContext';
import TkFilters from '../TkFilters';

interface ListeAttestationsProps {
  reloadSignal?: number; // incrémenté par le parent après création d'une attestation
}

const fmtDate = (d?: string) => {
  if (!d) return '-';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('fr-FR');
};
const fmtMontant = (v?: number) => (v || 0).toLocaleString('fr-FR');

export const ListeAttestations: React.FC<ListeAttestationsProps> = ({ reloadSignal }) => {
  const { user } = useAuth();
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const [annulModal, setAnnulModal] = useState<Attestation | null>(null);
  const [motif, setMotif] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setAttestations(await attestationRepository.getAll());
    } catch (e) {
      notifications.show({ title: 'Erreur', message: 'Chargement des attestations impossible', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [reloadSignal]);

  const filtrees = useMemo(() => {
    const term = search.trim().toLowerCase();
    const termDigits = term.replace(/\D/g, '');
    return attestations.filter((a) => {
      const jour = (a.date_attestation || '').slice(0, 10);
      if (dateDebut && jour < dateDebut) return false;
      if (dateFin && jour > dateFin) return false;
      if (!term) return true;
      const champs = [a.code_attestation, a.cedant_nom, a.cess_nom, a.materiel, a.cedant_tel, a.cess_tel]
        .map((v) => (v || '').toLowerCase());
      const matchTexte = champs.some((c) => c.includes(term));
      const matchTel = termDigits.length > 0 && [a.cedant_tel, a.cess_tel]
        .some((t) => (t || '').replace(/\D/g, '').includes(termDigits));
      return matchTexte || matchTel;
    });
  }, [attestations, search, dateDebut, dateFin]);

  const handleImprimer = (a: Attestation) => {
    printHtml(attestationHtml(a), "Attestation d'achat-vente", ATTESTATION_PRINT_STYLES);
  };

  const handlePdf = async (a: Attestation) => {
    try {
      const blob = attestationPdfBlob(a);
      const res = await saveFile(blob, `${a.code_attestation || 'attestation'}.pdf`);
      if (res !== 'cancelled') {
        notifications.show({ title: 'PDF généré', message: 'Attestation enregistrée en PDF', color: 'green' });
      }
    } catch (e) {
      notifications.show({ title: 'Erreur', message: 'Génération du PDF impossible', color: 'red' });
    }
  };

  const confirmerAnnulation = async () => {
    if (!annulModal) return;
    await attestationRepository.annuler(annulModal.idAttestation, user?.nom, motif.trim() || undefined);
    notifications.show({ title: 'Attestation annulée', message: `${annulModal.code_attestation} annulée`, color: 'orange' });
    setAnnulModal(null);
    setMotif('');
    load();
  };

  const handleRestaurer = async (a: Attestation) => {
    await attestationRepository.restaurer(a.idAttestation);
    notifications.show({ title: 'Attestation rétablie', message: `${a.code_attestation} rétablie`, color: 'green' });
    load();
  };

  return (
    <Card withBorder radius="md" p="md" mt="md">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconFileText size={18} />
          <Title order={5}>Attestations enregistrées</Title>
          <Badge variant="light" color="grape">{filtrees.length}</Badge>
        </Group>
        <Tooltip label="Actualiser">
          <ActionIcon variant="light" onClick={load}><IconRefresh size={16} /></ActionIcon>
        </Tooltip>
      </Group>

      {/* Filtres */}
      <TkFilters>
      <Grid align="flex-end" mb="sm">
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            placeholder="Rechercher (code, cédant, cessionnaire, matériel, téléphone)…"
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            size="sm"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <TextInput type="date" label="Du" value={dateDebut} onChange={(e) => setDateDebut(e.currentTarget.value)} size="sm" />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <TextInput type="date" label="Au" value={dateFin} onChange={(e) => setDateFin(e.currentTarget.value)} size="sm" />
        </Grid.Col>
      </Grid>
      </TkFilters>

      {loading ? (
        <Group justify="center" py="xl"><Loader /></Group>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Code</Table.Th>
                <Table.Th>Cédant</Table.Th>
                <Table.Th>Cessionnaire</Table.Th>
                <Table.Th>Matériel</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Montant</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtrees.length === 0 ? (
                <Table.Tr><Table.Td colSpan={7}><Text ta="center" c="dimmed" py="md">Aucune attestation</Text></Table.Td></Table.Tr>
              ) : filtrees.map((a) => {
                const annulee = !!a.est_annule;
                return (
                  <Table.Tr key={a.idAttestation} style={annulee ? { backgroundColor: '#f1f3f5', opacity: 0.6, textDecoration: 'line-through' } : undefined}>
                    <Table.Td>{fmtDate(a.date_attestation)}</Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <Text size="sm" fw={600}>{a.code_attestation}</Text>
                        {annulee && <Badge color="orange" variant="filled" size="xs">Annulé</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td><Text size="sm">{a.cedant_nom || '-'}</Text></Table.Td>
                    <Table.Td><Text size="sm">{a.cess_nom || '-'}</Text></Table.Td>
                    <Table.Td><Text size="sm" lineClamp={1} maw={220}>{a.materiel || '-'}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text size="sm" fw={600}>{fmtMontant(a.montant)} F</Text></Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="center" wrap="nowrap">
                        <Tooltip label="Imprimer">
                          <ActionIcon variant="light" color="indigo" onClick={() => handleImprimer(a)}><IconPrinter size={16} /></ActionIcon>
                        </Tooltip>
                        <Tooltip label="Télécharger en PDF">
                          <ActionIcon variant="light" color="teal" onClick={() => handlePdf(a)}><IconDownload size={16} /></ActionIcon>
                        </Tooltip>
                        {annulee ? (
                          <Tooltip label="Rétablir">
                            <ActionIcon variant="light" color="green" onClick={() => handleRestaurer(a)}><IconArrowBackUp size={16} /></ActionIcon>
                          </Tooltip>
                        ) : (
                          <Tooltip label="Annuler">
                            <ActionIcon variant="light" color="red" onClick={() => { setAnnulModal(a); setMotif(''); }}><IconBan size={16} /></ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {/* Modal d'annulation */}
      <Modal opened={!!annulModal} onClose={() => setAnnulModal(null)} title="Annuler l'attestation" centered>
        <Stack>
          <Text size="sm">
            Annuler l'attestation <b>{annulModal?.code_attestation}</b> ? Elle restera visible et tracée (marquée « Annulé »).
          </Text>
          <Textarea label="Motif (optionnel)" placeholder="Raison de l'annulation" value={motif} onChange={(e) => setMotif(e.currentTarget.value)} autosize minRows={2} />
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setAnnulModal(null)}>Fermer</Button>
            <Button color="orange" onClick={confirmerAnnulation}>Confirmer l'annulation</Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
};

export default ListeAttestations;
