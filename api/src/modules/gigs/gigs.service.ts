import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gig, GigApplication, GigStatus } from './entities/gig.entity';
import { ApplyForGigDto, CreateGigDto, UpdateGigStatusDto } from './dto/gigs.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class GigsService {
  constructor(
    @InjectRepository(Gig)
    private readonly gigRepo: Repository<Gig>,
    @InjectRepository(GigApplication)
    private readonly appRepo: Repository<GigApplication>,
  ) {}

  async findAllGigs(category?: string): Promise<Gig[]> {
    const qb = this.gigRepo.createQueryBuilder('gig')
      .leftJoinAndSelect('gig.postedBy', 'postedBy')
      .leftJoinAndSelect('gig.assignedTo', 'assignedTo')
      .leftJoinAndSelect('gig.applications', 'applications')
      .orderBy('gig.createdAt', 'DESC');

    if (category) {
      qb.andWhere('gig.category = :category', { category });
    }

    return qb.getMany();
  }

  async findGigById(id: string): Promise<Gig> {
    const gig = await this.gigRepo.findOne({
      where: { id },
      relations: ['postedBy', 'assignedTo', 'applications', 'applications.applicant'],
    });
    if (!gig) {
      throw new NotFoundException(`Gig with ID ${id} not found`);
    }
    return gig;
  }

  async createGig(dto: CreateGigDto, user: User): Promise<Gig> {
    const gig = this.gigRepo.create({
      ...dto,
      postedBy: user,
      status: GigStatus.OPEN,
    });
    return this.gigRepo.save(gig);
  }

  async applyForGig(gigId: string, dto: ApplyForGigDto, user: User): Promise<GigApplication> {
    const gig = await this.findGigById(gigId);
    if (gig.postedBy.id === user.id) {
      throw new BadRequestException('You cannot apply for your own posted gig.');
    }
    if (gig.status !== GigStatus.OPEN) {
      throw new BadRequestException('This gig is no longer accepting applications.');
    }

    const application = this.appRepo.create({
      gig,
      applicant: user,
      pitch: dto.pitch,
      status: 'pending',
    });
    return this.appRepo.save(application);
  }

  async assignGig(gigId: string, applicantId: string, poster: User): Promise<Gig> {
    const gig = await this.findGigById(gigId);
    if (gig.postedBy.id !== poster.id) {
      throw new BadRequestException('Only the gig creator can assign workers.');
    }

    const application = await this.appRepo.findOne({
      where: { gig: { id: gigId }, applicant: { id: applicantId } },
      relations: ['applicant'],
    });
    if (!application) {
      throw new NotFoundException('Selected applicant not found');
    }

    application.status = 'accepted';
    await this.appRepo.save(application);

    gig.assignedTo = application.applicant;
    gig.status = GigStatus.ASSIGNED;
    return this.gigRepo.save(gig);
  }

  async updateGigStatus(id: string, dto: UpdateGigStatusDto): Promise<Gig> {
    const gig = await this.findGigById(id);
    gig.status = dto.status;
    return this.gigRepo.save(gig);
  }
}
