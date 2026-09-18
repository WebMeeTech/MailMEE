import { EmailProviderService } from '../providers/email-provider.service';
import { TemplateEngine } from '../template/template.engine';
import {
  IEmailSender,
  SendEmailResult,
  SendOptions,
  SendSendGridTemplateOptions,
  SendTemplateOptions,
  WebmeeEmailOptions,
} from '../types/email.types';

/**
 * The main email sender — wraps the provider service and template engine
 * into a single, clean API.
 *
 * Created via `createEmailSender(options)` for standalone (non-NestJS) usage.
 * In NestJS, use `WebmeeEmailService` instead (injected by `WebmeeEmailModule`).
 */
export class EmailSender implements IEmailSender {
  private readonly providerService: EmailProviderService;
  private readonly templateEngine: TemplateEngine;

  constructor(options: WebmeeEmailOptions) {
    this.providerService = new EmailProviderService(options);
    this.templateEngine = new TemplateEngine({
      caching: options.templateCaching ?? true,
      customHelpers: options.customHelpers,
    });
  }

  /**
   * Send a raw email (no template rendering).
   *
   * @example
   * await sender.send({
   *   to: 'customer@example.com',
   *   subject: 'Your order is confirmed',
   *   html: '<h1>Order #123</h1>',
   * });
   */
  async send(options: SendOptions): Promise<SendEmailResult> {
    return this.providerService.sendEmail({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      from: options.from,
      metadata: options.metadata,
      categories: options.categories,
      attachments: options.attachments,
    });
  }

  /**
   * Render a Handlebars template then send.
   *
   * @example
   * await sender.sendTemplate({
   *   to: 'customer@example.com',
   *   subject: 'Ticket for {{event_name}}',
   *   template: '<p>Hi {{name}}, event date: {{formatDate date "short"}}</p>',
   *   context: { name: 'Isuru', event_name: 'Tech Summit', date: '2025-09-20' },
   * });
   */
  async sendTemplate(options: SendTemplateOptions): Promise<SendEmailResult> {
    const rendered = this.templateEngine.renderString({
      subject: options.subject,
      bodyHtml: options.template,
      bodyText: options.templateText,
      context: options.context,
    });

    return this.providerService.sendEmail({
      to: options.to,
      subject: rendered.subject,
      html: rendered.bodyHtml,
      text: rendered.bodyText,
      from: options.from,
      metadata: options.metadata,
      categories: options.categories,
    });
  }

  /**
   * Send via SendGrid dynamic template.
   * Requires a SendGrid API key to be configured.
   *
   * @example
   * await sender.sendSendGridTemplate({
   *   to: 'organiser@example.com',
   *   templateId: 'd-0a261929077b4faba5bf48613449664a',
   *   data: { event_name: 'Summer Fest', event_date: 'July 15' },
   * });
   */
  async sendSendGridTemplate(options: SendSendGridTemplateOptions): Promise<SendEmailResult> {
    return this.providerService.sendEmail({
      to: options.to,
      subject: '',
      html: '',
      from: options.from,
      categories: options.categories,
      sendgridTemplateId: options.templateId,
      sendgridDynamicTemplateData: options.data,
      attachments: options.attachments,
    });
  }

  /** Returns the name of the currently active email provider */
  getActiveProvider(): string {
    return this.providerService.getActiveProvider();
  }

  /** Access the underlying template engine for advanced usage */
  getTemplateEngine(): TemplateEngine {
    return this.templateEngine;
  }
}
