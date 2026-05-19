// src/components/reglements/FormulaireReglement.tsx
import React, { useState, useEffect } from 'react';
import { Modal, Select, NumberInput, TextInput, Button, Group, Stack, LoadingOverlay } from '@mantine/core';
import { useReglements } from '../../hooks/useReglements';
import { useFactures } from '../../hooks/useFactures';
import { notifications } from '@mantine/notifications';
import { getNextReglementCode } from '../../services/codeGeneratorService';

interface FormulaireReglementProps {
  opened: boolean;
  onClose: () => void;
  idFacture?: number;
  idClient?: number;
  montantMax?: number;
}

export const FormulaireReglement: React.FC<FormulaireReglementProps> = ({ 
  opened, onClose, idFacture, idClient, montantMax 
}) => {
  const { createReglement } = useReglements();
  const { factures } = useFactures();
  const [loading, setLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeReglement, setCodeReglement] = useState<string>('');
  
  const [formData, setFormData] = useState({
    idFacture: idFacture || null,
    idClient: idClient || null,
    montant: 0,
    mode_reglement: '',
    reference: '',
    observation: '',
  });

  // Générer automatiquement le code règlement à l'ouverture du modal
  useEffect(() => {
    const generateCode = async () => {
      if (opened) {
        setGeneratingCode(true);
        try {
          const code = await getNextReglementCode();
          setCodeReglement(code);
        } catch (error) {
          console.error('Erreur génération code:', error);
        } finally {
          setGeneratingCode(false);
        }
      }
    };
    generateCode();
  }, [opened]);

  // Mettre à jour idFacture et idClient quand les props changent
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      idFacture: idFacture || null,
      idClient: idClient || null,
    }));
  }, [idFacture, idClient]);

  // Réinitialiser le formulaire à la fermeture
  useEffect(() => {
    if (!opened) {
      setFormData({
        idFacture: null,
        idClient: null,
        montant: 0,
        mode_reglement: '',
        reference: '',
        observation: '',
      });
      setCodeReglement('');
    }
  }, [opened]);

  const modesReglement = [
    { value: 'ESPECES', label: 'Espèces' },
    { value: 'CHEQUE', label: 'Chèque' },
    { value: 'VIREMENT', label: 'Virement bancaire' },
    { value: 'CARTE', label: 'Carte bancaire' },
    { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  ];

  const factureOptions = factures
    .filter(f => f.statut !== 'REGLEE' && f.statut !== 'ANNULEE')
    .map(f => ({
      value: f.idFacture.toString(),
      label: `${f.code_facture} - ${f.client_nom || 'Client'} - ${((f.montant_restant || f.montant_ttc) || 0).toLocaleString()} FCFA restant`
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.mode_reglement) {
      notifications.show({ title: 'Erreur', message: 'Sélectionnez un mode de règlement', color: 'red' });
      return;
    }
    
    if (formData.montant <= 0) {
      notifications.show({ title: 'Erreur', message: 'Le montant doit être supérieur à 0', color: 'red' });
      return;
    }
    
    if (montantMax && formData.montant > montantMax) {
      notifications.show({ 
        title: 'Erreur', 
        message: `Le montant ne peut pas dépasser ${montantMax.toLocaleString()} FCFA`, 
        color: 'red' 
      });
      return;
    }
    
    setLoading(true);
    
    try {
      await createReglement({
        idClient: formData.idClient,
        idFacture: formData.idFacture,
        idDecompte: null,
        montant: formData.montant,
        mode_reglement: formData.mode_reglement,
        reference: formData.reference || null,
        observation: formData.observation || null,
      });
      
      notifications.show({
        title: 'Succès',
        message: `Règlement ${codeReglement} enregistré avec succès`,
        color: 'green',
      });
      
      onClose();
      
    } catch (error) {
      console.error(error);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de l\'enregistrement du règlement',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Enregistrer un règlement"
      size="md"
      padding="xl"
    >
      <LoadingOverlay visible={generatingCode} />
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Code règlement"
            value={codeReglement}
            readOnly
            disabled
            styles={{ input: { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } }}
          />

          {!idFacture && (
            <Select
              label="Facture"
              placeholder="Sélectionnez une facture"
              data={factureOptions}
              value={formData.idFacture?.toString() || null}
              onChange={(value) => setFormData({ ...formData, idFacture: value ? parseInt(value) : null })}
              searchable
              clearable
            />
          )}
          
          <Select
            label="Mode de règlement"
            placeholder="Choisissez un mode"
            data={modesReglement}
            value={formData.mode_reglement}
            onChange={(value) => setFormData({ ...formData, mode_reglement: value || '' })}
            required
          />
          
          <NumberInput
            label="Montant"
            placeholder="Montant à régler"
            value={formData.montant}
            onChange={(value) => setFormData({ ...formData, montant: Number(value) || 0 })}
            min={0}
            max={montantMax}
            step={1000}
            required
          />
          
          <TextInput
            label="Référence"
            placeholder="Numéro de chèque, virement..."
            value={formData.reference}
            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
          />
          
          <TextInput
            label="Observation"
            placeholder="Commentaire..."
            value={formData.observation}
            onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
          />
          
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={loading} color="green">
              Enregistrer
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};