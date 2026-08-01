import { IsNotEmpty, IsString } from 'class-validator';

export class AffecterAgentDto {
  @IsNotEmpty()
  @IsString()
  agentId: string;
}