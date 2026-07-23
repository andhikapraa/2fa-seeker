import "./style.css";

import {
  MAX_SECRET_INPUT_LENGTH,
  SecretInputError,
  parseBase32Secret,
} from "./shared/input";
import {
  TotpParameterError,
  formatAlgorithm,
  generateTotp,
  prepareTotpSecret,
  validateTotpParameters,
  type PreparedTotpSecret,
  type TotpParameters,
  type TotpResult,
} from "./shared/totp";

declare global {
  interface Window {
    __TOTP_PATH__?: string | null;
    __TOTP_SLOW_TIMER__?: number;
  }
}

const slowFallbackTimer = window.__TOTP_SLOW_TIMER__;
if (slowFallbackTimer !== undefined) {
  window.clearTimeout(slowFallbackTimer);
  delete window.__TOTP_SLOW_TIMER__;
}

interface ActiveGeneration {
  revision: number;
  prepared: PreparedTotpSecret;
  parameters: TotpParameters;
  result: TotpResult | null;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error("Application shell is incomplete.");
  return element;
}

const instrument = requireElement<HTMLElement>(".instrument");
const form = requireElement<HTMLFormElement>("#totp-form");
const secretInput = requireElement<HTMLInputElement>("#secret-input");
const toggleSecretButton = requireElement<HTMLButtonElement>("#toggle-secret");
const clearSecretButton = requireElement<HTMLButtonElement>("#clear-secret");
const secretError = requireElement<HTMLElement>("#secret-error");
const secretLengthWarning = requireElement<HTMLElement>("#secret-length-warning");
const algorithmInput = requireElement<HTMLSelectElement>("#algorithm-input");
const digitsInput = requireElement<HTMLSelectElement>("#digits-input");
const periodInput = requireElement<HTMLInputElement>("#period-input");
const settingsError = requireElement<HTMLElement>("#settings-error");
const resultMetadata = requireElement<HTMLElement>("#result-metadata");
const resultEmpty = requireElement<HTMLElement>("#result-empty");
const resultComputing = requireElement<HTMLElement>("#result-computing");
const resultValid = requireElement<HTMLElement>("#result-valid");
const codeAccessible = requireElement<HTMLElement>("#code-accessible");
const codeGroupOne = requireElement<HTMLElement>("#code-group-one");
const codeGroupTwo = requireElement<HTMLElement>("#code-group-two");
const timerText = requireElement<HTMLElement>("#timer-text");
const timerBar = requireElement<HTMLProgressElement>("#timer-bar");
const copyCodeButton = requireElement<HTMLButtonElement>("#copy-code");
const copyFeedback = requireElement<HTMLElement>("#copy-feedback");
const clockNote = requireElement<HTMLElement>("#clock-note");
const statusRegion = requireElement<HTMLElement>("#status-region");

let revision = 0;
let activeGeneration: ActiveGeneration | null = null;
let timerId: number | null = null;
let copyResetId: number | null = null;
let announceNextInput = false;
let rootReplacementPaste = false;
let urlDerived = document.documentElement.classList.contains("has-path-secret");

function announce(message: string): void {
  statusRegion.textContent = "";
  window.setTimeout(() => {
    statusRegion.textContent = message;
  }, 0);
}

function setUrlDerived(value: boolean): void {
  urlDerived = value;
  document.documentElement.classList.toggle("has-path-secret", value);
}

function setSecretError(message: string | null): void {
  secretError.hidden = message === null;
  secretError.textContent = message ?? "";
  secretInput.setAttribute("aria-invalid", String(message !== null));
}

function setSettingsError(message: string | null): void {
  settingsError.hidden = message === null;
  settingsError.textContent = message ?? "";
  periodInput.setAttribute("aria-invalid", String(message !== null));
}

function setCopyFeedback(message: string | null, failed = false): void {
  copyFeedback.hidden = message === null;
  copyFeedback.textContent = message ?? "";
  copyFeedback.classList.toggle("is-error", failed);
}

function clearScheduledWork(): void {
  if (timerId !== null) window.clearTimeout(timerId);
  if (copyResetId !== null) window.clearTimeout(copyResetId);
  timerId = null;
  copyResetId = null;
}

function renderNoResult(): void {
  instrument.classList.remove("is-valid", "is-computing");
  resultEmpty.hidden = false;
  resultComputing.hidden = true;
  resultValid.hidden = true;
  resultMetadata.hidden = true;
  clockNote.hidden = true;
  copyCodeButton.disabled = true;
  copyCodeButton.textContent = "Copy code";
  codeAccessible.textContent = "";
  codeGroupOne.textContent = "";
  codeGroupTwo.textContent = "";
  timerText.textContent = "";
  timerBar.value = 0;
  setCopyFeedback(null);
}

