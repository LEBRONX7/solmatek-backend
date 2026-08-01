import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDemandeDto } from './dto/create-demande.dto';
import { CreateCommentaireDto } from './dto/create-commentaire.dto';
import { CreateRendezVousDto } from './dto/create-rendez-vous.dto';
import { StatutDemande, StatutDocument, Role } from '@prisma/client';

@Injectable()
export class DemandesService {
  constructor(private prisma: PrismaService) {}

  // Génère un numéro du type SMC-2026-0001
  private async generateNumeroDossier(): Promise<string> {
    const annee = new Date().getFullYear();
    const prefix = `SMC-${annee}-`;

    const count = await this.prisma.demande.count({
      where: { numeroDossier: { startsWith: prefix } },
    });

    const numero = (count + 1).toString().padStart(4, '0');
    return `${prefix}${numero}`;
  }

  async create(clientId: string, dto: CreateDemandeDto) {
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service) throw new NotFoundException('Service introuvable');

    const numeroDossier = await this.generateNumeroDossier();

    const demande = await this.prisma.demande.create({
      data: {
        clientId,
        serviceId: dto.serviceId,
        commentaire: dto.commentaire,
        numeroDossier,
        statut: StatutDemande.EN_ATTENTE,
        dateDepot: new Date(),
      },
      include: { service: true, client: true },
    });

    await this.prisma.historique.create({
      data: {
        demandeId: demande.id,
        ancienStatut: null,
        nouveauStatut: StatutDemande.EN_ATTENTE,
        modifieParId: clientId,
      },
    });

    // Notifie tous les admins de la nouvelle demande
    const admins = await this.prisma.user.findMany({ where: { role: Role.ADMIN } });
    await Promise.all(
      admins.map((admin) =>
        this.prisma.notification.create({
          data: {
            userId: admin.id,
            titre: 'Nouvelle demande',
            contenu: `${demande.client.prenom} ${demande.client.nom} a soumis une demande "${service.nom}" (${numeroDossier})`,
          },
        }),
      ),
    );

