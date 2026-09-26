import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gig, GigApplication } from './entities/gig.entity';
import { GigsService } from './gigs.service';
import { GigsController } from './gigs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Gig, GigApplication])],
  providers: [GigsService],
  controllers: [GigsController],
  exports: [GigsService],
})
export class GigsModule {}
