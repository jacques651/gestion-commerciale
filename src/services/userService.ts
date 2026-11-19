// src/services/userService.ts
import { getDb } from '../database/db';
import bcrypt from 'bcryptjs';

export interface UserProfile {
  id: number;
  nom: string;
  prenom: string;
  login: string;
  email: string;
  telephone?: string;
  role: string;
  avatar?: string;
  theme?: string;
  notifications?: boolean;
}

export interface CompanySettings {
  id: number;
  nom_entreprise: string;
  logo?: string;
  telephone: string;
  email: string;
  adresse: string;
  nif: string;
  rccm: string;
  devise: string;
  taux_tva: number;
  message_facture?: string;
}

class UserService {
  // Récupérer le profil de l'utilisateur connecté
  async getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
      const db = await getDb();
      // Récupérer l'utilisateur connecté (en attendant l'auth, on prend le premier admin)
      const users = await db.select<UserProfile[]>(`
        SELECT id, nom, prenom, login, email, telephone, role, theme
        FROM utilisateurs 
        WHERE est_actif = 1 
        LIMIT 1
      `);
      return users[0] || null;
    } catch (error) {
      console.error('Erreur récupération profil:', error);
      return null;
    }
  }

  // Mettre à jour le profil utilisateur
  async updateUserProfile(userId: number, data: Partial<UserProfile>): Promise<boolean> {
    try {
      const db = await getDb();
      const fields: string[] = [];
      const values: any[] = [];

      if (data.email !== undefined) {
        fields.push('email = ?');
        values.push(data.email);
      }
      if (data.telephone !== undefined) {
        fields.push('telephone = ?');
        values.push(data.telephone);
      }
      if (data.theme !== undefined) {
        fields.push('theme = ?');
        values.push(data.theme);
      }
      if (data.notifications !== undefined) {
        fields.push('notifications = ?');
        values.push(data.notifications ? 1 : 0);
      }

      if (fields.length === 0) return false;

      values.push(userId);
      await db.execute(
        `UPDATE utilisateurs SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      
      return true;
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      return false;
    }
  }

  // Changer le mot de passe (table users, bcrypt)
  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      const db = await getDb();
      // Lire le hash depuis la table users (celle utilisée par l'authentification)
      const rows = await db.select<any[]>(
        `SELECT mot_de_passe FROM users WHERE id = ?`, [userId]
      );
      if (!rows[0]) return false;

      // Vérifier l'ancien mot de passe (bcrypt ou fallback texte clair)
      let valid = false;
      try {
        valid = await bcrypt.compare(oldPassword, rows[0].mot_de_passe);
      } catch {
        valid = oldPassword === rows[0].mot_de_passe;
      }
      if (!valid) return false;

      // Hasher et sauvegarder le nouveau mot de passe
      const hash = await bcrypt.hash(newPassword, 10);
      await db.execute(`UPDATE users SET mot_de_passe = ? WHERE id = ?`, [hash, userId]);
      return true;
    } catch (error) {
      console.error('Erreur changement mot de passe:', error);
      return false;
    }
  }

  // Récupérer les paramètres de l'entreprise
  async getCompanySettings(): Promise<CompanySettings | null> {
    try {
      const db = await getDb();
      const settings = await db.select<CompanySettings[]>(`
        SELECT * FROM configuration_atelier WHERE id = 1
      `);
      return settings[0] || null;
    } catch (error) {
      console.error('Erreur récupération paramètres:', error);
      return null;
    }
  }

  // Mettre à jour les paramètres de l'entreprise
  async updateCompanySettings(data: Partial<CompanySettings>): Promise<boolean> {
    try {
      const db = await getDb();
      const fields: string[] = [];
      const values: any[] = [];

      if (data.nom_entreprise !== undefined) {
        fields.push('nom_atelier = ?');
        values.push(data.nom_entreprise);
      }
      if (data.telephone !== undefined) {
        fields.push('telephone = ?');
        values.push(data.telephone);
      }
      if (data.email !== undefined) {
        fields.push('email = ?');
        values.push(data.email);
      }
      if (data.adresse !== undefined) {
        fields.push('adresse = ?');
        values.push(data.adresse);
      }
      if (data.nif !== undefined) {
        fields.push('nif = ?');
        values.push(data.nif);
      }
      if (data.message_facture !== undefined) {
        fields.push('message_facture = ?');
        values.push(data.message_facture);
      }
      if (data.logo !== undefined) {
        fields.push('logo_base64 = ?');
        values.push(data.logo);
      }

      if (fields.length === 0) return false;

      values.push(new Date().toISOString());
      values.push(1);
      
      await db.execute(
        `UPDATE configuration_atelier SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`,
        values
      );
      
      return true;
    } catch (error) {
      console.error('Erreur mise à jour paramètres:', error);
      return false;
    }
  }
}

export const userService = new UserService();
