import { classes } from '@automapper/classes';
import { AutomapperModule } from '@automapper/nestjs';
import { HttpModule } from '@nestjs/axios';
import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as RedisStore from 'connect-redis';
import * as session from 'express-session';
import { RedisClient } from 'ioredis/built/connectors/SentinelConnector/types';
import * as passport from 'passport';
import * as path from 'path';
import { DataSource } from 'typeorm';

import { AuthModule } from '@/auth/auth.module';
import accessTokenConfig from '@/config/accessTokenConfig';
import emailConfig from '@/config/email.config';
import refreshTokenConfig from '@/config/refreshTokenConfig';
import { REDIS_AUTH, RedisModule } from '@/redis';
import { RoutineModule } from '@/routines/routine.module';

import jwtConfig from './config/jwtConfig';
import { validationSchema } from './config/validationSchema';
import { ExceptionModule } from './exception/exception-module';
import { HealthCheckController } from './health-check/health-check.controller';
import { LoggingModule } from './logging/logging.module';
import { TimerModule } from './timers/timer.module';
import { UserModule } from './users/user.module';

const envPath = path.join(process.cwd(), `env/.${process.env.NODE_ENV}.env`);

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AutomapperModule.forRoot({
      strategyInitializer: classes(),
    }),
    ConfigModule.forRoot({
      envFilePath: [envPath],
      load: [jwtConfig, refreshTokenConfig, accessTokenConfig, emailConfig],
      isGlobal: true,
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({}),
      dataSourceFactory: async (): Promise<DataSource> => {
        const { default: ormConfig } = await import('./db/ormconfig');
        await ormConfig.initialize();
        return ormConfig;
      },
    }),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 20,
    }),
    UserModule,
    AuthModule,
    RedisModule,
    HttpModule,
    LoggingModule,
    TerminusModule,
    ExceptionModule,
    TimerModule,
    RoutineModule,
  ],
  controllers: [HealthCheckController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  constructor(
    @Inject(REDIS_AUTH) private readonly redis: RedisClient,
    @Inject(refreshTokenConfig.KEY)
    private refreshTokenConf: ConfigType<typeof refreshTokenConfig>,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        session({
          store: new (RedisStore(session))({
            client: this.redis,
            logErrors: true,
          }),
          name: 'refreshToken',
          saveUninitialized: false,
          resave: false,
          secret: process.env.SESSION_SECRET,
          cookie: this.refreshTokenConf,
        }),
        passport.initialize(),
        passport.session(),
      )
      .forRoutes('*');
  }
}
