// src/utils/confirm.ts
/**
 * Ouvre une boîte de dialogue de confirmation
 * Utilise la fonction native confirm du navigateur
 * @param message - Le message à afficher
 * @param title - Le titre (ignoré dans cette version)
 * @returns Promise<boolean> - true si l'utilisateur confirme, false sinon
 */
export const confirm = (
  message: string,
  title: string = 'Confirmation'
): Promise<boolean> => {
  return new Promise((resolve) => {
    // Fallback sur la fonction native si Mantine n'est pas disponible
    const result = window.confirm(`${title}\n\n${message}`);
    resolve(result);
  });
};

export default confirm;