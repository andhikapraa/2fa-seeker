export const BOOTSTRAP_CSP_HASH = "sha256-hJyxfS7BRirp1eCnbfv6pThnaM2I8JjAUCTI5Ac2+SU=";
export const ONE_KB_SCRIPT_CSP_HASH = "sha256-ziQ2eKKcHDsgmy4q0DM5M7f2mV7UML/FkmKt7ifTTms=";
export const ONE_KB_STYLE_CSP_HASH = "sha256-jfdpgB7C3gYAe6D8hVZTnKumrNFoYf4NDrQPwTP9b+Y=";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' '${BOOTSTRAP_CSP_HASH}' '${ONE_KB_SCRIPT_CSP_HASH}'`,
  `style-src 'self' '${ONE_KB_STYLE_CSP_HASH}'`,
  "font-src 'self'",
  "img-src 'self'",
  "connect-src 'none'",
].join("; ");

export function applySecurityHeaders(headers: Headers): Headers {
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  headers.set("Strict-Transport-Security", "max-age=31536000");
  return headers;
}

export function applyVaryAccept(headers: Headers): Headers {
  const current = headers.get("Vary");
  const values = current
    ? current
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  if (!values.some((value) => value.toLowerCase() === "accept")) values.push("Accept");
  headers.set("Vary", values.join(", "));
  return headers;
}
