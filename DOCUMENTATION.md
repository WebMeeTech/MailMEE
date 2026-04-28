# webmee-email — Full Documentation

> Deep-dive reference for architecture, configuration, all APIs, adapter patterns, and adding a new project integration. For a quick-start guide, see [README.md](./README.md).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How It Works — Request Flow](#2-how-it-works--request-flow)
3. [Configuration Reference](#3-configuration-reference)
4. [Environment Variables Reference](#4-environment-variables-reference)
5. [Standalone API (`createEmailSender`)](#5-standalone-api-createemailsender)
6. [NestJS API (`WebmeeEmailModule` + `WebmeeEmailService`)](#6-nestjs-api-webmeeemailmodule--webmeeemailservice)
7. [Provider System](#7-provider-system)
   - [SendGrid Provider](#sendgrid-provider)
   - [SMTP Provider](#smtp-provider)
   - [Provider Selection & Fallback Logic](#provider-selection--fallback-logic)
   - [Writing a Custom Provider](#writing-a-custom-provider)
8. [Template Engine](#8-template-engine)
   - [How Caching Works](#how-caching-works)
   - [Auto Plain-Text Generation](#auto-plain-text-generation)
   - [Built-in Helpers — Full Reference](#built-in-helpers--full-reference)
   - [Writing Custom Helpers](#writing-custom-helpers)
   - [Advanced: Using the Engine Directly](#advanced-using-the-engine-directly)
9. [Adapter Interfaces](#9-adapter-interfaces)
   - [IEmailQueue](#iemailqueue)
   - [IIdempotencyStore](#iidempotencystore)
   - [IMessageStore](#imessagestore)
   - [ITemplateStore](#itemplatestore)
   - [NestJS Injection Tokens](#nestjs-injection-tokens)
10. [Enums Reference](#10-enums-reference)
11. [TypeScript Types — Full Reference](#11-typescript-types--full-reference)
12. [Integrating into a New Node.js Project](#12-integrating-into-a-new-nodejs-project)
13. [Integrating into a New NestJS Project](#13-integrating-into-a-new-nestjs-project)
14. [Testing Locally (Mailtrap)](#14-testing-locally-mailtrap)
15. [Publishing to npm](#15-publishing-to-npm)
16. [FAQ & Troubleshooting](#16-faq--troubleshooting)

---

## 1. Architecture Overview

```
webmee-email/
├── src/
│   ├── index.ts                  ← Root exports (standalone + types + adapters)
│   ├── core/
│   │   └── email-sender.ts       ← EmailSender class (standalone factory)
│   ├── providers/
│   │   ├── sendgrid.provider.ts  ← SendGrid API v3 implementation
│   │   ├── smtp.provider.ts      ← Nodemailer SMTP implementation
│   │   └── email-provider.service.ts ← Provider selector + fallback logic
│   ├── template/
│   │   ├── template.engine.ts    ← Handlebars engine with LRU cache
│   │   └── helpers/
│   │       ├── date.helper.ts
│   │       ├── currency.helper.ts
│   │       ├── conditional.helper.ts
│   │       └── string.helper.ts
│   ├── nestjs/
│   │   ├── webmee-email.module.ts    ← forRoot / forRootAsync DynamicModule
│   │   ├── webmee-email.service.ts   ← Injectable NestJS service
│   │   └── webmee-email.options.ts   ← Async options types
│   ├── adapters/
│   │   ├── email-queue.interface.ts
│   │   ├── idempotency-store.interface.ts
│   │   ├── message-store.interface.ts
│   │   ├── template-store.interface.ts
│   │   └── adapter-tokens.ts
│   └── types/
│       ├── email.types.ts        ← All core interfaces
│       └── enums.ts              ← EmailType, EmailStatus, BroadcastStatus
```

**Key design decisions:**

- The package ships zero opinionated infrastructure (no database, no queue, no HTTP client beyond `fetch` for SendGrid).
- All infrastructure contracts are defined as adapter interfaces your application implements.
- NestJS and standalone usage share the same `EmailProviderService` and `TemplateEngine` — NestJS is purely additive.
- Template caching is done per `TemplateEngine` instance, so the NestJS singleton service shares one cache for the lifetime of the application.

---

## 2. How It Works — Request Flow

```
Your code calls:
  emailService.sendTemplate({ to, subject, template, context })
        │
        ▼
  TemplateEngine.renderString()
    ├── Compiles subject string as Handlebars template
    ├── Compiles bodyHtml string as Handlebars template
    ├── Runs both against context
    └── Auto-generates bodyText if not provided
        │
        ▼
  EmailProviderService.sendEmail()
    ├── Calls primary provider (SendGrid or SMTP)
    │     └── On failure + fallback available → retries with SMTP
    └── Returns SendEmailResult { success, messageId?, error? }
        │
        ▼
  Returns result to your code
```

For SendGrid dynamic templates (`sendSendGridTemplate`), the template rendering step is skipped — the template is rendered entirely by SendGrid's engine on their servers.

---

## 3. Configuration Reference

```typescript
interface WebmeeEmailOptions {
  /**
   * Which provider to use as primary.
   *
   * 'sendgrid' → SendGrid primary. Falls back to SMTP if smtp config is provided.
   * 'smtp'     → SMTP only, no fallback.
   * 'auto'     → SendGrid if sendgrid.apiKey is truthy, else SMTP.
   */
  provider: 'sendgrid' | 'smtp' | 'auto';

  sendgrid?: {
    apiKey: string;      // Required when provider is 'sendgrid' or 'auto' with a key
    apiHost?: string;    // Default: 'https://api.sendgrid.com'
                         // EU: 'https://api.eu.sendgrid.com'
    from: {
      email: string;     // Must be a verified sender in SendGrid
      name?: string;     // Display name in the From field
    };
  };

  smtp?: {
    host: string;        // e.g. 'smtp.gmail.com', 'smtp.mailtrap.io'
    port?: number;       // Default: 587
    user: string;        // SMTP auth username
    pass: string;        // SMTP auth password
    secure?: boolean;    // true = TLS (port 465), false = STARTTLS (port 587). Default: false
    from: {
      email: string;
      name?: string;
    };
  };

  customHelpers?: Record<string, (...args: any[]) => any>;
  // Additional Handlebars helpers. Merged with built-ins; custom overrides on collision.

  templateCaching?: boolean;
  // Default: true. Set to false in dev/test when templates change frequently.
}
```

---

## 4. Environment Variables Reference

Create a `.env` file based on `.env.example`:

```env
# ─── SendGrid ────────────────────────────────────────────────────────────────
# Required if using SendGrid as provider.
# Generate at: https://app.sendgrid.com/settings/api_keys
# Permissions needed: Mail Send (Full Access)
SENDGRID_API_KEY=SG.your_api_key_here

# Optional — only needed for EU data residency
# SENDGRID_API_HOST=https://api.eu.sendgrid.com

# ─── Sender Identity ─────────────────────────────────────────────────────────
# This address must be verified in SendGrid (Settings → Sender Authentication)
# or be within a verified domain.
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=YourApp

# ─── SMTP (optional — used as fallback or primary when no SendGrid key) ───────
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_SECURE=false
```

**How to load these in your app:**

```typescript
// Node.js (plain)
import 'dotenv/config';

// NestJS
import { ConfigModule } from '@nestjs/config';
ConfigModule.forRoot({ isGlobal: true });
```

---

## 5. Standalone API (`createEmailSender`)

Import path: `webmee-email`

```typescript
import { createEmailSender, EmailSender } from 'webmee-email';

const sender: EmailSender = createEmailSender(options);
```

### Methods

#### `sender.send(options: SendOptions): Promise<SendEmailResult>`

Send a raw email. No template rendering.

```typescript
const result = await sender.send({
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Hello world</p>',
  text: 'Hello world',          // optional
  from: { email: 'custom@app.com', name: 'Custom' }, // optional per-send override
  metadata: { userId: 'abc' },  // optional — stored as SendGrid custom_args
  categories: ['welcome'],      // optional — SendGrid dashboard labels (max 10)
});

// result: { success: true, messageId: 'sg-xxx' }
// or:     { success: false, error: 'reason' }
```

#### `sender.sendTemplate(options: SendTemplateOptions): Promise<SendEmailResult>`

Render a Handlebars template then send.

```typescript
const result = await sender.sendTemplate({
  to: 'user@example.com',
  subject: 'Your order #{{orderId}}',
  template: '<p>Hi {{name}}, total: {{formatCurrency total "USD"}}</p>',
  templateText: 'Hi {{name}}, total: {{total}}',  // optional plain text template
  context: { name: 'Isuru', orderId: '123', total: 99.99 },
  from: { email: 'orders@app.com' },              // optional
  metadata: { orderId: '123' },                   // optional
  categories: ['order-confirmation'],             // optional
});
```

#### `sender.sendSendGridTemplate(options: SendSendGridTemplateOptions): Promise<SendEmailResult>`

Send using a SendGrid dynamic template (designed in the SendGrid dashboard).

```typescript
const result = await sender.sendSendGridTemplate({
  to: 'user@example.com',
  templateId: 'd-0a261929077b4faba5bf48613449664a',
  data: {
    first_name: 'Isuru',
    event_name: 'Tech Summit',
    cta_url: 'https://yourapp.com/tickets',
  },
  from: { email: 'events@app.com' }, // optional
  categories: ['event-reminder'],    // optional
});
```

#### `sender.getActiveProvider(): string`

Returns the name of the currently configured primary provider: `"SendGrid"` or `"SMTP"`.

#### `sender.getTemplateEngine(): TemplateEngine`

Returns the underlying `TemplateEngine` instance for advanced usage (pre-warming cache, rendering standalone, etc.).

---

## 6. NestJS API (`WebmeeEmailModule` + `WebmeeEmailService`)

Import path: `webmee-email/nestjs`

### `WebmeeEmailModule.forRoot(options)`

Static config — use when options are known at compile time:

```typescript
WebmeeEmailModule.forRoot({
  provider: 'sendgrid',
  sendgrid: { apiKey: 'SG.xxx', from: { email: 'no-reply@app.com' } },
})
```

### `WebmeeEmailModule.forRootAsync(asyncOptions)`

Dynamic config — the recommended approach for any real application:

```typescript
WebmeeEmailModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({ ... }),
  inject: [ConfigService],
})
```

You can also use `useClass` or `useExisting` for factory classes:

```typescript
// Using a factory class
WebmeeEmailModule.forRootAsync({
  useClass: EmailConfigService,
})

// Where EmailConfigService implements WebmeeEmailOptionsFactory:
@Injectable()
export class EmailConfigService implements WebmeeEmailOptionsFactory {
  createWebmeeEmailOptions(): WebmeeEmailOptions {
    return { provider: 'sendgrid', sendgrid: { ... } };
  }
}
```

### `WebmeeEmailService` Methods

All methods return `Promise<SendEmailResult>`.

| Method | Description |
|---|---|
| `send(options)` | Send raw HTML email |
| `sendTemplate(options)` | Render Handlebars template then send |
| `sendRendered(template, context, to, extras?)` | Render a stored template entity and send |
| `sendSendGridTemplate(options)` | Send via SendGrid dynamic template |
| `getActiveProvider()` | Returns `"SendGrid"` or `"SMTP"` |
| `templateEngine` | Public property — access the `TemplateEngine` directly |

#### `sendRendered` — unique to NestJS service

This method is designed for use with a template fetched from your database:

```typescript
// Fetch template from DB (any shape with subject + bodyHtml)
const tpl = await this.db.emailTemplates.findOne({
  where: { type: EmailType.BUYER_ORDER_CONFIRMATION }
});

// Render and send in one call
await this.email.sendRendered(
  tpl,                              // { subject, bodyHtml, bodyText? }
  { orderId: '123', total: 49.99 }, // context
  'buyer@example.com',              // recipient
  {                                 // optional extras
    metadata: { orderId: '123' },
    categories: ['order-confirmation'],
  },
);
```

---

## 7. Provider System

### SendGrid Provider

- **Endpoint**: `POST https://api.sendgrid.com/v3/mail/send`
- **Auth**: `Authorization: Bearer {apiKey}` header
- **Success**: HTTP 202 — extracts `x-message-id` header as `messageId`
- **Error handling**: Parses `errors[]` array from SendGrid JSON response
- **Dynamic templates**: Uses `template_id` + `dynamic_template_data` in the request body; `subject` and `content` are omitted entirely
- **Metadata**: Stored as `custom_args` — all values are coerced to strings
- **Categories**: Passed as `categories` array (max 10)
- **Date sanitization**: `Date` objects in dynamic template data are auto-converted to ISO strings (SendGrid requires JSON-serializable values)

**EU region:**

```typescript
sendgrid: {
  apiKey: 'SG.xxx',
  apiHost: 'https://api.eu.sendgrid.com',  // EU data residency
  from: { email: 'no-reply@app.com' },
}
```

### SMTP Provider

- Uses [Nodemailer](https://nodemailer.com/)
- Supports STARTTLS (port 587, `secure: false`) and TLS (port 465, `secure: true`)
- Exposes a `verify()` method for health checks
- Cannot render SendGrid dynamic templates — returns an error immediately if `sendgridTemplateId` is passed

**Gmail example:**

```typescript
smtp: {
  host: 'smtp.gmail.com',
  port: 587,
  user: 'you@gmail.com',
  pass: 'your-app-password',  // Use an App Password, not your account password
  secure: false,
  from: { email: 'you@gmail.com', name: 'YourApp' },
}
```

### Provider Selection & Fallback Logic

```
provider = 'auto'
  ├── sendgrid.apiKey is set? → Primary: SendGrid
  │                               Fallback: SMTP (if smtp config provided)
  └── no apiKey?              → Primary: SMTP, no fallback

provider = 'sendgrid'
  ├── Primary: SendGrid
  └── Fallback: SMTP (if smtp config provided)

provider = 'smtp'
  └── Primary: SMTP, no fallback
```

Fallback is triggered when the primary returns `success: false`. A warning is logged:

```
[webmee-email] Primary provider (SendGrid) failed — retrying with fallback (SMTP)
```

**Exception**: If the email uses a SendGrid dynamic template ID, no fallback is attempted (SMTP cannot render it).

### Writing a Custom Provider

```typescript
import { IEmailProvider, SendEmailOptions, SendEmailResult } from 'webmee-email';

export class PostmarkProvider implements IEmailProvider {
  constructor(private readonly serverToken: string) {}

  getProviderName(): string {
    return 'Postmark';
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': this.serverToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          From: options.from?.email,
          To: options.to,
          Subject: options.subject,
          HtmlBody: options.html,
          TextBody: options.text,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, messageId: data.MessageID };
      }

      return { success: false, error: data.Message };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
```

> Currently, custom providers must be passed directly to `EmailProviderService` by construction — plugging them into the `WebmeeEmailModule` via config is on the roadmap.

---

## 8. Template Engine

### How Caching Works

The engine maintains a `Map<string, TemplateDelegate>` (the compiled Handlebars function) keyed by the raw template string. When a template is rendered:

1. Check if the string exists in cache — if yes, use the cached compiled function.
2. If cache is full (default: 500 entries), evict the oldest entry (FIFO approximation).
3. Compile the template string, store in cache, then execute.

This means repeated sends of the same template (e.g. order confirmation emails) pay the compilation cost only once per application lifetime.

**Disable caching** (useful in dev/test when templates are edited at runtime):

```typescript
createEmailSender({ ..., templateCaching: false })
```

**Pre-warm the cache** at startup:

```typescript
const engine = sender.getTemplateEngine();
engine.precompile('<p>Hi {{name}}, your order #{{orderId}} is confirmed.</p>');
```

**Inspect cache size:**

```typescript
console.log(engine.cacheSize); // number of compiled templates currently cached
```

**Clear the cache:**

```typescript
engine.clearCache();
```

### Auto Plain-Text Generation

When `text` (in `SendOptions`) or `templateText` (in `SendTemplateOptions`) is not provided, the engine generates a plain-text version from the rendered HTML by:

1. Stripping `<style>` and `<script>` blocks entirely
2. Adding a space before block-level closing tags (`</p>`, `</div>`, `</h1>`–`</h6>`, etc.) so words don't run together
3. Adding a space for `<br>` and `<hr>` elements
4. Stripping all remaining HTML tags
5. Decoding common HTML entities: `&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`
6. Collapsing multiple whitespace characters into a single space

### Built-in Helpers — Full Reference

#### Date Helpers

```typescript
// registerDateHelpers() — registered in: src/template/helpers/date.helper.ts

// formatDate(date, format?)
// format options: 'short' | 'long' | 'time' | 'iso' | 'month' | 'day'
// Default format: 'short'
{{formatDate event_date "short"}}   // → 9/20/2025
{{formatDate event_date "long"}}    // → September 20, 2025
{{formatDate event_date "time"}}    // → 6:00 PM
{{formatDate event_date "iso"}}     // → 2025-09-20T18:00:00.000Z
{{formatDate event_date "month"}}   // → September 2025
{{formatDate event_date "day"}}     // → Saturday

// relativeDate(date)
// Returns human-friendly relative string from now
{{relativeDate future_date}}        // → in 3 days
{{relativeDate past_date}}          // → 2 hours ago
{{relativeDate now}}                // → just now
```

#### Currency & Number Helpers

```typescript
// registerCurrencyHelpers() — src/template/helpers/currency.helper.ts

// formatCurrency(amount, currency?)
// Uses Intl.NumberFormat. Default currency: USD
{{formatCurrency 149.99 "GBP"}}     // → £149.99
{{formatCurrency 299 "EUR"}}        // → €299.00
{{formatCurrency 100}}              // → $100.00

// formatNumber(value, decimals?)
// Locale-aware number formatting with optional decimal places
{{formatNumber 12345.5 2}}          // → 12,345.50
{{formatNumber 1000000}}            // → 1,000,000
```

#### Conditional Helpers

```typescript
// registerConditionalHelpers() — src/template/helpers/conditional.helper.ts
// All are block helpers with {{else}} support

{{#ifEquals status "active"}}Active{{else}}Inactive{{/ifEquals}}
{{#ifNotEquals status "cancelled"}}Still on{{/ifNotEquals}}
{{#ifGreaterThan seats_remaining 0}}{{seats_remaining}} left!{{/ifGreaterThan}}
{{#ifLessThan seats_remaining 5}}Almost full!{{/ifLessThan}}
{{#ifContains tags "vip"}}VIP benefits apply{{/ifContains}}
{{#ifTruthy promoCode}}Promo: {{promoCode}}{{else}}No promo{{/ifTruthy}}
```

#### String Helpers

```typescript
// registerStringHelpers() — src/template/helpers/string.helper.ts

{{uppercase name}}                  // ISURU RAVEEN
{{lowercase email}}                 // user@example.com
{{capitalize name}}                 // Isuru Raveen
{{truncate description 80}}         // First 80 chars followed by ...
{{default promoCode "NONE"}}        // Returns fallback if null/undefined/""
{{{safeHtml richContent}}}          // Triple-stash: renders unescaped HTML
{{join tags ", "}}                  // music, arts, food
{{urlEncode eventName}}             // Summer%20Festival
{{repeat "★" 5}}                    // ★★★★★
```

> ⚠️ `safeHtml` uses Handlebars triple-stash `{{{...}}}` to bypass HTML escaping. Only use with trusted content.

### Writing Custom Helpers

```typescript
import Handlebars from 'handlebars';

// Value helper (returns a string/value)
const myHelpers = {
  ticketRef: (id: string) => `TKT-${id.toUpperCase()}`,

  ordinalSuffix: (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  },
};

// Block helper (controls rendering of a block)
const blockHelpers = {
  ifPremium: function(tier: string, options: Handlebars.HelperOptions) {
    return tier === 'premium' || tier === 'vip'
      ? options.fn(this)
      : options.inverse(this);
  },
};

createEmailSender({
  ...,
  customHelpers: { ...myHelpers, ...blockHelpers },
});
```

### Advanced: Using the Engine Directly

```typescript
import { TemplateEngine } from 'webmee-email';

const engine = new TemplateEngine({
  caching: true,
  maxCacheSize: 100,
  customHelpers: { myHelper: (v: string) => v.toUpperCase() },
});

// Render from strings
const result = engine.renderString({
  subject: 'Hello {{name}}',
  bodyHtml: '<p>Hi {{name}}</p>',
  context: { name: 'Isuru' },
});
// result: { subject: 'Hello Isuru', bodyHtml: '<p>Hi Isuru</p>', bodyText: 'Hi Isuru' }

// Render from a template entity object
const result2 = engine.render(
  { subject: 'Hi {{name}}', bodyHtml: '<p>{{message}}</p>', bodyText: null },
  { name: 'Isuru', message: 'Welcome!' },
);

// Pre-warm cache
engine.precompile('<p>Hi {{name}}</p>');
console.log(engine.cacheSize); // 1
engine.clearCache();
```

---

## 9. Adapter Interfaces

These interfaces define contracts between `webmee-email` and the host application's infrastructure. The package never implements them — you do, in your own service.

Import from: `webmee-email`

### IEmailQueue

```typescript
export interface IEmailQueue {
  addEmailJob(data: EmailJobPayload): Promise<unknown>;
}

export interface EmailJobPayload {
  type: string;           // EmailType value
  recipient: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  metadata?: Record<string, any>;
  categories?: string[];
  idempotencyKey?: string;
  messageId?: string;     // Pre-created email_messages record ID
  sendgridTemplateId?: string;
  sendgridDynamicTemplateData?: Record<string, any>;
}
```

**Example implementation (BullMQ):**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IEmailQueue, EmailJobPayload } from 'webmee-email';

@Injectable()
export class BullMqEmailQueueAdapter implements IEmailQueue {
  constructor(@InjectQueue('email') private readonly queue: Queue) {}

  async addEmailJob(data: EmailJobPayload): Promise<unknown> {
    return this.queue.add('send', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }
}
```

### IIdempotencyStore

Prevents the same email being sent twice for the same logical event (e.g. order confirmed email for order ID `xyz`).

```typescript
export interface IIdempotencyStore {
  generateIdempotencyKey(eventType: string, entityId: string, emailType: string): string;
  checkIfSent(idempotencyKey: string): Promise<boolean>;
  markAsSent(idempotencyKey: string, messageId: string): Promise<void>;
}
```

**Example implementation (TypeORM):**

```typescript
@Injectable()
export class TypeOrmIdempotencyAdapter implements IIdempotencyStore {
  constructor(
    @InjectRepository(EmailSentLog)
    private readonly repo: Repository<EmailSentLog>,
  ) {}

  generateIdempotencyKey(eventType: string, entityId: string, emailType: string): string {
    return `${eventType}:${entityId}:${emailType}`;
  }

  async checkIfSent(key: string): Promise<boolean> {
    return this.repo.existsBy({ idempotencyKey: key });
  }

  async markAsSent(key: string, messageId: string): Promise<void> {
    await this.repo.save({ idempotencyKey: key, messageId, sentAt: new Date() });
  }
}
```

**Usage pattern:**

```typescript
async sendOrderConfirmation(order: Order) {
  const key = this.idempotency.generateIdempotencyKey('order.confirmed', order.id, EmailType.BUYER_ORDER_CONFIRMATION);

  if (await this.idempotency.checkIfSent(key)) {
    return; // Already sent, skip
  }

  const result = await this.email.sendTemplate({ ... });

  if (result.success) {
    await this.idempotency.markAsSent(key, result.messageId!);
  }
}
```

### IMessageStore

Tracks every email send attempt with full status history in your database.

```typescript
export interface IMessageStore {
  createMessage(data: CreateMessageData): Promise<{ id: string }>;
  updateMessageStatus(
    id: string,
    status: EmailStatus,
    providerMessageId?: string,
    errorMessage?: string,
  ): Promise<void>;
}

export interface CreateMessageData {
  type: EmailType | string;
  recipient: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  metadata?: Record<string, any>;
}
```

**Status lifecycle:**

```
createMessage()   → PENDING
addEmailJob()     → QUEUED
sendEmail()       → SENT (success) | FAILED (error)
provider webhook  → DELIVERED | BOUNCED
```

**Example implementation:**

```typescript
@Injectable()
export class TypeOrmMessageStoreAdapter implements IMessageStore {
  constructor(
    @InjectRepository(EmailMessage)
    private readonly repo: Repository<EmailMessage>,
  ) {}

  async createMessage(data: CreateMessageData): Promise<{ id: string }> {
    const msg = this.repo.create({ ...data, status: EmailStatus.PENDING });
    const saved = await this.repo.save(msg);
    return { id: saved.id };
  }

  async updateMessageStatus(
    id: string,
    status: EmailStatus,
    providerMessageId?: string,
    errorMessage?: string,
  ): Promise<void> {
    await this.repo.update(id, {
      status,
      ...(providerMessageId && { providerMessageId }),
      ...(errorMessage && { errorMessage }),
      ...(status === EmailStatus.SENT && { sentAt: new Date() }),
    });
  }
}
```

### ITemplateStore

Resolves and renders stored email templates from your database.

```typescript
export interface ITemplateStore {
  renderTemplate(
    type: EmailType,
    context: Record<string, any>,
    boxOfficeId?: string,
    locale?: string,
  ): Promise<TemplateRenderOutput>;

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
```

**Resolution order** (recommended implementation):
1. Org-specific template (`boxOfficeId` match + `type` match)
2. Global default template (`type` match, no org)
3. Throw `NotFoundException` if neither found

### NestJS Injection Tokens

If you're wiring the adapters into a NestJS module, import the token constants to avoid magic strings:

```typescript
import { ADAPTER_TOKENS } from 'webmee-email';

// ADAPTER_TOKENS = {
//   EMAIL_QUEUE:        'WEBMEE_EMAIL_QUEUE',
//   IDEMPOTENCY_STORE:  'WEBMEE_IDEMPOTENCY_STORE',
//   MESSAGE_STORE:      'WEBMEE_MESSAGE_STORE',
//   TEMPLATE_STORE:     'WEBMEE_TEMPLATE_STORE',
// }

@Module({
  providers: [
    { provide: ADAPTER_TOKENS.EMAIL_QUEUE, useClass: BullMqEmailQueueAdapter },
    { provide: ADAPTER_TOKENS.IDEMPOTENCY_STORE, useClass: TypeOrmIdempotencyAdapter },
  ],
})
```

---

## 10. Enums Reference

```typescript
import { EmailType, EmailStatus, BroadcastStatus } from 'webmee-email';

// EmailType — identifies the purpose of an email
EmailType.SENDGRID_TEMPLATE              // Raw SendGrid dynamic template
EmailType.BROADCAST_EVENT_ANNOUNCEMENT   // Event announced to attendees
EmailType.BROADCAST_PRE_EVENT_REMINDER   // Reminder before event
EmailType.BROADCAST_POST_EVENT_FOLLOWUP  // Follow-up after event
EmailType.BUYER_ORDER_CONFIRMATION       // Buyer's order confirmation
EmailType.ORG_NEW_ORDER_NOTIFICATION     // Organiser notified of new order
EmailType.BUYER_EVENT_CONFIRMATION_TICKETS // Ticket delivery email
EmailType.BROADCAST_WAITLIST_NOTIFY      // Waitlist spot available

// EmailStatus — lifecycle of a single email send attempt
EmailStatus.PENDING    // Record created, not yet queued
EmailStatus.QUEUED     // Job added to queue
EmailStatus.SENT       // Provider accepted the email (HTTP 202)
EmailStatus.FAILED     // Provider rejected or network error
EmailStatus.BOUNCED    // Delivery failed (via provider webhook)
EmailStatus.DELIVERED  // Confirmed delivery (via provider webhook)

// BroadcastStatus — lifecycle of a broadcast campaign
BroadcastStatus.DRAFT      // Being composed
BroadcastStatus.SCHEDULED  // Set to send at a future time
BroadcastStatus.QUEUED     // Jobs queued for all recipients
BroadcastStatus.SENT       // All jobs processed
BroadcastStatus.FAILED     // Campaign-level failure
```

---

## 11. TypeScript Types — Full Reference

```typescript
import type {
  // ── Config ─────────────────────────────────────────────────────────────
  WebmeeEmailOptions,
  SendGridConfig,
  SmtpConfig,
  EmailFrom,

  // ── Sending ────────────────────────────────────────────────────────────
  SendOptions,
  SendTemplateOptions,
  SendSendGridTemplateOptions,
  SendEmailOptions,      // Internal — used by provider implementations
  SendEmailResult,

  // ── Provider ───────────────────────────────────────────────────────────
  IEmailProvider,
  IEmailSender,

  // ── Template Engine ────────────────────────────────────────────────────
  TemplateRenderInput,
  TemplateRenderResult,
  TemplateEngineOptions,

  // ── Adapters ───────────────────────────────────────────────────────────
  IEmailQueue,
  EmailJobPayload,
  IIdempotencyStore,
  IMessageStore,
  CreateMessageData,
  ITemplateStore,
  TemplateRenderOutput,

  // ── Enums ──────────────────────────────────────────────────────────────
  EmailType,
  EmailStatus,
  BroadcastStatus,
} from 'webmee-email';
```

---

## 12. Integrating into a New Node.js Project

This covers any plain Node.js or Express project — no NestJS required.

### Step 1: Install

```bash
npm install webmee-email dotenv
```

### Step 2: Create `.env`

```env
SENDGRID_API_KEY=SG.your_key_here
EMAIL_FROM_ADDRESS=noreply@yourapp.com
EMAIL_FROM_NAME=YourApp
```

### Step 3: Create an email service module

```typescript
// src/services/email.service.ts
import 'dotenv/config';
import { createEmailSender, EmailSender } from 'webmee-email';

let _sender: EmailSender | null = null;

export function getEmailSender(): EmailSender {
  if (!_sender) {
    _sender = createEmailSender({
      provider: 'auto',
      sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY!,
        from: {
          email: process.env.EMAIL_FROM_ADDRESS!,
          name: process.env.EMAIL_FROM_NAME,
        },
      },
    });
  }
  return _sender;
}
```

### Step 4: Use it anywhere

```typescript
// src/routes/orders.ts
import { getEmailSender } from '../services/email.service';

app.post('/orders', async (req, res) => {
  const order = await createOrder(req.body);

  const result = await getEmailSender().sendTemplate({
    to: order.buyerEmail,
    subject: 'Order #{{orderId}} Confirmed',
    template: `
      <h2>Thanks for your order!</h2>
      <p>Order: <strong>#{{orderId}}</strong></p>
      <p>Total: {{formatCurrency total "USD"}}</p>
    `,
    context: { orderId: order.id, total: order.total },
    categories: ['order-confirmation'],
  });

  if (!result.success) {
    console.error('Email failed:', result.error);
    // Don't fail the request — email failure is non-critical
  }

  res.json({ order });
});
```

### Express app setup checklist

- [ ] `npm install webmee-email dotenv`
- [ ] Create `.env` with `SENDGRID_API_KEY` and `EMAIL_FROM_ADDRESS`
- [ ] Call `import 'dotenv/config'` at the top of your entry file
- [ ] Create a singleton `createEmailSender(...)` call (or call at startup)
- [ ] Handle `result.success === false` in your callers

---

## 13. Integrating into a New NestJS Project

### Step 1: Install

```bash
npm install webmee-email @nestjs/config
```

### Step 2: Create `.env`

```env
SENDGRID_API_KEY=SG.your_key_here
EMAIL_FROM_ADDRESS=noreply@yourapp.com
EMAIL_FROM_NAME=YourApp
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_username
SMTP_PASS=your_password
```

### Step 3: Register in AppModule

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebmeeEmailModule } from 'webmee-email/nestjs';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    WebmeeEmailModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        provider: 'auto',
        sendgrid: {
          apiKey: config.get<string>('SENDGRID_API_KEY')!,
          from: {
            email: config.get<string>('EMAIL_FROM_ADDRESS')!,
            name: config.get<string>('EMAIL_FROM_NAME'),
          },
        },
        smtp: {
          host: config.get<string>('SMTP_HOST', 'smtp.mailtrap.io'),
          port: parseInt(config.get<string>('SMTP_PORT', '587')),
          user: config.get<string>('SMTP_USER')!,
          pass: config.get<string>('SMTP_PASS')!,
          from: {
            email: config.get<string>('EMAIL_FROM_ADDRESS')!,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Step 4: Inject into any service

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common';
import { WebmeeEmailService } from 'webmee-email/nestjs';

@Injectable()
export class UserService {
  constructor(private readonly email: WebmeeEmailService) {}

  async onUserRegistered(user: User) {
    await this.email.sendTemplate({
      to: user.email,
      subject: 'Welcome to {{appName}}!',
      template: `
        <h1>Welcome, {{capitalize name}}!</h1>
        <p>Your account was created on {{formatDate createdAt "long"}}.</p>
        <p>Get started: <a href="{{dashboardUrl}}">Go to Dashboard</a></p>
      `,
      context: {
        name: user.name,
        appName: 'YourApp',
        createdAt: user.createdAt,
        dashboardUrl: 'https://yourapp.com/dashboard',
      },
    });
  }
}
```

### NestJS checklist

- [ ] `npm install webmee-email @nestjs/config`
- [ ] `ConfigModule.forRoot({ isGlobal: true })` in AppModule
- [ ] `WebmeeEmailModule.forRootAsync(...)` in AppModule imports
- [ ] Inject `WebmeeEmailService` in any service that needs to send email
- [ ] Set env variables in `.env`

---

## 14. Testing Locally (Mailtrap)

[Mailtrap](https://mailtrap.io) is a free email sandbox that captures all outgoing emails without delivering them — perfect for development and testing.

### Setup

1. Create a free account at [mailtrap.io](https://mailtrap.io)
2. Go to **Email Testing → Inboxes → SMTP Settings**
3. Copy the credentials

```env
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_mailtrap_user
SMTP_PASS=your_mailtrap_password
SMTP_SECURE=false

# Leave SENDGRID_API_KEY empty to force SMTP in 'auto' mode
SENDGRID_API_KEY=
EMAIL_FROM_ADDRESS=test@yourapp.com
EMAIL_FROM_NAME=YourApp Dev
```

### Verifying SMTP connection (standalone)

```typescript
import { SmtpProvider } from 'webmee-email';

const smtp = new SmtpProvider({
  host: 'sandbox.smtp.mailtrap.io',
  port: 587,
  user: process.env.SMTP_USER!,
  pass: process.env.SMTP_PASS!,
  from: { email: 'test@yourapp.com' },
});

const ok = await smtp.verify();
console.log('SMTP connection:', ok ? '✅ OK' : '❌ Failed');
```

---

## 15. Publishing to npm

Before publishing, run through this checklist:

### Pre-publish checklist

- [ ] **Build passes**: `pnpm run build` produces `dist/` with JS + `.d.ts` files
- [ ] **Tests pass**: `pnpm test`
- [ ] **`package.json` is correct**: `name`, `version`, `main`, `exports`, `files`, `peerDependencies`
- [ ] **`files` field** includes only `dist` and `README.md` (no `src`, no `.env`)
- [ ] **Version bumped** according to semver
- [ ] **README is up to date**

### Build and publish

```bash
# Build
pnpm run build

# Dry run — see what files will be published
npm pack --dry-run

# Publish (requires npm login)
npm login
npm publish --access public
```

### Versioning guide

| Change type | Version bump |
|---|---|
| Bug fix | Patch: `1.0.0 → 1.0.1` |
| New feature, backward-compatible | Minor: `1.0.0 → 1.1.0` |
| Breaking change to API or config | Major: `1.0.0 → 2.0.0` |

---

## 16. FAQ & Troubleshooting

**Q: I get a 403 error from SendGrid.**

A: Your API key doesn't have "Mail Send" permission. Regenerate it at [sendgrid.com/settings/api_keys](https://app.sendgrid.com/settings/api_keys) and ensure "Mail Send" is set to Full Access.

---

**Q: I get a 403 with "The from address does not match a verified Sender Identity."**

A: The `EMAIL_FROM_ADDRESS` must be verified in SendGrid. Go to **Settings → Sender Authentication** and either verify a single sender or authenticate your entire domain.

---

**Q: Emails are sent but not arriving.**

A: Check SendGrid's Activity Feed at [app.sendgrid.com/email_activity](https://app.sendgrid.com/email_activity). Common causes: recipient spam filter, bounced address, invalid domain DNS. Use Mailtrap for local testing so you can rule out delivery issues.

---

**Q: `sendSendGridTemplate` returns an error about SMTP.**

A: You're trying to use a SendGrid dynamic template but the provider is configured as `'smtp'` or there is no `SENDGRID_API_KEY`. Dynamic templates can only be sent via SendGrid's API. Set `SENDGRID_API_KEY` and set `provider: 'sendgrid'` or `'auto'`.

---

**Q: My Handlebars template renders `[object Object]` instead of a value.**

A: You're passing a non-primitive directly into a `{{variable}}` expression. Use a specific field: `{{user.name}}` instead of `{{user}}`. For arrays, use `{{#each items}}{{this}}{{/each}}` or the `join` helper.

---

**Q: How do I use `webmee-email` inside a monorepo before publishing to npm?**

A: Reference it as a local file or workspace dependency:

```json
// In your other project's package.json
{
  "dependencies": {
    "webmee-email": "file:../../packages/webmee-email"
  }
}
```

Or with pnpm workspaces:
```json
{
  "dependencies": {
    "webmee-email": "workspace:*"
  }
}
```

---

**Q: Template caching is causing stale output during development.**

A: Set `templateCaching: false` in your config when running in development:

```typescript
createEmailSender({
  ...,
  templateCaching: process.env.NODE_ENV !== 'production',
})
```

---

**Q: Can I send to multiple recipients at once?**

A: The current API sends to a single `to` address per call. For bulk sending, loop over recipients and call `sendTemplate` for each. For large broadcast campaigns, use the `IEmailQueue` adapter pattern to queue jobs.

---

**Q: How do I add support for a provider like Mailgun or AWS SES?**

A: Implement the `IEmailProvider` interface (see [Writing a Custom Provider](#writing-a-custom-provider)). You can then construct `EmailProviderService` directly with your custom provider. A first-class plugin API for custom providers is on the roadmap.
