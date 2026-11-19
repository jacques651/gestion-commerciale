// src/components/caisse/RapportsVente.tsx
// ============================================================================
// ÉCRAN « RAPPORTS DE VENTE »
// ----------------------------------------------------------------------------
// Les rapports de fin de poste n'étaient consultables qu'au moment de la
// clôture. Cet écran les rend accessibles à tout moment : consultation,
// filtrage, impression et téléchargement à volonté, y compris pour le poste
// en cours (rapport provisoire).
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  Card, Stack, Group, Text, Title, Button, Select, TextInput, Table,
  Badge, SimpleGrid, Paper, Loader, Center, Divider, ThemeIcon, Alert, Flex,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconReportMoney, IconPrinter, IconDownload, IconRefresh,
  IconFilter, IconAlertCircle, IconCash, IconDeviceMobile,
} from '@tabler/icons-react';

import {
  rapportVenteService,
  RapportVente,
  FiltreRapport,
} from '../../services/rapportVenteService';
import { libelleModePaiement } from '../../services/journalCaisseService';
import { imprimerRapportVente } from '../../utils/rapportVenteHtml';
import {
  formatImpressionService,
  optionsFormatPapier,
  FormatPapier,
} from '../../utils/printFormats';
import { saveText } from '../../utils/fileExport';
import { getDb } from '../../database/db';
import { useTransactionContext, useTransactionSnapshot } from '../../hooks/useTransactionSnapshot';
import TransactionsSummary from '../ventes/TransactionsSummary';
import type { TransactionOrigin } from '../../services/transactionContracts';

const fmt = (v: number | null | undefined): string =>
  (v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });

const fmtDate = (d?: string | null): string => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('fr-FR') + ' ' +
    dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const aujourdhui = () => new Date().toISOString().split('T')[0];

