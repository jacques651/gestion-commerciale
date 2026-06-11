export interface ClientDto {
  idClient?: number;

  NomComplet: string;

  Societe?: string;

  Adresse?: string;

  Tel?: string;

  Email?: string;

  Ville?: string;

  TypeClient: "client" | "revendeur";
}