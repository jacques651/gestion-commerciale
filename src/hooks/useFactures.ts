// src/hooks/useFactures.ts
import { useState, useEffect, useCallback } from 'react';
import { factureRepository } from '../database/repositories/factureRepository';
import { factureRevendeurRepository } from '../database/repositories/factureRevendeurRepository';
import { notifications } from '@mantine/notifications';

// ✅ Créer une interface de base sans les propriétés problématiques
export interface FactureWithDetails {
  // Propriétés communes
  id?: number;
  idFacture?: number;
  idFactureRevendeur?: number;
  idClient?: number;
  idRevendeur?: number;
  idCommande?: number;
  code_facture?: string;
  code_commande?: string;
  date_facture?: string;
  created_at?: string;
  updated_at?: string;
  
  // Montants
  montant_ht?: number;
  montant_tva?: number;
  montant_ttc?: number;
  montant_regle?: number;
  commission?: number;
  taux_commission?: number;
  
  // Statut et type
  statut?: string;
  type?: 'standard' | 'revendeur';
  type_commande?: string;
  type_facture?: string;
  
  // Informations client
  NomComplet?: string;
  Societe?: string;
  Tel?: string;
  Adresse?: string;
  client_nom?: string;
  client_societe?: string;
  
  // Détails
  details?: any[];
  notes?: string;
  observation?: string;
  
  // Autres
  [key: string]: any;
}

