import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ImageProxyController } from './image-proxy/image-proxy.controller';
import { ImageProxyService } from './image-proxy/image-proxy.service';
import { PatternsController } from './patterns/patterns.controller';
import { PatternsService } from './patterns/patterns.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Connessione MongoDB (Mongoose), predisposta ma non attiva: da decommentare
    // quando il database sarà disponibile. Richiede di ripristinare gli import:
    //   import { ConfigService } from '@nestjs/config';
    //   import { MongooseModule } from '@nestjs/mongoose';
    // La URI viene letta da `.env` (vedi .env.example nella root del workspace).
    //
    // MongooseModule.forRootAsync({
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     uri: config.get<string>(
    //       'MONGODB_URI',
    //       'mongodb://localhost:27017/crosstitch',
    //     ),
    //   }),
    // }),
    ServeStaticModule.forRoot({ rootPath: join(__dirname, 'public/browser') }),
  ],
  controllers: [AppController, ImageProxyController, PatternsController],
  providers: [AppService, ImageProxyService, PatternsService],
})
export class AppModule {}
