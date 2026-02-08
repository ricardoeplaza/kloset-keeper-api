import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
    constructor(
        private _jwtService: JwtService,
        private usersService: UsersService,
    ) { }

async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    if (user && await bcrypt.compare(pass, user.password)) {
        /**
         * Use object destructuring to extract the password 
         * and keep the rest of the user properties in 'result'.
         * This prevents sensitive data from being leaked in the response or token.
         */
        const { password, ...result } = user;
        
        return result;
    }
    
    return null;
}

    async generateToken(user: any) {
        const payload = {
            sub: user.id,
            isAdmin: user.isAdmin
        };

        return {
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            access_token: await this._jwtService.signAsync(payload)
        };
    }
}
