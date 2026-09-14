import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/sanitize";
import { formatMinor } from "@/lib/money";

/**
 * Admin-editable wording for the site's transactional emails (Admin >
 * Settings > Emails). Only the message itself — subject, an intro block,
 * an optional closing block — is editable; structural parts like the items
 * table or the payment button are always built in code (see the render*
 * functions below) so an edit here can never break how an order's details
 * actually display. {{tokens}} in the subject/intro/closing are filled in
 * with real values (and HTML-escaped) at send time.
 */

export type EmailTemplateKey = "PAYMENT_LINK" | "ORDER_CONFIRMATION" | "WELCOME";

export const EMAIL_TEMPLATE_KEYS: EmailTemplateKey[] = ["PAYMENT_LINK", "ORDER_CONFIRMATION", "WELCOME"];

type TemplateInfo = {
  label: string;
  description: string;
  variables: { token: string; description: string }[];
  hasClosing: boolean;
  defaultSubject: string;
  defaultIntroHtml: string;
  defaultClosingHtml: string;
};

export const EMAIL_TEMPLATE_INFO: Record<EmailTemplateKey, TemplateInfo> = {
  PAYMENT_LINK: {
    label: "Payment link (manual order)",
    description:
      "Sent when staff create a manual order and share a payment link with a client. The item list, price breakdown and payment button are added automatically below your message.",
    variables: [{ token: "{{orderNumber}}", description: "Order number, e.g. SD26-4821" }],
    hasClosing: true,
    defaultSubject: "Complete your order — {{orderNumber}} — Slowly Downward",
    defaultIntroHtml:
      "<p>Hello,</p><p>Thank you for your order with Slowly Downward. Please use the link below to complete payment and provide your shipping details.</p>",
    defaultClosingHtml: "",
  },
  ORDER_CONFIRMATION: {
    label: "Order confirmation",
    description:
      "Sent the moment a storefront order is paid. The item list and price breakdown are added automatically below your message.",
    variables: [
      { token: "{{customerName}}", description: "The customer's first name, or \"there\" if unknown" },
      { token: "{{orderNumber}}", description: "Order number, e.g. SD26-4821" },
    ],
    hasClosing: true,
    defaultSubject: "Your order is confirmed — {{orderNumber}} — Slowly Downward",
    defaultIntroHtml:
      "<p>Hi {{customerName}},</p><p>Thank you for your order — here's a confirmation of what you've bought.</p>",
    defaultClosingHtml: "<p>We'll email you again once it's on its way.</p>",
  },
  WELCOME: {
    label: "Welcome (new account)",
    description: "Sent the moment someone creates an account on the storefront.",
    variables: [{ token: "{{customerName}}", description: "The customer's first name, or \"there\" if unknown" }],
    hasClosing: false,
    defaultSubject: "Welcome to Slowly Downward",
    defaultIntroHtml:
      "<p>Hi {{customerName}},</p><p>Your account is all set up. You'll find your order history and collection waiting for you any time you sign in.</p>",
    defaultClosingHtml: "",
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fillTokens(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name) => (name in variables ? escapeHtml(variables[name]) : match));
}

/** Fetches a template row, creating it from its default wording the first
 * time it's needed — same "seed on first read" approach as SiteSettings
 * (src/lib/site-settings.ts), so there's nothing to run once to set these
 * up. */
export async function getEmailTemplate(key: EmailTemplateKey) {
  const info = EMAIL_TEMPLATE_INFO[key];
  return prisma.emailTemplate.upsert({
    where: { key },
    update: {},
    create: { key, subject: info.defaultSubject, introHtml: info.defaultIntroHtml, closingHtml: info.defaultClosingHtml },
  });
}

/** All templates, each guaranteed to exist — for the Admin > Settings >
 * Emails list page. */
export async function listEmailTemplates() {
  return Promise.all(EMAIL_TEMPLATE_KEYS.map((key) => getEmailTemplate(key)));
}

export async function saveEmailTemplate(
  key: EmailTemplateKey,
  input: { subject: string; introHtml: string; closingHtml: string }
) {
  const subject = input.subject.trim();
  const introHtml = sanitizeRichText(input.introHtml);
  const closingHtml = input.closingHtml.trim() ? sanitizeRichText(input.closingHtml) : "";
  await prisma.emailTemplate.upsert({
    where: { key },
    update: { subject, introHtml, closingHtml },
    create: { key, subject, introHtml, closingHtml },
  });
}

const WRAPPER_OPEN = `<div style="font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;max-width:520px;margin:0 auto;">`;
const WRAPPER_CLOSE = `</div>`;

type OrderItemLine = { title: string; editionNumber: number | null; priceMinor: number; currency: string };

