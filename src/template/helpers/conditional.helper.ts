import * as Handlebars from 'handlebars';

export function registerConditionalHelpers(): void {
  /**
   * Block helper — renders content only when arg1 === arg2.
   *
   * Usage:
   *   {{#ifEquals ticket_type "VIP"}}
   *     <p>VIP lounge access included</p>
   *   {{else}}
   *     <p>Standard entry</p>
   *   {{/ifEquals}}
   */
  Handlebars.registerHelper('ifEquals', function (
    this: unknown,
    arg1: unknown,
    arg2: unknown,
    options: Handlebars.HelperOptions,
  ): string {
    return arg1 === arg2 ? options.fn(this) : options.inverse(this);
  });

  /**
   * Block helper — renders content when arg1 !== arg2.
   *
   * Usage:
   *   {{#ifNotEquals status "cancelled"}}...{{/ifNotEquals}}
   */
  Handlebars.registerHelper('ifNotEquals', function (
    this: unknown,
    arg1: unknown,
    arg2: unknown,
    options: Handlebars.HelperOptions,
  ): string {
    return arg1 !== arg2 ? options.fn(this) : options.inverse(this);
  });

  /**
   * Block helper — renders content when value > threshold.
   *
   * Usage:
   *   {{#ifGreaterThan ticket_count 0}}You have tickets!{{/ifGreaterThan}}
   */
  Handlebars.registerHelper('ifGreaterThan', function (
    this: unknown,
    value: number,
    threshold: number,
    options: Handlebars.HelperOptions,
  ): string {
    return value > threshold ? options.fn(this) : options.inverse(this);
  });

  /**
   * Block helper — renders content when value < threshold.
   *
   * Usage:
   *   {{#ifLessThan remaining_seats 5}}Only a few seats left!{{/ifLessThan}}
   */
  Handlebars.registerHelper('ifLessThan', function (
    this: unknown,
    value: number,
    threshold: number,
    options: Handlebars.HelperOptions,
  ): string {
    return value < threshold ? options.fn(this) : options.inverse(this);
  });

  /**
   * Block helper — renders content when an array/string contains the value.
   *
   * Usage:
   *   {{#ifContains tags "featured"}}<span>Featured</span>{{/ifContains}}
   */
  Handlebars.registerHelper('ifContains', function (
    this: unknown,
    collection: unknown[] | string | undefined,
    value: unknown,
    options: Handlebars.HelperOptions,
  ): string {
    if (!collection) return options.inverse(this);
    const contains = Array.isArray(collection)
      ? collection.includes(value)
      : typeof collection === 'string' && collection.includes(String(value));
    return contains ? options.fn(this) : options.inverse(this);
  });

  /**
   * Block helper — renders content when value is truthy (non-empty, non-zero, non-null).
   * Alias for {{#if}} but more explicit.
   *
   * Usage:
   *   {{#ifTruthy discount_code}}<p>Code: {{discount_code}}</p>{{/ifTruthy}}
   */
  Handlebars.registerHelper('ifTruthy', function (
    this: unknown,
    value: unknown,
    options: Handlebars.HelperOptions,
  ): string {
    return value ? options.fn(this) : options.inverse(this);
  });
}
