// src/utils/confirm.ts
// Remplacement de window.confirm() pour Tauri v2
// window.confirm() n'est pas autorisé dans Tauri v2 — on utilise le plugin dialog

import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';

/**
 * Affiche une boîte de dialogue de confirmation native Tauri.
 * Remplace window.confirm() qui est bloqué dans Tauri v2.
 */
export async function confirm(message: string, title?: string): Promise<boolean> {
  try {
    return await tauriConfirm(message, { title: title ?? 'Confirmation', kind: 'warning' });
  } catch {
    // Fallback si le plugin n'est pas disponible (dev browser)
    return window.confirm(message);
  }
}
