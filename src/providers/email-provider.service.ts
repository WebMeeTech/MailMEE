import { IEmailProvider, SendEmailOptions, SendEmailResult, WebmeeEmailOptions } from '../types/email.types';
import { SendGridProvider } from './sendgrid.provider';
import { SmtpProvider } from './smtp.provider';

/**
 * Selects and delegates to the appropriate email provider.
 *
 * Selection logic:
 *  - provider: 'auto'     → SendGrid if apiKey provided, else SMTP
 *  - provider: 'sendgrid' → SendGrid primary, SMTP fallback (if configured)
 *  - provider: 'smtp'     → SMTP only
 *
 * Fallback behaviour:
 *  - If primary fails and fallback is available, retries with fallback
 *  - SendGrid dynamic templates are NOT retried via SMTP (incompatible)
 */
export class EmailProviderService {
  private readonly primary: IEmailProvider;
  private readonly fallback: IEmailProvider | null;

  constructor(options: WebmeeEmailOptions) {
    const { provider, sendgrid, smtp } = options;

    const sendGridReady = !!(sendgrid?.apiKey);
    const smtpReady = !!(smtp?.host && smtp?.user);

    const useSendGrid =
      provider === 'sendgrid' ||
      (provider === 'auto' && sendGridReady);

    if (useSendGrid) {
      if (!sendgrid) throw new Error('[webmee-email] sendgrid config is required when provider is "sendgrid" or "auto" with a SendGrid key.');
      this.primary = new SendGridProvider(sendgrid);
      this.fallback = smtpReady ? new SmtpProvider(smtp!) : null;
    } else {
      if (!smtp) throw new Error('[webmee-email] smtp config is required when provider is "smtp" (or "auto" without a SendGrid key).');
      this.primary = new SmtpProvider(smtp);
      this.fallback = null;
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const result = await this.primary.sendEmail(options);

      if (result.success) return result;

      // Skip fallback for SendGrid dynamic templates — SMTP cannot render them
      if (options.sendgridTemplateId || !this.fallback) return result;

      console.warn(
        `[webmee-email] Primary provider (${this.primary.getProviderName()}) failed — retrying with fallback (${this.fallback.getProviderName()})`,
      );
      return this.fallback.sendEmail(options);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error in EmailProviderService';
      return { success: false, error: message };
    }
  }

  getActiveProvider(): string {
    return this.primary.getProviderName();
  }

  getFallbackProvider(): string | null {
    return this.fallback?.getProviderName() ?? null;
  }
}
