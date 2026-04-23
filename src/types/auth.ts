// src/types/auth.ts
export type Role = 'admin' | 'gestionnaire' | 'caissier' | 'commercial';

export interface Utilisateur {
  id: number;
  nom: string;
  login: string;
  role: Role;
  est_actif: number;
}

export interface AuthContextType {
  user: Utilisateur | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (login: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (nom: string, login: string, password: string, role: Role) => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
}