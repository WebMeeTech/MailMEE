import { DynamicModule, Module, Provider } from '@nestjs/common';
import { WebmeeEmailService } from './webmee-email.service';
import {
  WEBMEE_EMAIL_OPTIONS,
  WebmeeEmailAsyncOptions,
  WebmeeEmailOptions,
  WebmeeEmailOptionsFactory,
} from './webmee-email.options';

/**
 * NestJS module for webmee-email.
 *
 * Drop into your app.module.ts with `forRoot` (static config)
 * or `forRootAsync` (dynamic config from ConfigService, env, etc.)
 *
 * @example Static:
 * WebmeeEmailModule.forRoot({
 *   provider: 'sendgrid',
 *   sendgrid: { apiKey: '...', from: { email: 'no-reply@webmee.com' } },
 * })
 *
 * @example Async (recommended):
 * WebmeeEmailModule.forRootAsync({
 *   useFactory: (config: ConfigService) => ({
 *     provider: config.get('SENDGRID_API_KEY') ? 'sendgrid' : 'smtp',
 *     sendgrid: { apiKey: config.get('SENDGRID_API_KEY'), from: { email: config.get('EMAIL_FROM') } },
 *     smtp: { host: config.get('SMTP_HOST'), port: 587, user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS'), from: { email: config.get('EMAIL_FROM') } },
 *   }),
 *   inject: [ConfigService],
 * })
 */
@Module({})
export class WebmeeEmailModule {
  /**
   * Configure with static options.
   * Use `forRootAsync` when options come from environment variables or ConfigService.
   */
  static forRoot(options: WebmeeEmailOptions): DynamicModule {
    return {
      module: WebmeeEmailModule,
      global: true,
      providers: [
        {
          provide: WEBMEE_EMAIL_OPTIONS,
          useValue: options,
        },
        WebmeeEmailService,
      ],
      exports: [WebmeeEmailService],
    };
  }

  /**
   * Configure asynchronously — inject ConfigService, env vars, or any other provider.
   */
  static forRootAsync(asyncOptions: WebmeeEmailAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      ...this.createAsyncProviders(asyncOptions),
      WebmeeEmailService,
    ];

    return {
      module: WebmeeEmailModule,
      global: true,
      imports: asyncOptions.imports ?? [],
      providers,
      exports: [WebmeeEmailService],
    };
  }

  private static createAsyncProviders(asyncOptions: WebmeeEmailAsyncOptions): Provider[] {
    if (asyncOptions.useFactory) {
      return [
        {
          provide: WEBMEE_EMAIL_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: asyncOptions.inject ?? [],
        },
      ];
    }

    if (asyncOptions.useClass) {
      return [
        {
          provide: WEBMEE_EMAIL_OPTIONS,
          useFactory: async (factory: WebmeeEmailOptionsFactory) =>
            factory.createWebmeeEmailOptions(),
          inject: [asyncOptions.useClass],
        },
        {
          provide: asyncOptions.useClass,
          useClass: asyncOptions.useClass,
        },
      ];
    }

    if (asyncOptions.useExisting) {
      return [
        {
          provide: WEBMEE_EMAIL_OPTIONS,
          useFactory: async (factory: WebmeeEmailOptionsFactory) =>
            factory.createWebmeeEmailOptions(),
          inject: [asyncOptions.useExisting],
        },
      ];
    }

    throw new Error(
      '[webmee-email] WebmeeEmailModule.forRootAsync() requires one of: useFactory, useClass, or useExisting.',
    );
  }
}
