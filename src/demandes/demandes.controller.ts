import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, Req, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { DemandesService } from './demandes.service';
import { CreateDemandeDto } from './dto/create-demande.dto';
import { UpdateStatutDto } from './dto/update-statut.dto';
import { AffecterAgentDto } from './dto/affecter-agent.dto';
import { CreateCommentaireDto } from './dto/create-commentaire.dto';
import { CreateRendezVousDto } from './dto/create-rendez-vous.dto';
import { UpdateDocumentStatutDto } from './dto/update-document-statut.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('demandes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DemandesController {
  constructor(private demandesService: DemandesService) {}

  @Post()
  @Roles(Role.CLIENT)
  create(@Req() req, @Body() dto: CreateDemandeDto) {
    return this.demandesService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req) {
    return this.demandesService.findAll(req.user.id, req.user.role);
  }

  @Get('journal/tout')
  @Roles(Role.ADMIN)
  getJournal() {
    return this.demandesService.getJournal();
  }

  @Get('rendez-vous')
  findMesRendezVous(@Req() req) {
    return this.demandesService.findMesRendezVous(req.user.id, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    return this.demandesService.findOne(id, req.user.id, req.user.role);
  }

  @Patch(':id/statut')
  @Roles(Role.AGENT, Role.ADMIN)
  updateStatut(@Param('id') id: string, @Body() dto: UpdateStatutDto, @Req() req) {
    return this.demandesService.updateStatut(id, dto.statut, req.user.id);
  }

  @Patch(':id/affecter')
  @Roles(Role.ADMIN)
  affecterAgent(@Param('id') id: string, @Body() dto: AffecterAgentDto) {
    return this.demandesService.affecterAgent(id, dto.agentId);
  }

  // Upload d'un document (multipart/form-data)
  @Post(':id/documents')
  @Roles(Role.CLIENT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
        if (!allowed.includes(extname(file.originalname).toLowerCase())) {
          return callback(new Error('Seuls les fichiers PDF, PNG, JPG et JPEG sont acceptés'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo max
    }),
  )
  uploadDocument(
    @Param('id') demandeId: string,
    @Body('serviceDocumentId') serviceDocumentId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.demandesService.uploadDocument(demandeId, serviceDocumentId, file);
  }

  @Patch('documents/:documentId/statut')
  @Roles(Role.AGENT, Role.ADMIN)
  updateDocumentStatut(@Param('documentId') documentId: string, @Body() dto: UpdateDocumentStatutDto) {
    return this.demandesService.updateDocumentStatut(documentId, dto.statut);
  }

  // Commentaires
  @Post(':id/commentaires')
  addCommentaire(@Param('id') id: string, @Req() req, @Body() dto: CreateCommentaireDto) {
    return this.demandesService.addCommentaire(id, req.user.id, dto);
  }

  // Rendez-vous
  @Post(':id/rendez-vous')
  @Roles(Role.AGENT, Role.ADMIN)
  createRendezVous(@Param('id') id: string, @Req() req, @Body() dto: CreateRendezVousDto) {
    return this.demandesService.createRendezVous(id, req.user.id, dto);
  }

  @Patch('rendez-vous/:id')
  @Roles(Role.AGENT, Role.ADMIN)
  updateRendezVous(@Param('id') id: string, @Body() dto: any) {
    return this.demandesService.updateRendezVous(id, dto);
  }

  @Patch('rendez-vous/:id/annuler')
  @Roles(Role.AGENT, Role.ADMIN)
  annulerRendezVous(@Param('id') id: string) {
    return this.demandesService.annulerRendezVous(id);
  }
}