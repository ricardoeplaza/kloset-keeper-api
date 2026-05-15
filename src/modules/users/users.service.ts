import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RequestContext } from 'src/infra/context/request-context';
import { uuidv7 } from 'uuidv7';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './repositories/users.repository';

@Injectable()
export class UsersService {

  constructor(
    private readonly usersRepository: UsersRepository
  ) { }

  async isFirstRun(): Promise<boolean> {
    const count = await this.usersRepository.countAdmins();
    return count === 0;
  }

  async findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const [insertedUser] = await this.usersRepository.create({
      id: uuidv7(),
      ...createUserDto,
      password: hashedPassword,
    });

    const { password, ...userWithoutPassword } = insertedUser;
    return userWithoutPassword;
  }

  async findAll() {
    return this.usersRepository.findAll();
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateme(updateUserDto: UpdateUserDto) {
    const userId = RequestContext.getRequiredUserId();
    return this.update(userId, updateUserDto);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const [updatedUser] = await this.usersRepository.update(id, {
      ...updateUserDto,
      updatedAt: new Date(),
    });

    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async remove(id: string) {
    const [deletedUser] = await this.usersRepository.delete(id);

    if (!deletedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return { deleted: true, userId: id };
  }
}
