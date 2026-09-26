import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Facility, FacilityBooking, BookingStatus, IncidentReport, DormRule } from './entities/facility.entity';
import { CreateBookingDto, CreateFacilityDto, CreateIncidentReportDto } from './dto/facilities.dto';
import { HousingService } from '../housing/housing.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class FacilitiesService {
  constructor(
    @InjectRepository(Facility)
    private readonly facilityRepo: Repository<Facility>,
    @InjectRepository(FacilityBooking)
    private readonly bookingRepo: Repository<FacilityBooking>,
    @InjectRepository(IncidentReport)
    private readonly incidentRepo: Repository<IncidentReport>,
    @InjectRepository(DormRule)
    private readonly ruleRepo: Repository<DormRule>,
    private readonly housingService: HousingService,
  ) {}

  async findAllFacilities(propertyId?: string): Promise<Facility[]> {
    if (propertyId) {
      return this.facilityRepo.find({ where: { property: { id: propertyId } } });
    }
    return this.facilityRepo.find();
  }

  async createFacility(dto: CreateFacilityDto): Promise<Facility> {
    const property = await this.housingService.findPropertyById(dto.propertyId);
    const facility = this.facilityRepo.create({
      name: dto.name,
      type: dto.type,
      property,
      slotCapacity: dto.slotCapacity,
      operationalHours: dto.operationalHours || '06:00 - 22:00',
    });
    return this.facilityRepo.save(facility);
  }

  async createBooking(dto: CreateBookingDto, user: User): Promise<FacilityBooking> {
    const facility = await this.facilityRepo.findOne({ where: { id: dto.facilityId } });
    if (!facility) {
      throw new NotFoundException(`Facility with ID ${dto.facilityId} not found`);
    }

    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (start >= end) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Check capacity conflicts
    const overlappingCount = await this.bookingRepo.count({
      where: {
        facility: { id: facility.id },
        status: BookingStatus.CONFIRMED,
        startTime: LessThanOrEqual(end),
        endTime: MoreThanOrEqual(start),
      },
    });

    if (overlappingCount >= facility.slotCapacity) {
      throw new BadRequestException('All slots for this facility are currently reserved during the requested time window.');
    }

    const booking = this.bookingRepo.create({
      facility,
      user,
      startTime: start,
      endTime: end,
      status: BookingStatus.CONFIRMED,
    });
    return this.bookingRepo.save(booking);
  }

  async findBookingsByUser(user: User): Promise<FacilityBooking[]> {
    return this.bookingRepo.find({
      where: { user: { id: user.id } },
      relations: ['facility'],
      order: { startTime: 'ASC' },
    });
  }

  // Incidents and Rules
  async createIncident(dto: CreateIncidentReportDto, reporter: User): Promise<IncidentReport> {
    const property = await this.housingService.findPropertyById(dto.propertyId);
    const incident = this.incidentRepo.create({
      title: dto.title,
      description: dto.description,
      severity: dto.severity || 'medium',
      property,
      reporter,
    });
    return this.incidentRepo.save(incident);
  }

  async findAllRules(propertyId?: string): Promise<DormRule[]> {
    return this.ruleRepo.find({ order: { createdAt: 'ASC' } });
  }
}
