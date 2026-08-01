import { IsEnum, IsNotEmpty } from 'class-validator';
import { StatutDemande } from '@prisma/client';

export class UpdateStatutDto {
  @IsNotEmpty()
  @IsEnum(StatutDemande)
  statut: StatutDemande;
}