import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleAuthService {
  private client: OAuth2Client;

  constructor(private configService: ConfigService) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');

    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is required');
    }

    this.client = new OAuth2Client(clientId);
  }

  async validateIdToken(idToken: string) {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();

      if (!payload?.email || payload.email_verified !== true) {
        throw new UnauthorizedException({
          error: 'INVALID_GOOGLE_TOKEN',
          message: '유효하지 않은 Google 토큰입니다',
        });
      }

      return {
        email: payload.email,
        name: payload.name ?? '',
      };
    } catch {
      throw new UnauthorizedException({
        error: 'INVALID_GOOGLE_TOKEN',
        message: '유효하지 않은 Google 토큰입니다',
      });
    }
  }
}
