import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { UtilitySplitterService } from './utility-splitter.service';
import { CalculateUtilitySplitDto, CreateInvoiceDto, RecordPaymentDto } from './dto/billing.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Billing & Utility Splitting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly utilitySplitter: UtilitySplitterService,
  ) {}

  @Get('invoices')
  @ApiOperation({ summary: 'List all invoices for tenant or property manager' })
  async getInvoices(@CurrentUser() user: User) {
    return this.billingService.findAllInvoices(user);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice details with payments' })
  async getInvoiceById(@Param('id') id: string, @CurrentUser() user: User) {
    return this.billingService.findInvoiceById(id, user);
  }

  @Post('invoices')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Generate a new invoice with rent & utilities' })
  async createInvoice(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: User,
    @Req() request: Request,
  ) {
    return this.billingService.createInvoice(dto, user, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Post('payments')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN, Role.STUDENT)
  @ApiOperation({ summary: 'Record a payment against an invoice (online or synced offline)' })
  async recordPayment(
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: User,
    @Req() request: Request,
  ) {
    return this.billingService.recordPayment(dto, user, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Post('utility-splitter/calculate')
  @ApiOperation({ summary: 'Calculate equitable utility breakdown' })
  async calculateSplit(@Body() dto: CalculateUtilitySplitDto) {
    return this.utilitySplitter.calculateEqualSplit({
      totalElectric: dto.totalElectricBill,
      totalWater: dto.totalWaterBill,
      occupantCount: dto.occupantCount,
    });
  }
}
