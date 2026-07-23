import {
  MAX_REQUEST_BODY_BYTES,
  MAX_SECRET_INPUT_LENGTH,
  SecretInputError,
  parseBase32Secret,
} from "./shared/input";
import {
  REPRESENTATION_CONTENT_TYPES,
  negotiateRepresentation,
  type Representation,
} from "./shared/representations";
import { applySecurityHeaders, applyVaryAccept } from "./shared/security";
import {
  TotpParameterError,
  generateTotp,
  prepareTotpSecret,
  validateTotpParameters,
  type TotpParameterInput,
  type TotpResult,
} from "./shared/totp";

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

interface ApiRequestBody extends TotpParameterInput {
  secret: string;
}

interface TotpJsonResponse {
  code: string;
  algorithm: TotpResult["algorithm"];
  digits: TotpResult["digits"];
  period: number;
  generated_at: string;
  valid_until: string;
  seconds_remaining: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createHeaders(representation: Representation, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Content-Type", REPRESENTATION_CONTENT_TYPES[representation]);
  applyVaryAccept(headers);
  applySecurityHeaders(headers);
  return headers;
}

function totpJson(result: TotpResult): TotpJsonResponse {
  return {
    code: result.code,
    algorithm: result.algorithm,
    digits: result.digits,
    period: result.period,
    generated_at: result.generatedAt,
    valid_until: result.validUntil,
    seconds_remaining: result.secondsRemaining,
  };
}

function successResponse(
  result: TotpResult,
  representation: Exclude<Representation, "html">,
  head: boolean,
): Response {
  const body = representation === "json" ? JSON.stringify(totpJson(result)) : `${result.code}\n`;
  return new Response(head ? null : body, {
    status: 200,
    headers: createHeaders(representation),
  });
}

function errorResponse(
  status: number,
  message: string,
  representation: Exclude<Representation, "html">,
  extraHeaders?: HeadersInit,
  head = false,
): Response {
  const body = representation === "json" ? JSON.stringify({ error: message }) : `${message}\n`;
  return new Response(head ? null : body, {
    status,
    headers: createHeaders(representation, extraHeaders),
  });
}

function selectErrorRepresentation(acceptHeader: string | null): Exclude<Representation, "html"> {
  const negotiated = negotiateRepresentation(acceptHeader);
  return negotiated === "json" ? "json" : "plain";
}

async function htmlAssetResponse(
  request: Request,
  env: Env,
  assetPath: string,
  head: boolean,
): Promise<Response> {
  const rootUrl = new URL(assetPath, request.url);
  const assetRequest = new Request(rootUrl, {
    method: "GET",
    headers: { Accept: "text/html" },
  });
  const assetResponse = await env.ASSETS.fetch(assetRequest);
  const headers = new Headers(assetResponse.headers);
  headers.set("Content-Type", REPRESENTATION_CONTENT_TYPES.html);
  applyVaryAccept(headers);
  applySecurityHeaders(headers);

  return new Response(head ? null : assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
}

async function staticAssetResponse(request: Request, env: Env): Promise<Response> {
  const assetResponse = await env.ASSETS.fetch(request);
  const headers = new Headers(assetResponse.headers);
  applySecurityHeaders(headers);

  return new Response(request.method === "HEAD" ? null : assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
}

async function readLimitedBody(request: Request): Promise<string> {
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_REQUEST_BODY_BYTES) {
      throw new HttpError(413, "Request body is too large.");
    }
  }

  if (request.body === null) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value === undefined) continue;

    received += value.byteLength;
    if (received > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      throw new HttpError(413, "Request body is too large.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw new HttpError(400, "Request body must be valid UTF-8.");
  }
}

async function parseApiRequest(request: Request): Promise<ApiRequestBody> {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  const body = await readLimitedBody(request);

  if (contentType === "text/plain") {
    return { secret: body };
  }

  if (contentType === "application/json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new HttpError(400, "Request body must be valid JSON.");
    }

    if (!isRecord(parsed) || typeof parsed.secret !== "string") {
      throw new HttpError(400, "JSON body must include a string secret.");
    }

    return {
      secret: parsed.secret,
      algorithm: parsed.algorithm,
      digits: parsed.digits,
      period: parsed.period,
    };
  }

  throw new HttpError(415, "Content-Type must be text/plain or application/json.");
}

async function handleApiTotp(
  request: Request,
  acceptHeader: string | null,
  timestampMs: number,
): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse(
      405,
      "Method not allowed.",
      selectErrorRepresentation(acceptHeader),
      { Allow: "POST" },
    );
  }

  const representation = negotiateRepresentation(acceptHeader);
  if (representation === null) {
    return errorResponse(406, "Not acceptable.", "plain");
  }

  try {
    const body = await parseApiRequest(request);
    const parsedSecret = parseBase32Secret(body.secret);
    const parameters = validateTotpParameters(body);
    const result = generateTotp(prepareTotpSecret(parsedSecret.bytes), parameters, timestampMs);
    return successResponse(result, representation, false);
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error.status, error.message, representation);
    }
    if (error instanceof SecretInputError || error instanceof TotpParameterError) {
      return errorResponse(400, "Invalid Base32 secret or TOTP parameters.", representation);
    }
    return errorResponse(500, "Internal server error.", representation);
  }
}

