import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { AddServiceDocumentDto } from './dto/add-service-document.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateServiceDto) {
    return this.prisma.service.create({ data: dto });
  }

  async findAll() {
    return this.prisma.service.findMany({
      include: { documentsRequis: true },
      orderBy: { nom: 'asc' },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { documentsRequis: true },
    });
    if (!service) throw new NotFoundException('Service introuvable');
    return service;
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.findOne(id);
    return this.prisma.service.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.service.delete({ where: { id } });
  }

  // Documents requis pour un service
  async addDocument(serviceId: string, dto: AddServiceDocumentDto) {
    await this.findOne(serviceId);
    return this.prisma.serviceDocument.create({
      data: {
        serviceId,
        nomDocument: dto.nomDocument,
        obligatoire: dto.obligatoire ?? true,
      },
    });
  }

  async removeDocument(serviceId: string, documentId: string) {
    return this.prisma.serviceDocument.delete({
      where: { id: documentId },
    });
  }
}