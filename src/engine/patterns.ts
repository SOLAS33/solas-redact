/** Ready-made patterns for the things offices redact most. Each one finds candidates; the reviewer decides. */

export interface PatternDef {
  id: string;
  label: string;
  example: string;
  /** What the pattern does and does not check, shown next to the tick box. */
  note: string;
  regex: RegExp;
  /** Extra test applied to each candidate to cut false matches. */
  validate?: (match: string) => boolean;
}

export function luhn(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d.charCodeAt(i) - 48;
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** ISO 13616 check: move the first four characters to the end, turn letters into numbers (A=10), remainder mod 97 must be 1. */
export function ibanValid(raw: string): boolean {
  const s = raw.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of v) rem = (rem * 10 + (digit.charCodeAt(0) - 48)) % 97;
  }
  return rem === 1;
}

export const PATTERNS: PatternDef[] = [
  {
    id: "email",
    label: "Email addresses",
    example: "name@example.ie",
    note: "Anything shaped like name@domain.tld.",
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
  },
  {
    id: "pps",
    label: "Irish PPS numbers",
    example: "1234567TA",
    note: "Seven digits followed by one or two letters, written without spaces. Does not check that the number is real.",
    regex: /(?<![A-Za-z0-9])\d{7}[A-Za-z]{1,2}(?![A-Za-z0-9])/g,
  },
  {
    id: "eircode",
    label: "Eircodes",
    example: "A65 F4E2",
    note: "Seven characters in two parts of three and four, no letter O. Looser than the official list of routing keys, so it can match other codes.",
    regex: /(?<![A-Za-z0-9])[A-NP-Za-np-z]\d[\dWw]\s?[0-9A-NP-Za-np-z]{4}(?![A-Za-z0-9])/g,
  },
  {
    id: "phone",
    label: "Phone numbers",
    example: "087 123 4567, +353 1 234 5678",
    note: "International numbers starting + or 00, and Irish numbers starting 0. Can miss unusual layouts.",
    regex: /(?<![\w+])(?:(?:\+|00)\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}|0\d{1,2}[\s.-]?\d{3}[\s.-]?\d{3,4})(?!\d)/g,
  },
  {
    id: "iban",
    label: "IBANs",
    example: "IE29 AIBK 9311 5212 3456 78",
    note: "Checked with the standard IBAN check digits, so random text rarely matches.",
    regex: /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?(?![A-Za-z0-9])/g,
    validate: ibanValid,
  },
  {
    id: "card",
    label: "Payment card numbers",
    example: "4111 1111 1111 1111",
    note: "13 to 19 digits that pass the Luhn check.",
    regex: /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g,
    validate: luhn,
  },
  {
    id: "sort",
    label: "Bank sort codes",
    example: "93-11-52",
    note: "Three pairs of digits with hyphens. Also matches some dates written the same way.",
    regex: /(?<!\d)\d{2}-\d{2}-\d{2}(?!\d)/g,
  },
  {
    id: "date",
    label: "Dates written as numbers",
    example: "14/03/1985, 14.3.85",
    note: "Day, month and year separated by / . or -. Matches every such date, not only birth dates.",
    regex: /(?<!\d)\d{1,2}[/.-]\d{1,2}[/.-](?:\d{4}|\d{2})(?!\d)/g,
  },
  {
    id: "ip",
    label: "IP addresses",
    example: "192.168.1.20",
    note: "Four numbers from 0 to 255 separated by dots.",
    regex: /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.])/g,
  },
  {
    id: "url",
    label: "Web addresses",
    example: "https://example.ie/page",
    note: "Starts with http://, https:// or www.",
    regex: /(?:https?:\/\/|www\.)[^\s<>"')]+/g,
  },
];

export const PATTERN_BY_ID = new Map(PATTERNS.map((p) => [p.id, p]));
