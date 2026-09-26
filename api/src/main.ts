import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global prefix for all REST endpoints
  app.setGlobalPrefix('api/v1');

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // OpenAPI Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('UniStay MSU REST API')
    .setDescription(
      'Unified Institutional & Private Housing Management Information System API documentation for Mindanao State University.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Authentication', 'Institutional Google OAuth & JWT token endpoints')
    .addTag('Users', 'User management & RBAC profiles')
    .addTag('Housing & Dormitories', 'Property listings, unit inventory, and applications')
    .addTag('Billing & Utility Splitting', 'Ledger, invoices, payment tracking, and utility splitting calculation')
    .addTag('Maintenance & Utilities', 'Service-desk ticketing with photo evidence and outage notifications')
    .addTag('Shared Facilities & Governance', 'Amenity bookings (laundry/parking), incidents, and dorm rules')
    .addTag('Student Gig Board', 'Micro-jobs and student errand marketplace')
    .addTag('Offline Sync Engine', 'Dexie.js offline mutation synchronization queue')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`UniStay MSU API running on: http://localhost:${port}/api/v1`);
  logger.log(`Swagger OpenAPI Documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
