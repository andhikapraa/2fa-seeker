export const MAX_SECRET_INPUT_LENGTH = 1024;
export const MAX_REQUEST_BODY_BYTES = 4096;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const VALID_UNPADDED_REMAINDERS = new Set([0, 2, 4, 5, 7]);
const EXPECTED_PADDING = new Map([
  [0, 0],
  [2, 6],
  [4, 4],
  [5, 3],
  [7, 1],
]);

export type SecretInputErrorCode = "empty" | "too_long" | "invalid_base32";

export class SecretInputError extends Error {
  readonly code: SecretInputErrorCode;

  constructor(code: SecretInputErrorCode) {
    super(code);
    this.name = "SecretInputError";
    this.code = code;
  }
}

export interface DecodeBase32Options {
  allowSpaces?: boolean;
  maxLength?: number;
}

export interface ParsedSecret {
  bytes: Uint8Array;
  isBelowRecommendedLength: boolean;
}

function invalidBase32(): never {
  throw new SecretInputError("invalid_base32");
}

export function decodeBase32(
  value: string,
  options: DecodeBase32Options = {},
): Uint8Array {
  const maxLength = options.maxLength ?? MAX_SECRET_INPUT_LENGTH;
  if (value.length > maxLength) {
    throw new SecretInputError("too_long");
  }

  const normalized = (options.allowSpaces ? value.replaceAll(" ", "") : value).toUpperCase();
  if (normalized.length === 0) return new Uint8Array();

  const paddingIndex = normalized.indexOf("=");
  const data = paddingIndex === -1 ? normalized : normalized.slice(0, paddingIndex);
  const padding = paddingIndex === -1 ? "" : normalized.slice(paddingIndex);

  if (data.length === 0 || !/^[A-Z2-7]+$/.test(data)) invalidBase32();
  if (padding.length > 0 && !/^=+$/.test(padding)) invalidBase32();

  const remainder = data.length % 8;
  if (!VALID_UNPADDED_REMAINDERS.has(remainder)) invalidBase32();

  if (padding.length > 0) {
    const expectedPadding = EXPECTED_PADDING.get(remainder);
    if (
      expectedPadding === undefined ||
      padding.length !== expectedPadding ||
      normalized.length % 8 !== 0
    ) {
      invalidBase32();
    }
  }

  const unusedBits = (data.length * 5) % 8;
  if (unusedBits > 0) {
    const finalValue = BASE32_ALPHABET.indexOf(data[data.length - 1] ?? "");
    const unusedMask = (1 << unusedBits) - 1;
    if ((finalValue & unusedMask) !== 0) invalidBase32();
  }

  const output = new Uint8Array(Math.floor((data.length * 5) / 8));
  let accumulator = 0;
  let availableBits = 0;
  let outputIndex = 0;

  for (const character of data) {
    const valueIndex = BASE32_ALPHABET.indexOf(character);
    if (valueIndex < 0) invalidBase32();

    accumulator = (accumulator << 5) | valueIndex;
    availableBits += 5;

    while (availableBits >= 8) {
      availableBits -= 8;
      output[outputIndex] = (accumulator >>> availableBits) & 0xff;
      outputIndex += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }

  return output;
}

export function parseBase32Secret(
  value: string,
  options: DecodeBase32Options = {},
): ParsedSecret {
  if (value.length === 0) throw new SecretInputError("empty");
  const bytes = decodeBase32(value, options);
  if (bytes.length === 0) throw new SecretInputError("empty");

  return {
    bytes,
    isBelowRecommendedLength: bytes.length < 16,
  };
}
