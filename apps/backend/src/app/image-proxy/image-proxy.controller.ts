import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ImageProxyService } from './image-proxy.service';

@Controller('image-proxy')
export class ImageProxyController {
  constructor(private readonly imageProxy: ImageProxyService) {}

  @Get()
  async proxy(
    @Query('url') url: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, contentType } = await this.imageProxy.fetchImage(url);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(buffer);
  }
}
