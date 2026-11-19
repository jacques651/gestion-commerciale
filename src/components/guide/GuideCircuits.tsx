// src/components/guide/GuideCircuits.tsx
// Guide des circuits : parcours (création / modification / mise à jour / annulation)
// par fonctionnalité. Recherche + filtre par fonctionnalité + impression + PDF.
// L'impression et l'export PDF passent par un rendu HTML autonome (couleurs en dur)
// pour garantir l'affichage des titres, badges et fonds.

import { useMemo, useState } from 'react';
import {
  Stack, Title, Text, Card, Group, Badge, TextInput, ThemeIcon, Box, Divider, SimpleGrid,
  Select, Button,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSearch, IconChevronRight, IconRoute, IconPackage, IconUsers, IconShoppingCart,
  IconFileInvoice, IconChartBar, IconDeviceMobile, IconTruckDelivery, IconReceipt,
  IconBuildingWarehouse, IconUserPlus, IconCoin, IconCash, IconMoneybag, IconReceipt2,
  IconCreditCard, IconPercentage, IconUserCog, IconSettings, IconKey, IconPrinter,
  IconDownload, IconFilter,
} from '@tabler/icons-react';

type FlowType = 'Création' | 'Modification' | 'Mise à jour' | 'Annulation';

interface Flow { type: FlowType; steps: string[]; }
interface Feature { titre: string; icon: React.ReactNode; couleur: string; flows: Flow[]; }
interface Section { titre: string; couleur: string; icon: React.ReactNode; features: Feature[]; }

const flowColor: Record<FlowType, string> = {
  'Création': 'teal',
  'Modification': 'blue',
  'Mise à jour': 'grape',
  'Annulation': 'red',
};

// Couleurs en dur (pour impression / PDF, indépendantes des variables CSS Mantine)
const SEC_HEX: Record<string, string> = {
  indigo: '#4c6ef5', blue: '#228be6', teal: '#12b886', cyan: '#15aabf',
  grape: '#ae3ec9', violet: '#7048e8', orange: '#fd7e14', red: '#fa5252',
};
const FLOW_HEX: Record<FlowType, [string, string]> = {
  'Création': ['#e6fcf5', '#0ca678'],
  'Modification': ['#e7f5ff', '#1c7ed6'],
  'Mise à jour': ['#f8f0fc', '#ae3ec9'],
  'Annulation': ['#fff5f5', '#e03131'],
};