    return demande;
  }

  // Liste selon le rôle : client = ses demandes, agent = ses dossiers affectés, admin = tout
  async findAll(userId: string, role: Role) {
    let where = {};
    if (role === Role.CLIENT) where = { clientId: userId };
    if (role === Role.AGENT) where = { agentId: userId };
    // ADMIN : pas de filtre, voit tout

    return this.prisma.demande.findMany({
      where,
      include: {
        service: true,
        client: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
        agent: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, role: Role) {
    const demande = await this.prisma.demande.findUnique({
      where: { id },
      include: {
        service: { include: { documentsRequis: true } },
        client: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
        agent: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
        documents: { include: { serviceDocument: true } },
        rendezVous: true,
        commentaires: { include: { user: { select: { nom: true, prenom: true, role: true } } }, orderBy: { createdAt: 'asc' } },
        historiques: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!demande) throw new NotFoundException('Demande introuvable');

    // Sécurité : un client ne peut voir que ses propres demandes
    if (role === Role.CLIENT && demande.clientId !== userId) {
      throw new ForbiddenException('Accès refusé à cette demande');
    }
    if (role === Role.AGENT && demande.agentId !== userId) {
      throw new ForbiddenException('Accès refusé à cette demande');
    }

    return demande;
  }

async updateStatut(id: string, nouveauStatut: StatutDemande, modifieParId: string) {
    const demande = await this.prisma.demande.findUnique({ where: { id } });
    if (!demande) throw new NotFoundException('Demande introuvable');

    const updated = await this.prisma.demande.update({
      where: { id },
      data: { statut: nouveauStatut },
    });

    await this.prisma.historique.create({
      data: {
        demandeId: id,
        ancienStatut: demande.statut,
        nouveauStatut,
        modifieParId,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: demande.clientId,
        titre: 'Mise à jour de votre dossier',
        contenu: `Votre demande ${demande.numeroDossier} est passée au statut : ${nouveauStatut}`,
      },
    });

    // Notifie aussi tous les admins de l'évolution du dossier
    const admins = await this.prisma.user.findMany({ where: { role: Role.ADMIN } });
    await Promise.all(
      admins.map((admin) =>
        this.prisma.notification.create({
          data: {
            userId: admin.id,
            titre: 'Statut de demande modifié',
            contenu: `Le dossier ${demande.numeroDossier} est passé de "${demande.statut}" à "${nouveauStatut}"`,
          },
        }),
      ),
    );

    return updated;
  }

  async affecterAgent(id: string, agentId: string) {
    const agent = await this.prisma.user.findUnique({ where: { id: agentId } });
    if (!agent || agent.role !== Role.AGENT) {
      throw new NotFoundException('Agent introuvable');
    }

    const demande = await this.prisma.demande.update({
      where: { id },
      data: { agentId },
      include: { service: true },
    });

    await this.prisma.notification.create({
      data: {
        userId: agentId,
        titre: 'Nouvelle demande affectée',
        contenu: `Le dossier ${demande.numeroDossier} (${demande.service.nom}) vous a été affecté.`,
      },
    });

    return demande;
  }

  // Documents
  async uploadDocument(
    demandeId: string,
    serviceDocumentId: string,
    file: Express.Multer.File,
  ) {
    const demande = await this.prisma.demande.findUnique({ where: { id: demandeId } });
    if (!demande) throw new NotFoundException('Demande introuvable');

    const document = await this.prisma.demandeDocument.create({
      data: {
        demandeId,
        serviceDocumentId,
        nomOriginal: file.originalname,
        nomFichier: file.filename,
        type: file.mimetype,
        taille: file.size,
        url: `/uploads/${file.filename}`,
        statut: StatutDocument.EN_ATTENTE,
      },
    });

    if (demande.agentId) {
      await this.prisma.notification.create({
        data: {
          userId: demande.agentId,
          titre: 'Nouveau document reçu',
          contenu: `Un document a été déposé pour le dossier ${demande.numeroDossier}.`,
        },
      });
    }

    return document;
  }
  async updateDocumentStatut(documentId: string, statut: StatutDocument) {
    const doc = await this.prisma.demandeDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document introuvable');

    return this.prisma.demandeDocument.update({
      where: { id: documentId },
      data: { statut },
    });
  }

  // Commentaires
  async addCommentaire(demandeId: string, userId: string, dto: CreateCommentaireDto) {
    const demande = await this.prisma.demande.findUnique({ where: { id: demandeId } });
    if (!demande) throw new NotFoundException('Demande introuvable');

    const commentaire = await this.prisma.commentaire.create({
      data: { demandeId, userId, message: dto.message },
      include: { user: { select: { nom: true, prenom: true, role: true } } },
    });

    // Notifie l'autre partie (client <-> agent)
    const destinataireId = userId === demande.clientId ? demande.agentId : demande.clientId;
    if (destinataireId) {
      await this.prisma.notification.create({
        data: {
          userId: destinataireId,
          titre: 'Nouveau message',
          contenu: `${commentaire.user.prenom} a envoyé un message sur le dossier ${demande.numeroDossier}.`,
        },
      });
    }

    return commentaire;
  }
  // Rendez-vous
  async createRendezVous(demandeId: string, agentId: string, dto: CreateRendezVousDto) {
    const demande = await this.prisma.demande.findUnique({ where: { id: demandeId } });
    if (!demande) throw new NotFoundException('Demande introuvable');

    const rdv = await this.prisma.rendezVous.create({
      data: {
        demandeId,
        agentId,
        date: new Date(dto.date),
        heure: dto.heure,
        lieu: dto.lieu,
        motif: dto.motif,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: demande.clientId,
        titre: 'Nouveau rendez-vous',
        contenu: `Un rendez-vous a été programmé pour votre dossier ${demande.numeroDossier}`,
      },
    });

    return rdv;
  }

  async findMesRendezVous(userId: string, role: Role) {
    if (role === Role.CLIENT) {
      return this.prisma.rendezVous.findMany({
        where: { demande: { clientId: userId } },
        include: { demande: { include: { service: true } }, agent: { select: { nom: true, prenom: true } } },
        orderBy: { date: 'asc' },
      });
    }
    if (role === Role.AGENT) {
      return this.prisma.rendezVous.findMany({
        where: { agentId: userId },
        include: { demande: { include: { service: true, client: true } } },
        orderBy: { date: 'asc' },
      });
    }
    return this.prisma.rendezVous.findMany({
      include: { demande: { include: { service: true, client: true } }, agent: { select: { nom: true, prenom: true } } },
      orderBy: { date: 'asc' },
    });
  }
  async getJournal() {
    return this.prisma.historique.findMany({
      include: {
        demande: { include: { service: true, client: true } },
        modifiePar: { select: { nom: true, prenom: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async updateRendezVous(id: string, dto: any) {
    const rdv = await this.prisma.rendezVous.findUnique({ where: { id } });
    if (!rdv) throw new NotFoundException('Rendez-vous introuvable');

    return this.prisma.rendezVous.update({
      where: { id },
      data: {
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.heure && { heure: dto.heure }),
        ...(dto.lieu !== undefined && { lieu: dto.lieu }),
        ...(dto.motif !== undefined && { motif: dto.motif }),
        ...(dto.statut && { statut: dto.statut }),
      },
    });
  }

  async annulerRendezVous(id: string) {
    const rdv = await this.prisma.rendezVous.findUnique({ where: { id } });
    if (!rdv) throw new NotFoundException('Rendez-vous introuvable');

    return this.prisma.rendezVous.update({
      where: { id },
      data: { statut: 'ANNULE' },
    });
  }
}