function renderComputing(parameters: TotpParameters): void {
  instrument.classList.remove("is-valid");
  instrument.classList.add("is-computing");
  resultEmpty.hidden = true;
  resultComputing.hidden = false;
  resultValid.hidden = true;
  resultMetadata.hidden = false;
  resultMetadata.textContent = `${formatAlgorithm(parameters.algorithm)} · ${parameters.digits} digits · ${parameters.period} seconds`;
  clockNote.hidden = true;
  copyCodeButton.disabled = true;
}

function renderValidResult(result: TotpResult): void {
  instrument.classList.remove("is-computing");
  instrument.classList.add("is-valid");
  const splitAt = result.digits === 6 ? 3 : 4;
  resultEmpty.hidden = true;
  resultComputing.hidden = true;
  resultValid.hidden = false;
  resultMetadata.hidden = false;
  resultMetadata.textContent = `${formatAlgorithm(result.algorithm)} · ${result.digits} digits · ${result.period} seconds`;
  codeAccessible.textContent = result.code;
  codeGroupOne.textContent = result.code.slice(0, splitAt);
  codeGroupTwo.textContent = result.code.slice(splitAt);
  timerText.textContent = `Valid for ${result.secondsRemaining} ${result.secondsRemaining === 1 ? "second" : "seconds"}`;
  timerBar.value = result.progress;
  copyCodeButton.disabled = false;
  clockNote.hidden = false;
}

function invalidateGeneration(): number {
  revision += 1;
  clearScheduledWork();
  activeGeneration = null;
  secretLengthWarning.hidden = true;
  renderNoResult();
  return revision;
}

function secretErrorMessage(error: SecretInputError): string {
  if (error.code === "empty") return "Enter a Base32 secret.";
  if (error.code === "too_long") return "The secret is too long.";
  return "Use A-Z and 2-7 only; spaces between groups are allowed.";
}

function currentParameters(): TotpParameters | null {
  try {
    const parameters = validateTotpParameters({
      algorithm: algorithmInput.value,
      digits: Number(digitsInput.value),
      period: periodInput.valueAsNumber,
    });
    setSettingsError(null);
    return parameters;
  } catch (error) {
    if (!(error instanceof TotpParameterError)) throw error;
    setSettingsError(
      "Choose SHA-1, SHA-256, or SHA-512; 6 or 8 digits; and a period from 1 to 3600 seconds.",
    );
    return null;
  }
}

function scheduleNextUpdate(active: ActiveGeneration, sampledAtMs: number): void {
  if (timerId !== null) window.clearTimeout(timerId);
  const delay = 1000 - (sampledAtMs % 1000) + 10;
  timerId = window.setTimeout(() => {
    if (activeGeneration !== active || revision !== active.revision) return;
    updateActiveGeneration(active, Date.now(), true);
  }, delay);
}

function updateActiveGeneration(
  active: ActiveGeneration,
  sampledAtMs: number,
  announceRollover: boolean,
): TotpResult | null {
  if (activeGeneration !== active || revision !== active.revision) return null;

  const previousCounter = active.result?.counter;
  const result = generateTotp(active.prepared, active.parameters, sampledAtMs);
  if (activeGeneration !== active || revision !== active.revision) return null;

  active.result = result;
  renderValidResult(result);
  scheduleNextUpdate(active, sampledAtMs);

  if (announceRollover && previousCounter !== undefined && previousCounter !== result.counter) {
    setCopyFeedback(null);
    announce("Code updated for a new time window.");
  }

  return result;
}

function beginGeneration(announceError: boolean): void {
  const currentRevision = invalidateGeneration();
  setSecretError(null);

  const parameters = currentParameters();
  if (parameters === null) return;

  let parsedSecret;
  try {
    parsedSecret = parseBase32Secret(secretInput.value, { allowSpaces: !urlDerived });
  } catch (error) {
    if (!(error instanceof SecretInputError)) throw error;
    if (announceError) {
      const message = secretErrorMessage(error);
      setSecretError(message);
      announce(message);
    }
    return;
  }

  secretLengthWarning.hidden = !parsedSecret.isBelowRecommendedLength;
  const active: ActiveGeneration = {
    revision: currentRevision,
    prepared: prepareTotpSecret(parsedSecret.bytes),
    parameters,
    result: null,
  };
  activeGeneration = active;
  renderComputing(parameters);

  queueMicrotask(() => {
    if (activeGeneration !== active || revision !== currentRevision) return;
    try {
      updateActiveGeneration(active, Date.now(), false);
    } catch {
      if (activeGeneration !== active || revision !== currentRevision) return;
      activeGeneration = null;
      renderNoResult();
      setSecretError("The code could not be generated.");
      announce("The code could not be generated.");
    }
  });
}