const SECTIONS: Section[] = [
  {
    titre: 'Catalogue', couleur: 'indigo', icon: <IconPackage size={18} />,
    features: [
      {
        titre: 'Produits', icon: <IconPackage size={18} />, couleur: 'indigo',
        flows: [
          { type: 'Création', steps: ['Menu Catalogue', 'Produits', 'Nouveau produit', 'Renseigner nom, référence (optionnel), catégorie, unité', 'Saisir prix de vente détail / gros et le stock initial', 'Enregistrer'] },
          { type: 'Modification', steps: ['Menu Catalogue', 'Produits', 'Rechercher le produit', 'Icône crayon sur la ligne', 'Ajuster les champs', 'Enregistrer'] },
          { type: 'Mise à jour', steps: ['Le stock se met à jour automatiquement à chaque vente, appro et retour', 'Un réapprovisionnement (appro) augmente le stock', 'Une vente diminue le stock'] },
          { type: 'Annulation', steps: ['Produits', 'Rechercher le produit', 'Bouton Annuler / Supprimer', 'Confirmer', 'Le produit est masqué (annulé) sans casser l’historique'] },
        ],
      },
      {
        titre: 'Clients', icon: <IconUsers size={18} />, couleur: 'blue',
        flows: [
          { type: 'Création', steps: ['Menu Catalogue', 'Clients', 'Nouveau client', 'Choisir le type (client / revendeur)', 'Renseigner nom, société, téléphone, adresse', 'Enregistrer'] },
          { type: 'Modification', steps: ['Clients', 'Rechercher le client', 'Icône crayon', 'Modifier les infos', 'Enregistrer'] },
          { type: 'Annulation', steps: ['Clients', 'Rechercher le client', 'Annuler', 'Confirmer', 'Le client est archivé (annulé)'] },
        ],
      },
    ],
  },
  {
    titre: 'Ventes', couleur: 'teal', icon: <IconShoppingCart size={18} />,
    features: [
      {
        titre: 'Vente comptoir (détail)', icon: <IconChartBar size={18} />, couleur: 'teal',
        flows: [
          { type: 'Création', steps: ['Menu Ventes', 'Ventes comptoir', 'Nouvelle vente', 'Cocher « Ajouter les infos client » puis renseigner (si client connu)', 'Filtrer par catégorie et/ou rechercher un produit', 'Cliquer sur (+) devant le produit', 'Descendre dans le panier', 'Ajuster la quantité et, si besoin, le prix via l’icône crayon', 'Répéter pour chaque produit', 'Valider la vente'] },
          { type: 'Modification', steps: ['Avant validation : modifier quantité / prix / retirer une ligne dans le panier', 'Après validation : la vente n’est plus modifiable, il faut l’annuler'] },
          { type: 'Annulation', steps: ['Menu Ventes', 'Ventes comptoir', 'Ligne de la vente', 'Annuler', 'Motif', 'Confirmer', 'Le stock est réintégré et la caisse corrigée'] },
        ],
      },
      {
        titre: 'Commandes (standard)', icon: <IconShoppingCart size={18} />, couleur: 'cyan',
        flows: [
          { type: 'Création', steps: ['Menu Ventes', 'Commandes', 'Nouvelle commande', 'Sélectionner le client', 'Filtrer/rechercher un produit et l’ajouter au panier', 'Ajuster quantités et prix', 'Enregistrer la commande'] },
          { type: 'Modification', steps: ['Commandes', 'Ouvrir la commande', 'Modifier', 'Ajuster lignes / quantités', 'Enregistrer'] },
          { type: 'Mise à jour', steps: ['Commandes', 'Ouvrir la commande', 'Générer facture (transforme la commande en facture)', 'Le statut passe à « Facturée »'] },
          { type: 'Annulation', steps: ['Commandes', 'Ligne de la commande', 'Annuler', 'Motif', 'Confirmer', 'Le stock réservé est réintégré'] },
        ],
      },
      {
        titre: 'Factures (standard)', icon: <IconFileInvoice size={18} />, couleur: 'grape',
        flows: [
          { type: 'Création', steps: ['Soit via Commandes → Générer facture', 'Soit Menu Ventes', 'Factures', 'Nouvelle facture', 'Choisir le client et ajouter les produits', 'Valider'] },
          { type: 'Mise à jour', steps: ['Factures', 'Ouvrir la facture', 'Encaisser via un Règlement (voir Finances → Règlements)', 'Le statut passe de Impayée → Partielle → Payée'] },
          { type: 'Annulation', steps: ['Factures', 'Ligne de la facture', 'Annuler', 'Motif', 'Confirmer', 'Le stock est réintégré et les règlements liés sont neutralisés'] },
        ],
      },
      {
        titre: 'Articles seconde main', icon: <IconDeviceMobile size={18} />, couleur: 'orange',
        flows: [
          { type: 'Création', steps: ['Menu Ventes', 'Articles seconde main', 'Nouvel article', 'Choisir le sens (Achat d’occasion ou Vente d’occasion)', 'Renseigner article, client, montant', 'Enregistrer → génère l’attestation et l’écriture de caisse'] },
          { type: 'Mise à jour', steps: ['Articles seconde main', 'Ouvrir l’article', 'Imprimer / rééditer l’attestation'] },
          { type: 'Annulation', steps: ['Articles seconde main', 'Ligne de l’article', 'Annuler', 'Confirmer', 'L’écriture de caisse est corrigée'] },
        ],
      },
    ],
  },
  {
    titre: 'Revendeurs', couleur: 'grape', icon: <IconTruckDelivery size={18} />,
    features: [
      {
        titre: 'Commandes revendeur', icon: <IconShoppingCart size={18} />, couleur: 'grape',
        flows: [
          { type: 'Création', steps: ['Menu Revendeurs', 'Commandes', 'Nouvelle commande', 'Sélectionner le revendeur', 'Ajouter les produits (prix gros)', 'Enregistrer'] },
          { type: 'Mise à jour', steps: ['Commandes', 'Ouvrir la commande', 'Générer facture revendeur', 'Statut « Facturée »'] },
          { type: 'Annulation', steps: ['Commandes', 'Ligne', 'Annuler', 'Confirmer', 'Stock réintégré'] },
        ],
      },
      {
        titre: 'Factures revendeur', icon: <IconFileInvoice size={18} />, couleur: 'violet',
        flows: [
          { type: 'Création', steps: ['Via Commandes revendeur → Générer facture', 'ou Menu Revendeurs', 'Factures', 'Nouvelle facture', 'Choisir le revendeur et les produits (prix gros)', 'Valider'] },
          { type: 'Mise à jour', steps: ['Factures', 'Ouvrir la facture', 'Enregistrer un règlement', 'Statut Impayée → Partielle → Payée'] },
          { type: 'Annulation', steps: ['Factures', 'Ligne', 'Annuler', 'Motif', 'Confirmer'] },
        ],
      },
      {
        titre: 'Décomptes', icon: <IconReceipt size={18} />, couleur: 'indigo',
        flows: [
          { type: 'Création', steps: ['Menu Revendeurs', 'Décomptes', 'Nouveau décompte', 'Sélectionner le revendeur', 'Ajouter le détail des articles vendus/retournés', 'Créer un décompte'] },
          { type: 'Modification', steps: ['Décomptes', 'Ouvrir le décompte', 'Modifier', 'Ajuster le détail', 'Enregistrer'] },
          { type: 'Mise à jour', steps: ['Décomptes', 'Ouvrir', 'Imprimer / éditer le reçu du décompte'] },
          { type: 'Annulation', steps: ['Décomptes', 'Ligne', 'Annuler', 'Confirmer', 'Les stocks revendeur et la caisse sont corrigés'] },
        ],
      },
      {
        titre: 'Stock revendeurs', icon: <IconBuildingWarehouse size={18} />, couleur: 'cyan',
        flows: [
          { type: 'Création', steps: ['Menu Revendeurs', 'Stock', 'Approvisionner / Importer', 'Choisir le revendeur et les quantités', 'Valider'] },
          { type: 'Mise à jour', steps: ['Le stock revendeur augmente avec les appros et diminue avec les décomptes de vente'] },
        ],
      },
      {
        titre: 'Revendeurs ponctuels', icon: <IconUserPlus size={18} />, couleur: 'teal',
        flows: [
          { type: 'Création', steps: ['Menu Revendeurs', 'Revendeurs ponctuels', 'Nouveau', 'Renseigner nom et téléphone', 'Enregistrer une opération (appro / vente / retour)'] },
          { type: 'Mise à jour', steps: ['Revendeurs ponctuels', 'Rechercher (par nom ou téléphone)', 'Ajouter une opération'] },
          { type: 'Annulation', steps: ['Revendeurs ponctuels', 'Opération', 'Annuler', 'Confirmer'] },
        ],
      },
    ],
  },
  {
    titre: 'Finances', couleur: 'orange', icon: <IconCoin size={18} />,
    features: [
      {
        titre: 'Règlements', icon: <IconReceipt2 size={18} />, couleur: 'orange',
        flows: [
          { type: 'Création', steps: ['Menu Finances', 'Règlements', 'Nouveau règlement', 'Sélectionner le client (type client uniquement)', 'Choisir la facture à régler', 'Saisir le montant et le mode de paiement', 'Enregistrer → met à jour le solde de la facture et la caisse'] },
          { type: 'Annulation', steps: ['Règlements', 'Ligne', 'Annuler', 'Confirmer', 'Le solde de la facture et la caisse sont corrigés'] },
        ],
      },
      {
        titre: 'Crédits', icon: <IconCreditCard size={18} />, couleur: 'red',
        flows: [
          { type: 'Création', steps: ['Menu Finances', 'Crédits', 'Nouveau crédit', 'Sélectionner le client', 'Montant et échéance', 'Enregistrer le crédit'] },
          { type: 'Mise à jour', steps: ['Crédits', 'Ouvrir le crédit', 'Ajouter un remboursement', 'Montant', 'Enregistrer le remboursement', 'Le solde du crédit diminue'] },
          { type: 'Annulation', steps: ['Crédits', 'Ligne', 'Annuler', 'Confirmer'] },
        ],
      },
      {
        titre: 'Remboursements', icon: <IconPercentage size={18} />, couleur: 'grape',
        flows: [
          { type: 'Création', steps: ['Via Crédits → Ajouter un remboursement', 'ou Menu Finances', 'Remboursements', 'Nouveau', 'Choisir le crédit / client', 'Montant', 'Enregistrer'] },
          { type: 'Annulation', steps: ['Remboursements', 'Ligne', 'Annuler', 'Confirmer', 'Le solde du crédit est recalculé'] },
        ],
      },
      {
        titre: 'Charges', icon: <IconMoneybag size={18} />, couleur: 'indigo',
        flows: [
          { type: 'Création', steps: ['Menu Finances', 'Charges', 'Nouvelle charge', 'Catégorie, libellé, montant, date', 'Enregistrer → écriture de caisse (sortie)'] },
          { type: 'Modification', steps: ['Charges', 'Ligne', 'Modifier', 'Enregistrer'] },
          { type: 'Annulation', steps: ['Charges', 'Ligne', 'Annuler', 'Confirmer', 'La caisse est corrigée'] },
        ],
      },
      {
        titre: 'Caisse', icon: <IconCash size={18} />, couleur: 'teal',
        flows: [
          { type: 'Mise à jour', steps: ['Menu Finances', 'Caisse', 'Le journal se remplit automatiquement (ventes, règlements, charges, décomptes)', 'Ouvrir / clôturer la session de caisse'] },
        ],
      },
      {
        titre: 'Tableau de bord financier', icon: <IconChartBar size={18} />, couleur: 'cyan',
        flows: [
          { type: 'Mise à jour', steps: ['Menu Finances', 'Tableau de bord', 'Les indicateurs (CA, marges, impayés) se recalculent en temps réel', 'Filtrer par période'] },
        ],
      },
    ],
  },
  {
    titre: 'Administration', couleur: 'violet', icon: <IconSettings size={18} />,
    features: [
      {
        titre: 'Utilisateurs', icon: <IconUserCog size={18} />, couleur: 'violet',
        flows: [
          { type: 'Création', steps: ['Menu Administration', 'Utilisateurs', 'Nouvel utilisateur', 'Nom, identifiant, mot de passe, rôle/permissions', 'Enregistrer'] },
          { type: 'Modification', steps: ['Utilisateurs', 'Ligne', 'Modifier', 'Ajuster rôle / permissions', 'Enregistrer'] },
          { type: 'Mise à jour', steps: ['Bloc profil (en haut de la navbar)', 'Changer le mot de passe'] },
        ],
      },
      {
        titre: 'Paramètres (atelier / TVA)', icon: <IconSettings size={18} />, couleur: 'indigo',
        flows: [
          { type: 'Modification', steps: ['Menu Administration', 'Paramètres', 'Renseigner infos atelier (nom, logo, IFU, RCCM, contacts)', 'Activer / désactiver la TVA (18%)', 'Enregistrer → appliqué à toutes les factures et reçus'] },
        ],
      },
      {
        titre: 'Licence', icon: <IconKey size={18} />, couleur: 'orange',
        flows: [
          { type: 'Mise à jour', steps: ['Menu Administration', 'Licence', 'Saisir le code d’activation fourni par le revendeur', 'Activer maintenant → version définitive'] },
        ],
      },
    ],
  },
];

