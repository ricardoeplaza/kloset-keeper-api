import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';

import { RequestContext } from 'src/infra/context/request-context';
import { uuidv7 } from 'uuidv7';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as schema from './schemas/users.schema';
import { users } from './schemas/users.schema';

@Injectable()
export class UsersService {

  constructor(
    @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>
  ) { }

  async isFirstRun(): Promise<boolean> {
    const result = await this.db.select({ count: sql<number>`count(*)` }).from(users);
    return Number(result[0].count) === 0;
  }

  async findByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email));

    return user; // Will be undefined if not found
  }

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const [insertedUser] = await this.db
      .insert(users)
      .values({
        id: uuidv7(),
        ...createUserDto,
        password: hashedPassword,
      })
      .returning();

    // Standard JS way to omit a property
    const { password, ...userWithoutPassword } = insertedUser;
    return userWithoutPassword;
  }

  async findAll() {
    // Retrieve all users from the database
    return await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        // password is excluded by not being listed here
      })
      .from(users);
  }

  async findOne(id: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id));

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async updateme(updateUserDto: UpdateUserDto) {
    // Context helper to update the current authenticated user ID
    const userId = RequestContext.getRequiredUserId();
    return this.update(userId, updateUserDto);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const [updatedUser] = await this.db
      .update(users)
      .set({
        ...updateUserDto,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Final cleanup before returning to the controller
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async remove(id: string) {
    // Delete user by ID and return the deleted record
    const [deletedUser] = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning();

    if (!deletedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return { deleted: true, userId: id };
  }
}
