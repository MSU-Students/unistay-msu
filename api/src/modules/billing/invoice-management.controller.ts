import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../users/entities/user.entity';
import {
  GenerateInvoiceDto,
  InvoiceListQueryDto,
  UpdateInvoiceStatusDto,
} from './dto/billing.dto';
import { BillingService } from './billing.service';

function requestMetadata(request: Request) {
  return {
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  };
}

@ApiTags('Invoice Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties/:propertyId/invoices')
export class PropertyInvoiceController {
  constructor(private readonly billingService: BillingService) {}

  @Post('generate')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Generate a manual or recurring invoice for a billing period' })
  generate(
    @Param('propertyId') propertyId: string,
    @Body() dto: GenerateInvoiceDto,
    @CurrentUser() actor: User,
    @Req() request: Request,
  ) {
    return this.billingService.generateInvoice(propertyId, dto, actor, requestMetadata(request));
  }

  @Get()
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'List paginated property invoices with filters' })
  list(
    @Param('propertyId') propertyId: string,
    @Query() query: InvoiceListQueryDto,
    @CurrentUser() actor: User,
  ) {
    return this.billingService.listPropertyInvoices(propertyId, query, actor);
  }

  @Get('leases')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'List active property leases for tenant and recurring billing selection' })
  listLeases(@Param('propertyId') propertyId: string, @CurrentUser() actor: User) {
    return this.billingService.listPropertyLeases(propertyId, actor);
  }
}

@ApiTags('Invoice Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly billingService: BillingService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice details and itemized breakdown' })
  detail(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.billingService.findInvoiceById(id, actor);
  }

  @Get(':id/audit-trail')
  @ApiOperation({ summary: 'Get chronological immutable invoice audit history' })
  auditTrail(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.billingService.getAuditTrail(id, actor);
  }

  @Patch(':id/status')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Update invoice status with an audit snapshot' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceStatusDto,
    @CurrentUser() actor: User,
    @Req() request: Request,
  ) {
    return this.billingService.updateStatus(id, dto, actor, requestMetadata(request));
  }
}
