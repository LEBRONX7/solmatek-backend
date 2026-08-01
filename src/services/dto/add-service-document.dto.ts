import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class AddServiceDocumentDto {
  @IsNotEmpty()
  @IsString()
  nomDocument: string;

  @IsOptional()
  @IsBoolean()
  obligatoire?: boolean;
}