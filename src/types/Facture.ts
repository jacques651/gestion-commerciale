export interface CreateFactureDto {

  idClient: number;

  idCommande?: number;

  montantHT: number;

  montantTTC: number;
}