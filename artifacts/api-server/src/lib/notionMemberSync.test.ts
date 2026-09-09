import { describe, expect, it } from "vitest";
import {
  isValidNotionApplicant,
  isNotionSnapshotCurrent,
  hasNotionIdentityConflict,
  notionApplicantStorageData,
  pageToNotionApplicant,
  resolveNotionMemberProfile,
  resolveProfileSubmissionStatus,
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
      "Year of Birth": { id: "birth", type: "date", date: { start: "1984-06-12", end: null } },
      "Position(s)": {
        id: "position",
        type: "multi_select",
        multi_select: [{ id: "forward", name: "Forward" }, { id: "midfield", name: "Midfield" }],
      },
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
      dateOfBirth: "1984-06-12",
      position: "Forward, Midfield",
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

  it("keeps Notion-created member profile fields synchronized", () => {
    expect(resolveNotionMemberProfile(
      { consent: true, dateOfBirth: "1984-06-12", position: "Forward, Midfield" },
      { dateOfBirth: null, position: "Defender" },
      true,
    )).toEqual({
      updates: { dateOfBirth: "1984-06-12", position: "Forward, Midfield" },
      conflict: false,
    });
  });

  it("fills blank profile fields without overwriting a pre-existing member conflict", () => {
    expect(resolveNotionMemberProfile(
      { consent: true, dateOfBirth: "1984-06-12", position: "Forward" },
      { dateOfBirth: null, position: "Goalkeeper" },
      false,
    )).toEqual({
      updates: { dateOfBirth: "1984-06-12" },
      conflict: true,
    });
  });

  it("does not copy profile fields without consent", () => {
    expect(resolveNotionMemberProfile(
      { consent: false, dateOfBirth: "1984-06-12", position: "Forward" },
      { dateOfBirth: null, position: null },
      true,
    )).toEqual({ updates: {}, conflict: false });
  });

  it("clears a stale reconciliation conflict after the member is corrected locally", () => {
    expect(resolveProfileSubmissionStatus("conflict", false)).toBe("matched");
    expect(resolveProfileSubmissionStatus("matched", true)).toBe("conflict");
    expect(resolveProfileSubmissionStatus("matched", false)).toBeNull();
    expect(resolveProfileSubmissionStatus("conflict", true)).toBeNull();
  });

  it("does not clear a reconciliation conflict while the linked email still differs", () => {
    expect(hasNotionIdentityConflict("member@example.com", "changed@example.com")).toBe(true);
    expect(hasNotionIdentityConflict(" MEMBER@EXAMPLE.COM ", "member@example.com")).toBe(false);
    expect(resolveProfileSubmissionStatus("conflict", true)).toBeNull();
  });
});