import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
    if (user.role === Role.STUDENT) {
      return this.billingService.findAllInvoices(user.id);
    }
    return this.billingService.findAllInvoices();
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice details with payments' })
  async getInvoiceById(@Param('id') id: string) {
    return this.billingService.findInvoiceById(id);
  }

  @Post('invoices')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Generate a new invoice with rent & utilities' })
  async createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(dto);
  }

  @Post('payments')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN, Role.STUDENT)
  @ApiOperation({ summary: 'Record a payment against an invoice (online or synced offline)' })
  async recordPayment(
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.billingService.recordPayment(dto, user);
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
