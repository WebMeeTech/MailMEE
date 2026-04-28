/**
 * webmee-email — Plug-and-play email sending for Webmee services
 *
 * Quick start (no framework):
 *
 *   import { createEmailSender } from 'webmee-email';
 *
 *   const email = createEmailSender({
 *     provider: 'sendgrid',
 *     sendgrid: { apiKey: process.env.SENDGRID_API_KEY!, from: { email: 'no-reply@webmee.com' } },
 *   });
 *
 *   await email.send({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi!</p>' });
 *
 * For NestJS: import { WebmeeEmailModule, WebmeeEmailService } from 'webmee-email/nestjs'
 */

// ── Standalone Factory ───────────────────────────────────────────────────────
export { createEmailSender, EmailSender } from './core';

// ── Providers ────────────────────────────────────────────────────────────────
export { SendGridProvider } from './providers/sendgrid.provider';
export { SmtpProvider } from './providers/smtp.provider';
export { EmailProviderService } from './providers/email-provider.service';

// ── Template Engine ──────────────────────────────────────────────────────────
export { TemplateEngine, TemplateEngineOptions } from './template/template.engine';

// ── Types & Interfaces ───────────────────────────────────────────────────────
export * from './types';

// ── Adapter Interfaces (for host service implementations) ───────────────────
export * from './adapters';
