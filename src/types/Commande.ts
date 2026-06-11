export interface CommandeDetailDto {
  idProduit: number;
  quantite: number;
  prixUnitaire: number;
}

export interface CreateCommandeDto {
  idClient: number;
  typeCommande: "STANDARD" | "REVENDEUR";
  details: CommandeDetailDto[];
}