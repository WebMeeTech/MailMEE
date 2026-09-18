import { Inject, Injectable } from '@nestjs/common';
import { EmailProviderService } from '../providers/email-provider.service';
import { TemplateEngine } from '../template/template.engine';
import {
  SendEmailResult,
  SendOptions,
  SendSendGridTemplateOptions,
  SendTemplateOptions,
  WebmeeEmailOptions,
} from '../types/email.types';
import { WEBMEE_EMAIL_OPTIONS } from './webmee-email.options';

/**
 * Injectable NestJS service that exposes the full webmee-email API.
 *
 * Inject this wherever you need to send emails in your NestJS application.
 *
 * @example
 * @Injectable()
 * export class OrderService {
 *   constructor(private readonly email: WebmeeEmailService) {}
 *
 *   async confirmOrder(order: Order) {
 *     await this.email.sendTemplate({
 *       to: order.buyerEmail,
 *       subject: 'Order #{{order_id}} Confirmed',
 *       template: '<p>Total: {{formatCurrency total "GBP"}}</p>',
 *       context: { order_id: order.id, total: order.total },
 *     });
 *   }
 * }
 */
@Injectable()
export class WebmeeEmailService {
  private readonly providerService: EmailProviderService;
  readonly templateEngine: TemplateEngine;

  constructor(
    @Inject(WEBMEE_EMAIL_OPTIONS) private readonly options: WebmeeEmailOptions,
  ) {
    this.providerService = new EmailProviderService(options);
    this.templateEngine = new TemplateEngine({
      caching: options.templateCaching ?? true,
      customHelpers: options.customHelpers,
    });
  }

  /**
   * Send a raw email with subject + HTML body.
   *
   * @example
   * await this.email.send({
   *   to: 'user@example.com',
   *   subject: 'Hello',
   *   html: '<p>Hello world</p>',
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
   * Render a Handlebars template string then send.
   *
   * @example
   * await this.email.sendTemplate({
   *   to: 'user@example.com',
   *   subject: 'Ticket for {{event_name}}',
   *   template: '<p>Hi {{name}}, see you at {{event_name}} on {{formatDate date "long"}}!</p>',
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
      attachments: options.attachments,
    });
  }

  /**
   * Render a stored template entity (e.g. retrieved from email-service's DB)
   * and send it. Compatible with email-service's EmailTemplate entity shape.
   *
   * @example
   * const template = await this.templateService.findTemplate(EmailType.BUYER_ORDER_CONFIRMATION);
   * await this.email.sendRendered(template, context, 'customer@example.com');
   */
  async sendRendered(
    template: { subject: string; bodyHtml: string; bodyText?: string | null },
    context: Record<string, any>,
    to: string,
    extras?: Pick<SendOptions, 'from' | 'metadata' | 'categories' | 'attachments'>,
  ): Promise<SendEmailResult> {
    const rendered = this.templateEngine.render(template, context);

    return this.providerService.sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.bodyHtml,
      text: rendered.bodyText,
      from: extras?.from,
      metadata: extras?.metadata,
      categories: extras?.categories,
      attachments: extras?.attachments,
    });
  }

  /**
   * Send using a SendGrid dynamic template ID.
   * Requires a SendGrid API key to be configured.
   *
   * @example
   * await this.email.sendSendGridTemplate({
   *   to: 'user@example.com',
   *   templateId: 'd-0a261929077b4faba5bf48613449664a',
   *   data: { event_name: 'Summer Fest', button_url: 'https://webmee.com/events/123' },
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

  /** Returns the name of the active email provider (e.g. "SendGrid", "SMTP") */
  getActiveProvider(): string {
    return this.providerService.getActiveProvider();
  }
}
