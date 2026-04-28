import * as Handlebars from 'handlebars';

export function registerDateHelpers(): void {
  /**
   * Format a date value.
   *
   * Usage:
   *   {{formatDate event_date}}           → "4/13/2026, 9:00:00 AM"
   *   {{formatDate event_date "short"}}   → "4/13/2026"
   *   {{formatDate event_date "long"}}    → "April 13, 2026"
   *   {{formatDate event_date "time"}}    → "9:00 AM"
   *   {{formatDate event_date "iso"}}     → "2026-04-13T09:00:00.000Z"
   *   {{formatDate event_date "month"}}   → "April 2026"
   */
  Handlebars.registerHelper('formatDate', (date: Date | string | undefined, format?: string) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    switch (format) {
      case 'short':
        return d.toLocaleDateString('en-US');
      case 'long':
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      case 'time':
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      case 'iso':
        return d.toISOString();
      case 'month':
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'day':
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      default:
        return d.toLocaleString('en-US');
    }
  });

  /**
   * Relative date description.
   *
   * Usage:
   *   {{relativeDate event_date}}  → "3 days ago" | "in 2 hours" | "just now"
   */
  Handlebars.registerHelper('relativeDate', (date: Date | string | undefined) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    const now = Date.now();
    const diff = d.getTime() - now;
    const abs = Math.abs(diff);
    const past = diff < 0;

    const minutes = Math.round(abs / 60000);
    const hours = Math.round(abs / 3600000);
    const days = Math.round(abs / 86400000);

    let label: string;
    if (minutes < 1) label = 'just now';
    else if (minutes < 60) label = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    else if (hours < 24) label = `${hours} hour${hours !== 1 ? 's' : ''}`;
    else label = `${days} day${days !== 1 ? 's' : ''}`;

    if (label === 'just now') return label;
    return past ? `${label} ago` : `in ${label}`;
  });
}
