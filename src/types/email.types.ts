// ─── Core Send Options ─────────────────────────────────────────────────────

export interface EmailFrom {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** HTML body */
  html: string;
  /** Plain-text body (auto-generated from html if omitted) */
  text?: string;
  /** Override the default from address */
  from?: EmailFrom;
  /** Arbitrary key-value data attached to the send (stored as provider custom_args) */
  metadata?: Record<string, any>;
  /** SendGrid: up to 10 category labels for filtering in the SendGrid dashboard */
  categories?: string[];
  /**
   * SendGrid Dynamic Template ID (e.g. "d-0a261929077b4faba5bf48613449664a").
   * When set, subject/html/text are ignored — SendGrid renders from the template.
   */
  sendgridTemplateId?: string;
  /** Data passed into the SendGrid dynamic template */
  sendgridDynamicTemplateData?: Record<string, any>;
}

export interface SendEmailResult {
  success: boolean;
  /** Provider message ID (e.g. SendGrid x-message-id header) */
  messageId?: string;
  /** Error description on failure */
  error?: string;
}

// ─── Template Rendering ─────────────────────────────────────────────────────

export interface TemplateRenderInput {
  /** Handlebars subject string, e.g. "Your ticket for {{event_name}}" */
  subject: string;
  /** Handlebars HTML body string */
  bodyHtml: string;
  /** Optional plain-text Handlebars string; auto-generated from bodyHtml if omitted */
  bodyText?: string;
  /** Variables injected into the Handlebars templates */
  context: Record<string, any>;
}

export interface TemplateRenderResult {
  subject: string;
  bodyHtml: string;
  /** Always populated — either rendered bodyText or auto-stripped from bodyHtml */
  bodyText: string;
}

// ─── Provider Interface ──────────────────────────────────────────────────────

export interface IEmailProvider {
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
  getProviderName(): string;
}

// ─── Package Configuration ───────────────────────────────────────────────────

export interface SendGridConfig {
  apiKey: string;
  /** Override API host — for SendGrid EU use 'https://api.eu.sendgrid.com' */
  apiHost?: string;
  from: EmailFrom;
}

export interface SmtpConfig {
  host: string;
  /** Default: 587 */
  port?: number;
  user: string;
  pass: string;
  /** Use TLS. Default: false (STARTTLS on port 587) */
  secure?: boolean;
  from: EmailFrom;
}

export interface WebmeeEmailOptions {
  /**
   * Which provider to use as primary.
   * - 'sendgrid' → SendGrid primary, SMTP as fallback (if smtp config provided)
   * - 'smtp'     → SMTP only
   * - 'auto'     → SendGrid if sendgrid.apiKey is truthy, else SMTP
   */
  provider: 'sendgrid' | 'smtp' | 'auto';
  sendgrid?: SendGridConfig;
  smtp?: SmtpConfig;
  /**
   * Additional Handlebars helpers to register globally.
   * Merged with the built-in set; custom helpers override built-ins on name collision.
   */
  customHelpers?: Record<string, (...args: any[]) => any>;
  /**
   * Enable compiled template caching. Default: true.
   * Set to false only in test/dev environments where templates change frequently.
   */
  templateCaching?: boolean;
}

// ─── Sender API ──────────────────────────────────────────────────────────────

export interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: EmailFrom;
  metadata?: Record<string, any>;
  categories?: string[];
}

export interface SendTemplateOptions {
  to: string;
  /** Handlebars subject template string */
  subject: string;
  /** Handlebars HTML template string */
  template: string;
  /** Plain-text Handlebars template string (auto-generated if omitted) */
  templateText?: string;
  /** Variables to inject */
  context: Record<string, any>;
  from?: EmailFrom;
  metadata?: Record<string, any>;
  categories?: string[];
}

export interface SendSendGridTemplateOptions {
  to: string;
  /** SendGrid dynamic template ID, e.g. "d-xxxx" */
  templateId: string;
  /** Data for the dynamic template placeholders */
  data: Record<string, any>;
  from?: EmailFrom;
  categories?: string[];
}

export interface IEmailSender {
  send(options: SendOptions): Promise<SendEmailResult>;
  sendTemplate(options: SendTemplateOptions): Promise<SendEmailResult>;
  sendSendGridTemplate(options: SendSendGridTemplateOptions): Promise<SendEmailResult>;
  getActiveProvider(): string;
}
