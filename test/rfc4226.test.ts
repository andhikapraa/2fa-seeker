import { describe, expect, it } from "vitest";

import { generateHotp, prepareTotpSecret } from "../src/shared/totp";

const RFC_4226_SECRET = new TextEncoder().encode("12345678901234567890");
const RFC_4226_CODES = [
  "755224",
  "287082",
  "359152",
  "969429",
  "338314",
  "254676",
  "287922",
  "162583",
  "399871",
  "520489",
] as const;

describe("RFC 4226 HOTP", () => {
  const prepared = prepareTotpSecret(RFC_4226_SECRET);

  it.each(RFC_4226_CODES.map((code, counter) => [counter, code] as const))(
    "matches counter %i",
    (counter, code) => {
      expect(generateHotp(prepared, counter)).toBe(code);
    },
  );

  it("encodes counters beyond 32 bits as unsigned 8-byte big-endian values", () => {
    expect(generateHotp(prepared, 4_294_967_296)).toBe("999456");
    expect(generateHotp(prepared, 4_294_967_297)).toBe("108930");
  });
});
