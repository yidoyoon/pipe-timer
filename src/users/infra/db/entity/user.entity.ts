import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@/users/domain/user';
import * as argon2 from 'argon2';

@Entity('User')
export class UserEntity extends User {
  @PrimaryColumn()
  userId: string;

  @Column({ length: 30 })
  userName: string;

  @Column({ length: 128, unique: true })
  email: string;

  @Column({ length: 128 })
  password: string;

  @Column({ length: 60 })
  signupVerifyToken: string;

  @Column({ type: 'text', default: null })
  refreshToken: string;

  @Column({ default: null })
  resetPasswordToken: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: false })
  isLoggedin: boolean;

  @Column({ default: false })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  private async hashPassword() {
    this.password = await argon2.hash(this.password);
  }
}