export const useFactures = () => {
  const [factures, setFactures] = useState<FactureWithDetails[]>([]);
  const [standardFactures, setStandardFactures] = useState<FactureWithDetails[]>([]);
  const [revendeurFactures, setRevendeurFactures] = useState<FactureWithDetails[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<FactureWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFactures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Chargement des factures...');
      
      // ✅ Charger les factures standards
      const standardData = await factureRepository.getAll();
      console.log('📄 Factures standards:', standardData.length);
      
      // ✅ Charger les factures revendeurs
      const revendeurData = await factureRevendeurRepository.getAll();
      console.log('📄 Factures revendeurs:', revendeurData.length);
      
      // ✅ Fusionner avec un type
      const standardWithType: FactureWithDetails[] = standardData.map((f: any) => ({ 
        ...f, 
        type: 'standard' as const,
        idFacture: f.idFacture,
        montant_ttc: f.montant_ttc || 0,
        code_facture: f.code_facture || `F-${f.idFacture}`,
        date_facture: f.date_facture || new Date().toISOString(),
        statut: f.statut || 'EN_ATTENTE',
        NomComplet: f.NomComplet || f.client_nom || 'Client'
      }));
      
      const revendeurWithType: FactureWithDetails[] = revendeurData.map((f: any) => ({ 
        ...f, 
        type: 'revendeur' as const,
        idFactureRevendeur: f.idFactureRevendeur,
        montant_ttc: f.montant_ttc || 0,
        code_facture: f.code_facture || `FR-${f.idFactureRevendeur}`,
        date_facture: f.date_facture || new Date().toISOString(),
        statut: f.statut || 'EN_ATTENTE',
        NomComplet: f.NomComplet || f.client_nom || 'Revendeur'
      }));
      
      // ✅ Fusionner les deux listes
      const allFactures = [...standardWithType, ...revendeurWithType];
      
      // ✅ Trier par date décroissante
      allFactures.sort((a, b) => {
        const dateA = new Date(a.date_facture || a.created_at || 0);
        const dateB = new Date(b.date_facture || b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log('📄 Total factures:', allFactures.length);
      
      setFactures(allFactures);
      setStandardFactures(standardWithType);
      setRevendeurFactures(revendeurWithType);
      setError(null);
      
    } catch (err: any) {
      console.error('❌ Erreur chargement factures:', err);
      setError(err?.message || 'Erreur de chargement des factures');
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les factures',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnpaidInvoices = useCallback(async () => {
    try {
      // ✅ Factures standards impayées
      const standardUnpaid = await factureRepository.getUnpaidInvoices();
      
      // ✅ Factures revendeurs impayées
      const revendeurData = await factureRevendeurRepository.getAll();
      const revendeurUnpaid = revendeurData.filter((f: any) => 
        f.statut === 'EN_ATTENTE' || f.statut === 'en_attente'
      );
      
      const allUnpaid: FactureWithDetails[] = [
        ...standardUnpaid.map((f: any) => ({ 
          ...f, 
          type: 'standard' as const,
          montant_ttc: f.montant_ttc || 0,
          code_facture: f.code_facture || `F-${f.idFacture}`,
          date_facture: f.date_facture || new Date().toISOString(),
          statut: f.statut || 'EN_ATTENTE',
          NomComplet: f.NomComplet || f.client_nom || 'Client'
        })),
        ...revendeurUnpaid.map((f: any) => ({ 
          ...f, 
          type: 'revendeur' as const,
          montant_ttc: f.montant_ttc || 0,
          code_facture: f.code_facture || `FR-${f.idFactureRevendeur}`,
          date_facture: f.date_facture || new Date().toISOString(),
          statut: f.statut || 'EN_ATTENTE',
          NomComplet: f.NomComplet || f.client_nom || 'Revendeur'
        }))
      ];
      
      setUnpaidInvoices(allUnpaid);
    } catch (err) {
      console.error('❌ Erreur chargement factures impayées:', err);
    }
  }, []);

  const createFacture = useCallback(async (idCommande: number) => {
    try {
      const id = await factureRepository.createFromCommande(idCommande);
      notifications.show({
        title: 'Succès',
        message: 'Facture créée avec succès',
        color: 'green',
      });
      await loadFactures();
      await loadUnpaidInvoices();
      return id;
    } catch (err) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la création de la facture',
        color: 'red',
      });
      throw err;
    }
  }, [loadFactures, loadUnpaidInvoices]);

  const updateStatus = useCallback(async (id: number, statut: string, type: 'standard' | 'revendeur' = 'standard') => {
    try {
      if (type === 'revendeur') {
        await factureRevendeurRepository.updateStatut(id, statut);
      } else {
        await factureRepository.updateStatus(id, statut);
      }
      
      notifications.show({
        title: 'Succès',
        message: `Statut mis à jour: ${statut}`,
        color: 'green',
      });
      await loadFactures();
      await loadUnpaidInvoices();
    } catch (err) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la mise à jour',
        color: 'red',
      });
      throw err;
    }
  }, [loadFactures, loadUnpaidInvoices]);

  const getFactureById = useCallback(async (id: number, type: 'standard' | 'revendeur' = 'standard') => {
    try {
      if (type === 'revendeur') {
        return await factureRevendeurRepository.getById(id);
      }
      return await factureRepository.getById(id);
    } catch (err) {
      console.error('❌ Erreur getFactureById:', err);
      return null;
    }
  }, []);

  const getFactureByCode = useCallback(async (code: string) => {
    try {
      // Chercher dans les factures standards
      const standard = factures.find(f => f.code_facture === code && f.type === 'standard');
      if (standard) return standard;
      
      // Chercher dans les factures revendeurs
      const revendeur = factures.find(f => f.code_facture === code && f.type === 'revendeur');
      if (revendeur) return revendeur;
      
      return null;
    } catch (err) {
      console.error('❌ Erreur getFactureByCode:', err);
      return null;
    }
  }, [factures]);

  useEffect(() => {
    loadFactures();
    loadUnpaidInvoices();
  }, [loadFactures, loadUnpaidInvoices]);

  return {
    factures,
    standardFactures,
    revendeurFactures,
    unpaidInvoices,
    loading,
    error,
    createFacture,
    updateStatus,
    getFactureById,
    getFactureByCode,
    refresh: loadFactures,
    refreshUnpaid: loadUnpaidInvoices,
  };
};