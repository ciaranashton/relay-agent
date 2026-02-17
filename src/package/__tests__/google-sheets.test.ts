import { describe, it, expect, vi } from "vitest";

vi.mock("google-spreadsheet", () => {
  const mockRows = [
    {
      toObject: () => ({
        vendor: "Deliveroo",
        amount: "18.50",
        category: "Food",
        date: "2025-01-15",
      }),
      rowNumber: 2,
    },
    {
      toObject: () => ({
        vendor: "AWS",
        amount: "120.00",
        category: "Software",
        date: "2025-01-14",
      }),
      rowNumber: 3,
    },
  ];

  const mockSheet = {
    getRows: vi.fn().mockResolvedValue(mockRows),
    addRow: vi.fn().mockResolvedValue({
      rowNumber: 4,
      toObject: () => ({
        vendor: "New Vendor",
        amount: "50.00",
        category: "Other",
      }),
    }),
  };

  return {
    GoogleSpreadsheet: vi.fn().mockImplementation(() => ({
      loadInfo: vi.fn(),
      sheetsByTitle: { Expenses: mockSheet, Budgets: mockSheet },
    })),
  };
});

vi.mock("google-auth-library", () => ({
  JWT: vi.fn().mockImplementation(() => ({})),
}));

import { createGoogleSheetsSource } from "../adapters/google-sheets.js";

describe("createGoogleSheetsSource", () => {
  const source = createGoogleSheetsSource({
    sheetId: "test-sheet-id",
    credentials: {
      clientEmail: "test@test.iam.gserviceaccount.com",
      privateKey: "fake-key",
    },
    tabs: {
      expenses: "Expenses",
      budgets: "Budgets",
    },
  });

  it("has correct name and description", () => {
    expect(source.name).toBe("google_sheets");
    expect(source.description).toContain("expenses");
    expect(source.description).toContain("budgets");
  });

  describe("query", () => {
    it("returns all rows from a tab", async () => {
      const results = await source.query({ tab: "expenses" });
      expect(results).toHaveLength(2);
      expect((results as any[])[0].vendor).toBe("Deliveroo");
    });

    it("filters rows by key-value pairs", async () => {
      const results = await source.query({
        tab: "expenses",
        filter: { category: "Food" },
      });
      expect(results).toHaveLength(1);
      expect((results as any[])[0].vendor).toBe("Deliveroo");
    });

    it("limits results", async () => {
      const results = await source.query({
        tab: "expenses",
        limit: 1,
      });
      expect(results).toHaveLength(1);
    });

    it("throws for unknown tab key", async () => {
      await expect(source.query({ tab: "unknown" })).rejects.toThrow(
        'Unknown tab key: "unknown"',
      );
    });
  });

  describe("write", () => {
    it("adds a row to the sheet", async () => {
      const result = await source.write!({
        tab: "expenses",
        row: { vendor: "New Vendor", amount: "50.00", category: "Other" },
      });
      expect((result as any).success).toBe(true);
      expect((result as any).rowNumber).toBe(4);
    });
  });
});
