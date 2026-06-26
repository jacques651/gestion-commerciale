// src/components/products/ModalImportProduits.tsx
import React, { useState, useRef } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Alert,
  Progress,
  Card,
  SimpleGrid,
  Table,
  ScrollArea,
  Stepper,
  Badge
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconFileExcel,
  IconUpload,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconAlertCircle,
  IconRocket,
  IconAutomation,
  IconFileDescription
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { productRepository, CreateProductInput } from '../../database/repositories/productRepository';

interface ModalImportProduitsProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EXPECTED_COLUMNS = [
  { key: 'designation', label: 'Désignation', required: true },
  { key: 'categorie', label: 'Catégorie', required: false },
  { key: 'unite_base', label: 'Unité', required: false },
  { key: 'prix_achat_base', label: 'Prix achat', required: false },
  { key: 'prix_vente_detail', label: 'Prix vente détail', required: false },
  { key: 'prix_vente_gros', label: 'Prix vente gros', required: false },
  { key: 'seuil_alerte', label: 'Seuil alerte', required: false },
  { key: 'qte_stock', label: 'Stock', required: false },
  { key: 'methode_gestion_stock', label: 'Méthode gestion', required: false }
];

export const ModalImportProduits: React.FC<ModalImportProduitsProps> = ({
  opened,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [importData, setImportData] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [, setSeparator] = useState(',');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setFileContent] = useState('');

  const generateCSVTemplate = (): string => {
    const headers = EXPECTED_COLUMNS.map(col => col.label).join(',');
    const exampleRow = [
      'Disque dur SSD 1To',
      'Informatique',
      'pièce',
      '25000',
      '50000',
      '45000',
      '10',
      '10',
      'PMP'
    ].join(',');
    return `${headers}\n${exampleRow}`;
  };

  const downloadCSVTemplate = () => {
    const csvContent = generateCSVTemplate();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'template_import_produits.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notifications.show({ 
      title: '✅ Template téléchargé', 
      message: '9 colonnes disponibles - Seule Désignation est obligatoire', 
      color: 'green' 
    });
  };

  const downloadExcelTemplate = () => {
    notifications.show({
      title: '✅ Template Excel',
      message: 'Le téléchargement va commencer.',
      color: 'green',
    });

    setTimeout(() => {
      const wsData = [
        EXPECTED_COLUMNS.map(col => col.label),
        [
          'Disque dur SSD 1To',
          'Informatique',
          'pièce',
          '25000',
          '50000',
          '45000',
          '10',
          '10',
          'PMP'
        ]
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Produits');
      XLSX.writeFile(wb, 'template_import_produits.xlsx');
    }, 150);
  };

  const detectSeparator = (firstLine: string): string => {
    const separators = [',', ';', '\t', '|'];
    let bestSep = ',';
    let maxCount = 0;
    for (const sep of separators) {
      const count = firstLine.split(sep).length;
      if (count > maxCount && count > 1) {
        maxCount = count;
        bestSep = sep;
      }
    }
    return bestSep;
  };

  const normalizeHeader = (header: string) => {
    const h = header
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .replace(/[*_]/g, '');

    if (h === 'designation') return 'designation';
    if (h === 'categorie') return 'categorie';
    if (h === 'unite' || h === 'unitebase') return 'unite_base';
    if (h === 'prixachat') return 'prix_achat_base';
    if (h === 'prixvente' || h === 'prixventedetail') return 'prix_vente_detail';
    if (h === 'prixgros' || h === 'prixventegros') return 'prix_vente_gros';
    if (h === 'seuilalerte') return 'seuil_alerte';
    if (h === 'stock' || h === 'qtestock') return 'qte_stock';
    if (h === 'methodegestion' || h === 'methodestock' || h === 'gestionstock') return 'methode_gestion_stock';

    return h;
  };

  const parseCSV = (text: string, sep: string): any[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const cleanLines = lines.map(line => line.trim());
    const headers = cleanLines[0].split(sep).map(h => normalizeHeader(h.trim()));

    const results = [];

    for (let i = 1; i < cleanLines.length; i++) {
      const line = cleanLines[i];
      if (line === '') continue;

      let values: string[] = [];
      let inQuotes = false;
      let currentValue = '';

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === sep && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());

      values = values.map(v => v.replace(/^["']|["']$/g, ''));

      const row: any = {};
      headers.forEach((header, idx) => {
        if (header && values[idx] !== undefined && values[idx] !== '') {
          row[header] = values[idx];
        }
      });

      if (row.designation && row.designation.trim() !== '') {
        results.push(row);
      } else if (values[0] && values[0].trim() !== '') {
        results.push({ designation: values[0].trim() });
      }
    }

    return results;
  };

  const sheetToRows = (sheet: XLSX.WorkSheet): any[] => {
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    return json.map((row) => {
      const mapped: any = {};
      Object.entries(row).forEach(([key, value]) => {
        const normalized = normalizeHeader(key);
        mapped[normalized] = typeof value === 'string' ? value.trim() : value;
      });
      return mapped;
    });
  };

  const validateAndCompleteData = async (data: any[]): Promise<{ valid: any[]; errors: any[] }> => {
    const valid: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      if (!row.designation || row.designation.trim() === '') {
        errors.push({ row: i + 2, errors: ['Désignation obligatoire'], data: row });
        continue;
      }

      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const codeProduit = timestamp * 10000 + random;

      // Valeurs par défaut
      const uniteBase = row.unite_base || 'pièce';
      const seuilAlerte = row.seuil_alerte ? parseFloat(String(row.seuil_alerte)) : 10;
      const prixAchat = row.prix_achat_base ? parseFloat(String(row.prix_achat_base)) : 0;
      const prixVenteDetail = row.prix_vente_detail ? parseFloat(String(row.prix_vente_detail)) : 0;
      const prixVenteGros = row.prix_vente_gros ? parseFloat(String(row.prix_vente_gros)) : 0;
      const qteStock = row.qte_stock ? parseFloat(String(row.qte_stock)) : 0;
      const methodeGestion = row.methode_gestion_stock || 'PMP';

      // Si seul le prix d'achat est fourni, on utilise une marge par défaut
      const prixVenteFinal = prixVenteDetail > 0 ? prixVenteDetail : (prixAchat > 0 ? prixAchat + 5000 : 0);
      const prixGrosFinal = prixVenteGros > 0 ? prixVenteGros : Math.round(prixVenteFinal * 0.9);

      const product: CreateProductInput = {
        code_produit: codeProduit,
        designation: row.designation.trim(),
        categorie: row.categorie || '',
        unite_base: uniteBase,
        prix_achat_base: prixAchat,
        prix_vente_detail: prixVenteFinal,
        prix_vente_gros: prixGrosFinal,
        seuil_alerte: seuilAlerte,
        qte_stock: qteStock,
        prix_moyen_pondere: 0,
        methode_gestion_stock: methodeGestion
      };

      valid.push(product);
    }

    return { valid, errors };
  };

  const handleImport = async () => {
    if (importData.length === 0) {
      notifications.show({ 
        title: 'Erreur', 
        message: 'Aucune donnée valide à importer', 
        color: 'red' 
      });
      return;
    }

    setLoading(true);
    setProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < importData.length; i++) {
      try {
        await productRepository.create(importData[i]);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Erreur import ${importData[i].designation}:`, error);
      }
      setProgress(((i + 1) / importData.length) * 100);
    }

    setLoading(false);

    if (successCount > 0) {
      notifications.show({
        title: '✅ Import terminé',
        message: `${successCount} produit(s) importé(s)${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`,
        color: 'green'
      });
      onSuccess();
      onClose();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      let parsed: any[] = [];

      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        parsed = sheetToRows(sheet);
        setSeparator('excel');
        setFileContent('');
      } else {
        const content = await file.text();
        setFileContent(content);
        const firstLine = content.split(/\r?\n/)[0] || '';
        const detectedSep = detectSeparator(firstLine);
        setSeparator(detectedSep);
        parsed = parseCSV(content, detectedSep);
      }

      if (parsed.length === 0) {
        notifications.show({
          title: 'Erreur',
          message: 'Aucune donnée trouvée. Vérifiez le format du fichier.',
          color: 'red'
        });
        return;
      }

      const { valid, errors: validationErrors } = await validateAndCompleteData(parsed);
      setImportData(valid);
      setErrors(validationErrors);

      if (valid.length > 0) {
        notifications.show({
          title: '✅ Fichier analysé',
          message: `${valid.length} produit(s) valide(s) trouvé(s).`,
          color: 'green'
        });
        setStep(2);
      } else {
        notifications.show({
          title: '❌ Erreur',
          message: 'Aucune ligne valide. Vérifiez que chaque ligne a une désignation.',
          color: 'red'
        });
      }
    } catch (error) {
      console.error(error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de lire ce fichier.',
        color: 'red'
      });
    }
  };

  const resetImport = () => {
    setStep(1);
    setImportData([]);
    setErrors([]);
    setProgress(0);
    setFileName('');
    setFileContent('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        resetImport();
        onClose();
      }}
      title={
        <Group gap="sm">
          <IconRocket size={24} color="#228be6" />
          <div>
            <Text fw={700} size="lg">Import de produits</Text>
            <Text size="xs" c="dimmed">Seule la désignation est obligatoire</Text>
          </div>
        </Group>
      }
      size="xl"
      centered
      padding="lg"
      radius="lg"
    >
      <Stepper active={step - 1} size="sm">
        <Stepper.Step label="1. Template" description="Télécharger" />
        <Stepper.Step label="2. Fichier" description="Charger" />
        <Stepper.Step label="3. Importer" description="Valider" />
      </Stepper>

      <Stack mt="xl" gap="md">
        {step === 1 && (
          <>
            <Alert color="green" variant="light" icon={<IconAutomation size={18} />}>
              <Text fw={600}>📋 9 colonnes disponibles</Text>
              <Text size="sm">Seule la colonne <strong>Désignation</strong> est obligatoire.</Text>
            </Alert>

            <Card withBorder p="md" radius="md">
              <Text fw={600} mb="md" ta="center">📥 Télécharger le template</Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Button
                  variant="gradient"
                  gradient={{ from: 'green', to: 'teal', deg: 90 }}
                  leftSection={<IconFileExcel size={18} />}
                  onClick={downloadExcelTemplate}
                  fullWidth
                  size="lg"
                >
                  📊 Template Excel
                </Button>
                <Button
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan', deg: 90 }}
                  leftSection={<IconFileDescription size={18} />}
                  onClick={downloadCSVTemplate}
                  fullWidth
                  size="lg"
                >
                  📄 Template CSV
                </Button>
              </SimpleGrid>
            </Card>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Card withBorder p="md" radius="md" bg="blue.0">
                <Text fw={600} mb="xs">📋 Colonnes</Text>
                {EXPECTED_COLUMNS.map((col) => (
                  <Text key={col.key} size="sm">
                    • {col.label} {col.required && <Badge color="red" size="xs">Obligatoire</Badge>}
                  </Text>
                ))}
              </Card>

              <Card withBorder p="md" radius="md" bg="green.0">
                <Text fw={600} mb="xs">🤖 Valeurs par défaut</Text>
                <Text size="sm">• Unité : "pièce"</Text>
                <Text size="sm">• Seuil alerte : 10</Text>
                <Text size="sm">• Méthode de gestion : "PMP"</Text>
                <Text size="sm">• Code produit : Généré auto</Text>
                <Text size="sm">• Prix vente = Prix achat + 5000 F (si non renseigné)</Text>
              </Card>
            </SimpleGrid>
          </>
        )}

        {step === 2 && (
          <>
            <Card withBorder p="md" radius="md">
              <input
                type="file"
                accept=".csv,.xls,.xlsx,.txt"
                onChange={handleFileUpload}
                ref={fileInputRef}
                style={{ display: 'none' }}
              />
              <Button
                variant="light"
                color="blue"
                leftSection={<IconUpload size={18} />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
                size="lg"
              >
                📂 Sélectionner votre fichier
              </Button>
              {fileName && <Text size="xs" c="dimmed" ta="center" mt="sm">Fichier : {fileName}</Text>}
            </Card>

            {errors.length > 0 && (
              <Alert color="yellow" variant="light" icon={<IconAlertCircle size={18} />}>
                <Text fw={600}>⚠️ {errors.length} ligne(s) ignorée(s)</Text>
                <ScrollArea h={100}>
                  {errors.slice(0, 5).map((err, idx) => (
                    <Text key={idx} size="xs">• Ligne {err.row}: {err.errors.join(', ')}</Text>
                  ))}
                </ScrollArea>
              </Alert>
            )}

            {importData.length > 0 && (
              <>
                <Alert color="green" variant="light" icon={<IconCheck size={18} />}>
                  <Text fw={600}>✅ {importData.length} produit(s) valide(s)</Text>
                </Alert>

                <Card withBorder p="md" radius="md">
                  <Text fw={600} mb="sm">📊 Aperçu (10 premiers)</Text>
                  <ScrollArea h={200}>
                    <Table striped>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Désignation</Table.Th>
                          <Table.Th>Catégorie</Table.Th>
                          <Table.Th>Unité</Table.Th>
                          <Table.Th>Prix achat</Table.Th>
                          <Table.Th>Prix vente</Table.Th>
                          <Table.Th>Prix gros</Table.Th>
                          <Table.Th>Stock</Table.Th>
                          <Table.Th>Méthode</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {importData.slice(0, 10).map((item, idx) => (
                          <Table.Tr key={idx}>
                            <Table.Td>
                              <Text fw={500} size="sm">{item.designation}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{item.categorie || '-'}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{item.unite_base}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{Number(item.prix_achat_base || 0).toLocaleString()} F</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge color="blue" size="sm">{Number(item.prix_vente_detail || 0).toLocaleString()} F</Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{Number(item.prix_vente_gros || 0).toLocaleString()} F</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{item.qte_stock}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge color="teal" size="sm">{item.methode_gestion_stock || 'PMP'}</Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Card>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Card withBorder p="md" radius="md" ta="center">
              <Text fw={700} size="xl">{importData.length}</Text>
              <Text size="sm">produit(s) à importer</Text>
            </Card>

            {loading && (
              <Card withBorder p="md" radius="md">
                <Text size="sm" mb="xs">Import en cours... {Math.round(progress)}%</Text>
                <Progress value={progress} size="lg" radius="md" color="green" animated />
              </Card>
            )}

            <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />}>
              <Text size="sm">🔍 Résumé de l'import :</Text>
              <Text size="xs">• {importData.length} produit(s) seront ajoutés</Text>
              <Text size="xs">• Un code unique sera généré pour chaque produit</Text>
              <Text size="xs">• La méthode de gestion par défaut est "PMP"</Text>
            </Alert>
          </>
        )}
      </Stack>

      <Group justify="space-between" mt="xl">
        <Button variant="outline" onClick={resetImport} leftSection={<IconX size={16} />}>
          Réinitialiser
        </Button>
        <Group>
          {step > 1 && <Button variant="light" onClick={() => setStep(step - 1)}>Précédent</Button>}
          {step < 3 && (
            <Button 
              onClick={() => setStep(step + 1)} 
              disabled={step === 2 && importData.length === 0} 
              color="blue"
            >
              Suivant
            </Button>
          )}
          {step === 3 && (
            <Button 
              onClick={handleImport} 
              loading={loading} 
              disabled={importData.length === 0} 
              color="green"
            >
              Importer {importData.length} produit(s)
            </Button>
          )}
        </Group>
      </Group>
    </Modal>
  );
};

export default ModalImportProduits;