import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { ChangeEmailCommand } from '@/users/application/command/impl/change-email.command';
import { CreateTimestampCommand } from '@/users/application/command/impl/create-timestamp.command';
import { UpdatePasswordCommand } from '@/users/application/command/impl/update-password.command';
import { VerifyChangeEmailCommand } from '@/users/application/command/impl/verify-change-email.command';
import { PasswordResetDto } from '@/users/interface/dto/password-reset.dto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import accessTokenConfig from '@/config/accessTokenConfig';
import { AddResetTokenCommand } from '@/users/application/command/impl/add-reset-token.command';
import { AuthService } from '@/auth/auth.service';
import { CheckEmailCommand } from '@/auth/command/impl/check-email.command';
import { CommandBus, EventBus } from '@nestjs/cqrs';
import { ConfigType } from '@nestjs/config';
import { IEmailService } from '@/users/application/adapter/iemail.service';
import { IRes, IUser } from '@/type-defs/message.interface';
import { PasswordResetGuard } from '@/users/common/guard/password-reset.guard';
import { Request, Response } from 'express';
import { VerifyEmailCommand } from '@/users/application/command/impl/verify-email.command';
import { VerifyResetPasswordTokenCommand } from '@/users/application/command/impl/verify-reset-password-token.command';
import { ulid } from 'ulid';

@Controller('users')
export class UserController {
  constructor(
    private commandBus: CommandBus,
    private eventBus: EventBus,
    private authService: AuthService,
    @Inject('EmailService') private emailService: IEmailService,
    @Inject(accessTokenConfig.KEY)
    private accessConf: ConfigType<typeof accessTokenConfig>,
  ) {}

  @Get('verify-email')
  async verifyEmail(@Query() query): Promise<string> {
    const { signupVerifyToken } = query;
    const command = new VerifyEmailCommand(signupVerifyToken);

    return await this.commandBus.execute(command);
  }

  @Post('reset-password')
  async resetPass(@Body() data): Promise<IRes<any>> {
    const { email } = data;
    const command = new CheckEmailCommand(email);

    const response = await this.commandBus.execute(command);

    // Email exists, sending email
    if (response.success === false) {
      const res = {} as IRes<any>;

      try {
        const resetPasswordVerifyToken = ulid();
        await this.emailService.sendPasswordResetVerification(
          email,
          resetPasswordVerifyToken,
        );

        const command = new AddResetTokenCommand(
          email,
          resetPasswordVerifyToken,
        );

        const response = await this.commandBus.execute(command);

        res.success = true;
        res.message = 'Reset password verification email sent successfully.';

        return res;
      } catch (err) {
        // res.success = false;
        // res.message = err;
        console.log(err);

        return null;
      }
    }

    return null;
  }

  @Get('verify-reset-password')
  async verifyResetPassword(
    @Query() query,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IRes<IUser>> {
    const { resetPasswordVerifyToken } = query;

    const command = new VerifyResetPasswordTokenCommand(
      resetPasswordVerifyToken,
    );
    const result: IRes<IUser> = await this.commandBus.execute(command);

    const user = result.data;

    if (user !== null) {
      const accessToken = await this.authService.issueToken(user as IUser);

      res.cookie('resetPasswordToken', accessToken, this.accessConf);
    }

    return result;
  }

  @UseGuards(PasswordResetGuard)
  @Post('post-password-reset')
  async resetPassword(
    @Req() req: Request,
    @Body() body: PasswordResetDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const newPassword = body.password;
    let resetPasswordToken;

    if ('resetPasswordToken' in req.cookies) {
      resetPasswordToken = req.cookies.resetPasswordToken;
    }

    let response = {} as IRes<void>;

    const user = await this.authService.verifyJwt(resetPasswordToken);

    const command = new UpdatePasswordCommand(user.data.email, newPassword);
    response = await this.commandBus.execute(command);

    if (response.success === true) {
      res.cookie('resetPasswordToken', null, { ...this.accessConf, maxAge: 1 });
      const command = new AddResetTokenCommand(user.data.email, null);

      try {
        await this.commandBus.execute(command);
      } catch (err) {
        console.log(err);
      }
    }

    return response;
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-email')
  async changeEmail(
    @Req() req: Request,
    @Body() body: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    let oldEmail;
    let uid;
    if ('email' in req.user && 'id' in req.user) {
      oldEmail = req.user.email;
      uid = req.user.id;
    }
    const newEmail = body.email;
    const changeEmailVerifyToken = ulid();
    const command = new ChangeEmailCommand(
      oldEmail,
      newEmail,
      changeEmailVerifyToken,
    );
    const response = await this.commandBus.execute(command);

    if (response.success === true) {
      try {
        await this.emailService.sendChangeEmailVerification(
          newEmail,
          changeEmailVerifyToken,
        );

        const command = new CreateTimestampCommand(
          uid,
          `changeEmailTokenCreated`,
        );
        const response = await this.commandBus.execute(command);
      } catch (err) {
        console.log(err);
      }
    }

    return {
      success: true,
      message: 'Change email verification email sent successfully.',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('verify-change-email')
  async verifyChangeEmail(
    @Req() req: Request,
    @Query() query: any,
    @Res({ passthrough: true }) res,
  ) {
    let changeEmailVerifyToken;
    if ('changeEmailVerifyToken' in query) {
      changeEmailVerifyToken = query.changeEmailVerifyToken;
    }
    let response = {} as IRes<IUser>;
    response.success = false;
    const command = new VerifyChangeEmailCommand(changeEmailVerifyToken);
    response = await this.commandBus.execute(command);

    if (response.success === true) {
      const newUser: IUser = response.data;
      const accessToken = await this.authService.issueToken(newUser);
      res.cookie('accessToken', accessToken, this.accessConf);

      return response;
    } else {
      throw new BadRequestException(
        'Something went wrong. Change email reverted',
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-name')
  async changeName(
    @Req() req: Request,
    @Body() body: any,
    @Res({ passthrough: true }) res,
  ) {
    const newName = body.userName;

    return null;
  }
}
