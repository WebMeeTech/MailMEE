import * as nodemailer from 'nodemailer';
import { IEmailProvider, SendEmailOptions, SendEmailResult, SmtpConfig } from '../types/email.types';

export class SmtpProvider implements IEmailProvider {
  private transporter: nodemailer.Transporter;
  private readonly fromEmail: string;
  private readonly fromName: string | undefined;

  constructor(config: SmtpConfig) {
    this.fromEmail = config.from.email;
    this.fromName = config.from.name;

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port ?? 587,
      secure: config.secure ?? false, // false = STARTTLS on port 587
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  getProviderName(): string {
    return 'SMTP';
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    // SMTP cannot render SendGrid dynamic templates
    if (options.sendgridTemplateId) {
      return {
        success: false,
        error: 'SMTP provider does not support SendGrid dynamic templates. Configure a SendGrid API key.',
      };
    }

    const fromAddress = options.from?.email ?? this.fromEmail;
    const fromName = options.from?.name ?? this.fromName;
    const from = fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;

    const text = options.text ?? this.stripHtml(options.html);

    try {
      const info = await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send email via SMTP';
      return { success: false, error: msg };
    }
  }

  /** Verify the SMTP connection — useful for health checks */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}
