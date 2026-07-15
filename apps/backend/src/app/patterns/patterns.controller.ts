import { Controller, Get } from '@nestjs/common';
import { Pattern, PatternsService } from './patterns.service';

@Controller('patterns')
export class PatternsController {
  constructor(private readonly patternsService: PatternsService) {}

  @Get()
  findAll(): Pattern[] {
    return this.patternsService.findAll();
  }
}
