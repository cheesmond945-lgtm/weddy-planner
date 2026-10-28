import { Global, Module } from '@nestjs/common';
import { AiQuotaService } from './ai-quota.service';
import { GeminiService } from './gemini.service';

@Global()
@Module({ providers: [GeminiService, AiQuotaService], exports: [GeminiService, AiQuotaService] })
export class AiModule {}
