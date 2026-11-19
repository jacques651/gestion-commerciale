// src/utils/fileExport.ts
// Utilitaires d'export/impression :
//  - saveFile()  : enregistre un fichier en laissant l'utilisateur CHOISIR le dossier
//                  (via l'API File System Access des navigateurs Chromium),
//                  avec repli sur un téléchargement classique si non supporté.
//  - printHtml() : imprime un contenu HTML SANS popup ni capture d'écran
//                  (iframe caché + dialogue d'impression natif -> permet aussi
//                   « Enregistrer au format PDF » avec choix du dossier).

type SaveResult = 'saved' | 'downloaded' | 'cancelled';

const extToMime: Record<string, string> = {
  csv: 'text/csv', pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel', json: 'application/json', txt: 'text/plain', html: 'text/html',
};

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

/**
 * Enregistre un Blob. Ouvre un sélecteur de dossier si le navigateur le supporte,
 * sinon déclenche un téléchargement classique (dossier Téléchargements).
 * Retourne 'saved' | 'downloaded' | 'cancelled'.
 */
export async function saveFile(blob: Blob, suggestedName: string): Promise<SaveResult> {
  const ext = extOf(suggestedName);
  const mime = blob.type || extToMime[ext] || 'application/octet-stream';

  const picker = (window as any).showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName,
        types: ext ? [{ description: ext.toUpperCase(), accept: { [mime]: ['.' + ext] } }] : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (err: any) {
      // L'utilisateur a annulé le sélecteur
      if (err && (err.name === 'AbortError' || err.code === 20)) return 'cancelled';
      // Sinon on retombe sur le téléchargement classique
    }
  }

  // Repli : téléchargement classique
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

/** Raccourci : enregistre du texte (CSV, JSON…) avec choix du dossier. */
export async function saveText(text: string, suggestedName: string): Promise<SaveResult> {
  const ext = extOf(suggestedName);
  // BOM pour que les accents s'affichent correctement dans Excel (CSV)
  const prefix = ext === 'csv' ? '﻿' : '';
  return saveFile(new Blob([prefix + text], { type: extToMime[ext] || 'text/plain;charset=utf-8' }), suggestedName);
}

/**
 * Imprime un contenu HTML sans ouvrir de fenêtre (pas de popup) et sans capture
 * d'écran : le contenu est réel (texte). L'utilisateur peut imprimer sur papier
 * ou « Enregistrer au format PDF » et choisir l'emplacement.
 *
 * @param bodyHtml  le HTML du corps à imprimer
 * @param title     titre du document (onglet / nom de PDF proposé)
 * @param styles    CSS supplémentaire (optionnel) — sinon un style par défaut soigné
 */
export function printHtml(bodyHtml: string, title = 'Document', styles?: string): void {
  const defaultStyles = `
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1a1a2e; margin: 0; padding: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { white-space: nowrap; }
  `;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }

  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
    <style>${styles || defaultStyles}</style></head><body>${bodyHtml}</body></html>`);
  doc.close();

  const cleanup = () => { setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 500); };

  // Laisser le temps au rendu (images/polices) avant d'imprimer
  setTimeout(() => {
    try {
      const win = iframe.contentWindow!;
      win.focus();
      win.onafterprint = cleanup;
      win.print();
      // Filet de sécurité si onafterprint n'est pas déclenché
      setTimeout(cleanup, 60000);
    } catch {
      cleanup();
    }
  }, 250);
}
