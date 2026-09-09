import { describe, expect, it } from "vitest";
import {
  isValidNotionApplicant,
  isNotionSnapshotCurrent,
  notionApplicantStorageData,
  pageToNotionApplicant,
  shouldApplyImportedTier,
  validateNotionMemberProperties,
} from "./notionMemberSync";

function pageFixture(overrides: Record<string, unknown> = {}) {
  return {
    object: "page",
    id: "notion-page-1",
    created_time: "2026-09-01T10:00:00.000Z",
    last_edited_time: "2026-09-02T10:00:00.000Z",
    archived: false,
    in_trash: false,
    url: "https://notion.so/notion-page-1",
    public_url: null,
    parent: { type: "data_source_id", data_source_id: "source-1" },
    properties: {
      "First Name": { id: "title", type: "title", title: [{ plain_text: "Alex" }] },
      "Last Name": { id: "last", type: "rich_text", rich_text: [{ plain_text: "Lee" }] },
      Email: { id: "email", type: "email", email: " ALEX@EXAMPLE.COM " },
      "WhatsApp / Phone": { id: "phone", type: "phone_number", phone_number: "1234" },
      Submitted: { id: "submitted", type: "created_time", created_time: "2026-09-01T10:00:00.000Z" },
      "Consent to Be Contacted": { id: "consent", type: "checkbox", checkbox: true },
    },
    ...overrides,
  };
}

describe("Notion member sync rules", () => {
  it("normalizes a valid applicant from the real form property names", () => {
    const applicant = pageToNotionApplicant(pageFixture());
    expect(applicant).toMatchObject({
      externalId: "notion-page-1",
      name: "Alex Lee",
      email: "alex@example.com",
      phone: "1234",
      consent: true,
    });
    expect(applicant && isValidNotionApplicant(applicant)).toBe(true);
  });

  it("does not retain applicant PII when contact consent is absent", () => {
    const applicant = pageToNotionApplicant(pageFixture({
      properties: {
        ...pageFixture().properties,
        "Consent to Be Contacted": { id: "consent", type: "checkbox", checkbox: false },
      },
    }));
    expect(applicant && isValidNotionApplicant(applicant)).toBe(false);
    expect(applicant && notionApplicantStorageData(applicant)).toEqual({
      submittedName: "(Consent not granted)",
      submittedEmail: "(Not retained)",
      submittedPhone: null,
      rawData: { reason: "consent_not_granted", notionPageId: "notion-page-1" },
    });
  });

  it("never downgrades a selected member from a Notion review row", () => {
    expect(shouldApplyImportedTier("notion_join", "active_player")).toBe(false);
    expect(shouldApplyImportedTier("notion_join", "division_one_squad")).toBe(false);
    expect(shouldApplyImportedTier("notion_join", "awaiting_selection")).toBe(true);
    expect(shouldApplyImportedTier("manual_import", "active_player")).toBe(true);
  });

  it("keeps a newer stored snapshot authoritative over an older retry", () => {
    const newer = new Date("2026-09-03T10:00:00.000Z");
    const older = new Date("2026-09-02T10:00:00.000Z");
    expect(isNotionSnapshotCurrent(newer, older)).toBe(true);
    expect(isNotionSnapshotCurrent(newer, newer)).toBe(true);
    expect(isNotionSnapshotCurrent(older, newer)).toBe(false);
  });

  it("fails clearly when the Notion form property mapping drifts", () => {
    const properties = pageFixture().properties;
    expect(() => validateNotionMemberProperties(properties)).not.toThrow();
    expect(() => validateNotionMemberProperties({ ...properties, Email: undefined }))
      .toThrow(/Email \(email\)/);
  });
});