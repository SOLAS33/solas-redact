# Solas Redact

Permanent redaction for PDFs and other documents, in the browser. Free and open source (MIT). Files never leave your computer.

Solas Redact hides names, numbers and other details in PDFs, pictures, Word .docx files, emails (.eml) and text files. It draws each page to a picture, paints black boxes into the picture, and builds a new PDF from the pictures alone. The copy has no text, fonts, metadata, attachments, form fields or links, so there is nothing under a box to recover. Originals are never changed.

- **Use it:** https://redact.solas33.com/app/
- **Read about it:** https://redact.solas33.com/ and the [documentation](docs/)
- **Licence:** MIT. See [LICENSE](LICENSE) and [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)

## What it does

1. Add files. Anything that is not a PDF is converted to one first.
2. Say what to hide: words and names, and kinds of detail such as email addresses, Irish PPS numbers, Eircodes, IBANs, phone numbers and dates.
3. Review every match as a black box on the page. Keep or hide each, or draw your own.
4. Confirm that the redactions are permanent. Solas Redact makes `_REDACTED.pdf` copies, checks each one, and only then offers it for download.

Up to seven checks run on every finished file (page count and size, no text, solid boxes, structure, metadata, a search of the raw bytes, and an optional re-reading of the pages). A copy that fails any check is discarded.

## What it does not do

- The copy is made of page pictures. It cannot be searched or copied, so it does not suit filings that must be text-searchable.
- Text recognition is English only and can misread. You review every match.
- Word files are converted as plain text. Excel, PowerPoint, Outlook .msg and older .doc files must be saved as PDF first.
- Tested in Chrome on Windows only.

See [docs/limits.md](docs/limits.md) for the full list.

## Run it yourself

```bash
git clone https://github.com/SOLAS33/solas-redact.git
cd solas-redact
npm ci
npm run build        # app + website into dist/
npm run preview      # serve dist/ locally, then open /app/
npm test             # unit tests
npm run test:e2e     # real Chrome, full flow (set CHROME_PATH if needed)
```

It needs Node.js 22 or later. The build copies the PDF and text recognition support files out of `node_modules` into `public/vendor` (see [tools/copy-vendor.mjs](tools/copy-vendor.mjs)), so nothing is loaded from a CDN at run time.

## Layout

| Path | What is in it |
|---|---|
| `src/engine/` | Reading, search, conversion, flattening and checking. No interface code |
| `src/app/` | The React interface |
| `app/index.html` | Entry page of the tool, served at `/app/` |
| `public/` | Security headers, icons, service worker, manifest |
| `docs/` | Documentation. Rendered into the website by `tools/build-site.ts` |
| `site/` | Landing page text and stylesheet |
| `tests/` | Unit tests, fixtures and the browser test |
| `tools/` | Build helpers: vendor copy, licence notices, site builder, icons |

## Contributing and reporting problems

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). Do not attach real documents to issues.

## Citing

See [CITATION.cff](CITATION.cff).
