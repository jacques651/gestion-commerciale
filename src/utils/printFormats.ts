// src/utils/printFormats.ts
// ============================================================================
// FORMATS D'IMPRESSION
// ----------------------------------------------------------------------------
// Centralise le choix du format papier (A4, A5, A6, B5, B6...) et génère le
// CSS d'impression correspondant. Le corps du document s'adapte
// automatiquement : la taille de police, les marges et les paddings sont
// dérivés de la largeur utile du format choisi.
//
// Corrige également l'ordre des pages : sans règle @page explicite, le moteur
// d'impression applique ses propres sauts, ce qui produit des pages blanches
// intercalées et une pagination désordonnée. On fixe donc la géométrie et on
// interdit les sauts « recto forcé » (page-break-before: left/right) qui sont
// la cause des impressions impaires-puis-paires.
// ============================================================================

import { getDb } from '../database/db';

export type FormatPapier = 'A4' | 'A5' | 'A6' | 'B5' | 'B6' | 'LETTER' | 'TICKET80';
export type OrientationPapier = 'portrait' | 'landscape';

export interface DefinitionFormat {
  value: FormatPapier;
  label: string;
  /** Largeur en mm (portrait) */
  largeurMm: number;
  /** Hauteur en mm (portrait) */
  hauteurMm: number;
  /** Valeur CSS pour la propriété @page size */
  cssSize: string;
  /** Marge par défaut en mm */
  margeMm: number;
  /** Taille de police de base en pt */
  policeBasePt: number;
}

export const FORMATS_PAPIER: DefinitionFormat[] = [
  { value: 'A4',       label: 'A4 (210 × 297 mm)',        largeurMm: 210, hauteurMm: 297, cssSize: 'A4',       margeMm: 12, policeBasePt: 11 },
  { value: 'A5',       label: 'A5 (148 × 210 mm)',        largeurMm: 148, hauteurMm: 210, cssSize: 'A5',       margeMm: 9,  policeBasePt: 9.5 },
  { value: 'A6',       label: 'A6 (105 × 148 mm)',        largeurMm: 105, hauteurMm: 148, cssSize: 'A6',       margeMm: 6,  policeBasePt: 8 },
  { value: 'B5',       label: 'B5 (176 × 250 mm)',        largeurMm: 176, hauteurMm: 250, cssSize: 'B5',       margeMm: 10, policeBasePt: 10.5 },
  { value: 'B6',       label: 'B6 (125 × 176 mm)',        largeurMm: 125, hauteurMm: 176, cssSize: 'B6',       margeMm: 7,  policeBasePt: 8.5 },
  { value: 'LETTER',   label: 'Letter (216 × 279 mm)',    largeurMm: 216, hauteurMm: 279, cssSize: 'Letter',   margeMm: 12, policeBasePt: 11 },
  { value: 'TICKET80', label: 'Ticket 80 mm (rouleau)',   largeurMm: 80,  hauteurMm: 297, cssSize: '80mm auto', margeMm: 3, policeBasePt: 8 },
];

export const FORMAT_PAR_DEFAUT: FormatPapier = 'A4';

export const getDefinitionFormat = (format?: FormatPapier | string | null): DefinitionFormat =>
  FORMATS_PAPIER.find(f => f.value === format) ||
  FORMATS_PAPIER.find(f => f.value === FORMAT_PAR_DEFAUT)!;

/** Options prêtes pour un composant Select Mantine. */
export const optionsFormatPapier = FORMATS_PAPIER.map(f => ({
  value: f.value,
  label: f.label,
}));

// ---------------------------------------------------------------------------
// Persistance du format par défaut (Paramètres)
// ---------------------------------------------------------------------------

let cacheFormat: FormatPapier | null = null;

