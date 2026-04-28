import { EmailType } from '../types/enums';

/**
 * Adapter interface for resolving and rendering stored email templates.
 *
 * The host service provides the implementation (e.g. TypeORM querying email_templates table).
 * The package's TemplateEngine handles Handlebars compilation — the store just needs
 * to resolve the right template and call the engine.
 *
 * @example
 * export class TypeOrmTemplateStoreAdapter implements ITemplateStore {
 *   constructor(
 *     private templateService: TemplateService, // host service's TypeORM-backed service
 *   ) {}
 *
 *   async renderTemplate(type, context, boxOfficeId?, locale?) {
 *     return this.templateService.renderTemplate(type, context, boxOfficeId, locale);
 *   }
 *
 *   async renderTemplateById(id, context) {
 *     return this.templateService.renderTemplateById(id, context);
 *   }
 * }
 */
export interface ITemplateStore {
  /**
   * Find a template by type (and optional org/locale), render it with context data,
   * and return the rendered output.
   *
   * Resolution order: org-specific → global default → throw NotFoundException
   */
  renderTemplate(
    type: EmailType,
    context: Record<string, any>,
    boxOfficeId?: string,
    locale?: string,
  ): Promise<TemplateRenderOutput>;

  /**
   * Render a template by its database UUID (mirrors SendGrid template_id usage).
   * Returns the rendered content plus the template's EmailType for tracking.
   */
  renderTemplateById(
    id: string,
    context: Record<string, any>,
  ): Promise<TemplateRenderOutput & { type: EmailType }>;
}

export interface TemplateRenderOutput {
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
}
