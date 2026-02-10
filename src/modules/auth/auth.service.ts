import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';


@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(user: any) {
    const payload = { sub: user.id, email: user.email };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  async signup(dto: SignupDto) {
  return { message: 'signup' };
}

}