export const formatImpressionService = {
  invalidate(): void {
    cacheFormat = null;
  },

  async getFormatDefaut(force = false): Promise<FormatPapier> {
    if (cacheFormat && !force) return cacheFormat;
    try {
      const db = await getDb();
      const r = await db.select<any[]>(
        `SELECT valeur FROM config_parametres
         WHERE categorie = 'IMPRESSION' AND code_param = 'format_papier'`
      );
      const v = r?.[0]?.valeur;
      if (v && FORMATS_PAPIER.some(f => f.value === v)) {
        cacheFormat = v as FormatPapier;
        return cacheFormat;
      }
    } catch (e) {
      console.error('Erreur lecture format d\'impression:', e);
    }
    cacheFormat = FORMAT_PAR_DEFAUT;
    return cacheFormat;
  },

  async setFormatDefaut(format: FormatPapier): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO config_parametres (categorie, code_param, valeur, type_valeur, description)
       VALUES ('IMPRESSION', 'format_papier', ?, 'text', 'Format papier par défaut pour les impressions')
       ON CONFLICT(categorie, code_param) DO UPDATE SET valeur = excluded.valeur`,
      [format]
    );
    cacheFormat = format;
  },

  async getOrientationDefaut(): Promise<OrientationPapier> {
    try {
      const db = await getDb();
      const r = await db.select<any[]>(
        `SELECT valeur FROM config_parametres
         WHERE categorie = 'IMPRESSION' AND code_param = 'orientation'`
      );
      return r?.[0]?.valeur === 'landscape' ? 'landscape' : 'portrait';
    } catch {
      return 'portrait';
    }
  },

  async setOrientationDefaut(orientation: OrientationPapier): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO config_parametres (categorie, code_param, valeur, type_valeur, description)
       VALUES ('IMPRESSION', 'orientation', ?, 'text', 'Orientation par défaut pour les impressions')
       ON CONFLICT(categorie, code_param) DO UPDATE SET valeur = excluded.valeur`,
      [orientation]
    );
  },
};

// ---------------------------------------------------------------------------
// Génération du CSS d'impression
// ---------------------------------------------------------------------------

export interface OptionsCssImpression {
  format?: FormatPapier | string | null;
  orientation?: OrientationPapier;
  /** Sélecteur racine du contenu à imprimer (défaut : .print-area) */
  racine?: string;
  /** Marge personnalisée en mm (sinon celle du format) */
  margeMm?: number;
}

/**
 * Construit le bloc CSS `@media print` complet pour un format donné.
 * Le corps du document s'adapte automatiquement au format :
 *  - police de base proportionnelle au format,
 *  - largeur de contenu calée sur la largeur utile,
 *  - tableaux qui ne se coupent pas au milieu d'une ligne,
 *  - pagination séquentielle (pas de saut « recto forcé »).
 */
export const construireCssImpression = (options: OptionsCssImpression = {}): string => {
  const def = getDefinitionFormat(options.format);
  const orientation = options.orientation || 'portrait';
  const racine = options.racine || '.print-area';
  const marge = options.margeMm ?? def.margeMm;

  const paysage = orientation === 'landscape';
  const largeurUtile = (paysage ? def.hauteurMm : def.largeurMm) - marge * 2;

  // Le facteur d'échelle rapporte la largeur utile du format choisi à celle
  // d'un A4 standard : le contenu conserve les mêmes proportions sur A5, A6...
  const largeurRefA4 = 210 - 12 * 2;
  const echelle = Math.min(1, largeurUtile / largeurRefA4);
  const police = def.policeBasePt;

  const sizeCss = def.value === 'TICKET80'
    ? '80mm auto'
    : `${def.cssSize}${paysage ? ' landscape' : ''}`;

  return `
@media print {
  /* --- Géométrie de la page ---------------------------------------- */
  @page {
    size: ${sizeCss};
    margin: ${marge}mm;
  }
  /* Aucune règle @page :left / :right : forcer un démarrage sur page
     impaire insère des pages blanches et donne une sortie désordonnée. */

  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    width: auto !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .no-print, .no-print * { display: none !important; }

  /* --- Corps adapté au format -------------------------------------- */
  ${racine} {
    width: ${largeurUtile}mm !important;
    max-width: ${largeurUtile}mm !important;
    margin: 0 auto !important;
    padding: 0 !important;
    font-size: ${police}pt !important;
    line-height: 1.35 !important;
    box-sizing: border-box !important;
  }

  ${racine} * {
    box-sizing: border-box !important;
    max-width: 100% !important;
  }

  ${racine} h1 { font-size: ${(police * 1.6).toFixed(1)}pt !important; }
  ${racine} h2 { font-size: ${(police * 1.35).toFixed(1)}pt !important; }
  ${racine} h3 { font-size: ${(police * 1.15).toFixed(1)}pt !important; }
  ${racine} small,
  ${racine} .print-small { font-size: ${(police * 0.82).toFixed(1)}pt !important; }

  ${racine} img,
  ${racine} svg {
    max-width: 100% !important;
    height: auto !important;
    /* Le logo (et autres images) est plafonné et rétrécit avec le format
       choisi : ~12 mm en A4, ~6 mm en A6. Sans ça, height:auto affiche
       l'image à sa taille naturelle (trop grande). */
    max-height: ${(echelle * 12).toFixed(1)}mm !important;
    width: auto !important;
    object-fit: contain !important;
  }

  /* --- Tableaux ----------------------------------------------------- */
  ${racine} table {
    width: 100% !important;
    border-collapse: collapse !important;
    font-size: ${(police * 0.9).toFixed(1)}pt !important;
    table-layout: fixed !important;
  }
  ${racine} table th,
  ${racine} table td {
    padding: ${(1.6 * echelle).toFixed(2)}mm ${(2 * echelle).toFixed(2)}mm !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }
  /* L'en-tête se répète sur chaque page, les lignes ne sont pas coupées */
  ${racine} thead { display: table-header-group !important; }
  ${racine} tfoot { display: table-footer-group !important; }
  ${racine} tr,
  ${racine} img {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* --- Pagination séquentielle -------------------------------------- */
  /* On neutralise tout saut hérité qui forcerait une page blanche. */
  ${racine} * {
    page-break-before: auto !important;
    break-before: auto !important;
  }
  /* Sauf les éléments explicitement marqués par le développeur. */
  ${racine} .saut-de-page,
  ${racine} .page-break {
    page-break-before: always !important;
    break-before: page !important;
  }
  ${racine} .eviter-coupure,
  ${racine} .avoid-break {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  /* Évite les lignes veuves/orphelines qui créent des pages presque vides */
  ${racine} p,
  ${racine} li {
    orphans: 3 !important;
    widows: 3 !important;
  }

  /* --- Nettoyage des artefacts d'interface -------------------------- */
  /* Les overlays de modale (position: fixed) génèrent des pages blanches
     intercalées, ce qui fait apparaître l'impression comme désordonnée. */
  [class*="mantine-Modal-overlay"],
  [class*="mantine-Overlay"],
  [class*="mantine-Modal-header"] {
    display: none !important;
  }
  [class*="mantine-Modal-root"],
  [class*="mantine-Modal-inner"],
  [class*="mantine-Modal-content"],
  [class*="mantine-Modal-body"] {
    position: static !important;
    overflow: visible !important;
    box-shadow: none !important;
    max-height: none !important;
    height: auto !important;
    width: auto !important;
    padding: 0 !important;
    margin: 0 !important;
    inset: auto !important;
  }
}
`;
};

