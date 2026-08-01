import { Module } from '@nestjs/common';
import { DemandesService } from './demandes.service';
import { DemandesController } from './demandes.controller';

@Module({
  providers: [DemandesService],
  controllers: [DemandesController],
})
export class DemandesModule {}