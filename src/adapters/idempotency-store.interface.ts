/**
 * Adapter interface for idempotency checks.
 *
 * The host service provides the implementation (e.g. TypeORM + email_sent_log table).
 * This prevents the same email being sent twice for the same logical event.
 *
 * @example
 * export class TypeOrmIdempotencyAdapter implements IIdempotencyStore {
 *   constructor(@InjectRepository(EmailSentLog) private repo: Repository<EmailSentLog>) {}
 *
 *   generateIdempotencyKey(eventType, entityId, emailType) {
 *     return `${eventType}:${entityId}:${emailType}`;
 *   }
 *
 *   async checkIfSent(key) {
 *     return this.repo.existsBy({ idempotencyKey: key });
 *   }
 *
 *   async markAsSent(key, messageId) {
 *     await this.repo.save({ idempotencyKey: key, messageId });
 *   }
 * }
 */
export interface IIdempotencyStore {
  /**
   * Build a deterministic idempotency key from event context.
   * Key format is up to the implementation — the important thing is uniqueness.
   */
  generateIdempotencyKey(
    eventType: string,
    entityId: string,
    emailType: string,
  ): string;

  /** Returns true if an email with this key has already been sent successfully. */
  checkIfSent(idempotencyKey: string): Promise<boolean>;

  /** Called after a successful send to record the key so future duplicates are blocked. */
  markAsSent(idempotencyKey: string, messageId: string): Promise<void>;
}
