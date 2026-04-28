/**
 * Adapter interface for queuing email jobs.
 *
 * The host service provides the implementation (e.g. BullMQ + Redis).
 * The package never imports queue infrastructure directly.
 *
 * @example
 * // BullMQ implementation in email-service:
 * export class BullMqEmailQueueAdapter implements IEmailQueue {
 *   constructor(@InjectQueue('email-queue') private queue: Queue) {}
 *   async addEmailJob(data) { return this.queue.add('send', data); }
 * }
 */
export interface IEmailQueue {
  addEmailJob(data: EmailJobPayload): Promise<unknown>;
}

export interface EmailJobPayload {
  /** EmailType enum value */
  type: string;
  recipient: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  metadata?: Record<string, any>;
  categories?: string[];
  idempotencyKey?: string;
  /** Pre-created email_messages.id for status tracking */
  messageId?: string;
  /** SendGrid dynamic template ID */
  sendgridTemplateId?: string;
  sendgridDynamicTemplateData?: Record<string, any>;
}
