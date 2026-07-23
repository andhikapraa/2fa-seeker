export type Representation = "plain" | "json" | "html";

export const REPRESENTATION_CONTENT_TYPES: Readonly<Record<Representation, string>> = Object.freeze({
  plain: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
  html: "text/html; charset=utf-8",
});

interface MediaRange {
  type: string;
  subtype: string;
  quality: number;
  order: number;
}

interface NegotiationOptions {
  allowHtml?: boolean;
}

const REPRESENTATION_MEDIA_TYPES: Readonly<Record<Representation, readonly [string, string]>> =
  Object.freeze({
    plain: ["text", "plain"],
    json: ["application", "json"],
    html: ["text", "html"],
  });

function parseQuality(value: string): number {
  if (!/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?|\.\d{1,3})$/.test(value)) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
}

function parseAccept(value: string): MediaRange[] {
  const ranges: MediaRange[] = [];

  for (const [order, entry] of value.split(",").entries()) {
    const [rawMediaType, ...rawParameters] = entry.split(";");
    const mediaType = rawMediaType?.trim().toLowerCase() ?? "";
    const slashIndex = mediaType.indexOf("/");
    if (slashIndex <= 0 || slashIndex === mediaType.length - 1) continue;

    let quality = 1;
    for (const rawParameter of rawParameters) {
      const [rawName, rawValue] = rawParameter.split("=", 2);
      if (rawName?.trim().toLowerCase() === "q") {
        quality = parseQuality(rawValue?.trim() ?? "");
      }
    }

    ranges.push({
      type: mediaType.slice(0, slashIndex),
      subtype: mediaType.slice(slashIndex + 1),
      quality,
      order,
    });
  }

  return ranges;
}

function matchSpecificity(range: MediaRange, type: string, subtype: string): number {
  if (range.type === "*" && range.subtype === "*") return 0;
  if (range.type === type && range.subtype === "*") return 1;
  if (range.type === type && range.subtype === subtype) return 2;
  return -1;
}

function qualityFor(ranges: readonly MediaRange[], representation: Representation): number {
  const [type, subtype] = REPRESENTATION_MEDIA_TYPES[representation];
  let bestSpecificity = -1;
  let bestOrder = Number.POSITIVE_INFINITY;
  let quality = 0;

  for (const range of ranges) {
    const specificity = matchSpecificity(range, type, subtype);
    if (specificity < 0) continue;
    if (specificity > bestSpecificity || (specificity === bestSpecificity && range.order < bestOrder)) {
      bestSpecificity = specificity;
      bestOrder = range.order;
      quality = range.quality;
    }
  }

  return quality;
}

export function negotiateRepresentation(
  acceptHeader: string | null,
  options: { allowHtml: true },
): Representation | null;
export function negotiateRepresentation(
  acceptHeader: string | null,
  options?: { allowHtml?: false },
): Exclude<Representation, "html"> | null;
export function negotiateRepresentation(
  acceptHeader: string | null,
  options: NegotiationOptions = {},
): Representation | null {
  if (acceptHeader === null || acceptHeader.trim() === "") return "plain";

  const ranges = parseAccept(acceptHeader);
  if (ranges.length === 0) return null;

  const supported: Representation[] = options.allowHtml
    ? ["plain", "json", "html"]
    : ["plain", "json"];

  let selected: Representation | null = null;
  let selectedQuality = 0;

  for (const representation of supported) {
    const quality = qualityFor(ranges, representation);
    if (quality > selectedQuality) {
      selected = representation;
      selectedQuality = quality;
    }
  }

  return selectedQuality > 0 ? selected : null;
}
