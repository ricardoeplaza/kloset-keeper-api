import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { InferSelectModel } from 'drizzle-orm';
import { users } from '../users/schemas/users.schema';

export type UserWithoutPassword = Omit<InferSelectModel<typeof users>, 'password'>;

export interface TokenPayload {
  sub: string;
  isAdmin: boolean;
}

export interface AuthResponse {
  name: string;
  email: string;
  isAdmin: boolean;
  access_token: string;
}

@Injectable()
export class AuthService {
    constructor(
        private _jwtService: JwtService,
        private usersService: UsersService,
    ) { }

  async validateUser(email: string, pass: string): Promise<UserWithoutPassword | null> {
    const user = await this.usersService.findByEmail(email);

    if (user && await bcrypt.compare(pass, user.password)) {
        /**
         * Use object destructuring to extract the password 
         * and keep the rest of the user properties in 'result'.
         * This prevents sensitive data from being leaked in the response or token.
         */
      const { password, ...result } = user;
      return result as UserWithoutPassword;
    }
    
    return null;
  }

  async generateToken(user: UserWithoutPassword): Promise<AuthResponse> {
    const payload: TokenPayload = {
      sub: user.id,
      isAdmin: !!user.isAdmin
    };

    return {
      name: user.name,
      email: user.email,
      isAdmin: !!user.isAdmin,
      access_token: await this._jwtService.signAsync(payload)
    };
  }
}
