import { IsEmail, IsNotEmpty, Matches, Length } from 'class-validator';

export class LoginDto {
  @IsEmail() email: string;

  @Length(8, 16) password: string;
}