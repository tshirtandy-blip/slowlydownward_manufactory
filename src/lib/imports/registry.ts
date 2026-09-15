import { clientsCsvTemplate, parseClientsCsv, applyClientsImport, CLIENTS_CSV_HEADER } from "./clients-import";
import { productsCsvTemplate, parseProductsCsv, applyProductsImport, PRODUCTS_CSV_HEADER } from "./products-import";
import { ordersCsvTemplate, parseOrdersCsv, applyOrdersImport, ORDERS_CSV_HEADER } from "./orders-import";

/**
 * Every CSV import offered from Admin > Settings > Import — the "table of
 * options" a staff member picks from before downloading a template and
 * uploading their filled-in copy. Adding a new importable data type means
 * adding one entry here (plus its own file alongside clients-import.ts /
 * products-import.ts / orders-import.ts) — the hub page, the per-type
 * upload page, and the template download route are all generic and read
 * from this list, nothing else needs to change.
 */

export type ImportSummary = { created: number; updated?: number; skipped?: number; errors: string[] };

export type ImportType = {
  key: string;
  label: string;
  description: string;
  columnsHeader: string;
  template: () => string;
  parse: (text: string) => { rows: any[]; errors: string[] };
  apply: (rows: any[]) => Promise<ImportSummary>;
};

export const IMPORT_TYPES: ImportType[] = [
  {
    key: "clients",
    label: "Clients",
    description: "Archival client records — email, name, phone, marketing opt-in. Matched and updated by email.",
    columnsHeader: CLIENTS_CSV_HEADER,
    template: clientsCsvTemplate,
    parse: parseClientsCsv,
    apply: applyClientsImport,
  },
  {
    key: "products",
    label: "Products",
    description: "Your print catalogue — e.g. migrating 200+ products from an old Shopify shop. Matched by slug.",
    columnsHeader: PRODUCTS_CSV_HEADER,
    template: productsCsvTemplate,
    parse: parseProductsCsv,
    apply: applyProductsImport,
  },
  {
    key: "orders",
    label: "Historical purchases",
    description: "Past sales from before this system existed — recorded as already-shipped orders against a client and print.",
    columnsHeader: ORDERS_CSV_HEADER,
    template: ordersCsvTemplate,
    parse: parseOrdersCsv,
    apply: applyOrdersImport,
  },
];

export function getImportType(key: string): ImportType | undefined {
  return IMPORT_TYPES.find((t) => t.key === key);
}
