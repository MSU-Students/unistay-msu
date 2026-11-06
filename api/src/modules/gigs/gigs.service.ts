import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Gig,
  GigApplication,
  GigStatus,
  GigStatusLog,
  GigNote,
} from './entities/gig.entity';
import {
  ApplyForGigDto,
  CreateGigDto,
  CreateGigNoteDto,
  UpdateGigStatusDto,
} from './dto/gigs.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class GigsService {
  constructor(
    @InjectRepository(Gig)
    private readonly gigRepo: Repository<Gig>,
    @InjectRepository(GigApplication)
    private readonly appRepo: Repository<GigApplication>,
    @InjectRepository(GigStatusLog)
    private readonly logRepo: Repository<GigStatusLog>,
    @InjectRepository(GigNote)
    private readonly noteRepo: Repository<GigNote>,
  ) { }

  async findAllGigs(category?: string, status?: GigStatus): Promise<Gig[]> {
    const qb = this.gigRepo
      .createQueryBuilder('gig')
      .leftJoinAndSelect('gig.postedBy', 'postedBy')
      .leftJoinAndSelect('gig.assignedTo', 'assignedTo')
      .leftJoinAndSelect('gig.applications', 'applications')
      .orderBy('gig.createdAt', 'DESC');

    if (category) {
      qb.andWhere('gig.category = :category', { category });
    }

    if (status) {
      qb.andWhere('gig.status = :status', { status });
    }

    return qb.getMany();
  }

  async findGigById(id: string): Promise<Gig> {
    const gig = await this.gigRepo.findOne({
      where: { id },
      relations: [
        'postedBy',
        'assignedTo',
        'applications',
        'applications.applicant',
        'statusLogs',
        'statusLogs.changedBy',
        'notes',
        'notes.author',
      ],
      order: {
        statusLogs: { createdAt: 'DESC' },
        notes: { createdAt: 'DESC' },
      },
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
    const savedGig = await this.gigRepo.save(gig);

    const initialLog = this.logRepo.create({
      gig: savedGig,
      fromStatus: undefined,
      toStatus: GigStatus.OPEN,
      action: 'CREATED',
      changedBy: user,
      reason: 'Gig posted on student marketplace',
    });
    await this.logRepo.save(initialLog);

    return savedGig;
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

  async assignGig(
    gigId: string,
    applicantId: string,
    poster: User,
  ): Promise<Gig> {
    const gig = await this.findGigById(gigId);
    
    if (gig.postedBy.id !== poster.id) {
      throw new ForbiddenException('Only the gig creator can assign workers.');
    }

    if (gig.status !== GigStatus.OPEN) {
      throw new BadRequestException(
        `Cannot assign worker to a gig that is currently ${gig.status}.`,
      );
    }

    const application = await this.appRepo.findOne({
      where: { gig: { id: gigId }, applicant: { id: applicantId } },
      relations: ['applicant'],
    });

    if (!application) {
      throw new NotFoundException('Selected applicant not found for this gig.');
    }

    application.status = 'accepted';
    await this.appRepo.save(application);

    const fromStatus = gig.status;
    gig.assignedTo = application.applicant;
    gig.status = GigStatus.ASSIGNED;
    gig.assignedAt = new Date();
    const updatedGig = await this.gigRepo.save(gig);

    const log = this.logRepo.create({
      gig: updatedGig,
      fromStatus,
      toStatus: GigStatus.ASSIGNED,
      action: 'ASSIGNED',
      changedBy: poster,
      reason: `Assigned to student ${application.applicant.fullName || application.applicant.email}`,
    });
    await this.logRepo.save(log);

    return updatedGig;
  }


  async updateGigStatus(
    id: string,
    dto: UpdateGigStatusDto,
    currentUser: User,
  ): Promise<Gig> {
    const gig = await this.findGigById(id);

    const isPoster = gig.postedBy?.id === currentUser.id;
    const isAssignee = gig.assignedTo?.id === currentUser.id;

    if (!isPoster && !isAssignee) {
      throw new ForbiddenException(
        'You do not have permission to modify the status of this gig.',
      );
    }

    if (
      gig.status === GigStatus.COMPLETED ||
      gig.status === GigStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot change the status of a gig that is already ${gig.status}.`,
      );
    }

    if (gig.status === dto.status) {
      return gig;
    }

    const fromStatus = gig.status;
    const toStatus = dto.status;
    const now = new Date();

    switch (toStatus) {
      case GigStatus.IN_PROGRESS:
        if (fromStatus !== GigStatus.ASSIGNED) {
          throw new BadRequestException(
            `A gig must be in 'assigned' status before moving to 'in_progress'. Current status: '${fromStatus}'.`,
          );
        }
        gig.startedAt = now;
        break;

      case GigStatus.COMPLETED:
        if (
          fromStatus !== GigStatus.IN_PROGRESS &&
          fromStatus !== GigStatus.ASSIGNED
        ) {
          throw new BadRequestException(
            `Cannot mark gig as completed from status '${fromStatus}'. It must be assigned or in_progress first.`,
          );
        }
        gig.completedAt = now;
        if (dto.note) {
          gig.completionNote = dto.note;
        }
        break;

      case GigStatus.CANCELLED:
        gig.cancelledAt = now;
        gig.cancellationReason =
          dto.cancellationReason || dto.note || 'No reason provided';
        break;

      case GigStatus.ASSIGNED:
        throw new BadRequestException(
          "Use the assign endpoint to transition a gig to 'assigned'.",
        );

      case GigStatus.OPEN:
        if (fromStatus !== GigStatus.ASSIGNED) {
          throw new BadRequestException(
            `Cannot reopen a gig that is in '${fromStatus}' status.`,
          );
        }
        gig.assignedTo = undefined;
        gig.assignedAt = undefined;
        break;

      default:
        throw new BadRequestException(`Unsupported gig status: ${toStatus}`);
    }

    gig.status = toStatus;
    const savedGig = await this.gigRepo.save(gig);

    const log = this.logRepo.create({
      gig: savedGig,
      fromStatus,
      toStatus,
      action: toStatus.toUpperCase(),
      changedBy: currentUser,
      reason:
        dto.cancellationReason ||
        dto.note ||
        `Status transitioned from ${fromStatus} to ${toStatus}`,
    });
    await this.logRepo.save(log);

    return savedGig;
  }

  async findMyPostedGigs(user: User): Promise<Gig[]> {
    return this.gigRepo.find({
      where: { postedBy: { id: user.id } },
      relations: [
        'assignedTo',
        'applications',
        'applications.applicant',
        'statusLogs',
        'notes',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findMyAssignedGigs(user: User): Promise<Gig[]> {
    return this.gigRepo.find({
      where: { assignedTo: { id: user.id } },
      relations: ['postedBy', 'statusLogs', 'notes'],
      order: { createdAt: 'DESC' },
    });
  }

  async addGigNote(
    gigId: string,
    dto: CreateGigNoteDto,
    author: User,
  ): Promise<GigNote> {
    const gig = await this.findGigById(gigId);

    const isPoster = gig.postedBy?.id === author.id;
    const isAssignee = gig.assignedTo?.id === author.id;
    const isApplicant = gig.applications?.some(
      (app) => app.applicant?.id === author.id,
    );

    if (!isPoster && !isAssignee && !isApplicant) {
      throw new ForbiddenException(
        'Only students involved in this gig can attach notes or messages.',
      );
    }

    const note = this.noteRepo.create({
      gig,
      author,
      message: dto.message,
    });
    return this.noteRepo.save(note);
  }

  async getGigNotes(gigId: string): Promise<GigNote[]> {
    return this.noteRepo.find({
      where: { gig: { id: gigId } },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });
  }

  async getGigTimeline(gigId: string): Promise<
    Array<{
      type: 'status_change' | 'note';
      id: string;
      timestamp: Date;
      actor: User;
      title: string;
      description?: string;
      fromStatus?: GigStatus;
      toStatus?: GigStatus;
    }>
  > {
    const gig = await this.findGigById(gigId);

    const timelineItems: Array<{
      type: 'status_change' | 'note';
      id: string;
      timestamp: Date;
      actor: User;
      title: string;
      description?: string;
      fromStatus?: GigStatus;
      toStatus?: GigStatus;
    }> = [];

    for (const log of gig.statusLogs || []) {
      timelineItems.push({
        type: 'status_change',
        id: log.id,
        timestamp: log.createdAt,
        actor: log.changedBy,
        title: `Status changed to ${log.toStatus.toUpperCase()}`,
        description: log.reason,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
      });
    }

    for (const note of gig.notes || []) {
      timelineItems.push({
        type: 'note',
        id: note.id,
        timestamp: note.createdAt,
        actor: note.author,
        title: `Note from ${note.author?.fullName || note.author?.email || 'Student'}`,
        description: note.message,
      });
    }

    return timelineItems.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }
}
