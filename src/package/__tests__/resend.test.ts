import { describe, it, expect, vi } from "vitest";
import { createResendAdapter } from "../adapters/resend.js";

const mockWebhookPayload = {
  type: "email.received",
  data: {
    email_id: "email-123",
    from: "user@example.com",
    to: ["expenses@myapp.com"],
    subject: "Fwd: Your Deliveroo receipt",
    created_at: "2025-01-15T10:00:00Z",
  },
};

const mockEmailResponse = {
  html: "<p>Your order of £18.50 from Deliveroo</p>",
  text: "Your order of £18.50 from Deliveroo",
};

vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockEmailResponse),
  }),
);

describe("createResendAdapter", () => {
  const adapter = createResendAdapter({
    webhookSecret: "whsec_test123",
    apiKey: "re_test_key",
  });

  it("has correct name", () => {
    expect(adapter.name).toBe("resend");
  });

  describe("parseWebhook", () => {
    it("parses webhook payload and fetches email body", async () => {
      const request = new Request("https://example.com/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockWebhookPayload),
      });

      const message = await adapter.parseWebhook(request);

      expect(message.id).toBe("email-123");
      expect(message.channel).toBe("email");
      expect(message.from).toBe("user@example.com");
      expect(message.to).toBe("expenses@myapp.com");
      expect(message.subject).toBe("Fwd: Your Deliveroo receipt");
      expect(message.body).toBe("Your order of £18.50 from Deliveroo");
      expect(message.metadata).toEqual({
        emailId: "email-123",
        webhookType: "email.received",
      });
    });

    it("fetches email body from Resend API", async () => {
      const request = new Request("https://example.com/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockWebhookPayload),
      });

      await adapter.parseWebhook(request);

      expect(fetch).toHaveBeenCalledWith(
        "https://api.resend.com/emails/email-123",
        { headers: { Authorization: "Bearer re_test_key" } },
      );
    });
  });
});
