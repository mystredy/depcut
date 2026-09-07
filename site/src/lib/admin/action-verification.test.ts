import { describe, expect, test } from "bun:test";

import {
  createActionChallenge,
  generateActionCode,
  verifyActionChallenge,
} from "./action-verification";

const base = {
  action: "grant-super-user" as const,
  adminUserId: "admin1",
  targetUserId: "target1",
};

describe("action-verification", () => {
  test("accepts the right code for the right challenge", () => {
    const code = generateActionCode();
    const challenge = createActionChallenge({ ...base, code });
    expect(verifyActionChallenge({ ...base, challenge, code })).toBe(true);
  });

  test("rejects a wrong code", () => {
    const challenge = createActionChallenge({ ...base, code: "123456" });
    expect(verifyActionChallenge({ ...base, challenge, code: "654321" })).toBe(false);
  });

  test("rejects a tampered challenge", () => {
    const code = "123456";
    const challenge = createActionChallenge({ ...base, code });
    const tampered = `${challenge.split(".")[0]}.tampered-signature`;
    expect(verifyActionChallenge({ ...base, challenge: tampered, code })).toBe(false);
  });

  test("rejects a challenge issued for a different action", () => {
    const code = "123456";
    const challenge = createActionChallenge({ ...base, code });
    expect(
      verifyActionChallenge({ ...base, action: "revoke-super-user", challenge, code }),
    ).toBe(false);
  });

  test("rejects a challenge issued for a different admin or target", () => {
    const code = "123456";
    const challenge = createActionChallenge({ ...base, code });
    expect(
      verifyActionChallenge({ ...base, adminUserId: "someone-else", challenge, code }),
    ).toBe(false);
    expect(
      verifyActionChallenge({ ...base, targetUserId: "someone-else", challenge, code }),
    ).toBe(false);
  });

  test("generated codes are six digits", () => {
    for (let i = 0; i < 20; i++) {
      expect(/^\d{6}$/.test(generateActionCode())).toBe(true);
    }
  });
});
