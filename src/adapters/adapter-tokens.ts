/**
 * NestJS injection tokens for the adapter interfaces.
 * Use these when providing custom implementations in your service.
 *
 * @example
 * // In your service module:
 * {
 *   provide: ADAPTER_TOKENS.EMAIL_QUEUE,
 *   useClass: BullMqEmailQueueAdapter,
 * }
 */
export const ADAPTER_TOKENS = {
  EMAIL_QUEUE: 'WEBMEE_EMAIL_QUEUE',
  IDEMPOTENCY_STORE: 'WEBMEE_IDEMPOTENCY_STORE',
  MESSAGE_STORE: 'WEBMEE_MESSAGE_STORE',
  TEMPLATE_STORE: 'WEBMEE_TEMPLATE_STORE',
} as const;