secretInput.addEventListener("paste", () => {
  announceNextInput = true;
  const selectionStart = secretInput.selectionStart;
  const selectionEnd = secretInput.selectionEnd;
  rootReplacementPaste =
    urlDerived && selectionStart === 0 && selectionEnd === secretInput.value.length;
});

secretInput.addEventListener("input", () => {
  if (rootReplacementPaste) setUrlDerived(false);
  rootReplacementPaste = false;
  const shouldAnnounce = announceNextInput;
  announceNextInput = false;
  beginGeneration(shouldAnnounce);
});

secretInput.addEventListener("blur", () => {
  if (activeGeneration === null) beginGeneration(true);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  beginGeneration(true);
});

for (const element of [algorithmInput, digitsInput, periodInput]) {
  element.addEventListener("input", () => {
    beginGeneration(true);
  });
}

toggleSecretButton.addEventListener("click", () => {
  const shouldShow = secretInput.type === "password";
  secretInput.type = shouldShow ? "text" : "password";
  toggleSecretButton.textContent = shouldShow ? "Hide secret" : "Show secret";
  toggleSecretButton.setAttribute("aria-pressed", String(shouldShow));
  secretInput.focus({ preventScroll: true });
});

clearSecretButton.addEventListener("click", () => {
  invalidateGeneration();
  secretInput.value = "";
  secretInput.type = "password";
  toggleSecretButton.textContent = "Show secret";
  toggleSecretButton.setAttribute("aria-pressed", "false");
  setSecretError(null);
  setUrlDerived(false);
  secretInput.focus();
  announce("Secret and code cleared from this page.");
});

copyCodeButton.addEventListener("click", () => {
  const active = activeGeneration;
  if (active === null || active.result === null || revision !== active.revision) return;

  const activeRevision = active.revision;
  let result: TotpResult | null;
  try {
    result = updateActiveGeneration(active, Date.now(), false);
  } catch {
    result = null;
  }
  if (result === null || activeGeneration !== active || revision !== activeRevision) return;

  const clipboardPromise = navigator.clipboard?.writeText(result.code);
  if (clipboardPromise === undefined) {
    setCopyFeedback("Copy failed. Select the code and copy it manually.", true);
    announce("Copy failed. Select the code and copy it manually.");
    return;
  }

  void clipboardPromise.then(
    () => {
      if (activeGeneration !== active || revision !== activeRevision) return;
      copyCodeButton.textContent = "Copied";
      const message = `Code copied. ${result.secondsRemaining} ${result.secondsRemaining === 1 ? "second" : "seconds"} remaining.`;
      setCopyFeedback(message);
      announce(message);
      copyResetId = window.setTimeout(() => {
        if (activeGeneration !== active || revision !== activeRevision) return;
        copyCodeButton.textContent = "Copy code";
        setCopyFeedback(null);
        copyResetId = null;
      }, 1600);
    },
    () => {
      if (activeGeneration !== active || revision !== activeRevision) return;
      copyCodeButton.textContent = "Copy code";
      setCopyFeedback("Copy failed. Select the code and copy it manually.", true);
      announce("Copy failed. Select the code and copy it manually.");
    },
  );
});

document.addEventListener("visibilitychange", () => {
  const active = activeGeneration;
  if (document.visibilityState === "visible" && active !== null) {
    updateActiveGeneration(active, Date.now(), true);
  }
});

window.addEventListener("pageshow", () => {
  const active = activeGeneration;
  if (active !== null) updateActiveGeneration(active, Date.now(), true);
});

const pathHandoff = window.__TOTP_PATH__;
delete window.__TOTP_PATH__;

renderNoResult();
setSettingsError(null);

if (pathHandoff !== null && pathHandoff !== undefined) {
  setUrlDerived(true);
  announce(
    "This secret came from the URL. The address bar is now cleared, but the URL request was already sent to the service.",
  );

  if (pathHandoff.length > MAX_SECRET_INPUT_LENGTH) {
    setSecretError("The secret is too long.");
  } else {
    try {
      const decodedPath = decodeURIComponent(pathHandoff);
      if (decodedPath.length > MAX_SECRET_INPUT_LENGTH) {
        setSecretError("The secret is too long.");
      } else {
        secretInput.value = decodedPath;
        beginGeneration(true);
      }
    } catch {
      setSecretError("Use A-Z and 2-7 only; spaces between groups are allowed.");
    }
  }
} else {
  setUrlDerived(false);
}
