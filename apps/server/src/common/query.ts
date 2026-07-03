import { BadRequestException } from '@nestjs/common';

export function parseOptionalPositiveInt(value: string | number | undefined | null, fieldName: string) {
  if (value === undefined || value === null || value === '')
    return null;

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0)
    throw new BadRequestException(`${fieldName}必须是正整数`);
  return numberValue;
}

export function parseOptionalBooleanFlag(value: string | number | boolean | undefined | null, fieldName: string) {
  if (value === undefined || value === null || value === '')
    return null;
  if (value === true || value === 'true' || value === 1 || value === '1')
    return true;
  if (value === false || value === 'false' || value === 0 || value === '0')
    return false;
  throw new BadRequestException(`${fieldName}必须是 0 或 1`);
}

export function parseOptionalIntegerIn(value: string | number | undefined | null, fieldName: string, allowedValues: readonly number[]) {
  if (value === undefined || value === null || value === '')
    return null;

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || !allowedValues.includes(numberValue))
    throw new BadRequestException(`${fieldName}取值无效`);
  return numberValue;
}

export function parseOptionalStringIn<T extends string>(value: string | undefined | null, fieldName: string, allowedValues: readonly T[]) {
  if (value === undefined || value === null || value === '')
    return null;

  if (allowedValues.includes(value as T))
    return value as T;
  throw new BadRequestException(`${fieldName}取值无效`);
}
