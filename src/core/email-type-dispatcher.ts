import type { IEmailSender } from '../types/email.types';
import type { AppEmailTypeMap } from '../types/email.types';

/**
 * createEmailTypeDispatcher
 *
 * Factory that binds an email sender + an app-level EmailTypeMap together and
 * returns a single typed `dispatch(type, to, context)` function.
 *
 * The dispatcher automatically:
 *  - Uses the SendGrid dynamic template when the entry's `envVar` is set and
 *    the corresponding environment variable is non-empty.
 *  - Falls back to the inline Handlebars subject + HTML otherwise.
 *
 * @example
 * // In your app's email-map.ts:
 * import { createEmailTypeDispatcher } from 'mailmee';
 * import { emailSender } from './email.js';
 *
 * const MY_MAP: AppEmailTypeMap<MyEmailTypeValue> = { ... };
 *
 * export const sendEmailByType = createEmailTypeDispatcher(emailSender, MY_MAP);
 *
 * // Then anywhere in your app:
 * await sendEmailByType('MY_EMAIL_TYPE', 'user@example.com', { name: 'Alice' });
 */
export function createEmailTypeDispatcher<T extends string>(
  sender: IEmailSender,
  map: AppEmailTypeMap<T>,
): (type: T, to: string, context: Record<string, unknown>) => Promise<void> {
  return async function dispatch(
    type: T,
    to: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    const entry = map[type];
    if (!entry) {
      console.warn(`[mailmee] No email map entry found for type: ${type}`);
      return;
    }

    const templateId = entry.envVar ? process.env[entry.envVar] : undefined;

    if (templateId) {
      await sender.sendSendGridTemplate({
        to,
        templateId,
        data: context,
        categories: entry.categories,
      });
    } else {
      await sender.sendTemplate({
        to,
        subject: entry.fallbackSubject,
        template: entry.fallbackHtml,
        context,
        categories: entry.categories,
      });
    }
  };
}
