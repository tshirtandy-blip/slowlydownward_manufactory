import type { Order, OrderItem, Print, Edition } from "@prisma/client";
import { substituteMergeFields, type ResolvedCoaTemplate } from "@/lib/coa-template";

/**
 * Renders one or more Certificates of Authenticity to a single PDF —
 * called from generateCoaPdf in
 * src/app/admin/(protected)/pack/actions.ts (one COA page per order item)
 * and from the Settings template editor's "Preview PDF" button (one page,
 * sample data).
 *
 * Unlike src/lib/commercial-invoice.ts (pdfkit — explicit x/y drawing
 * calls), a COA template is owner-authored, arbitrary HTML/CSS, so this
 * needs an actual browser engine to render it: puppeteer-core drives
 * headless Chromium, and @sparticuz/chromium-min supplies a Chromium build
 * that runs inside a Vercel serverless function (this app has no
 * Dockerfile / `output: "standalone"`, so there's no system-installed
 * Chromium to point at in production).
 *
 * Uses the "-min" package (not the full @sparticuz/chromium) fetching its
 * binary from a remote URL at runtime, rather than the full package, which
 * bundles the binary locally. Next.js's build-time file tracing can't see
 * @sparticuz/chromium's dynamically-resolved binary path, so on Vercel the
 * bundled binary silently gets left out of the deployed function and every
 * call fails with "The input directory .../.next/server/bin does not
 * exist" — a well-known issue with this package on Vercel specifically.
 * Fetching the (pre-packed, brotli-compressed) binary from a URL at
 * runtime sidesteps that tracing problem entirely. CHROMIUM_PACK_URL lets
 * this be overridden (e.g. to a same-region S3/Vercel Blob mirror for
 * lower cold-start latency) without a code change; it defaults to the
 * matching version's official release asset, which is enough for an
 * occasional admin action like this.
 */

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ??
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";

type ItemWithRelations = OrderItem & { print: Print; edition: Edition | null };

const PAGE_SIZE_MM: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 216, height: 279 }, // approximated in mm for puppeteer's width/height option
};

async function launchBrowser() {
  // Local development escape hatch: @sparticuz/chromium-min's remote binary
  // targets Vercel/AWS Lambda's Linux runtime and will not launch on a
  // typical macOS/Windows dev machine. Point CHROME_EXECUTABLE_PATH (in
  // .env.local) at a real local Chrome/Chromium install to test COA
  // generation outside of a deployed environment.
  const puppeteer = (await import("puppeteer-core")).default;
  const localExecutablePath = process.env.CHROME_EXECUTABLE_PATH;
  if (localExecutablePath) {
    return puppeteer.launch({ executablePath: localExecutablePath, headless: true });
  }

  // @sparticuz/chromium-min ships libnss3.so and friends inside its
  // downloaded pack (confirmed by hand: the release asset's al2023.tar.br
  // contains lib/libnss3.so), but it only EXTRACTS them when its own
  // isRunningInAwsLambda()/isRunningInAwsLambdaNode20() checks pass — which
  // look for an AWS_EXECUTION_ENV or AWS_LAMBDA_JS_RUNTIME env var that only
  // real AWS Lambda sets. Vercel doesn't set it, so those checks silently
  // fail, the library files are never extracted, and Chromium fails to
  // launch with "error while loading shared libraries: libnss3.so" — no
  // Node.js version or build-cache setting changes this. Setting this env
  // var ourselves (before the package's module code first runs) makes it
  // behave as if it's on Lambda Node 20/AL2023 and actually extract the
  // libraries. Must happen before the dynamic import below, since the
  // package's top-level module code (which also wires up LD_LIBRARY_PATH)
  // runs once, at first import, and reads this env var then.
  process.env.AWS_LAMBDA_JS_RUNTIME ??= "nodejs20.x";

  const chromium = (await import("@sparticuz/chromium-min")).default;
  const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);

  // Belt-and-suspenders: the package's own module-load-time code (see
  // above) sets LD_LIBRARY_PATH to /tmp/al2023/lib too, but only the FIRST
  // time that module is evaluated in a given function instance — a warm
  // invocation that reuses the process won't re-run it. Setting it
  // ourselves on every call is a harmless no-op when it's already correct.
  const extraLibPaths = ["/tmp/al2023/lib", "/tmp/al2/lib"];
  process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
    ? [...new Set([...extraLibPaths, ...process.env.LD_LIBRARY_PATH.split(":")])].join(":")
    : extraLibPaths.join(":");

  return puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });
}

/** Wraps one item's substituted template HTML in a <section>, with the
 * template's own CSS isolated to that section via the CSS `@scope`
 * at-rule — so if a multi-item order mixes a per-product override with
 * the global default (or two different per-product overrides), their
 * styles can't bleed into each other even when both use generic class
 * names like `.coa`. (Known simplification: the PDF's overall page size
 * is taken from the FIRST item's template — see buildCoaPdf below — since
 * Chromium's print-to-PDF sizes the whole document, not per section; a
 * multi-item order with per-product templates set to different page sizes
 * will all print at the first item's size.) */
function renderPage(item: ItemWithRelations, order: Order, template: ResolvedCoaTemplate, index: number): string {
  const sectionId = `coa-page-${index}`;
  const merged = substituteMergeFields(template.bodyHtml, item, order);
  return `<section class="coa-page" id="${sectionId}">
  <style>@scope (#${sectionId}) { ${template.css} }</style>
  ${merged}
</section>`;
}

export async function buildCoaPdf(params: {
  order: Order;
  items: ItemWithRelations[];
  /** Resolves the template to use for one item's print — see
   * resolveCoaTemplate in src/lib/coa-template.ts. */
  templateFor: (printId: string) => Promise<ResolvedCoaTemplate> | ResolvedCoaTemplate;
}): Promise<Buffer> {
  const { order, items } = params;
  if (items.length === 0) throw new Error("No items to generate a Certificate of Authenticity for.");

  const templates = await Promise.all(items.map((item) => params.templateFor(item.printId)));
  const pageSize = PAGE_SIZE_MM[templates[0]?.pageSize ?? "A5"] ?? PAGE_SIZE_MM.A5;

  const sections = items.map((item, i) => renderPage(item, order, templates[i], i)).join("\n");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  .coa-page { page-break-after: always; }
  .coa-page:last-child { page-break-after: auto; }
</style>
</head>
<body>
${sections}
</body>
</html>`;

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      width: `${pageSize.width}mm`,
      height: `${pageSize.height}mm`,
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
