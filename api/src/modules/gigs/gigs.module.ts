import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gig, GigApplication, GigStatusLog, GigNote } from './entities/gig.entity';
import { GigsService } from './gigs.service';
import { GigsController } from './gigs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Gig, GigApplication, GigStatusLog, GigNote])],
  providers: [GigsService],
  controllers: [GigsController],
  exports: [GigsService],
})
export class GigsModule {}
