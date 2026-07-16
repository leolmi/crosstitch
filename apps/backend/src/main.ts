/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app/app.module';

/** Dominio canonico dell'app: il vecchio host *.herokuapp.com vi reindirizza. */
const CANONICAL_HOST = 'crosstitch.app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // redirect permanente dal dominio Heroku di default a quello canonico,
  // così i motori di ricerca consolidano l'indicizzazione su un solo host
  app.use((req: Request, res: Response, next: NextFunction) => {
    const host = req.headers.host ?? '';
    if (host.endsWith('.herokuapp.com')) {
      res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
      return;
    }
    next();
  });
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
