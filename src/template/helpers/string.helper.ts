import * as Handlebars from 'handlebars';

export function registerStringHelpers(): void {
  /**
   * Truncate a string to maxLength characters, appending "..." if trimmed.
   *
   * Usage:
   *   {{truncate description 100}}
   */
  Handlebars.registerHelper('truncate', (value: string | undefined, maxLength: number) => {
    if (!value) return '';
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength).trimEnd() + '...';
  });

  /**
   * Uppercase all characters.
   *
   * Usage: {{uppercase name}}  → "ISURU"
   */
  Handlebars.registerHelper('uppercase', (value: string | undefined) => {
    return typeof value === 'string' ? value.toUpperCase() : '';
  });

  /**
   * Lowercase all characters.
   *
   * Usage: {{lowercase email}}  → "user@example.com"
   */
  Handlebars.registerHelper('lowercase', (value: string | undefined) => {
    return typeof value === 'string' ? value.toLowerCase() : '';
  });

  /**
   * Capitalise the first letter of each word.
   *
   * Usage: {{capitalize name}}  → "Isuru Raveen"
   */
  Handlebars.registerHelper('capitalize', (value: string | undefined) => {
    if (typeof value !== 'string') return '';
    return value.replace(/\b\w/g, (c) => c.toUpperCase());
  });

  /**
   * Provide a default value when the primary value is falsy.
   *
   * Usage: {{default middle_name "N/A"}}
   */
  Handlebars.registerHelper('default', (value: unknown, fallback: unknown) => {
    return value != null && value !== '' ? value : fallback;
  });

  /**
   * Output unescaped HTML. Use only with trusted content.
   *
   * Usage: {{safeHtml rich_content}}
   */
  Handlebars.registerHelper('safeHtml', (value: string | undefined) => {
    if (!value) return '';
    return new Handlebars.SafeString(value);
  });

  /**
   * Repeat a string n times.
   *
   * Usage: {{repeat "★" 5}}  → "★★★★★"
   */
  Handlebars.registerHelper('repeat', (str: string, times: number) => {
    if (typeof str !== 'string' || typeof times !== 'number') return '';
    return str.repeat(Math.max(0, times));
  });

  /**
   * Join an array with a separator.
   *
   * Usage: {{join tags ", "}}  → "music, arts, food"
   */
  Handlebars.registerHelper('join', (arr: unknown[] | undefined, separator: string = ', ') => {
    if (!Array.isArray(arr)) return '';
    return arr.join(typeof separator === 'string' ? separator : ', ');
  });

  /**
   * URL-encode a string value — useful for building query strings inside templates.
   *
   * Usage: {{urlEncode event_name}}  → "Summer%20Fest"
   */
  Handlebars.registerHelper('urlEncode', (value: string | undefined) => {
    return typeof value === 'string' ? encodeURIComponent(value) : '';
  });
}
