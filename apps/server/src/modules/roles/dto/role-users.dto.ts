import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class RoleUsersDto {
  @IsArray()
  @ArrayNotEmpty({ message: '请选择员工' })
  @IsInt({ each: true })
  userIds: number[];
}