const FILTER_DATA = SECTIONS.map(sec => ({
  group: sec.titre,
  items: sec.features.map(f => ({ value: f.titre, label: f.titre })),
}));

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// CSS partagé impression / PDF (préfixe pour scoper le conteneur PDF)
function buildCSS(p = ''): string {
  return `
${p}.doc-header{border-bottom:2px solid #e9ecef;padding-bottom:10px;margin-bottom:16px;}
${p}.doc-title{font-size:22px;font-weight:800;margin:0;color:#212529;}
${p}.doc-sub{font-size:12px;color:#868e96;margin-top:2px;}
${p}.sec{margin:0 0 18px 0;}
${p}.sec-title{font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;margin:0 0 8px 0;}
${p}.card{border:1px solid #e9ecef;border-radius:10px;padding:13px 15px;margin-bottom:10px;background:#fff;break-inside:avoid;page-break-inside:avoid;}
${p}.card-title{font-size:15px;font-weight:700;margin:0 0 10px 0;color:#212529;}
${p}.flow{margin-bottom:9px;}
${p}.flow:last-child{margin-bottom:0;}
${p}.ftype{display:inline-block;font-size:11px;font-weight:700;padding:2px 9px;border-radius:6px;margin-bottom:6px;}
${p}.steps{line-height:1.9;}
${p}.chip{display:inline-block;font-size:12px;padding:3px 9px;border-radius:7px;background:#f1f3f5;border:1px solid #dee2e6;color:#343a40;}
${p}.arrow{color:#adb5bd;font-weight:700;margin:0 3px;}
`;
}

