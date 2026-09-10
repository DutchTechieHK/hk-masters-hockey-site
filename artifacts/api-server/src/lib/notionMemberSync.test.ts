import { describe, expect, it } from "vitest";
import {
  isValidNotionApplicant,
  isNotionSnapshotCurrent,
  isNotionProfileConflictResolved,
  hasNotionIdentityConflict,
  getNotionMemberConflicts,
  notionApplicantStorageData,
  markNotionProfileConflictResolved,
  pageToNotionApplicant,
  resolveNotionMemberProfile,
  resolveNotionMemberSyncProfile,
  resolveProfileSubmissionStatus,
  shouldSyncUnchangedNotionProfile,
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
      "Membership Section": { id: "section", type: "select", select: { id: "women", name: "Women" } },
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
      membershipSection: "women",
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
    expect(shouldApplyImportedTier("notion_join", "social_player")).toBe(false);
    expect(shouldApplyImportedTier("notion_join", "masters_division_one")).toBe(false);
    expect(shouldApplyImportedTier("notion_join", "awaiting_selection")).toBe(true);
    expect(shouldApplyImportedTier("manual_import", "social_player")).toBe(true);
  });

  it("only applies an explicit valid Notion membership section", () => {
    expect(resolveNotionMemberProfile(
      {
        consent: true,
        dateOfBirth: null,
        position: null,
        membershipSection: "women",
      },
      {
        dateOfBirth: null,
        position: null,
        currentMembershipSection: "not_set",
      },
      false,
    )).toEqual({
      updates: { currentMembershipSection: "women" },
      conflict: false,
    });
    const withoutSection = pageToNotionApplicant(pageFixture({
      properties: {
        ...pageFixture().properties,
        "Membership Section": undefined,
      },
    }));
    expect(withoutSection?.membershipSection).toBeNull();
  });

  it("maps the live Notion Category values to membership sections", () => {
    const baseProperties = pageFixture().properties;
    const withoutDedicatedSection = {
      ...baseProperties,
      "Membership Section": undefined,
    };
    const men = pageToNotionApplicant(pageFixture({
      properties: {
        ...withoutDedicatedSection,
        Category: { id: "category", type: "select", select: { id: "mens", name: "Mens Masters" } },
      },
    }));
    const women = pageToNotionApplicant(pageFixture({
      properties: {
        ...withoutDedicatedSection,
        Category: { id: "category", type: "select", select: { id: "ladies", name: "Ladies Masters" } },
      },
    }));

    expect(men?.membershipSection).toBe("men");
    expect(women?.membershipSection).toBe("women");
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

  it("updates a changed Notion-created profile without sending it to reconciliation", () => {
    expect(resolveNotionMemberSyncProfile(
      {
        consent: true,
        email: "member@example.com",
        dateOfBirth: "1984-06-12",
        position: "Forward, Midfield",
      },
      {
        email: "member@example.com",
        dateOfBirth: "1985-07-13",
        position: "Defender",
      },
      true,
    )).toEqual({
      updates: {
        dateOfBirth: "1984-06-12",
        position: "Forward, Midfield",
      },
      conflict: false,
    });
  });

  it("backfills an unchanged matched profile once, then becomes idempotent", () => {
    const applicant = {
      consent: true,
      email: "member@example.com",
      dateOfBirth: "1984-06-12",
      position: "Forward, Midfield",
    };
    const submission = { matchStatus: "matched", matchedPlayerId: 42 };

    expect(shouldSyncUnchangedNotionProfile(submission, true)).toBe(true);

    const firstPass = resolveNotionMemberSyncProfile(
      applicant,
      { email: "member@example.com", dateOfBirth: null, position: null },
      true,
    );
    expect(firstPass).toEqual({
      updates: { dateOfBirth: "1984-06-12", position: "Forward, Midfield" },
      conflict: false,
    });

    const secondPass = resolveNotionMemberSyncProfile(
      applicant,
      {
        email: "member@example.com",
        dateOfBirth: firstPass.updates.dateOfBirth ?? null,
        position: firstPass.updates.position ?? null,
      },
      true,
    );
    expect(secondPass).toEqual({ updates: {}, conflict: false });
    expect(resolveProfileSubmissionStatus(submission.matchStatus, secondPass.conflict)).toBeNull();
  });

  it("keeps dismissed unchanged submissions out of profile synchronization", () => {
    expect(shouldSyncUnchangedNotionProfile(
      { matchStatus: "dismissed", matchedPlayerId: 42 },
      true,
    )).toBe(false);
  });

  it("keeps an accepted conflict resolved until the Notion page changes", () => {
    const sourceUpdatedAt = new Date("2026-09-02T10:00:00.000Z");
    const marked = markNotionProfileConflictResolved(
      { "Position(s)": ["Forward"] },
      sourceUpdatedAt,
    );

    expect(isNotionProfileConflictResolved(marked, sourceUpdatedAt)).toBe(true);
    expect(isNotionProfileConflictResolved(
      marked,
      new Date("2026-09-03T10:00:00.000Z"),
    )).toBe(false);
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

  it("explains identity and profile conflicts with both values", () => {
    expect(getNotionMemberConflicts(
      {
        consent: true,
        email: "submitted@example.com",
        dateOfBirth: "1984-06-12",
        position: "Forward",
      },
      {
        email: "existing@example.com",
        dateOfBirth: "1985-07-13",
        position: "Goalkeeper",
      },
    )).toEqual([
      {
        field: "email",
        kind: "identity",
        existingValue: "existing@example.com",
        submittedValue: "submitted@example.com",
      },
      {
        field: "dateOfBirth",
        kind: "profile",
        existingValue: "1985-07-13",
        submittedValue: "1984-06-12",
      },
      {
        field: "position",
        kind: "profile",
        existingValue: "Goalkeeper",
        submittedValue: "Forward",
      },
    ]);
  });

  it("does not expose conflict values when consent was not granted", () => {
    expect(getNotionMemberConflicts(
      { consent: false, email: "private@example.com", dateOfBirth: "1984-06-12", position: "Forward" },
      { email: "existing@example.com", dateOfBirth: "1985-07-13", position: "Goalkeeper" },
    )).toEqual([]);
  });
});