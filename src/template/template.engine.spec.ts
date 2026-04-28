import { TemplateEngine } from './template.engine';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine({ caching: false });
  });

  describe('renderString', () => {
    it('renders subject and html with context variables', () => {
      const result = engine.renderString({
        subject: 'Hello {{name}}',
        bodyHtml: '<p>Hi {{name}}, welcome to {{company}}!</p>',
        context: { name: 'Isuru', company: 'Webmee' },
      });

      expect(result.subject).toBe('Hello Isuru');
      expect(result.bodyHtml).toBe('<p>Hi Isuru, welcome to Webmee!</p>');
    });

    it('auto-generates bodyText from html when not provided', () => {
      const result = engine.renderString({
        subject: 'Test',
        bodyHtml: '<h1>Title</h1><p>Body text here.</p>',
        context: {},
      });

      expect(result.bodyText).toBe('Title Body text here.');
    });

    it('uses provided bodyText template when given', () => {
      const result = engine.renderString({
        subject: 'Test',
        bodyHtml: '<p>HTML {{name}}</p>',
        bodyText: 'Text only: {{name}}',
        context: { name: 'Isuru' },
      });

      expect(result.bodyText).toBe('Text only: Isuru');
    });
  });

  describe('formatDate helper', () => {
    it('formats date in short format', () => {
      const result = engine.renderString({
        subject: '{{formatDate date "short"}}',
        bodyHtml: '',
        context: { date: '2026-04-13T09:00:00.000Z' },
      });

      expect(result.subject).toMatch(/\d+\/\d+\/\d+/);
    });

    it('returns empty string for undefined date', () => {
      const result = engine.renderString({
        subject: '{{formatDate date}}',
        bodyHtml: '',
        context: { date: undefined },
      });

      expect(result.subject).toBe('');
    });
  });

  describe('formatCurrency helper', () => {
    it('formats GBP currency', () => {
      const result = engine.renderString({
        subject: '{{formatCurrency price "GBP"}}',
        bodyHtml: '',
        context: { price: 149.99 },
      });

      expect(result.subject).toContain('149.99');
      expect(result.subject).toContain('£');
    });

    it('defaults to USD when no currency given', () => {
      const result = engine.renderString({
        subject: '{{formatCurrency price}}',
        bodyHtml: '',
        context: { price: 50 },
      });

      expect(result.subject).toContain('$');
    });

    it('returns empty string for undefined amount', () => {
      const result = engine.renderString({
        subject: '{{formatCurrency amount "GBP"}}',
        bodyHtml: '',
        context: { amount: undefined },
      });

      expect(result.subject).toBe('');
    });
  });

  describe('ifEquals helper', () => {
    it('renders fn block when values match', () => {
      const result = engine.renderString({
        subject: 'test',
        bodyHtml: '{{#ifEquals type "VIP"}}VIP content{{else}}Standard{{/ifEquals}}',
        context: { type: 'VIP' },
      });

      expect(result.bodyHtml).toBe('VIP content');
    });

    it('renders inverse block when values do not match', () => {
      const result = engine.renderString({
        subject: 'test',
        bodyHtml: '{{#ifEquals type "VIP"}}VIP{{else}}Standard{{/ifEquals}}',
        context: { type: 'GENERAL' },
      });

      expect(result.bodyHtml).toBe('Standard');
    });
  });

  describe('string helpers', () => {
    it('uppercase converts to uppercase', () => {
      const result = engine.renderString({
        subject: '{{uppercase name}}',
        bodyHtml: '',
        context: { name: 'isuru' },
      });
      expect(result.subject).toBe('ISURU');
    });

    it('capitalize capitalises each word', () => {
      const result = engine.renderString({
        subject: '{{capitalize name}}',
        bodyHtml: '',
        context: { name: 'isuru raveen' },
      });
      expect(result.subject).toBe('Isuru Raveen');
    });

    it('truncate trims long text and adds ellipsis', () => {
      const result = engine.renderString({
        subject: '{{truncate text 10}}',
        bodyHtml: '',
        context: { text: 'Hello world this is a long string' },
      });
      expect(result.subject).toBe('Hello worl...');
      expect(result.subject.length).toBeLessThanOrEqual(13);
    });

    it('default returns fallback for falsy values', () => {
      const result = engine.renderString({
        subject: '{{default middle "N/A"}}',
        bodyHtml: '',
        context: { middle: undefined },
      });
      expect(result.subject).toBe('N/A');
    });

    it('join concatenates array with separator', () => {
      const result = engine.renderString({
        subject: '{{join tags ", "}}',
        bodyHtml: '',
        context: { tags: ['music', 'arts', 'food'] },
      });
      expect(result.subject).toBe('music, arts, food');
    });
  });

  describe('caching', () => {
    it('caches compiled templates', () => {
      const cachedEngine = new TemplateEngine({ caching: true });
      const template = 'Hello {{name}}';

      cachedEngine.renderString({ subject: template, bodyHtml: '', context: { name: 'A' } });
      cachedEngine.renderString({ subject: template, bodyHtml: '', context: { name: 'B' } });

      expect(cachedEngine.cacheSize).toBeGreaterThan(0);
    });

    it('clearCache empties the cache', () => {
      const cachedEngine = new TemplateEngine({ caching: true });
      cachedEngine.renderString({ subject: 'Hello {{name}}', bodyHtml: '', context: { name: 'A' } });
      expect(cachedEngine.cacheSize).toBeGreaterThan(0);

      cachedEngine.clearCache();
      expect(cachedEngine.cacheSize).toBe(0);
    });
  });
});
