import { CheckEmailHandler } from '@/auth/command/handler/check-email.handler';
import { AddResetTokenHandler } from '@/users/application/command/handler/add-reset-token.handler';
import { VerifyResetPasswordTokenHandler } from '@/users/application/command/handler/verify-reset-password-token.handler';
import { Logger, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { CqrsModule } from '@nestjs/cqrs';
import { EmailModule } from 'src/email/email.module';
import { EmailService } from './infra/adapter/email.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './infra/db/entity/user.entity';
import { UserRegisterEventHandler } from './application/event/user-register-event.handler';
import { UserFactory } from './domain/user.factory';
import { UserRepository } from './infra/db/repository/UserRepository';
import { UserController } from './interface/user.controller';
import { UserProfile } from '@/users/common/mapper/user.profile';
import { VerifyEmailHandler } from '@/users/application/command/handler/verify-email.handler';
import { PassportModule } from '@nestjs/passport';

const commandHandlers = [
  VerifyEmailHandler,
  CheckEmailHandler,
  VerifyResetPasswordTokenHandler,
  AddResetTokenHandler,
];
const queryHandlers = [];
const eventHandlers = [UserRegisterEventHandler];
const factories = [UserFactory];

const repositories = [
  { provide: 'UserRepository', useClass: UserRepository },
  { provide: 'EmailService', useClass: EmailService },
];

@Module({
  imports: [
    AuthModule,
    CqrsModule,
    EmailModule,
    TypeOrmModule.forFeature([UserEntity]),
    PassportModule.register({
      session: true,
    }),
  ],
  controllers: [UserController],
  providers: [
    Logger,
    UserProfile,
    ...commandHandlers,
    ...queryHandlers,
    ...eventHandlers,
    ...factories,
    ...repositories,
  ],
})
export class UserModule {}
