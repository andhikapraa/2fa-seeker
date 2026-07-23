import "./slow.css";

import { SecretInputError, parseBase32Secret } from "./shared/input";
import {
  DEFAULT_TOTP_PARAMETERS,
  generateTotp,
  prepareTotpSecret,
  type PreparedTotpSecret,
  type TotpResult,
} from "./shared/totp";

interface SlowGeneration {
  revision: number;
  prepared: PreparedTotpSecret;
  result: TotpResult;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error("Low-network shell is incomplete.");
  return element;
}

const form = requireElement<HTMLFormElement>("#slow-form");
const secretInput = requireElement<HTMLInputElement>("#slow-secret");
const toggleButton = requireElement<HTMLButtonElement>("#slow-toggle");
const clearButton = requireElement<HTMLButtonElement>("#slow-clear");
const errorMessage = requireElement<HTMLElement>("#slow-error");
const lengthWarning = requireElement<HTMLElement>("#slow-length-warning");
const emptyResult = requireElement<HTMLElement>("#slow-empty");
const validResult = requireElement<HTMLElement>("#slow-valid");
const codeOutput = requireElement<HTMLOutputElement>("#slow-code");
const timerText = requireElement<HTMLElement>("#slow-timer");
const copyButton = requireElement<HTMLButtonElement>("#slow-copy");
const copyFeedback = requireElement<HTMLElement>("#slow-copy-feedback");
const statusRegion = requireElement<HTMLElement>("#slow-status");

let revision = 0;
let timerId: number | null = null;
let active: SlowGeneration | null = null;

function announce(message: string): void {
  statusRegion.textContent = "";
  window.setTimeout(() => {
    statusRegion.textContent = message;
  }, 0);
}

function clearTimer(): void {
  if (timerId !== null) window.clearTimeout(timerId);
  timerId = null;
}

function setError(message: string | null): void {
  errorMessage.hidden = message === null;
  errorMessage.textContent = message ?? "";
  secretInput.setAttribute("aria-invalid", String(message !== null));
}

function resetResult(): number {
  revision += 1;
  clearTimer();
  active = null;
  emptyResult.hidden = false;
  validResult.hidden = true;
  codeOutput.textContent = "";
  timerText.textContent = "";
  copyButton.disabled = true;
  copyFeedback.hidden = true;
  copyFeedback.textContent = "";
  lengthWarning.hidden = true;
  return revision;
}

function scheduleNextUpdate(generation: SlowGeneration, sampledAtMs: number): void {
  clearTimer();
  const delay = 1000 - (sampledAtMs % 1000) + 10;
  timerId = window.setTimeout(() => {
    if (active !== generation || revision !== generation.revision) return;
    updateCode(generation, Date.now(), true);
  }, delay);
}

function updateCode(
  generation: SlowGeneration,
  sampledAtMs: number,
  announceRollover: boolean,
  preparedResult?: TotpResult,
): TotpResult | null {
  if (active !== generation || revision !== generation.revision) return null;
  const previousCounter = generation.result.counter;
  const result =
    preparedResult ?? generateTotp(generation.prepared, DEFAULT_TOTP_PARAMETERS, sampledAtMs);
  if (active !== generation || revision !== generation.revision) return null;

  generation.result = result;
  codeOutput.textContent = `${result.code.slice(0, 3)} ${result.code.slice(3)}`;
  timerText.textContent = `Valid for ${result.secondsRemaining} ${result.secondsRemaining === 1 ? "second" : "seconds"}`;
  emptyResult.hidden = true;
  validResult.hidden = false;
  copyButton.disabled = false;
  scheduleNextUpdate(generation, sampledAtMs);

  if (announceRollover && previousCounter !== result.counter) {
    announce("Code updated for a new time window.");
  }
  return result;
}

function generateFromInput(): void {
  const currentRevision = resetResult();
  setError(null);

  try {
    const parsed = parseBase32Secret(secretInput.value, { allowSpaces: true });
    lengthWarning.hidden = !parsed.isBelowRecommendedLength;
    const prepared = prepareTotpSecret(parsed.bytes);
    const sampledAtMs = Date.now();
    const initial = generateTotp(prepared, DEFAULT_TOTP_PARAMETERS, sampledAtMs);
    const generation: SlowGeneration = {
      revision: currentRevision,
      prepared,
      result: initial,
    };
    active = generation;
    updateCode(generation, sampledAtMs, false, initial);
  } catch (error) {
    if (!(error instanceof SecretInputError)) throw error;
    const message =
      error.code === "empty"
        ? "Enter a Base32 secret."
        : error.code === "too_long"
          ? "The secret is too long."
          : "Use A-Z and 2-7 only; spaces between groups are allowed.";
    setError(message);
    announce(message);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  generateFromInput();
});

secretInput.addEventListener("input", () => {
  resetResult();
  setError(null);
});

toggleButton.addEventListener("click", () => {
  const show = secretInput.type === "password";
  secretInput.type = show ? "text" : "password";
  toggleButton.textContent = show ? "Hide secret" : "Show secret";
  toggleButton.setAttribute("aria-pressed", String(show));
  secretInput.focus({ preventScroll: true });
});

clearButton.addEventListener("click", () => {
  resetResult();
  secretInput.value = "";
  secretInput.type = "password";
  toggleButton.textContent = "Show secret";
  toggleButton.setAttribute("aria-pressed", "false");
  setError(null);
  secretInput.focus();
  announce("Secret and code cleared from this page.");
});

copyButton.addEventListener("click", () => {
  const generation = active;
  if (generation === null || revision !== generation.revision) return;
  const result = updateCode(generation, Date.now(), false);
  if (result === null) return;

  const write = navigator.clipboard?.writeText(result.code);
  if (write === undefined) {
    copyFeedback.hidden = false;
    copyFeedback.textContent = "Copy failed. Select the code and copy it manually.";
    announce(copyFeedback.textContent);
    return;
  }

  void write.then(
    () => {
      if (active !== generation || revision !== generation.revision) return;
      copyFeedback.hidden = false;
      copyFeedback.textContent = `Code copied. ${result.secondsRemaining} ${result.secondsRemaining === 1 ? "second" : "seconds"} remaining.`;
      announce(copyFeedback.textContent);
    },
    () => {
      if (active !== generation || revision !== generation.revision) return;
      copyFeedback.hidden = false;
      copyFeedback.textContent = "Copy failed. Select the code and copy it manually.";
      announce(copyFeedback.textContent);
    },
  );
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && active !== null) {
    updateCode(active, Date.now(), true);
  }
});

window.addEventListener("pageshow", () => {
  if (active !== null) updateCode(active, Date.now(), true);
});

resetResult();
