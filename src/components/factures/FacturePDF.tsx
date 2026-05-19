// src/components/factures/FacturePDF.tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Enregistrer une police (optionnel)
Font.register({
  family: 'Roboto',
  src: 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Mu4mxP.ttf',
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Roboto',
    fontSize: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottom: '1px solid #ccc',
    paddingBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 9,
    color: '#666',
    marginBottom: 3,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
    padding: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  table: {
    marginTop: 10,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #eee',
    padding: 8,
  },
  col1: { width: '40%' },
  col2: { width: '15%', textAlign: 'right' },
  col3: { width: '15%', textAlign: 'right' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '15%', textAlign: 'right' },
  totalSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  totalLabel: {
    width: 100,
    fontWeight: 'bold',
  },
  totalValue: {
    width: 120,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: 'center',
    borderTop: '1px solid #ccc',
    paddingTop: 10,
    fontSize: 8,
    color: '#666',
  },
});

interface FacturePDFProps {
  facture: any;
  config?: any;
}

export const FacturePDF: React.FC<FacturePDFProps> = ({ facture, config }) => {
  const companyConfig = config || {
    nom_atelier: 'MON ENTREPRISE',
    telephone: '+225 27 20 00 00 00',
    email: 'contact@email.com',
    adresse: 'Abidjan, Côte d\'Ivoire',
    nif: '12345678',
    message_facture: 'Merci de votre confiance',
  };

  const formatCurrency = (amount: number) => `${amount.toLocaleString('fr-FR')} FCFA`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>{companyConfig.nom_atelier}</Text>
            <Text style={styles.infoText}>NIF: {companyConfig.nif}</Text>
            <Text style={styles.infoText}>Tél: {companyConfig.telephone}</Text>
            <Text style={styles.infoText}>Email: {companyConfig.email}</Text>
            <Text style={styles.infoText}>Adresse: {companyConfig.adresse}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>FACTURE</Text>
            <Text style={styles.infoText}>N°: {facture.code_facture}</Text>
            <Text style={styles.infoText}>Date: {new Date(facture.date_facture).toLocaleDateString('fr-FR')}</Text>
          </View>
        </View>

        {/* Client Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Facturé à</Text>
          <Text style={{ fontWeight: 'bold' }}>{facture.client_nom}</Text>
          {facture.client_adresse && <Text style={styles.infoText}>{facture.client_adresse}</Text>}
          {facture.client_telephone && <Text style={styles.infoText}>Tél: {facture.client_telephone}</Text>}
          {facture.client_email && <Text style={styles.infoText}>Email: {facture.client_email}</Text>}
        </View>

        {/* Commande Info */}
        {facture.commande_code && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Référence commande</Text>
            <Text>{facture.commande_code}</Text>
          </View>
        )}

        {/* Tableau des produits */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Désignation</Text>
            <Text style={styles.col2}>Qté</Text>
            <Text style={styles.col3}>Prix HT</Text>
            <Text style={styles.col4}>TVA</Text>
            <Text style={styles.col5}>Total TTC</Text>
          </View>
          {facture.details?.map((detail: any, index: number) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.col1}>{detail.produit_nom || detail.designation}</Text>
              <Text style={styles.col2}>{detail.qte_commande || detail.quantite}</Text>
              <Text style={styles.col3}>{formatCurrency(detail.prix_unitaire_vente || detail.prix_unitaire)}</Text>
              <Text style={styles.col4}>18%</Text>
              <Text style={styles.col5}>{formatCurrency((detail.prix_unitaire_vente || detail.prix_unitaire) * (detail.qte_commande || detail.quantite) * 1.18)}</Text>
            </View>
          ))}
        </View>

        {/* Totaux */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT:</Text>
            <Text style={styles.totalValue}>{formatCurrency(facture.montant_ht)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA (18%):</Text>
            <Text style={styles.totalValue}>{formatCurrency(facture.montant_ttc - facture.montant_ht)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontWeight: 'bold', fontSize: 12 }]}>Total TTC:</Text>
            <Text style={[styles.totalValue, { fontWeight: 'bold', fontSize: 12 }]}>{formatCurrency(facture.montant_ttc)}</Text>
          </View>
        </View>

        {/* Message */}
        {companyConfig.message_facture && (
          <View style={{ marginTop: 30 }}>
            <Text style={{ fontSize: 9, fontStyle: 'italic', textAlign: 'center' }}>
              {companyConfig.message_facture}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Conditions de paiement : 30 jours</Text>
          <Text>IBAN: CI00XXXX | SWIFT: XXXXXX</Text>
          <Text>© {new Date().getFullYear()} {companyConfig.nom_atelier} - Tous droits réservés</Text>
        </View>
      </Page>
    </Document>
  );
};