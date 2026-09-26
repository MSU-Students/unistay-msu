import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Facility, FacilityBooking, IncidentReport, DormRule } from './entities/facility.entity';
import { FacilitiesService } from './facilities.service';
import { FacilitiesController } from './facilities.controller';
import { HousingModule } from '../housing/housing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Facility, FacilityBooking, IncidentReport, DormRule]),
    HousingModule,
  ],
  providers: [FacilitiesService],
  controllers: [FacilitiesController],
  exports: [FacilitiesService],
})
export class FacilitiesModule {}
