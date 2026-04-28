import { ModuleMetadata, Type } from '@nestjs/common';
import { WebmeeEmailOptions } from '../types/email.types';

export { WebmeeEmailOptions };

/** Factory interface for async module config */
export interface WebmeeEmailOptionsFactory {
  createWebmeeEmailOptions(): Promise<WebmeeEmailOptions> | WebmeeEmailOptions;
}

/** Async options for `WebmeeEmailModule.forRootAsync()` */
export interface WebmeeEmailAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (...args: any[]) => Promise<WebmeeEmailOptions> | WebmeeEmailOptions;
  inject?: any[];
  useClass?: Type<WebmeeEmailOptionsFactory>;
  useExisting?: Type<WebmeeEmailOptionsFactory>;
}

/** NestJS injection token for the module options */
export const WEBMEE_EMAIL_OPTIONS = 'WEBMEE_EMAIL_OPTIONS';
