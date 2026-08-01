import { IsOptional, IsString } from 'class-validator';

export class UpdateUserAdminDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  @IsOptional()
  @IsString()
  telephone?: string;
}