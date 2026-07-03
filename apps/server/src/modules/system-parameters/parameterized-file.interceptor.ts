import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Type, mixin } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SystemParametersService } from './system-parameters.service';

type FileInterceptorOptions = NonNullable<Parameters<typeof FileInterceptor>[1]>;

type ParameterizedFileInterceptorOptions = {
  resolveMaxMb: (parametersService: SystemParametersService) => Promise<number>;
  multerOptions: FileInterceptorOptions;
};

export function ParameterizedFileInterceptor(fieldName: string, options: ParameterizedFileInterceptorOptions): Type<NestInterceptor> {
  @Injectable()
  class ParameterizedFileUploadInterceptor implements NestInterceptor {
    constructor(
      private readonly parametersService: SystemParametersService,
    ) {}

    async intercept(context: ExecutionContext, next: CallHandler) {
      const maxMb = await options.resolveMaxMb(this.parametersService);
      const Interceptor = FileInterceptor(fieldName, {
        ...options.multerOptions,
        limits: {
          ...(options.multerOptions.limits || {}),
          fileSize: Math.floor(maxMb * 1024 * 1024),
        },
      });
      return new Interceptor().intercept(context, next);
    }
  }

  return mixin(ParameterizedFileUploadInterceptor);
}
