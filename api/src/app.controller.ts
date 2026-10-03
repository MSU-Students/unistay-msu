import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { AppService } from './app.service';

@Controller('')
export class AppController {
    constructor(private appService: AppService) {

    }
    @Public()
    @Get('health')
    health() {
        return this.appService.checkHealth();
    }
}