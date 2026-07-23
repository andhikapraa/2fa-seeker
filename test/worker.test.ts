import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { MAX_REQUEST_BODY_BYTES } from "../src/shared/input";
import { handleRequest } from "../src/request-handler";

const RFC_BASE32_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const FIXED_TIMESTAMP_MS = 59_000;

function request(path: string, init?: RequestInit): Request {
  return new Request(`https://2fa.example.test${path}`, init);
}

async function dispatch(path: string, init?: RequestInit): Promise<Response> {
  return handleRequest(request(path, init), env, FIXED_TIMESTAMP_MS);
}

function expectSecretResponseHeaders(response: Response): void {
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive, nosnippet");
  expect(response.headers.get("Vary")).toContain("Accept");
  expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
}

describe("Worker route contract", () => {
  it("returns only code plus newline for the default direct GET", async () => {
    const response = await dispatch(`/${RFC_BASE32_SECRET}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe("287082\n");
    expectSecretResponseHeaders(response);
  });

  it("runs through the actual Worker entrypoint", async () => {
    const response = await SELF.fetch(`https://2fa.example.test/${RFC_BASE32_SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toMatch(/^\d{6}\n$/);
  });

  it("returns JSON with a string code and validity metadata", async () => {
    const response = await dispatch(`/${RFC_BASE32_SECRET}`, {
      headers: { Accept: "application/json" },
    });
    const body = await response.json<{
      code: string;
      algorithm: string;
      digits: number;
      period: number;
      generated_at: string;
      valid_until: string;
      seconds_remaining: number;
    }>();

    expect(body).toEqual({
      code: "287082",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      generated_at: "1970-01-01T00:00:59Z",
      valid_until: "1970-01-01T00:01:00Z",
      seconds_remaining: 1,
    });
    expect(typeof body.code).toBe("string");
    expectSecretResponseHeaders(response);
  });

  it("serves the static application shell for HTML negotiation without embedding the secret", async () => {
    const response = await dispatch(`/${RFC_BASE32_SECRET}`, {
      headers: { Accept: "text/html" },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(body).toContain("<h1><span>Generate a</span><span>TOTP code</span></h1>");
    expect(body).toContain('rel="icon" href="/icons/icon.svg"');
    expect(body).toContain('rel="manifest" href="/site.webmanifest"');
    expect(body).toContain('class="brand-icon" src="/icons/icon.svg"');
    expect(body).not.toContain(RFC_BASE32_SECRET);
    expectSecretResponseHeaders(response);
  });

  it("serves the favicon, web icons, and manifest", async () => {
    const assets = [
      ["/favicon.ico", "image/"],
      ["/icons/icon.svg", "image/svg+xml"],
      ["/icons/icon-192.png", "image/png"],
      ["/icons/icon-512.png", "image/png"],
      ["/icons/apple-touch-icon.png", "image/png"],
      ["/site.webmanifest", "application/manifest+json"],
    ] as const;

    for (const [path, contentType] of assets) {
      const response = await dispatch(path);
      expect(response.status, path).toBe(200);
      expect(response.headers.get("Content-Type"), path).toContain(contentType);
    }
  });

  it("serves the dedicated low-network shell", async () => {
    const response = await dispatch("/slow", {
      headers: { Accept: "text/html" },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(body).toContain("<h1>Low-network mode</h1>");
    expect(body).not.toContain(RFC_BASE32_SECRET);
    expectSecretResponseHeaders(response);
  });

  it("serves the self-contained one-kilobyte shell", async () => {
    const response = await dispatch("/1k", {
      headers: { Accept: "text/html" },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(body).toContain("<h1>1k TOTP</h1>");
    expect(body).not.toMatch(/(?:src|href)=['"]\/(?:assets|fonts)\//);
    expect(body).not.toContain(RFC_BASE32_SECRET);
    expectSecretResponseHeaders(response);
  });

  it("serves a CSS-free minimal HTML code", async () => {
    const response = await dispatch(`/s/${RFC_BASE32_SECRET}`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(body).toBe("<meta http-equiv=refresh content=1><h1>287082</h1>");
    expect(body).not.toMatch(/<(?:script|style|link)\b/i);
    expect(body).toContain("http-equiv=refresh");
    expect(body).not.toContain(RFC_BASE32_SECRET);
    expectSecretResponseHeaders(response);

    const head = await dispatch(`/s/${RFC_BASE32_SECRET}`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(await head.text()).toBe("");
  });

  it("rejects an invalid minimal-route secret without echoing it", async () => {
    const submitted = "INVALID0";
    const response = await dispatch(`/s/${submitted}`);
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).not.toContain(submitted);
    expectSecretResponseHeaders(response);
  });

  it("supports text and JSON POST requests", async () => {
    const textResponse = await dispatch("/api/totp", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: RFC_BASE32_SECRET,
    });
    expect(await textResponse.text()).toBe("287082\n");

    const jsonResponse = await dispatch("/api/totp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        secret: RFC_BASE32_SECRET,
        algorithm: "SHA256",
        digits: 8,
        period: 60,
      }),
    });
    const json = await jsonResponse.json<{ code: string; algorithm: string; digits: number; period: number }>();
    expect(json).toMatchObject({
      code: expect.stringMatching(/^\d{8}$/),
      algorithm: "SHA256",
      digits: 8,
      period: 60,
    });
  });

  it("honors q=0 and returns 406 when all supported representations are unacceptable", async () => {
    const fallback = await dispatch(`/${RFC_BASE32_SECRET}`, {
      headers: { Accept: "text/plain;q=0, */*;q=1" },
    });
    expect(fallback.headers.get("Content-Type")).toBe("application/json; charset=utf-8");

    const response = await dispatch(`/${RFC_BASE32_SECRET}`, {
      headers: { Accept: "text/plain;q=0, application/json;q=0, text/html;q=0" },
    });
    expect(response.status).toBe(406);
    expect(await response.text()).toBe("Not acceptable.\n");
  });

  it("returns 415 for unsupported request content types", async () => {
    const response = await dispatch("/api/totp", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "secret=value",
    });
    expect(response.status).toBe(415);
  });

  it("returns 400 for invalid input without echoing it", async () => {
    const submitted = "INVALID0";
    const response = await dispatch("/api/totp", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Accept: "application/json",
      },
      body: submitted,
    });
    const body = await response.text();
    expect(response.status).toBe(400);
    expect(body).not.toContain(submitted);
  });

  it("returns 404 for an unknown route", async () => {
    const response = await dispatch("/api/unknown");
    expect(response.status).toBe(404);
  });

  it("returns 405 with Allow for unsupported methods", async () => {
    const direct = await dispatch(`/${RFC_BASE32_SECRET}`, { method: "DELETE" });
    expect(direct.status).toBe(405);
    expect(direct.headers.get("Allow")).toBe("GET, HEAD");

    const api = await dispatch("/api/totp", { method: "GET" });
    expect(api.status).toBe(405);
    expect(api.headers.get("Allow")).toBe("POST");

    const minimal = await dispatch(`/s/${RFC_BASE32_SECRET}`, { method: "POST" });
    expect(minimal.status).toBe(405);
    expect(minimal.headers.get("Allow")).toBe("GET, HEAD");
  });

  it("returns 413 for an oversized request body", async () => {
    const response = await dispatch("/api/totp", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "A".repeat(MAX_REQUEST_BODY_BYTES + 1),
    });
    expect(response.status).toBe(413);
  });

  it("returns HEAD headers and status without a body", async () => {
    const response = await dispatch(`/${RFC_BASE32_SECRET}`, { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe("");
    expectSecretResponseHeaders(response);
  });
});
