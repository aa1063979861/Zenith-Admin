import { IsString, Matches } from 'class-validator';

export class ChangeClientIdentityDto {
  @IsString()
  regionCode: string;

  @Matches(/^\d{6}$/)
  unitCode: string;

  @IsString()
  unitName: string;

  @IsString()
  reason: string;
}
