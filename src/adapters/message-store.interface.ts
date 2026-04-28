import { EmailStatus, EmailType } from '../types/enums';

/**
 * Adapter interface for persisting email message records.
 *
 * The host service provides the implementation (e.g. TypeORM + email_messages table).
 * Allows the host to track every email send attempt with full status history.
 *
 * @example
 * export class TypeOrmMessageStoreAdapter implements IMessageStore {
 *   constructor(@InjectRepository(EmailMessage) private repo: Repository<EmailMessage>) {}
 *
 *   async createMessage(data) {
 *     const msg = this.repo.create({ ...data, status: EmailStatus.PENDING });
 *     return this.repo.save(msg);
 *   }
 *
 *   async updateMessageStatus(id, status, messageId?, errorMessage?) {
 *     await this.repo.update(id, {
 *       status,
 *       ...(messageId && { messageId }),
 *       ...(errorMessage && { errorMessage }),
 *       ...(status === EmailStatus.SENT && { sentAt: new Date() }),
 *     });
 *   }
 * }
 */
export interface IMessageStore {
  /**
   * Insert a new email_message record. Returns the generated ID.
   * Initial status should be set to PENDING by the implementation.
   */
  createMessage(data: CreateMessageData): Promise<{ id: string }>;

  /**
   * Update the status of an existing message record.
   * Call with QUEUED when job is picked up, SENT on success, FAILED on error.
   */
  updateMessageStatus(
    id: string,
    status: EmailStatus,
    providerMessageId?: string,
    errorMessage?: string,
  ): Promise<void>;
}

export interface CreateMessageData {
  type: EmailType | string;
  recipient: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  metadata?: Record<string, any>;
}