/**
 * Construit uniquement le bloc `@page` (utile pour les fenêtres d'impression
 * autonomes générées via window.open + document.write).
 */
export const construireRegleAtPage = (
  format?: FormatPapier | string | null,
  orientation: OrientationPapier = 'portrait'
): string => {
  const def = getDefinitionFormat(format);
  const sizeCss = def.value === 'TICKET80'
    ? '80mm auto'
    : `${def.cssSize}${orientation === 'landscape' ? ' landscape' : ''}`;
  return `@page { size: ${sizeCss}; margin: ${def.margeMm}mm; }`;
};

/**
 * Ouvre une fenêtre d'impression autonome avec le format demandé.
 * Utilisé par les écrans qui génèrent leur HTML (journal de caisse,
 * rapports de vente, listes...).
 */
export const ouvrirFenetreImpression = (options: {
  titre: string;
  corpsHtml: string;
  format?: FormatPapier | string | null;
  orientation?: OrientationPapier;
  cssSupplementaire?: string;
  /** Lance l'impression automatiquement (défaut : true) */
  imprimerAuto?: boolean;
}): Window | null => {
  const win = window.open('', '_blank');
  if (!win) return null;

  const def = getDefinitionFormat(options.format);
  const css = construireCssImpression({
    format: options.format,
    orientation: options.orientation,
    racine: '.print-area',
  });

  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${options.titre}</title>
<style>
  * { font-family: Arial, Helvetica, sans-serif; box-sizing: border-box; }
  body { margin: 0; padding: 10mm; background: #f5f5f5; }
  .print-area {
    background: #fff;
    margin: 0 auto;
    padding: ${def.margeMm}mm;
    width: ${def.largeurMm}mm;
    max-width: 100%;
    font-size: ${def.policeBasePt}pt;
    line-height: 1.35;
  }
  table { width: 100%; border-collapse: collapse; }
  ${options.cssSupplementaire || ''}
  ${css}
</style>
</head>
<body>
  <div class="print-area">${options.corpsHtml}</div>
</body>
</html>`);
  win.document.close();

  if (options.imprimerAuto !== false) {
    win.onload = () => {
      win.focus();
      win.print();
    };
    // Repli si onload a déjà été déclenché
    setTimeout(() => {
      try { win.focus(); win.print(); } catch { /* ignore */ }
    }, 400);
  }

  return win;
};

export default {
  FORMATS_PAPIER,
  FORMAT_PAR_DEFAUT,
  optionsFormatPapier,
  getDefinitionFormat,
  formatImpressionService,
  construireCssImpression,
  construireRegleAtPage,
  ouvrirFenetreImpression,
};
