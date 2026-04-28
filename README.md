# webmee-email

> Plug-and-play email sending for Node.js and NestJS. Multi-provider support (SendGrid + SMTP fallback), a Handlebars template engine with 20+ built-in helpers, and first-class NestJS integration — all in one self-contained package.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Quick Start — No Framework](#quick-start--no-framework)
- [NestJS Integration](#nestjs-integration)
- [Sending Emails](#sending-emails)
  - [Raw Email](#1-raw-email)
  - [Handlebars Template](#2-handlebars-template)
  - [SendGrid Dynamic Template](#3-sendgrid-dynamic-template)
  - [Pre-rendered Template (NestJS only)](#4-pre-rendered-template-nestjs-only)
- [Template Engine & Built-in Helpers](#template-engine--built-in-helpers)
- [Custom Helpers](#custom-helpers)
- [Provider Selection & Fallback](#provider-selection--fallback)
- [Custom Providers](#custom-providers)
- [Adapter Interfaces](#adapter-interfaces)
- [TypeScript Types](#typescript-types)
- [License](#license)

---

## Features

- **Multi-provider** — SendGrid (API v3) primary with automatic SMTP fallback
- **Handlebars template engine** — compile-time caching, 20+ built-in helpers (dates, currency, conditionals, strings)
- **Auto plain-text** — plain-text body is generated from HTML automatically when not provided
- **NestJS module** — `forRoot` / `forRootAsync` with full `ConfigService` support, globally injectable
- **Standalone factory** — `createEmailSender()` works in any Node.js project, no framework needed
- **Custom providers** — implement `IEmailProvider` to add Mailgun, AWS SES, Postmark, etc.
- **Adapter interfaces** — plug in your own queue, idempotency store, message store, and template store
- **SendGrid EU** — configurable API host for EU data residency
- **Metadata & categories** — attach custom args and category labels to every send
- **Zero lock-in** — only two runtime dependencies: `handlebars` and `nodemailer`

---

## Installation

```bash
# npm
npm install webmee-email

# pnpm
pnpm add webmee-email

# yarn
yarn add webmee-email
```

**Peer dependencies** (only needed if using NestJS integration):

```bash
npm install @nestjs/common @nestjs/core @nestjs/config
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `SENDGRID_API_KEY` | Yes (if using SendGrid) | Your SendGrid Web API key — starts with `SG.` |
| `EMAIL_FROM_ADDRESS` | Yes | Sender email address (must be verified in SendGrid) |
| `EMAIL_FROM_NAME` | No | Display name shown in the From field |
| `SENDGRID_API_HOST` | No | Override API host. EU: `https://api.eu.sendgrid.com` |
| `SMTP_HOST` | Yes (if using SMTP) | SMTP server hostname |
| `SMTP_PORT` | No | SMTP port. Default: `587` |
| `SMTP_USER` | Yes (if using SMTP) | SMTP authentication username |
| `SMTP_PASS` | Yes (if using SMTP) | SMTP authentication password |
| `SMTP_SECURE` | No | `true` = TLS on port 465. `false` = STARTTLS on 587. Default: `false` |

> **SendGrid sender verification**: The `EMAIL_FROM_ADDRESS` domain must be verified in your SendGrid account under **Settings → Sender Authentication**.

---

## Quick Start — No Framework

```typescript
import { createEmailSender } from 'webmee-email';

const email = createEmailSender({
  provider: 'sendgrid',
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY!,
    from: {
      email: process.env.EMAIL_FROM_ADDRESS!,
      name: process.env.EMAIL_FROM_NAME,
    },
  },
});

// 1. Send a raw email
await email.send({
  to: 'customer@example.com',
  subject: 'Your order is confirmed',
  html: '<h1>Order #1234 confirmed!</h1><p>Thanks for your purchase.</p>',
});

// 2. Send with a Handlebars template
await email.sendTemplate({
  to: 'customer@example.com',
  subject: 'Ticket for {{event_name}}',
  template: `
    <p>Hi {{capitalize name}},</p>
    <p>Your ticket for <strong>{{event_name}}</strong> on
       {{formatDate event_date "long"}} is confirmed.</p>
    <p>Total paid: {{formatCurrency total "GBP"}}</p>
  `,
  context: {
    name: 'isuru raveen',
    event_name: 'Tech Summit 2025',
    event_date: '2025-09-20T18:00:00Z',
    total: 149.99,
  },
});

// 3. Send via a SendGrid dynamic template
await email.sendSendGridTemplate({
  to: 'organiser@example.com',
  templateId: 'd-0a261929077b4faba5bf48613449664a',
  data: { event_name: 'Summer Festival', event_date: 'July 15' },
});

// Check which provider is active
console.log(email.getActiveProvider()); // "SendGrid"
```

---

## NestJS Integration

### 1. Register the module

In your root `AppModule`, register `WebmeeEmailModule` once. Use `forRootAsync` (recommended) to pull config from `ConfigService`:

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
        provider: 'auto',   // auto-picks SendGrid if API key is present, else SMTP
        sendgrid: {
          apiKey: config.get<string>('SENDGRID_API_KEY')!,
          from: {
            email: config.get<string>('EMAIL_FROM_ADDRESS')!,
            name: config.get<string>('EMAIL_FROM_NAME'),
          },
        },
        smtp: {
          host: config.get<string>('SMTP_HOST')!,
          port: 587,
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

Or use `forRoot` for simple static config:

```typescript
WebmeeEmailModule.forRoot({
  provider: 'sendgrid',
  sendgrid: {
    apiKey: 'SG.xxxxxxxx',
    from: { email: 'no-reply@yourapp.com', name: 'YourApp' },
  },
})
```

### 2. Inject and use

`WebmeeEmailModule` is global — inject `WebmeeEmailService` anywhere in your app without re-importing the module:

```typescript
// notifications.service.ts
import { Injectable } from '@nestjs/common';
import { WebmeeEmailService } from 'webmee-email/nestjs';

@Injectable()
export class NotificationsService {
  constructor(private readonly email: WebmeeEmailService) {}

  async sendOrderConfirmation(buyerEmail: string, order: Order) {
    const result = await this.email.sendTemplate({
      to: buyerEmail,
      subject: 'Order #{{orderId}} Confirmed',
      template: `
        <h2>Thanks for your order!</h2>
        <p>Order ID: <strong>{{orderId}}</strong></p>
        <p>Total: {{formatCurrency total "GBP"}}</p>
        <p>Event: {{event_name}} — {{formatDate event_date "long"}}</p>
      `,
      context: {
        orderId: order.id,
        total: order.total,
        event_name: order.eventName,
        event_date: order.eventDate,
      },
      categories: ['order-confirmation'],
    });

    if (!result.success) {
      throw new Error(`Email failed: ${result.error}`);
    }

    return result.messageId;
  }
}
```

---

## Sending Emails

### 1. Raw Email

Send pre-built HTML directly — no template engine involved:

```typescript
await emailService.send({
  to: 'user@example.com',
  subject: 'Hello from YourApp',
  html: '<p>Welcome aboard!</p>',
  text: 'Welcome aboard!',         // optional — auto-generated from html if omitted
  from: { email: 'custom@yourapp.com', name: 'Custom Sender' }, // optional override
  metadata: { userId: '123', source: 'signup' },                // optional
  categories: ['welcome', 'transactional'],                      // optional (SendGrid only)
});
```

### 2. Handlebars Template

Pass a Handlebars template string and a context object. The engine renders subject, HTML body, and plain-text body all from the same context:

```typescript
await emailService.sendTemplate({
  to: 'user@example.com',
  subject: '{{#ifEquals ticketType "VIP"}}VIP Access{{else}}Your Ticket{{/ifEquals}} — {{event_name}}',
  template: `
    <p>Hi {{capitalize name}},</p>
    {{#ifGreaterThan seats_remaining 0}}
      <p>{{seats_remaining}} seats still available.</p>
    {{else}}
      <p>This event is now sold out.</p>
    {{/ifGreaterThan}}
    <p>Doors open {{formatDate doors_open "time"}} ({{relativeDate doors_open}})</p>
    <p>Price: {{formatCurrency price "USD"}}</p>
    <p>Tags: {{join tags ", "}}</p>
  `,
  context: {
    name: 'isuru',
    event_name: 'DevConf 2025',
    ticketType: 'VIP',
    seats_remaining: 12,
    doors_open: '2025-09-20T17:30:00Z',
    price: 299,
    tags: ['tech', 'networking', 'workshops'],
  },
});
```

### 3. SendGrid Dynamic Template

Use a template you've built in the SendGrid dashboard. Pass the template ID and the data object that maps to your template's `{{variable}}` placeholders:

```typescript
await emailService.sendSendGridTemplate({
  to: 'buyer@example.com',
  templateId: 'd-0a261929077b4faba5bf48613449664a',
  data: {
    buyer_name: 'Isuru',
    event_name: 'Summer Fest',
    order_total: '£149.99',
    ticket_url: 'https://yourapp.com/tickets/abc123',
  },
  categories: ['ticket-delivery'],
});
```

> Note: SendGrid dynamic templates cannot fall back to SMTP. If no SendGrid API key is configured, this call returns an error immediately.

### 4. Pre-rendered Template (NestJS only)

When you've already fetched a template entity from your database (with `subject`, `bodyHtml`, `bodyText` fields), use `sendRendered` to let the engine compile and send it in one step:

```typescript
// NestJS only — WebmeeEmailService
const template = await this.templateRepository.findOneByType(EmailType.BUYER_ORDER_CONFIRMATION);

await this.email.sendRendered(
  template,           // { subject, bodyHtml, bodyText? }
  { orderId: '123', total: 99.99 },  // context variables
  'buyer@example.com',
  { categories: ['order-confirmation'] },
);
```

---

## Template Engine & Built-in Helpers

The engine uses [Handlebars](https://handlebarsjs.com/) with compiled template caching (LRU, up to 500 entries by default).

### Date Helpers

| Helper | Usage | Output |
|---|---|---|
| `formatDate` | `{{formatDate date "short"}}` | `9/20/2025` |
| `formatDate` | `{{formatDate date "long"}}` | `September 20, 2025` |
| `formatDate` | `{{formatDate date "time"}}` | `6:00 PM` |
| `formatDate` | `{{formatDate date "iso"}}` | `2025-09-20T18:00:00.000Z` |
| `formatDate` | `{{formatDate date "month"}}` | `September 2025` |
| `formatDate` | `{{formatDate date "day"}}` | `Saturday` |
| `relativeDate` | `{{relativeDate date}}` | `in 3 days` / `2 hours ago` / `just now` |

### Currency & Number Helpers

| Helper | Usage | Output |
|---|---|---|
| `formatCurrency` | `{{formatCurrency 149.99 "GBP"}}` | `£149.99` |
| `formatCurrency` | `{{formatCurrency 299 "USD"}}` | `$299.00` |
| `formatNumber` | `{{formatNumber 12345.5 2}}` | `12,345.50` |
| `formatNumber` | `{{formatNumber 1000000}}` | `1,000,000` |

### Conditional Block Helpers

All conditional helpers follow the `{{#helper}}...{{else}}...{{/helper}}` Handlebars block pattern:

| Helper | Usage |
|---|---|
| `ifEquals` | `{{#ifEquals status "active"}}Active{{/ifEquals}}` |
| `ifNotEquals` | `{{#ifNotEquals status "cancelled"}}...{{/ifNotEquals}}` |
| `ifGreaterThan` | `{{#ifGreaterThan count 0}}Has items{{/ifGreaterThan}}` |
| `ifLessThan` | `{{#ifLessThan seats 5}}Almost full!{{/ifLessThan}}` |
| `ifContains` | `{{#ifContains tags "vip"}}VIP Holder{{/ifContains}}` |
| `ifTruthy` | `{{#ifTruthy promoCode}}Promo: {{promoCode}}{{/ifTruthy}}` |

### String Helpers

| Helper | Usage | Output |
|---|---|---|
| `uppercase` | `{{uppercase name}}` | `ISURU RAVEEN` |
| `lowercase` | `{{lowercase email}}` | `user@example.com` |
| `capitalize` | `{{capitalize name}}` | `Isuru Raveen` |
| `truncate` | `{{truncate description 80}}` | `This is a long desc...` |
| `default` | `{{default promoCode "NONE"}}` | `NONE` (if promoCode is null/undefined) |
| `safeHtml` | `{{safeHtml richContent}}` | Renders unescaped HTML (trusted content only) |
| `join` | `{{join tags ", "}}` | `music, arts, food` |
| `urlEncode` | `{{urlEncode eventName}}` | `Summer%20Festival` |
| `repeat` | `{{repeat "★" 5}}` | `★★★★★` |

---

## Custom Helpers

Register your own Handlebars helpers by passing them in the config:

```typescript
createEmailSender({
  provider: 'sendgrid',
  sendgrid: { ... },
  customHelpers: {
    // Simple value helper
    ticketRef: (id: string) => `TKT-${id.toUpperCase()}`,

    // Block helper
    ifPremium: function(tier: string, options: Handlebars.HelperOptions) {
      return tier === 'premium' ? options.fn(this) : options.inverse(this);
    },
  },
});
```

Usage in template:
```handlebars
<p>Reference: {{ticketRef orderId}}</p>
{{#ifPremium tier}}
  <p>✨ Premium member benefits apply</p>
{{/ifPremium}}
```

> Custom helpers override built-in helpers on name collision.

---

## Provider Selection & Fallback

The `provider` option controls which provider is used as primary:

| Value | Behaviour |
|---|---|
| `'sendgrid'` | SendGrid primary. Falls back to SMTP if `smtp` config is provided and SendGrid fails. |
| `'smtp'` | SMTP only. No fallback. |
| `'auto'` | Picks SendGrid if `sendgrid.apiKey` is set, otherwise SMTP. |

**Fallback behaviour:**
- When the primary provider returns a non-success result and a fallback is available, the package retries automatically and logs a warning.
- SendGrid dynamic templates (`sendSendGridTemplate`) are **never** retried via SMTP — they are incompatible.

```typescript
// Example: SendGrid primary with SMTP as a safety net
createEmailSender({
  provider: 'sendgrid',
  sendgrid: { apiKey: 'SG.xxx', from: { email: 'no-reply@app.com' } },
  smtp: { host: 'smtp.mailtrap.io', port: 587, user: 'xxx', pass: 'xxx', from: { email: 'no-reply@app.com' } },
});
```

---

## Custom Providers

Implement `IEmailProvider` to add any email provider:

```typescript
import { IEmailProvider, SendEmailOptions, SendEmailResult } from 'webmee-email';

export class MailgunProvider implements IEmailProvider {
  constructor(private readonly apiKey: string, private readonly domain: string) {}

  getProviderName(): string {
    return 'Mailgun';
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    // Call Mailgun API here
    try {
      // ... your HTTP call to Mailgun ...
      return { success: true, messageId: 'mg-abc123' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
```

---

## Adapter Interfaces

When integrating `webmee-email` into a larger service (e.g. a dedicated email microservice), you can wire up four optional adapter interfaces. These define the contracts — your service provides the implementations:

| Interface | Purpose |
|---|---|
| `IEmailQueue` | Queue email jobs (e.g. BullMQ + Redis) |
| `IIdempotencyStore` | Prevent duplicate sends for the same logical event |
| `IMessageStore` | Persist and track every email send attempt with status history |
| `ITemplateStore` | Resolve and render stored templates from a database |

Import from `webmee-email`:

```typescript
import {
  IEmailQueue,
  IIdempotencyStore,
  IMessageStore,
  ITemplateStore,
} from 'webmee-email';
```

See [DOCUMENTATION.md](./DOCUMENTATION.md) for full implementation examples.

---

## TypeScript Types

All types are exported from `webmee-email`:

```typescript
import type {
  // Config
  WebmeeEmailOptions,
  SendGridConfig,
  SmtpConfig,

  // Sending
  SendOptions,
  SendTemplateOptions,
  SendSendGridTemplateOptions,
  SendEmailResult,

  // Providers
  IEmailProvider,
  SendEmailOptions,

  // Template engine
  TemplateRenderInput,
  TemplateRenderResult,

  // Enums
  EmailType,
  EmailStatus,
  BroadcastStatus,
} from 'webmee-email';
```

---

## License

MIT
