import { describe, expect, it } from "vitest";

import {
  MAX_SECRET_INPUT_LENGTH,
  SecretInputError,
  decodeBase32,
  parseBase32Secret,
} from "../src/shared/input";

const RFC_4648_VECTORS = [
  ["", ""],
  ["f", "MY======"],
  ["fo", "MZXQ===="],
  ["foo", "MZXW6==="],
  ["foob", "MZXW6YQ="],
  ["fooba", "MZXW6YTB"],
  ["foobar", "MZXW6YTBOI======"],
] as const;

describe("RFC 4648 Base32", () => {
  it.each(RFC_4648_VECTORS)("decodes %s", (plain, encoded) => {
    expect(new TextDecoder().decode(decodeBase32(encoded))).toBe(plain);
  });

  it("accepts lowercase and optional omitted padding", () => {
    expect(new TextDecoder().decode(decodeBase32("mzxw6ytboi"))).toBe("foobar");
  });

  it("allows only ASCII spaces in the browser normalization mode", () => {
    expect(new TextDecoder().decode(decodeBase32("MZ XW6YTB OI======", { allowSpaces: true }))).toBe(
      "foobar",
    );
    expect(() => decodeBase32("MZ XW6YTB OI======")).toThrow(SecretInputError);
    expect(() => decodeBase32("MZ\tXW6YTBOI======", { allowSpaces: true })).toThrow(
      SecretInputError,
    );
  });

  it.each(["M0======", "MY=AAAAA", "A", "AAA", "AAAAAA"])(
    "rejects malformed input %s",
    (encoded) => {
      expect(() => decodeBase32(encoded)).toThrow(SecretInputError);
    },
  );

  it.each(["MZ======", "MZ", "MZXR====", "MZXR"])(
    "rejects nonzero unused pad bits in %s",
    (encoded) => {
      expect(() => decodeBase32(encoded)).toThrow(SecretInputError);
    },
  );

  it("rejects oversized input before decoding", () => {
    expect(() => parseBase32Secret("A".repeat(MAX_SECRET_INPUT_LENGTH + 1))).toThrowError(
      expect.objectContaining({ code: "too_long" }),
    );
  });

  it("reports secrets below 128 bits without rejecting them", () => {
    const parsed = parseBase32Secret("MY======");
    expect(parsed.bytes).toEqual(new Uint8Array([102]));
    expect(parsed.isBelowRecommendedLength).toBe(true);
  });
});
