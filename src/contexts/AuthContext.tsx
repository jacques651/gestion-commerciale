// src/contexts/AuthContext.tsx - Version corrigée

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDb } from '../database/db';
import { Utilisateur, AuthContextType, Role } from '../types/auth';
import bcrypt from 'bcryptjs';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Utilisateur | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔧 CRÉER UN ADMIN PAR DÉFAUT SI NÉCESSAIRE
  const createDefaultAdmin = async () => {
    try {
      const db = await getDb();
      
      // Vérifier s'il y a des utilisateurs
      const users = await db.select<any[]>('SELECT COUNT(*) as count FROM utilisateurs');
      const userCount = users[0]?.count || 0;
      
      if (userCount === 0) {
        console.log("🔧 Aucun utilisateur trouvé, création d'un administrateur par défaut...");
        
        // Mot de passe par défaut: admin123
        const defaultPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        await db.execute(
          `INSERT INTO utilisateurs (nom, login, mot_de_passe_hash, role, est_actif) 
           VALUES (?, ?, ?, ?, ?)`,
          ['Administrateur', 'admin', hashedPassword, 'admin', 1]
        );
        
        console.log("✅ Administrateur par défaut créé (login: admin, mot de passe: admin123)");
        console.log("⚠️ IMPORTANT: Changez ce mot de passe après la première connexion !");
      }
    } catch (error) {
      console.error("❌ Erreur lors de la création de l'admin par défaut:", error);
    }
  };

  // 🔐 INIT AUTH SAFE
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Créer l'admin par défaut si nécessaire
        await createDefaultAdmin();
        
        // Restaurer l'utilisateur depuis localStorage
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
          console.log("✅ User restauré");
        } else {
          console.log("ℹ️ Aucun utilisateur connecté");
        }
      } catch (error) {
        console.error("❌ Auth init error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    initAuth();
  }, []);

  // 🔐 LOGIN SAFE
  const login = async (login: string, password: string): Promise<boolean> => {
    try {
      console.log("🔐 Tentative login pour:", login);

      const db = await getDb();

      const users = await db.select<any[]>(
        'SELECT id, nom, login, role, est_actif, mot_de_passe_hash FROM utilisateurs WHERE login = ? AND est_actif = 1',
        [login]
      );

      if (!users || users.length === 0) {
        console.log("❌ Aucun utilisateur trouvé avec ce login");
        return false;
      }

      const userData = users[0];

      // Vérifier le mot de passe
      const isValid = await bcrypt.compare(password, userData.mot_de_passe_hash);

      if (!isValid) {
        console.log("❌ Mot de passe incorrect");
        return false;
      }

      // Supprimer le hash du mot de passe avant de stocker dans le state
      const { mot_de_passe_hash, ...userWithoutPassword } = userData;

      setUser(userWithoutPassword as Utilisateur);
      localStorage.setItem('user', JSON.stringify(userWithoutPassword));

      console.log("✅ Login réussi pour:", userWithoutPassword.nom);

      return true;

    } catch (error) {
      console.error('❌ Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    console.log("🔓 Déconnexion réussie");
  };

  // 🔧 CORRECTION ICI : retourne Promise<void> au lieu de Promise<boolean>
  const register = async (nom: string, login: string, password: string, role: Role): Promise<void> => {
    try {
      const db = await getDb();
      
      // Vérifier si le login existe déjà
      const existing = await db.select<any[]>(
        'SELECT id FROM utilisateurs WHERE login = ?',
        [login]
      );
      
      if (existing && existing.length > 0) {
        throw new Error('Ce login existe déjà');
      }
      
      const hash = await bcrypt.hash(password, 10);

      await db.execute(
        'INSERT INTO utilisateurs (nom, login, mot_de_passe_hash, role, est_actif) VALUES (?, ?, ?, ?, 1)',
        [nom, login, hash, role]
      );

      console.log("✅ Utilisateur créé:", login);

    } catch (error) {
      console.error("❌ Register error:", error);
      throw error; // Propager l'erreur pour que l'appelant puisse la gérer
    }
  };

  const hasRole = (roles: Role[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        register,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};