import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateDemandeDto {
  @IsNotEmpty()
  @IsString()
  serviceId: string;

  @IsOptional()
  @IsString()
  commentaire?: string;
}