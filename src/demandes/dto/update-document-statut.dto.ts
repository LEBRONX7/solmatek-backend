import { IsEnum, IsNotEmpty } from 'class-validator';
import { StatutDocument } from '@prisma/client';

export class UpdateDocumentStatutDto {
  @IsNotEmpty()
  @IsEnum(StatutDocument)
  statut: StatutDocument;
}