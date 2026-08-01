import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { StatutRendezVous } from '@prisma/client';

export class UpdateRendezVousDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  heure?: string;

  @IsOptional()
  @IsString()
  lieu?: string;

  @IsOptional()
  @IsString()
  motif?: string;

  @IsOptional()
  @IsEnum(StatutRendezVous)
  statut?: StatutRendezVous;
}