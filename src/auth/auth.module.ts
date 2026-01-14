import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { Role } from 'src/users/entities/role.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    ConfigModule,
    PassportModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const accessSecret = cfg.get<string>('JWT_SECRET');
        const refreshSecret = cfg.get<string>('JWT_REFRESH_SECRET');

        if (!accessSecret) throw new Error('JWT_SECRET is not defined');
        if (!refreshSecret)
          throw new Error('JWT_REFRESH_SECRET is not defined');

        const accessExpiresIn = cfg.get<string>('JWT_EXPIRES_IN') ?? '15m';
        const refreshExpiresIn =
          cfg.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

        return {
          secret: accessSecret,
          signOptions: {
            expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'],
          },

          refresh: {
            secret: refreshSecret,
            expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