function itemsTableHtml(items: OrderItemLine[]): string {
  const rows = items
    .map(
      (i) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e0d8;">
            ${escapeHtml(i.title)}${i.editionNumber ? ` — edition #${i.editionNumber}` : ""}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e0d8;text-align:right;white-space:nowrap;">
            ${formatMinor(i.priceMinor, i.currency)}
          </td>
        </tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:24px 0 0;font-size:14px;">${rows}</table>`;
}

function totalsTableHtml(subtotalMinor: number, shippingMinor: number, totalMinor: number, currency: string): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px;">
      <tr><td style="padding:4px 0;">Subtotal</td><td style="padding:4px 0;text-align:right;">${formatMinor(subtotalMinor, currency)}</td></tr>
      <tr><td style="padding:4px 0;">Shipping</td><td style="padding:4px 0;text-align:right;">${formatMinor(shippingMinor, currency)}</td></tr>
      <tr><td style="padding:4px 0;font-weight:bold;">Total</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${formatMinor(totalMinor, currency)}</td></tr>
    </table>`;
}

function ctaButtonHtml(url: string, label: string): string {
  return `<p style="text-align:center;margin:32px 0;"><a href="${escapeHtml(
    url
  )}" style="background:#1a1a1a;color:#fdfaf4;padding:14px 28px;text-decoration:none;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(
    label
  )}</a></p>`;
}

export async function renderPaymentLinkEmail(params: {
  orderNumber: string;
  paymentLinkUrl: string;
  items: OrderItemLine[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
}): Promise<{ subject: string; html: string }> {
  const template = await getEmailTemplate("PAYMENT_LINK");
  const vars = { orderNumber: params.orderNumber };
  const html =
    WRAPPER_OPEN +
    fillTokens(template.introHtml, vars) +
    itemsTableHtml(params.items) +
    totalsTableHtml(params.subtotalMinor, params.shippingMinor, params.totalMinor, params.currency) +
    ctaButtonHtml(params.paymentLinkUrl, "Complete your order") +
    `<p style="font-size:12px;color:#6b6558;">Order ${escapeHtml(
      params.orderNumber
    )}. This link is reserved for you — the item(s) above are being held pending your payment.</p>` +
    fillTokens(template.closingHtml, vars) +
    WRAPPER_CLOSE;
  return { subject: fillTokens(template.subject, vars), html };
}

export async function renderOrderConfirmationEmail(params: {
  customerName: string;
  orderNumber: string;
  items: OrderItemLine[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
}): Promise<{ subject: string; html: string }> {
  const template = await getEmailTemplate("ORDER_CONFIRMATION");
  const vars = { customerName: params.customerName, orderNumber: params.orderNumber };
  const html =
    WRAPPER_OPEN +
    fillTokens(template.introHtml, vars) +
    itemsTableHtml(params.items) +
    totalsTableHtml(params.subtotalMinor, params.shippingMinor, params.totalMinor, params.currency) +
    fillTokens(template.closingHtml, vars) +
    `<p style="font-size:12px;color:#6b6558;">Order ${escapeHtml(params.orderNumber)}.</p>` +
    WRAPPER_CLOSE;
  return { subject: fillTokens(template.subject, vars), html };
}

export async function renderWelcomeEmail(params: { customerName: string }): Promise<{ subject: string; html: string }> {
  const template = await getEmailTemplate("WELCOME");
  const vars = { customerName: params.customerName };
  const html = WRAPPER_OPEN + fillTokens(template.introHtml, vars) + fillTokens(template.closingHtml, vars) + WRAPPER_CLOSE;
  return { subject: fillTokens(template.subject, vars), html };
}

/** Sample data for the "send yourself a test" button on each template's
 * edit page — never touches real orders/customers. */
export async function renderSampleEmail(key: EmailTemplateKey): Promise<{ subject: string; html: string }> {
  const sampleItems: OrderItemLine[] = [
    { title: "Amnesiac (Screenprint)", editionNumber: 47, priceMinor: 22000, currency: "GBP" },
    { title: "Kid A", editionNumber: null, priceMinor: 4500, currency: "GBP" },
  ];
  switch (key) {
    case "PAYMENT_LINK":
      return renderPaymentLinkEmail({
        orderNumber: "SD26-1234",
        paymentLinkUrl: "https://checkout.stripe.com/example",
        items: sampleItems,
        subtotalMinor: 26500,
        shippingMinor: 800,
        totalMinor: 27300,
        currency: "GBP",
      });
    case "ORDER_CONFIRMATION":
      return renderOrderConfirmationEmail({
        customerName: "Jamie",
        orderNumber: "SD26-1234",
        items: sampleItems,
        subtotalMinor: 26500,
        shippingMinor: 800,
        totalMinor: 27300,
        currency: "GBP",
      });
    case "WELCOME":
      return renderWelcomeEmail({ customerName: "Jamie" });
  }
}
