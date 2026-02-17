import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { SourceAdapter } from "../types.js";
import { z } from "zod";

export interface JsonFileSourceOptions {
  filePath: string;
  tabs: Record<string, string>;
}

type FileData = Record<string, Record<string, string>[]>;

const querySchema = z.object({
  tab: z.string().describe("The tab key to query (e.g., 'expenses', 'budgets')"),
  filter: z
    .record(z.string())
    .optional()
    .describe("Optional key-value filters to match rows (e.g., { category: 'Food' })"),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of rows to return"),
});

const writeSchema = z.object({
  tab: z.string().describe("The tab key to write to (e.g., 'expenses')"),
  row: z
    .record(z.string())
    .describe("Key-value pairs for the row to add"),
});

function readData(filePath: string, tabs: Record<string, string>): FileData {
  if (!existsSync(filePath)) {
    // Initialise with empty arrays for each tab
    const initial: FileData = {};
    for (const tabTitle of Object.values(tabs)) {
      initial[tabTitle] = [];
    }
    writeFileSync(filePath, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(readFileSync(filePath, "utf-8")) as FileData;
}

function writeData(filePath: string, data: FileData): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function createJsonFileSource(
  options: JsonFileSourceOptions,
): SourceAdapter {
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
    name: "json_file",
    description: `JSON file data store with tabs: ${Object.entries(options.tabs).map(([k, v]) => `${k} ("${v}")`).join(", ")}`,
    queryDescription: `Query rows from the JSON file. Available tabs: ${Object.keys(options.tabs).join(", ")}`,
    writeDescription: `Add a new row to the JSON file. Available tabs: ${Object.keys(options.tabs).join(", ")}`,
    querySchema,
    writeSchema,

    async query(params: z.infer<typeof querySchema>) {
      const title = resolveTabTitle(params.tab);
      const data = readData(options.filePath, options.tabs);
      let rows = data[title] ?? [];

      if (params.filter) {
        rows = rows.filter((row) =>
          Object.entries(params.filter!).every(
            ([key, value]) =>
              String(row[key] ?? "").toLowerCase() === value.toLowerCase(),
          ),
        );
      }

      if (params.limit) {
        rows = rows.slice(0, params.limit);
      }

      return rows;
    },

    async write(params: z.infer<typeof writeSchema>) {
      const title = resolveTabTitle(params.tab);
      const data = readData(options.filePath, options.tabs);
      if (!data[title]) {
        data[title] = [];
      }
      data[title].push(params.row);
      writeData(options.filePath, data);

      return {
        success: true,
        rowNumber: data[title].length,
        data: params.row,
      };
    },
  };
}
