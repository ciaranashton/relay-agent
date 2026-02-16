import type { SourceAdapter } from "../types.js";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { z } from "zod";

export interface GoogleSheetsSourceOptions {
  sheetId: string;
  credentials: {
    clientEmail: string;
    privateKey: string;
  };
  tabs: Record<string, string>;
}

const querySchema = z.object({
  tab: z
    .string()
    .describe("The tab key to query (e.g., 'expenses', 'budgets')"),
  filter: z
    .record(z.string())
    .optional()
    .describe(
      "Optional key-value filters to match rows (e.g., { category: 'Food' })",
    ),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of rows to return"),
});

const writeSchema = z.object({
  tab: z
    .string()
    .describe("The tab key to write to (e.g., 'expenses')"),
  row: z
    .record(z.string())
    .describe(
      "Key-value pairs for the row to add (keys must match column headers)",
    ),
});

export function createGoogleSheetsSource(
  options: GoogleSheetsSourceOptions,
): SourceAdapter {
  const auth = new JWT({
    email: options.credentials.clientEmail,
    key: options.credentials.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const doc = new GoogleSpreadsheet(options.sheetId, auth);
  let loaded = false;

  async function ensureLoaded() {
    if (!loaded) {
      await doc.loadInfo();
      loaded = true;
    }
  }

  function resolveTabTitle(tabKey: string): string {
    const title = options.tabs[tabKey];
    if (!title) {
      throw new Error(
        `Unknown tab key: "${tabKey}". Available: ${Object.keys(options.tabs).join(", ")}`,
      );
    }
    return title;
  }

  return {
    name: "google_sheets",
    description: `Google Sheets spreadsheet with tabs: ${Object.entries(options.tabs).map(([k, v]) => `${k} ("${v}")`).join(", ")}`,
    queryDescription: `Query rows from the Google Sheets spreadsheet. Available tabs: ${Object.keys(options.tabs).join(", ")}`,
    writeDescription: `Add a new row to the Google Sheets spreadsheet. Available tabs: ${Object.keys(options.tabs).join(", ")}`,
    querySchema,
    writeSchema,

    async query(params: z.infer<typeof querySchema>) {
      await ensureLoaded();
      const title = resolveTabTitle(params.tab);
      const sheet = doc.sheetsByTitle[title];
      if (!sheet) throw new Error(`Sheet tab "${title}" not found`);

      const rows = await sheet.getRows();
      let results = rows.map((row) => row.toObject());

      if (params.filter) {
        results = results.filter((rowData) =>
          Object.entries(params.filter!).every(
            ([key, value]) =>
              String(rowData[key]).toLowerCase() === value.toLowerCase(),
          ),
        );
      }

      if (params.limit) {
        results = results.slice(0, params.limit);
      }

      return results;
    },

    async write(params: z.infer<typeof writeSchema>) {
      await ensureLoaded();
      const title = resolveTabTitle(params.tab);
      const sheet = doc.sheetsByTitle[title];
      if (!sheet) throw new Error(`Sheet tab "${title}" not found`);

      const addedRow = await sheet.addRow(params.row);
      return {
        success: true,
        rowNumber: addedRow.rowNumber,
        data: addedRow.toObject(),
      };
    },
  };
}
