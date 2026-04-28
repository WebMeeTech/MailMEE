import * as Handlebars from 'handlebars';

export function registerCurrencyHelpers(): void {
  /**
   * Format a number as currency.
   *
   * Usage:
   *   {{formatCurrency 149.99 "GBP"}}  → "£149.99"
   *   {{formatCurrency 149.99 "USD"}}  → "$149.99"
   *   {{formatCurrency 149.99 "EUR"}}  → "€149.99"
   *   {{formatCurrency 0}}             → "$0.00"  (defaults to USD)
   */
  Handlebars.registerHelper(
    'formatCurrency',
    (amount: number | undefined, currency: unknown) => {
      if (amount === null || amount === undefined) return '';
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      if (isNaN(num)) return '';
      // Handlebars passes its options object as the last arg when no currency is given —
      // guard against that so we fall back to USD cleanly.
      const currencyCode = typeof currency === 'string' ? currency : 'USD';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode || 'USD',
      }).format(num);
    },
  );

  /**
   * Format a number with decimal places (without currency symbol).
   *
   * Usage:
   *   {{formatNumber 12345.678 2}}  → "12,345.68"
   *   {{formatNumber 12345}}        → "12,345"
   */
  Handlebars.registerHelper(
    'formatNumber',
    (value: number | undefined, decimals?: number) => {
      if (value === null || value === undefined) return '';
      const num = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(num)) return '';
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 0,
      }).format(num);
    },
  );
}
