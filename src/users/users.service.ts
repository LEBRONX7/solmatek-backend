import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, StatutUtilisateur } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async create(data: {
    nom: string;
    prenom: string;
    email: string;
    motDePasse: string;
    telephone?: string;
    role?: Role;
  }) {
    return this.prisma.user.create({ data });
  }

  async findAll(role?: Role) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      select: {
        id: true, nom: true, prenom: true, email: true,
        telephone: true, role: true, statut: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    await this.findById(id);
    const updated = await this.prisma.user.update({ where: { id }, data: dto });
    const { motDePasse, ...result } = updated;
    return result;
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.findById(id);
    const isValid = await bcrypt.compare(dto.motDePasseActuel, user.motDePasse);
    if (!isValid) throw new BadRequestException('Mot de passe actuel incorrect');

    const hashed = await bcrypt.hash(dto.nouveauMotDePasse, 10);
    await this.prisma.user.update({ where: { id }, data: { motDePasse: hashed } });
    return { message: 'Mot de passe modifié avec succès' };
  }

  // --- Réservé à l'admin ---

  async createByAdmin(dto: CreateUserDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashed = await bcrypt.hash(dto.motDePasse, 10);
    const user = await this.prisma.user.create({
      data: { ...dto, motDePasse: hashed },
    });
    const { motDePasse, ...result } = user;
    return result;
  }

  async updateByAdmin(id: string, dto: UpdateUserAdminDto) {
    await this.findById(id);
    const updated = await this.prisma.user.update({ where: { id }, data: dto });
    const { motDePasse, ...result } = updated;
    return result;
  }

  async toggleStatut(id: string) {
    const user = await this.findById(id);
    const nouveauStatut =
      user.statut === StatutUtilisateur.ACTIF ? StatutUtilisateur.INACTIF : StatutUtilisateur.ACTIF;
    const updated = await this.prisma.user.update({ where: { id }, data: { statut: nouveauStatut } });
    const { motDePasse, ...result } = updated;
    return result;
  }
}