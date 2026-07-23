import { describe, expect, it } from "vitest";

import {
  TotpParameterError,
  generateTotp,
  prepareTotpSecret,
  validateTotpParameters,
  type TotpAlgorithm,
} from "../src/shared/totp";

const RFC_SECRETS: Record<TotpAlgorithm, string> = {
  SHA1: "12345678901234567890",
  SHA256: "12345678901234567890123456789012",
  SHA512: "1234567890123456789012345678901234567890123456789012345678901234",
};

const RFC_6238_VECTORS = [
  [59, "94287082", "46119246", "90693936"],
  [1_111_111_109, "07081804", "68084774", "25091201"],
  [1_111_111_111, "14050471", "67062674", "99943326"],
  [1_234_567_890, "89005924", "91819424", "93441116"],
  [2_000_000_000, "69279037", "90698825", "38618901"],
  [20_000_000_000, "65353130", "77737706", "47863826"],
] as const;

const ALGORITHMS: TotpAlgorithm[] = ["SHA1", "SHA256", "SHA512"];

describe("RFC 6238 TOTP", () => {
  for (const vector of RFC_6238_VECTORS) {
    const timestamp = vector[0];
    for (const [algorithmIndex, algorithm] of ALGORITHMS.entries()) {
      const expected = vector[algorithmIndex + 1];
      it(`${algorithm} matches timestamp ${timestamp}`, () => {
        const prepared = prepareTotpSecret(new TextEncoder().encode(RFC_SECRETS[algorithm]));
        const result = generateTotp(
          prepared,
          { algorithm, digits: 8, period: 30 },
          timestamp * 1000,
        );
        expect(result.code).toBe(expected);
        expect(result.code).toHaveLength(8);
      });
    }
  }

  it("preserves leading zeroes", () => {
    const prepared = prepareTotpSecret(new TextEncoder().encode(RFC_SECRETS.SHA1));
    expect(generateTotp(prepared, { algorithm: "SHA1", digits: 8, period: 30 }, 1_111_111_109_000).code).toBe(
      "07081804",
    );
  });

  it("supports six and eight digits with consistent metadata", () => {
    const prepared = prepareTotpSecret(new TextEncoder().encode(RFC_SECRETS.SHA1));
    const six = generateTotp(prepared, { algorithm: "SHA1", digits: 6, period: 30 }, 59_250);
    const eight = generateTotp(prepared, { algorithm: "SHA1", digits: 8, period: 30 }, 59_250);

    expect(six.code).toHaveLength(6);
    expect(eight.code).toBe("94287082");
    expect(six.generatedAt).toBe("1970-01-01T00:00:59Z");
    expect(six.validUntil).toBe("1970-01-01T00:01:00Z");
    expect(six.secondsRemaining).toBe(1);
  });

  it("normalizes allowed algorithms and rejects invalid parameters", () => {
    expect(validateTotpParameters({ algorithm: "sha-512", digits: 8, period: 60 })).toEqual({
      algorithm: "SHA512",
      digits: 8,
      period: 60,
    });

    for (const invalid of [
      { algorithm: "MD5" },
      { digits: 7 },
      { period: 0 },
      { period: 3601 },
      { period: 1.5 },
    ]) {
      expect(() => validateTotpParameters(invalid)).toThrow(TotpParameterError);
    }
  });
});
