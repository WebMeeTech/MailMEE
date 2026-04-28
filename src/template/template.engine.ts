import * as Handlebars from 'handlebars';
import type { TemplateDelegate } from 'handlebars';
import { TemplateRenderInput, TemplateRenderResult } from '../types/email.types';
import { registerDateHelpers } from './helpers/date.helper';
import { registerCurrencyHelpers } from './helpers/currency.helper';
import { registerConditionalHelpers } from './helpers/conditional.helper';
import { registerStringHelpers } from './helpers/string.helper';

export interface TemplateEngineOptions {
  /**
   * Enable compiled template caching.
   * Default: true — recommended for production.
   * Set to false in dev/test when templates change frequently.
   */
  caching?: boolean;
  /**
   * Maximum number of compiled templates to keep in cache.
   * Oldest entries are evicted when the limit is reached.
   * Default: 500
   */
  maxCacheSize?: number;
  /**
   * Custom Handlebars helpers to register globally.
   * These are merged with the built-in set.
   * Custom helpers override built-ins on name collision.
   */
  customHelpers?: Record<string, (...args: any[]) => any>;
}

/**
 * Handlebars-based email template engine.
 *
 * Features:
 *  - Compiles and caches Handlebars templates for performance
 *  - Built-in helpers: formatDate, relativeDate, formatCurrency, formatNumber,
 *    ifEquals, ifNotEquals, ifGreaterThan, ifLessThan, ifContains, ifTruthy,
 *    truncate, uppercase, lowercase, capitalize, default, safeHtml, repeat, join, urlEncode
 *  - Auto-generates plain-text version from HTML when bodyText is omitted
 *  - LRU-style cache eviction to prevent unbounded memory growth
 *
 * @example
 * const engine = new TemplateEngine();
 *
 * const result = engine.renderString({
 *   subject: 'Ticket for {{event_name}}',
 *   bodyHtml: '<p>Hi {{name}}, event date: {{formatDate date "short"}}</p>',
 *   context: { name: 'Isuru', event_name: 'Tech Summit', date: '2025-09-20' },
 * });
 */
export class TemplateEngine {
  private readonly cache: Map<string, TemplateDelegate>;
  private readonly cachingEnabled: boolean;
  private readonly maxCacheSize: number;

  constructor(options: TemplateEngineOptions = {}) {
    this.cachingEnabled = options.caching ?? true;
    this.maxCacheSize = options.maxCacheSize ?? 500;
    this.cache = new Map();

    // Register all built-in helpers
    registerDateHelpers();
    registerCurrencyHelpers();
    registerConditionalHelpers();
    registerStringHelpers();

    // Register custom helpers (may override built-ins)
    if (options.customHelpers) {
      for (const [name, fn] of Object.entries(options.customHelpers)) {
        Handlebars.registerHelper(name, fn);
      }
    }
  }

  /**
   * Render a template from string inputs.
   * This is the primary API for standalone usage.
   */
  renderString(input: TemplateRenderInput): TemplateRenderResult {
    const subjectFn = this.compile(input.subject);
    const htmlFn = this.compile(input.bodyHtml);

    const subject = subjectFn(input.context);
    const bodyHtml = htmlFn(input.context);

    let bodyText: string;
    if (input.bodyText) {
      const textFn = this.compile(input.bodyText);
      bodyText = textFn(input.context);
    } else {
      bodyText = this.stripHtml(bodyHtml);
    }

    return { subject, bodyHtml, bodyText };
  }

  /**
   * Render from an entity-like object (compatible with email-service's EmailTemplate entity).
   * Accepts any object with subject, bodyHtml, bodyText fields.
   */
  render(
    template: { subject: string; bodyHtml: string; bodyText?: string | null },
    context: Record<string, any>,
  ): TemplateRenderResult {
    return this.renderString({
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText ?? undefined,
      context,
    });
  }

  /**
   * Pre-compile a template string and store in cache.
   * Useful for warming the cache at startup.
   */
  precompile(templateStr: string): void {
    this.compile(templateStr);
  }

  /**
   * Clear the compiled template cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Returns the current number of cached compiled templates.
   */
  get cacheSize(): number {
    return this.cache.size;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private compile(templateStr: string): TemplateDelegate {
    if (!this.cachingEnabled) {
      return Handlebars.compile(templateStr);
    }

    if (this.cache.has(templateStr)) {
      return this.cache.get(templateStr)!;
    }

    // Evict oldest entry when cache is full (simple LRU approximation)
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    const compiled = Handlebars.compile(templateStr);
    this.cache.set(templateStr, compiled);
    return compiled;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      // Add a space before block-level closing/opening tags so words don't merge
      .replace(/<\/(h[1-6]|p|div|li|td|th|tr|section|article|header|footer|blockquote)>/gi, ' ')
      .replace(/<(br|hr)\s*\/?>/gi, ' ')
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
