import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { RegisterDto, LoginDto } from './dto/create-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schema/users.schema';
import { ErrorHandler } from 'src/common/handlers/error-handlers';
import { SuccessResponseHandler } from 'src/common/handlers/success-handlers';
import { BcryptService } from 'src/common/services/bcrypt.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User')
    private readonly userModel: Model<User>,
    private readonly bcryptService: BcryptService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async signToken(user: { id: string; name: string; email: string }) {
    return this.jwtService.signAsync(
      { id: user.id, name: user.name, email: user.email },
      { secret: this.configService.getOrThrow<string>('jwtAccessSecret') },
    );
  }

  //create an account — plain email+password, no OTP/email verification
  async register(dto: RegisterDto): Promise<any> {
    return ErrorHandler.execute(async () => {
      const existing = await this.userModel.findOne({ email: dto.email });
      if (existing) {
        throw ErrorHandler.alreadyExists('An account with this email');
      }

      const hashedPassword = await this.bcryptService.hashPassword(dto.password);

      const user = await this.userModel.create({
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: 'user',
        isEmailVerified: true,
      });

      const token = await this.signToken({ id: user.id, name: user.name, email: user.email });

      return SuccessResponseHandler.created('Account', {
        token,
        user: { id: user.id, name: user.name, email: user.email },
      });
    }, 'Failed to register');
  }

  //email + password login
  async login(dto: LoginDto): Promise<any> {
    return ErrorHandler.execute(async () => {
      const user = await this.userModel.findOne({ email: dto.email });
      if (!user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const isValid = await this.bcryptService.comparePassword(dto.password, user.password);
      if (!isValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const token = await this.signToken({ id: user.id, name: user.name, email: user.email });

      return SuccessResponseHandler.success('Logged in successfully', {
        token,
        user: { id: user.id, name: user.name, email: user.email },
      });
    }, 'Failed to login');
  }

  //get all users by admin
  async findAll(): Promise<any> {
    return ErrorHandler.execute(async () => {
      const users = await this.userModel.find().select('-password');

      return SuccessResponseHandler.retrived('user', users);
    }, 'Failed to get users');
  }

  //find only one users data
  async findOne(id: string): Promise<any> {
    return ErrorHandler.execute(
      async () => {
        const user = await this.userModel.findById(id).select('-password');

        if (!user) throw ErrorHandler.notFound(`User not found with the ${id}`);
        return SuccessResponseHandler.retrived('User', user);
      },

      'Failed to get user',
    );
  }

  //update your data
  async update(id: string, data: UpdateUserDto): Promise<any> {
    return ErrorHandler.execute(async () => {
      const userExists = await this.userModel.findById(id);
      if (!userExists)
        throw ErrorHandler.notFound("The user wasn't found on the platform");

      //check updatd email is already exists or nots
      if (data.email && data.email !== userExists.email) {
        const emailExists = await this.userModel.findOne({
          email: data.email,
        });
        if (emailExists) {
          throw ErrorHandler.alreadyExists('Email already exists!');
        }
      }

      if (data.password?.trim()) {
        data.password = await this.bcryptService.hashPassword(data.password);
      }

      const updatedUser = await this.userModel
        .findByIdAndUpdate(userExists._id, data, { new: true })
        .select('-password');

      if (!updatedUser) {
        throw ErrorHandler.serviceUnavailable(
          'Unable to update the user info!',
        );
      }

      return SuccessResponseHandler.updated('user', updatedUser);
    }, 'Faild to update user');
  }

  //remove the users from db
  async remove(id: string): Promise<any> {
    return ErrorHandler.execute(async () => {
      const userExists = await this.userModel.findById(id);
      if (!userExists) {
        throw ErrorHandler.notFound('User not found on the platform');
      }

      const deleteUser = await this.userModel.findByIdAndDelete(userExists._id);
      if (!deleteUser) {
        throw ErrorHandler.serviceUnavailable('Unable to delete the user !');
      }
      return SuccessResponseHandler.deleted('User', deleteUser);
    }, 'Failed to delete user');
  }
}
