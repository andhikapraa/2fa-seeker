import { HOTP, Secret, TOTP } from "otpauth/slim";

export type TotpAlgorithm = "SHA1" | "SHA256" | "SHA512";
export type TotpDigits = 6 | 8;

export interface TotpParameters {
  algorithm: TotpAlgorithm;
  digits: TotpDigits;
  period: number;
}

export interface TotpParameterInput {
  algorithm?: unknown;
  digits?: unknown;
  period?: unknown;
}

export interface PreparedTotpSecret {
  readonly byteLength: number;
  readonly secret: Secret;
}

export interface TotpResult extends TotpParameters {
  code: string;
  counter: number;
  generatedAt: string;
  validUntil: string;
  secondsRemaining: number;
  progress: number;
}

export const DEFAULT_TOTP_PARAMETERS: Readonly<TotpParameters> = Object.freeze({
  algorithm: "SHA1",
  digits: 6,
  period: 30,
});

export const MAX_TOTP_PERIOD = 3600;

export class TotpParameterError extends Error {
  constructor() {
    super("invalid_totp_parameters");
    this.name = "TotpParameterError";
  }
}

function parseAlgorithm(value: unknown): TotpAlgorithm {
  if (value === undefined) return DEFAULT_TOTP_PARAMETERS.algorithm;
  if (typeof value !== "string") throw new TotpParameterError();

  const normalized = value.toUpperCase().replaceAll("-", "");
  if (normalized === "SHA1" || normalized === "SHA256" || normalized === "SHA512") {
    return normalized;
  }
  throw new TotpParameterError();
}

function parseDigits(value: unknown): TotpDigits {
  if (value === undefined) return DEFAULT_TOTP_PARAMETERS.digits;
  if (value === 6 || value === 8) return value;
  throw new TotpParameterError();
}

function parsePeriod(value: unknown): number {
  if (value === undefined) return DEFAULT_TOTP_PARAMETERS.period;
  if (!Number.isInteger(value) || typeof value !== "number" || value < 1 || value > MAX_TOTP_PERIOD) {
    throw new TotpParameterError();
  }
  return value;
}

export function validateTotpParameters(input: TotpParameterInput = {}): TotpParameters {
  return {
    algorithm: parseAlgorithm(input.algorithm),
    digits: parseDigits(input.digits),
    period: parsePeriod(input.period),
  };
}

export function prepareTotpSecret(bytes: Uint8Array): PreparedTotpSecret {
  if (bytes.byteLength === 0) throw new TypeError("Secret bytes must not be empty");

  const buffer =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? bytes.buffer
      : bytes.slice().buffer;

  return {
    byteLength: bytes.byteLength,
    secret: new Secret({ buffer }),
  };
}

function assertCounter(counter: number): void {
  if (!Number.isSafeInteger(counter) || counter < 0) {
    throw new RangeError("Counter must be a non-negative safe integer");
  }
}

export function generateHotp(
  prepared: PreparedTotpSecret,
  counter: number,
  algorithm: TotpAlgorithm = "SHA1",
  digits: TotpDigits = 6,
): string {
  assertCounter(counter);
  return HOTP.generate({
    secret: prepared.secret,
    algorithm,
    digits,
    counter,
  });
}

function formatIsoSeconds(timestampMs: number): string {
  return new Date(Math.floor(timestampMs / 1000) * 1000).toISOString().replace(".000Z", "Z");
}

export function generateTotp(
  prepared: PreparedTotpSecret,
  parameters: TotpParameters,
  timestampMs: number,
): TotpResult {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) {
    throw new RangeError("Timestamp must be a non-negative finite number");
  }

  const counter = Math.floor(timestampMs / 1000 / parameters.period);
  assertCounter(counter);

  const validUntilMs = (counter + 1) * parameters.period * 1000;
  const remainingMs = validUntilMs - timestampMs;

  return {
    code: TOTP.generate({
      secret: prepared.secret,
      algorithm: parameters.algorithm,
      digits: parameters.digits,
      period: parameters.period,
      timestamp: timestampMs,
    }),
    ...parameters,
    counter,
    generatedAt: formatIsoSeconds(timestampMs),
    validUntil: formatIsoSeconds(validUntilMs),
    secondsRemaining: Math.ceil(remainingMs / 1000),
    progress: Math.max(0, Math.min(1, remainingMs / (parameters.period * 1000))),
  };
}

export function formatAlgorithm(algorithm: TotpAlgorithm): string {
  return algorithm.replace("SHA", "SHA-");
}