export const RapportsVente: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rapport, setRapport] = useState<RapportVente | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [operateurs, setOperateurs] = useState<string[]>([]);
  const [nomCommerce, setNomCommerce] = useState<string>('');

  // Filtres
  const [portee, setPortee] = useState<'SESSION' | 'PERIODE'>('PERIODE');
  const [idSession, setIdSession] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string>(aujourdhui());
  const [dateFin, setDateFin] = useState<string>(aujourdhui());
  const [operateur, setOperateur] = useState<string | null>(null);
  const [categorie, setCategorie] = useState<string | null>(null);
  const [origine, setOrigine] = useState<TransactionOrigin | null>(null);
  const txContext = useTransactionContext();
  const transactionSnapshot = useTransactionSnapshot(txContext, { dateDebut, dateFin, origin: origine ?? undefined });

  // Format d'impression, pré-rempli depuis les Paramètres
  const [format, setFormat] = useState<FormatPapier>('A4');

  useEffect(() => {
    (async () => {
      try {
        const [ses, ops, fmtDefaut] = await Promise.all([
          rapportVenteService.listerSessions(),
          rapportVenteService.listerOperateurs(),
          formatImpressionService.getFormatDefaut(),
        ]);
        setSessions(ses);
        setOperateurs(ops);
        setFormat(fmtDefaut);

        const db = await getDb();
        const cfg = await db.select<any[]>(
          `SELECT nom_atelier FROM configuration_atelier WHERE id = 1`
        );
        setNomCommerce(cfg[0]?.nom_atelier || '');
      } catch (e) {
        console.error('Erreur initialisation des rapports:', e);
      }
    })();
  }, []);

  const genererRapport = useCallback(async () => {
    setLoading(true);
    try {
      const filtre: FiltreRapport =
        portee === 'SESSION'
          ? { idSession: idSession ? parseInt(idSession) : null, categorie: categorie || null }
          : { dateDebut, dateFin, operateur: operateur || null, categorie: categorie || null };
      filtre.origin = origine ?? undefined;

      if (portee === 'SESSION' && !idSession) {
        notifications.show({
          title: 'Sélection requise',
          message: 'Choisissez un poste pour générer le rapport',
          color: 'orange',
        });
        setLoading(false);
        return;
      }

      setRapport(await rapportVenteService.construire(filtre));
    } catch (e: any) {
      notifications.show({
        title: 'Erreur',
        message: e?.message || 'Impossible de générer le rapport',
        color: 'red',
      });
      setRapport(null);
    } finally {
      setLoading(false);
    }
  }, [portee, idSession, dateDebut, dateFin, operateur, categorie, origine]);

  // Génération automatique au chargement et à chaque changement de filtre
  useEffect(() => { genererRapport(); }, [genererRapport]);

  const imprimer = () => {
    if (!rapport) return;
    imprimerRapportVente(rapport, { format, nomCommerce });
  };

  const telecharger = async () => {
    if (!rapport) return;
    try {
      const csv = rapportVenteService.construireCsv(rapport);
      const nom = `rapport-vente-${
        rapport.codeSession || `${dateDebut}_${dateFin}`
      }.csv`;
      // BOM UTF-8 pour un affichage correct des accents dans Excel
      await saveText('﻿' + csv, nom);
      notifications.show({
        title: 'Rapport téléchargé',
        message: nom,
        color: 'green',
      });
    } catch (e: any) {
      notifications.show({
        title: 'Erreur',
        message: e?.message || 'Téléchargement impossible',
        color: 'red',
      });
    }
  };

  const v = rapport?.ventilation;

  return (
    <Stack gap="md">
      {/* En-tête */}
      <Paper className="tk-page-tools"
        p="lg"
        radius="lg">
        <Flex justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="md">
            <ThemeIcon size={45} radius="md" color="teal" variant="filled">
              <IconReportMoney size={28} />
            </ThemeIcon>
            <div>
              <Title order={2} c="white">Rapports de vente</Title>
              <Text c="gray.3" size="sm">
                Consultables, imprimables et téléchargeables à tout moment
              </Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="white"
              leftSection={<IconRefresh size={16} />}
              onClick={genererRapport}
            >
              Actualiser
            </Button>
          </Group>
        </Flex>
      </Paper>

      {/* Filtres */}
      <Card withBorder radius="lg" shadow="sm" p="md">
        <Group gap="xs" mb="sm">
          <IconFilter size={18} />
          <Text fw={600} size="sm">Filtres du rapport</Text>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="sm">
          <Select label="Origine" placeholder="Toutes" clearable size="xs" value={origine}
            data={[{value:'vente',label:'Vente'},{value:'prestation',label:'Prestation'}]}
            onChange={value=>setOrigine(value as TransactionOrigin|null)} />
          <Select
            label="Portée"
            data={[
              { value: 'PERIODE', label: 'Période / dates' },
              { value: 'SESSION', label: 'Un poste précis' },
            ]}
            value={portee}
            onChange={(val) => val && setPortee(val as 'SESSION' | 'PERIODE')}
            allowDeselect={false}
            size="xs"
          />

          {portee === 'SESSION' ? (
            <Select
              label="Poste"
              placeholder="Choisir un poste"
              data={sessions.map((s) => ({
                value: String(s.idSession),
                label: `${s.code_session} — ${s.nom_operateur || 'Inconnu'} (${
                  s.statut === 'OUVERTE' ? 'en cours' : 'clôturé'
                })`,
              }))}
              value={idSession}
              onChange={setIdSession}
              searchable
              size="xs"
            />
          ) : (
            <>
              <TextInput
                label="Du"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                size="xs"
              />
              <TextInput
                label="Au"
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                size="xs"
              />
              <Select
                label="Opérateur"
                placeholder="Tous"
                data={operateurs.map((o) => ({ value: o, label: o }))}
                value={operateur}
                onChange={setOperateur}
                clearable
                searchable
                size="xs"
              />
            </>
          )}

          <Select
            label="Type d'opération"
            placeholder="Toutes"
            data={[
              { value: 'VENTE_COMPTOIR', label: 'Ventes comptoir' },
              { value: 'REGLEMENT_FACTURE', label: 'Règlements factures' },
              { value: 'DECOMPTE_REVENDEUR', label: 'Décomptes revendeurs' },
              { value: 'AUTRE_ENTREE', label: 'Autres entrées' },
              { value: 'CHARGE_FONCTIONNEMENT', label: 'Charges' },
              { value: 'AUTRE_SORTIE', label: 'Autres sorties' },
            ]}
            value={categorie}
            onChange={setCategorie}
            clearable
            size="xs"
          />

          <Select
            label="Format d'impression"
            data={optionsFormatPapier}
            value={format}
            onChange={(val) => val && setFormat(val as FormatPapier)}
            allowDeselect={false}
            size="xs"
          />
        </SimpleGrid>

        <Divider my="sm" />

        <Group justify="flex-end" gap="xs">
          <Button
            variant="light"
            leftSection={<IconDownload size={16} />}
            onClick={telecharger}
            disabled={!rapport}
            size="xs"
          >
            Télécharger (CSV)
          </Button>
          <Button
            leftSection={<IconPrinter size={16} />}
            onClick={imprimer}
            disabled={!rapport}
            size="xs"
          >
            Imprimer / PDF
          </Button>
        </Group>
      </Card>

      {portee === 'PERIODE' && <TransactionsSummary rows={transactionSnapshot.rows} loading={transactionSnapshot.loading}
        error={transactionSnapshot.error} filterOrigin={false} title="Facturation consolidée de la période" />}
      <Text size="xs" c="dimmed">La synthèse commerciale suit la période et l’origine. Le rapport de caisse conserve ses filtres de poste, opérateur et catégorie ; ses flux ne sont pas ajoutés au CA.</Text>
      {loading && (
        <Center py={40}><Loader /></Center>
      )}

      {!loading && rapport && (
        <>
          {rapport.provisoire && rapport.codeSession && (
            <Alert icon={<IconAlertCircle size={16} />} color="yellow">
              Ce poste n'est pas encore clôturé : le rapport est <strong>provisoire</strong>
              {' '}et sera recalculé automatiquement jusqu'à la clôture.
            </Alert>
          )}

          {/* Synthèse */}
          <Card withBorder radius="lg" shadow="sm" p="md">
            <Group justify="space-between" mb="sm">
              <div>
                <Text fw={700} size="lg">
                  {rapport.codeSession ? `Poste ${rapport.codeSession}` : 'Rapport de période'}
                </Text>
                <Text size="sm" c="dimmed">
                  {rapport.libellePeriode} · Opérateur : {rapport.operateurNom}
                </Text>
              </div>
              <Badge color={rapport.provisoire ? 'yellow' : 'green'} size="lg">
                {rapport.provisoire ? 'Provisoire' : 'Définitif'}
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
              <Paper withBorder p="xs" bg="gray.0">
                <Text size="xs" c="dimmed">Report (fond de caisse)</Text>
                <Text fw={700}>{fmt(rapport.report)} F</Text>
              </Paper>
              <Paper withBorder p="xs" bg="green.0">
                <Text size="xs" c="dimmed">Total encaissements</Text>
                <Text fw={700} c="green.8">+ {fmt(rapport.totalEntrees)} F</Text>
              </Paper>
              <Paper withBorder p="xs" bg="red.0">
                <Text size="xs" c="dimmed">Total décaissements</Text>
                <Text fw={700} c="red.8">− {fmt(rapport.totalSorties)} F</Text>
              </Paper>
              <Paper withBorder p="xs" bg="blue.0">
                <Text size="xs" c="dimmed">Total général (report inclus)</Text>
                <Text fw={700} c="blue.8">{fmt(rapport.soldeCalcule)} F</Text>
              </Paper>
            </SimpleGrid>
          </Card>

          {/* Point de caisse */}
          {v && (
            <Card withBorder radius="lg" shadow="sm" p="md">
              <Group gap="xs" mb="sm">
                <IconCash size={18} />
                <Text fw={600}>Point de caisse</Text>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                <Paper withBorder p="sm" bg="blue.0">
                  <Text size="xs" c="dimmed">Montant total des opérations</Text>
                  <Text fw={700} size="xl" c="blue.8">{fmt(v.total)} F</Text>
                  <Text size="xs" c="dimmed">{v.nbOperations} opération(s)</Text>
                </Paper>
                <Paper withBorder p="sm" bg="violet.0">
                  <Group gap={6} mb={2}>
                    <IconDeviceMobile size={14} />
                    <Text size="xs" c="dimmed">Transferts (Mobile Money)</Text>
                  </Group>
                  <Text fw={700} size="xl" c="violet.8">{fmt(v.mobileMoney)} F</Text>
                  {[
                    ['Orange Money', v.orangeMoney],
                    ['Moov Money', v.moovMoney],
                    ['Telecel Money', v.telecelMoney],
                    ['Sank Money', v.sankMoney],
                    ['Wave', v.wave],
                    ['Autre mobile', v.autreMobile],
                  ].filter(([, m]) => (m as number) !== 0).map(([label, m]) => (
                    <Text key={label as string} size="xs" c="dimmed">• {label} : {fmt(m as number)} F</Text>
                  ))}
                  {v.virements !== 0 && (
                    <Text size="xs" c="dimmed">+ {fmt(v.virements)} F de virements</Text>
                  )}
                </Paper>
                <Paper withBorder p="sm" bg="green.0">
                  <Text size="xs" c="dimmed">Espèces effectivement en caisse</Text>
                  <Text fw={700} size="xl" c="green.8">{fmt(rapport.especesAttendues)} F</Text>
                  <Text size="xs" c="dimmed">report inclus : {fmt(rapport.report)} F</Text>
                </Paper>
              </SimpleGrid>

              {v.nbNonPrecise > 0 && (
                <Alert mt="sm" color="yellow" icon={<IconAlertCircle size={16} />}>
                  {v.nbNonPrecise} opération(s) sans mode de paiement renseigné
                  ({fmt(v.nonPrecise)} F). Enregistrées avant l'activation du
                  suivi des modes, elles ne sont comptées ni en espèces ni en
                  transferts.
                </Alert>
              )}

              {rapport.soldeDeclare != null && (
                <Paper withBorder p="sm" mt="sm" bg={rapport.ecart === 0 ? 'green.0' : 'orange.0'}>
                  <Group justify="space-between">
                    <Text size="sm">Solde déclaré au comptage</Text>
                    <Text fw={700}>{fmt(rapport.soldeDeclare)} F</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Écart</Text>
                    <Text fw={700} c={rapport.ecart === 0 ? 'green.8' : 'orange.8'}>
                      {fmt(rapport.ecart)} F
                    </Text>
                  </Group>
                </Paper>
              )}
            </Card>
          )}

          {/* Détail des opérations */}
          <Card withBorder radius="lg" shadow="sm" p="md">
            <Text fw={600} mb="sm">
              Détail des opérations ({rapport.mouvements.length})
            </Text>
            <Table.ScrollContainer minWidth={760}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={50}>N°</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Désignation</Table.Th>
                    <Table.Th ta="center">Type</Table.Th>
                    <Table.Th ta="center">Mode</Table.Th>
                    <Table.Th ta="right">Montant</Table.Th>
                    <Table.Th ta="right">Solde</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rapport.mouvements.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={7} align="center">
                        <Text c="dimmed" py={30}>
                          Aucune opération sur cette période
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    rapport.mouvements.map((m, i) => {
                      const estEntree = m.type_mouvement !== 'SORTIE';
                      const estRetrait = (m.designation || '').toLowerCase().startsWith('retrait patron')
                        || (m.notes || '').startsWith('RETRAIT PATRON');
                      return (
                        <Table.Tr key={m.idJournal}>
                          <Table.Td>{i + 1}</Table.Td>
                          <Table.Td>
                            <Text size="sm">{fmtDate(m.date_journal)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={6}>
                              <Text size="sm" fw={500}>{m.designation || '—'}</Text>
                              {estRetrait && (
                                <Badge size="xs" color="grape" variant="filled">Retrait patron</Badge>
                              )}
                            </Group>
                            {m.reference && (
                              <Text size="xs" c="dimmed">Réf : {m.reference}</Text>
                            )}
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge size="xs" color={estEntree ? 'green' : 'red'} variant="light">
                              {estEntree ? 'Entrée' : 'Sortie'}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge
                              size="xs"
                              variant="light"
                              color={
                                m.mode_paiement === 'ESPECES' ? 'green'
                                : m.mode_paiement === 'MOBILE_MONEY' ? 'violet'
                                : m.mode_paiement ? 'blue'
                                : 'gray'
                              }
                            >
                              {m.mode_paiement_detail || libelleModePaiement(m.mode_paiement)}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} c={estEntree ? 'green' : 'red'}>
                              {estEntree ? '+' : '−'} {fmt(m.montant)} F
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600}>{fmt(m.solde_apres)} F</Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </>
      )}
    </Stack>
  );
};

export default RapportsVente;
