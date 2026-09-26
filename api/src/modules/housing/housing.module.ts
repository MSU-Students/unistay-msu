import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property, Unit } from './entities/property.entity';
import { Application, Lease } from './entities/application.entity';
import { HousingService } from './housing.service';
import { HousingController } from './housing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Property, Unit, Application, Lease])],
  providers: [HousingService],
  controllers: [HousingController],
  exports: [HousingService],
})
export class HousingModule {}
