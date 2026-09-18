import { IEmailProvider, SendEmailOptions, SendEmailResult } from '../types/email.types';
import { SendGridConfig } from '../types/email.types';

const DEFAULT_SENDGRID_HOST = 'https://api.sendgrid.com';

interface SendGridPersonalization {
  to: Array<{ email: string; name?: string }>;
  custom_args?: Record<string, string>;
  dynamic_template_data?: Record<string, any>;
}

interface SendGridAttachment {
  content: string; // base64
  filename: string;
  type: string;
  disposition: 'attachment';
}

interface SendGridV3Body {
  personalizations: SendGridPersonalization[];
  from: { email: string; name?: string };
  subject?: string;
  content?: Array<{ type: string; value: string }>;
  custom_args?: Record<string, string>;
  categories?: string[];
  template_id?: string;
  attachments?: SendGridAttachment[];
}

interface SendGridErrorResponse {
  errors?: Array<{ message?: string; field?: string }>;
}

export class SendGridProvider implements IEmailProvider {
  private readonly apiKey: string;
  private readonly apiHost: string;
  private readonly fromEmail: string;
  private readonly fromName: string | undefined;

  constructor(config: SendGridConfig) {
    this.apiKey = config.apiKey;
    this.apiHost = (config.apiHost ?? DEFAULT_SENDGRID_HOST).replace(/\/$/, '');
    this.fromEmail = config.from.email;
    this.fromName = config.from.name;
  }

  getProviderName(): string {
    return 'SendGrid';
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.apiKey) {
      return { success: false, error: 'SendGrid API key is not configured' };
    }

    const from = {
      email: options.from?.email ?? this.fromEmail,
      name: options.from?.name ?? this.fromName,
    };

    const personalization: SendGridPersonalization = {
      to: [{ email: options.to }],
    };

    let body: SendGridV3Body;

    if (options.sendgridTemplateId) {
      // Dynamic template: template_id + dynamic_template_data only (no subject/content)
      body = {
        personalizations: [
          {
            ...personalization,
            dynamic_template_data: this.sanitizeDynamicData(options.sendgridDynamicTemplateData ?? {}),
          },
        ],
        from,
        template_id: options.sendgridTemplateId,
      };
    } else {
      // Standard send: subject + HTML + plain text
      const text = options.text ?? this.stripHtml(options.html);
      body = {
        personalizations: [personalization],
        from,
        subject: options.subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: options.html },
        ],
      };
    }

    if (options.metadata && Object.keys(options.metadata).length > 0) {
      body.custom_args = this.toStringMap(options.metadata);
    }

    if (options.categories?.length) {
      body.categories = options.categories.slice(0, 10); // SendGrid max is 10
    }

    if (options.attachments?.length) {
      body.attachments = options.attachments.map((a) => ({
        content: a.content.toString('base64'),
        filename: a.filename,
        type: a.contentType ?? 'application/octet-stream',
        disposition: 'attachment',
      }));
    }

    const url = `${this.apiHost}/v3/mail/send`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const messageId = response.headers.get('x-message-id') ?? undefined;

      if (response.status === 202) {
        return { success: true, messageId };
      }

      // Parse error details from SendGrid response
      let errorMessage = `SendGrid API returned ${response.status}`;
      const rawBody = await response.text();
      if (rawBody) {
        try {
          const parsed: SendGridErrorResponse = JSON.parse(rawBody);
          if (parsed.errors?.length) {
            const msgs = parsed.errors.map((e) => e.message ?? '').filter(Boolean);
            if (msgs.length) errorMessage = msgs.join('; ');
          }
        } catch {
          if (rawBody.length < 300) errorMessage = rawBody;
        }
      }

      return { success: false, error: errorMessage };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send email via SendGrid';
      return { success: false, error: msg };
    }
  }

  /**
   * SendGrid dynamic_template_data must be JSON-serialisable.
   * Converts Date objects to ISO strings and recurses into nested objects/arrays.
   */
  private sanitizeDynamicData(data: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (v === null) { out[k] = null; continue; }
      if (v instanceof Date) { out[k] = v.toISOString(); continue; }
      if (Array.isArray(v)) {
        out[k] = v.map((item) =>
          item instanceof Date
            ? item.toISOString()
            : typeof item === 'object' && item !== null
            ? this.sanitizeDynamicData(item)
            : item,
        );
        continue;
      }
      if (typeof v === 'object') { out[k] = this.sanitizeDynamicData(v); continue; }
      out[k] = v;
    }
    return out;
  }

  /** SendGrid custom_args values must be strings */
  private toStringMap(metadata: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(metadata)) {
      if (v === undefined || v === null) continue;
      out[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    return out;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}