export default function GuideCircuits() {
  const [q, setQ] = useState('');
  const [feature, setFeature] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const sections = useMemo(() => {
    const t = q.trim().toLowerCase();
    return SECTIONS
      .map(sec => ({
        ...sec,
        features: sec.features.filter(f => {
          const matchFeature = !feature || f.titre === feature;
          const matchText = !t ||
            f.titre.toLowerCase().includes(t) ||
            sec.titre.toLowerCase().includes(t) ||
            f.flows.some(fl => fl.steps.join(' ').toLowerCase().includes(t));
          return matchFeature && matchText;
        }),
      }))
      .filter(sec => sec.features.length > 0);
  }, [q, feature]);

  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Contenu HTML autonome (titres, badges, chips) — couleurs en dur
  const buildContent = (): string => {
    const header = `
      <div class="doc-header">
        <div class="doc-title">Guide des circuits</div>
        <div class="doc-sub">Parcours de création, modification et mise à jour${feature ? ` — ${esc(feature)}` : ''} · ${dateStr}</div>
      </div>`;

    const body = sections.map(sec => {
      const cards = sec.features.map(f => {
        const flows = f.flows.map(fl => {
          const [bg, fg] = FLOW_HEX[fl.type];
          const steps = fl.steps.map((s, i) =>
            `<span class="chip">${esc(s)}</span>${i < fl.steps.length - 1 ? '<span class="arrow">→</span>' : ''}`
          ).join('');
          return `<div class="flow"><div class="ftype" style="background:${bg};color:${fg}">${fl.type}</div><div class="steps">${steps}</div></div>`;
        }).join('');
        return `<div class="card" style="border-top:3px solid ${SEC_HEX[f.couleur] || '#4c6ef5'}"><div class="card-title">${esc(f.titre)}</div>${flows}</div>`;
      }).join('');
      return `<div class="sec"><div class="sec-title" style="color:${SEC_HEX[sec.couleur] || '#4c6ef5'}">${esc(sec.titre)}</div>${cards}</div>`;
    }).join('');

    return header + (body || '<div style="color:#868e96">Aucun résultat.</div>');
  };

  const handlePrint = () => {
    const doc = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
      <title>Guide des circuits</title>
      <style>
        *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        body{font-family:Inter,'Segoe UI',system-ui,sans-serif;color:#212529;margin:0;padding:22px;}
        @page{size:A4;margin:14mm;}
        ${buildCSS('')}
      </style></head><body>${buildContent()}</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => iframe.remove(), 1000);
      }
    };
    iframe.srcdoc = doc;
    document.body.appendChild(iframe);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = 210, pageH = 297, M = 12;
      const contentW = pageW - M * 2;
      let y = M;

      const hexToRgb = (h: string): [number, number, number] => {
        const n = parseInt(h.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      };
      // La police interne (Helvetica) ne gère pas certains caractères : on les remplace
      const clean = (t: string) =>
        t.replace(/→/g, '->').replace(/›/g, '>').replace(/’/g, "'")
         .replace(/«/g, '"').replace(/»/g, '"').replace(/·/g, '-')
         .replace(/œ/g, 'oe').replace(/–/g, '-');
      const ensure = (need: number) => { if (y + need > pageH - M) { doc.addPage(); y = M; } };

      // Titre
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(33, 37, 41);
      doc.text('Guide des circuits', M, y + 3); y += 9;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(134, 142, 150);
      doc.text(clean(`Parcours de creation, modification et mise a jour${feature ? ` - ${feature}` : ''} - ${dateStr}`), M, y);
      y += 4;
      doc.setDrawColor(233, 236, 239); doc.line(M, y, pageW - M, y); y += 7;

      sections.forEach(sec => {
        ensure(14);
        const [r, g, b] = hexToRgb(SEC_HEX[sec.couleur] || '#4c6ef5');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(r, g, b);
        doc.text(clean(sec.titre).toUpperCase(), M, y); y += 6;

        sec.features.forEach(f => {
          ensure(12);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(33, 37, 41);
          doc.text(clean(f.titre), M, y); y += 5.5;

          f.flows.forEach(fl => {
            const [bg, fg] = FLOW_HEX[fl.type];
            ensure(11);
            // Badge du type de flux
            doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
            const label = clean(fl.type);
            const tw = doc.getTextWidth(label);
            const padX = 2;
            const [br, bgc, bb] = hexToRgb(bg);
            const [fr, fgc, fb] = hexToRgb(fg);
            doc.setFillColor(br, bgc, bb);
            doc.roundedRect(M, y - 3.2, tw + padX * 2, 4.6, 1, 1, 'F');
            doc.setTextColor(fr, fgc, fb);
            doc.text(label, M + padX, y);
            y += 4.5;
            // Etapes
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(52, 58, 64);
            const stepStr = clean(fl.steps.join('  >  '));
            const lines = doc.splitTextToSize(stepStr, contentW) as string[];
            lines.forEach(line => { ensure(5); doc.text(line, M, y); y += 4.2; });
            y += 1.5;
          });
          y += 2.5;
        });
        y += 3;
      });

      doc.save(`Guide_circuits_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      notifications.show({ title: 'Erreur', message: 'Le telechargement PDF a echoue.', color: 'red' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Stack gap="lg" p="md">
      {/* Barre d'outils */}
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            label="Rechercher"
            placeholder="Fonctionnalité ou étape…"
            leftSection={<IconSearch size={16} />}
            value={q}
            onChange={e => setQ(e.currentTarget.value)}
            w={260}
          />
          <Select
            label="Filtrer par fonctionnalité"
            placeholder="Toutes les fonctionnalités"
            leftSection={<IconFilter size={16} />}
            data={FILTER_DATA}
            value={feature}
            onChange={setFeature}
            searchable
            clearable
            w={260}
            nothingFoundMessage="Aucune fonctionnalité"
          />
        </Group>
        <Group gap="sm">
          <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={handlePrint}>
            Imprimer
          </Button>
          <Button leftSection={<IconDownload size={16} />} onClick={handleDownload} loading={downloading}>
            Télécharger (PDF)
          </Button>
        </Group>
      </Group>

      {/* En-tête écran */}
      <Group gap="sm" align="center">
        <ThemeIcon size={44} radius="md" variant="gradient" gradient={{ from: 'indigo', to: 'grape', deg: 135 }}>
          <IconRoute size={26} />
        </ThemeIcon>
        <div>
          <Title order={2}>Guide des circuits</Title>
          <Text c="dimmed" size="sm">Parcours de création, modification et mise à jour par fonctionnalité.</Text>
        </div>
      </Group>

      {/* Rendu à l'écran (Mantine) */}
      {sections.map(sec => (
        <Stack key={sec.titre} gap="sm">
          <Group gap={8}>
            <ThemeIcon size={30} radius="md" color={sec.couleur} variant="light">{sec.icon}</ThemeIcon>
            <Title order={4} c={sec.couleur}>{sec.titre}</Title>
          </Group>

          <SimpleGrid cols={1} spacing="md">
            {sec.features.map(f => (
              <Card key={f.titre} withBorder radius="lg" padding="lg"
                style={{ borderTop: `3px solid var(--mantine-color-${f.couleur}-6)` }}>
                <Group gap={8} mb="sm">
                  <ThemeIcon size={34} radius="md" color={f.couleur} variant="light">{f.icon}</ThemeIcon>
                  <Text fw={700} size="lg">{f.titre}</Text>
                </Group>
                <Stack gap="md">
                  {f.flows.map((fl, i) => (
                    <div key={i}>
                      {i > 0 && <Divider mb="md" variant="dashed" />}
                      <Box>
                        <Badge color={flowColor[fl.type]} variant="light" radius="sm" mb={6}>{fl.type}</Badge>
                        <Group gap={6} wrap="wrap" align="center">
                          {fl.steps.map((s, j) => (
                            <Group gap={6} key={j} wrap="nowrap" align="center">
                              <Box style={{
                                padding: '3px 10px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.35,
                                background: 'var(--mantine-color-gray-1)', color: 'var(--mantine-color-gray-8)',
                                border: '1px solid var(--mantine-color-gray-3)', whiteSpace: 'normal',
                              }}>
                                {s}
                              </Box>
                              {j < fl.steps.length - 1 && (
                                <IconChevronRight size={14} style={{ color: 'var(--mantine-color-gray-5)', flexShrink: 0 }} />
                              )}
                            </Group>
                          ))}
                        </Group>
                      </Box>
                    </div>
                  ))}
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      ))}

      {sections.length === 0 && (
        <Text c="dimmed" ta="center" py="xl">Aucun résultat.</Text>
      )}
    </Stack>
  );
}
