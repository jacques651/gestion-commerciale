export interface DecompteDetailDto {
  idProduit: number;
  quantite: number;
  prixVente: number;
}

export interface CreateDecompteDto {
  idRevendeur: number;
  details: DecompteDetailDto[];
}