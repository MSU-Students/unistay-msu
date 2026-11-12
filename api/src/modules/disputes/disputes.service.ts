import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Dispute,
  DisputeAction,
  DisputeActionType,
  DisputeStatus,
} from './entities/dispute.entity';
import { Gig } from '../gigs/entities/gig.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateDisputeDto,
  RespondToDisputeDto,
  ResolveDisputeDto,
  DisputeActionDto,
} from './dto/disputes.dto';

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,

    @InjectRepository(DisputeAction)
    private readonly actionRepo: Repository<DisputeAction>,

    @InjectRepository(Gig)
    private readonly gigRepo: Repository<Gig>,
  ) {}

  async findAll(reporterId?: string): Promise<Dispute[]> {
    const qb = this.disputeRepo
      .createQueryBuilder('dispute')
      .leftJoinAndSelect('dispute.gig', 'gig')
      .leftJoinAndSelect('dispute.reportedBy', 'reportedBy')
      .leftJoinAndSelect('dispute.assignedManager', 'manager')
      .orderBy('dispute.createdAt', 'DESC');

    if (reporterId) {
      qb.andWhere('reportedBy.id = :reporterId', { reporterId });
    }

    return qb.getMany();
  }

  async findById(id: string, reporterId?: string): Promise<Dispute> {
    const qb = this.disputeRepo
      .createQueryBuilder('dispute')
      .leftJoinAndSelect('dispute.gig', 'gig')
      .leftJoinAndSelect('gig.postedBy', 'postedBy')
      .leftJoinAndSelect('gig.assignedTo', 'assignedTo')
      .leftJoinAndSelect('dispute.reportedBy', 'reportedBy')
      .leftJoinAndSelect('dispute.assignedManager', 'manager')
      .leftJoinAndSelect('dispute.actions', 'actions')
      .leftJoinAndSelect('actions.performedBy', 'performedBy')
      .where('dispute.id = :id', { id });

    if (reporterId) {
      qb.andWhere('reportedBy.id = :reporterId', { reporterId });
    }

    const dispute = await qb.getOne();

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${id} not found`);
    }

    return dispute;
  }

  async create(dto: CreateDisputeDto, reporter: User): Promise<Dispute> {
    const gig = await this.gigRepo.findOne({
      where: { id: dto.gigId },
      relations: ['postedBy', 'assignedTo'],
    });

    if (!gig) {
      throw new NotFoundException('Gig not found');
    }

    const isParticipant =
      gig.postedBy.id === reporter.id ||
      gig.assignedTo?.id === reporter.id;

    if (!isParticipant) {
      throw new ForbiddenException(
        'Only the gig poster or assigned student can report a dispute.',
      );
    }

    const dispute = this.disputeRepo.create({
      gig,
      reportedBy: reporter,
      subject: dto.subject,
      description: dto.description,
      status: DisputeStatus.OPEN,
    });

    const savedDispute = await this.disputeRepo.save(dispute);

    await this.recordAction(
      savedDispute,
      reporter,
      DisputeActionType.SUBMITTED,
      'Dispute submitted.',
    );

    return this.findById(savedDispute.id);
  }

  async respond(
    id: string,
    dto: RespondToDisputeDto,
    manager: User,
  ): Promise<Dispute> {
    const dispute = await this.findById(id);

    this.ensureActive(dispute);

    dispute.assignedManager = manager;
    dispute.status = DisputeStatus.IN_REVIEW;

    await this.disputeRepo.save(dispute);

    await this.recordAction(
      dispute,
      manager,
      DisputeActionType.RESPONDED,
      dto.message,
    );

    return this.findById(id);
  }

  async escalate(
    id: string,
    dto: DisputeActionDto,
    manager: User,
  ): Promise<Dispute> {
    const dispute = await this.findById(id);

    this.ensureActive(dispute);

    dispute.assignedManager = manager;
    dispute.status = DisputeStatus.ESCALATED;

    await this.disputeRepo.save(dispute);

    await this.recordAction(
      dispute,
      manager,
      DisputeActionType.ESCALATED,
      dto.message,
    );

    return this.findById(id);
  }

  async resolve(
    id: string,
    dto: ResolveDisputeDto,
    manager: User,
  ): Promise<Dispute> {
    const dispute = await this.findById(id);

    this.ensureActive(dispute);

    dispute.assignedManager = manager;
    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolution = dto.resolution;

    await this.disputeRepo.save(dispute);

    await this.recordAction(
      dispute,
      manager,
      DisputeActionType.RESOLVED,
      dto.resolution,
    );

    return this.findById(id);
  }

  async close(
    id: string,
    dto: DisputeActionDto,
    manager: User,
  ): Promise<Dispute> {
    const dispute = await this.findById(id);

    if (
      dispute.status !== DisputeStatus.RESOLVED &&
      dispute.status !== DisputeStatus.ESCALATED
    ) {
      throw new BadRequestException(
        'Only resolved or escalated disputes can be closed.',
      );
    }

    dispute.assignedManager = manager;
    dispute.status = DisputeStatus.CLOSED;

    await this.disputeRepo.save(dispute);

    await this.recordAction(
      dispute,
      manager,
      DisputeActionType.CLOSED,
      dto.message,
    );

    return this.findById(id);
  }

  private ensureActive(dispute: Dispute): void {
    if (
      dispute.status === DisputeStatus.RESOLVED ||
      dispute.status === DisputeStatus.CLOSED
    ) {
      throw new BadRequestException(
        'This dispute is already resolved or closed.',
      );
    }
  }

  private async recordAction(
    dispute: Dispute,
    user: User,
    actionType: DisputeActionType,
    message: string,
  ): Promise<DisputeAction> {
    const action = this.actionRepo.create({
      dispute,
      performedBy: user,
      actionType,
      message,
    });

    return this.actionRepo.save(action);
  }
}
