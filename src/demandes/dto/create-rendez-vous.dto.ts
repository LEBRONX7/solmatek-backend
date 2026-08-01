import { IsNotEmpty, IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateRendezVousDto {
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsNotEmpty()
  @IsString()
  heure: string;

  @IsOptional()
  @IsString()
  lieu?: string;

  @IsOptional()
  @IsString()
  motif?: string;
}