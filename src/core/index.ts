export * from './email-sender';
export * from './email-type-dispatcher';

import { EmailSender } from './email-sender';
import { WebmeeEmailOptions } from '../types/email.types';

/**
 * Create a ready-to-use email sender — no framework required.
 *
 * @example
 * import { createEmailSender } from 'webmee-email';
 *
 * const emailSender = createEmailSender({
 *   provider: 'sendgrid',
 *   sendgrid: {
 *     apiKey: process.env.SENDGRID_API_KEY!,
 *     from: { email: 'no-reply@webmee.com', name: 'Webmee' },
 *   },
 * });
 *
 * await emailSender.send({
 *   to: 'customer@example.com',
 *   subject: 'Welcome!',
 *   html: '<h1>Welcome to Webmee</h1>',
 * });
 */
export function createEmailSender(options: WebmeeEmailOptions): EmailSender {
  return new EmailSender(options);
}
