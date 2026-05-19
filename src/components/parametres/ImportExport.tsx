// src/components/parametres/ImportExport.tsx
import React, { useState } from 'react';
import { Card, Button, Group, Stack, Text, Alert, FileInput, LoadingOverlay } from '@mantine/core';
import { IconUpload, IconDownload, IconAlertCircle } from '@tabler/icons-react';
import { importProductsFromExcel, exportProductsToExcel } from '../../services/importService';
import { notifications } from '@mantine/notifications';

export const ImportExport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleImport = async () => {
    if (!file) {
      notifications.show({
        title: 'Erreur',
        message: 'Sélectionnez un fichier Excel',
        color: 'red',
      });
      return;
    }
    
    setLoading(true);
    try {
      const result = await importProductsFromExcel(file);
      notifications.show({
        title: 'Import terminé',
        message: `${result.success} produits importés. ${result.errors.length} erreurs.`,
        color: result.errors.length > 0 ? 'yellow' : 'green',
      });
      setFile(null);
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de l\'import',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      await exportProductsToExcel();
      notifications.show({
        title: 'Succès',
        message: 'Export terminé',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de l\'export',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card withBorder p="lg" pos="relative">
      <LoadingOverlay visible={loading} />
      <Stack gap="md">
        <Text fw={600} size="lg">📊 Import/Export Excel</Text>
        
        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          Format attendu: code_produit, designation, categorie, prix_achat_base, prix_vente_detail, qte_stock
        </Alert>
        
        <FileInput
          label="Fichier Excel"
          placeholder="Sélectionnez un fichier .xlsx"
          accept=".xlsx,.xls"
          value={file}
          onChange={setFile}
        />
        
        <Group>
          <Button 
            leftSection={<IconUpload size={18} />} 
            onClick={handleImport}
            color="blue"
            disabled={!file}
          >
            Importer
          </Button>
          
          <Button 
            leftSection={<IconDownload size={18} />} 
            onClick={handleExport}
            color="green"
            variant="outline"
          >
            Exporter les produits
          </Button>
        </Group>
      </Stack>
    </Card>
  );
};