function generateDefaultTotpFromPath(rawPathValue: string, timestampMs: number): TotpResult {
  if (rawPathValue.length > MAX_SECRET_INPUT_LENGTH) {
    throw new SecretInputError("too_long");
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPathValue);
  } catch {
    throw new SecretInputError("invalid_base32");
  }

  const parsedSecret = parseBase32Secret(decoded);
  const parameters = validateTotpParameters();
  return generateTotp(prepareTotpSecret(parsedSecret.bytes), parameters, timestampMs);
}

function minimalHtmlResponse(result: TotpResult, head: boolean): Response {
  return new Response(
    head
      ? null
      : `<meta http-equiv=refresh content=${result.secondsRemaining}><h1>${result.code}</h1>`,
    {
      status: 200,
      headers: createHeaders("html"),
    },
  );
}

function handleMinimalSecret(
  request: Request,
  rawPathValue: string,
  timestampMs: number,
): Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse(405, "Method not allowed.", "plain", { Allow: "GET, HEAD" });
  }

  try {
    return minimalHtmlResponse(
      generateDefaultTotpFromPath(rawPathValue, timestampMs),
      request.method === "HEAD",
    );
  } catch (error) {
    if (error instanceof SecretInputError) {
      return errorResponse(
        400,
        "Invalid Base32 secret.",
        "plain",
        undefined,
        request.method === "HEAD",
      );
    }
    return errorResponse(
      500,
      "Internal server error.",
      "plain",
      undefined,
      request.method === "HEAD",
    );
  }
}

async function handleDirectSecret(
  request: Request,
  env: Env,
  rawPathValue: string,
  acceptHeader: string | null,
  timestampMs: number,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse(
      405,
      "Method not allowed.",
      selectErrorRepresentation(acceptHeader),
      { Allow: "GET, HEAD" },
    );
  }

  const representation = negotiateRepresentation(acceptHeader, { allowHtml: true });
  if (representation === null) {
    return errorResponse(406, "Not acceptable.", "plain", undefined, request.method === "HEAD");
  }

  if (representation === "html") {
    return htmlAssetResponse(request, env, "/", request.method === "HEAD");
  }

  try {
    const result = generateDefaultTotpFromPath(rawPathValue, timestampMs);
    return successResponse(result, representation, request.method === "HEAD");
  } catch (error) {
    if (error instanceof SecretInputError) {
      return errorResponse(
        400,
        "Invalid Base32 secret.",
        representation,
        undefined,
        request.method === "HEAD",
      );
    }
    return errorResponse(
      500,
      "Internal server error.",
      representation,
      undefined,
      request.method === "HEAD",
    );
  }
}

export async function handleRequest(
  request: Request,
  env: Env,
  timestampMs = Date.now(),
): Promise<Response> {
  const url = new URL(request.url);
  const acceptHeader = request.headers.get("Accept");

  if (url.pathname === "/") {
    if (request.method === "GET" || request.method === "HEAD") {
      return htmlAssetResponse(request, env, "/", request.method === "HEAD");
    }
    return errorResponse(
      405,
      "Method not allowed.",
      selectErrorRepresentation(acceptHeader),
      { Allow: "GET, HEAD" },
    );
  }

  if (url.pathname === "/slow" || url.pathname === "/slow/") {
    if (request.method === "GET" || request.method === "HEAD") {
      return htmlAssetResponse(request, env, "/slow.html", request.method === "HEAD");
    }
    return errorResponse(
      405,
      "Method not allowed.",
      selectErrorRepresentation(acceptHeader),
      { Allow: "GET, HEAD" },
    );
  }

  if (url.pathname === "/1k" || url.pathname === "/1k/") {
    if (request.method === "GET" || request.method === "HEAD") {
      return htmlAssetResponse(request, env, "/1k.html", request.method === "HEAD");
    }
    return errorResponse(
      405,
      "Method not allowed.",
      selectErrorRepresentation(acceptHeader),
      { Allow: "GET, HEAD" },
    );
  }

  if (url.pathname.startsWith("/s/")) {
    const minimalPathValue = url.pathname.slice(3);
    if (!minimalPathValue.includes("/")) {
      return handleMinimalSecret(request, minimalPathValue, timestampMs);
    }
  }

  if (
    (request.method === "GET" || request.method === "HEAD") &&
    (url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/fonts/") ||
      url.pathname === "/robots.txt" ||
      url.pathname === "/site.webmanifest" ||
      url.pathname === "/favicon.ico")
  ) {
    return staticAssetResponse(request, env);
  }

  if (url.pathname === "/api/totp") {
    return handleApiTotp(request, acceptHeader, timestampMs);
  }

  const pathValue = url.pathname.slice(1);
  if (pathValue.length > 0 && !pathValue.includes("/")) {
    return handleDirectSecret(request, env, pathValue, acceptHeader, timestampMs);
  }

  return errorResponse(404, "Not found.", selectErrorRepresentation(acceptHeader));
}

