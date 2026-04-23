// src/contexts/AuthContext.tsx
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

  // 🔐 INIT AUTH SAFE
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');

      if (savedUser) {
        setUser(JSON.parse(savedUser));
        console.log("✅ User restauré");
      } else {
        console.log("ℹ️ Aucun utilisateur");
      }
    } catch (error) {
      console.error("❌ Auth init error:", error);
      setUser(null);
    } finally {
      setLoading(false); // 🔥 CRITIQUE
    }
  }, []);

  // 🔐 LOGIN SAFE
  const login = async (login: string, password: string): Promise<boolean> => {
    try {
      console.log("🔐 Tentative login...");

      const db = await getDb();

      const users = await db.select<any[]>(
        'SELECT id, nom, login, role, est_actif, mot_de_passe_hash FROM utilisateurs WHERE login = ? AND est_actif = 1',
        [login]
      );

      if (!users || users.length === 0) {
        console.log("❌ Aucun utilisateur trouvé");
        return false;
      }

      const userData = users[0];

      const isValid = await bcrypt.compare(password, userData.mot_de_passe_hash);

      if (!isValid) {
        console.log("❌ Mot de passe incorrect");
        return false;
      }

      const { mot_de_passe_hash, ...userWithoutPassword } = userData;

      setUser(userWithoutPassword as Utilisateur);
      localStorage.setItem('user', JSON.stringify(userWithoutPassword));

      console.log("✅ Login réussi");

      return true;

    } catch (error) {
      console.error('❌ Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const register = async (nom: string, login: string, password: string, role: Role) => {
    try {
      const db = await getDb();
      const hash = await bcrypt.hash(password, 10);

      await db.execute(
        'INSERT INTO utilisateurs (nom, login, mot_de_passe_hash, role, est_actif) VALUES (?, ?, ?, ?, 1)',
        [nom, login, hash, role]
      );

      console.log("✅ Utilisateur créé");

    } catch (error) {
      console.error("❌ Register error:", error);
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