---
title: Changelog
description: Every version of Ebon, what changed, and corrections to published statements.
order: 12
---

## 1.0.0 (30 October 2026)

First release.

- Redacts PDFs by drawing each page to a picture, painting black boxes into it and building a new PDF from the pictures. No text, fonts, metadata, attachments, forms or links survive.
- Accepts PDFs, pictures, Word .docx files, emails (.eml) and text files. Everything else is refused with an explanation.
- Finds words and names, with options for case, accents and whole words, and ten built-in patterns including Irish PPS numbers, Eircodes and IBANs.
- English text recognition for pages that are pictures.
- Review screen with a box for every match, click to keep, drag to draw, and a checked tick for every file.
- Confirmation that the redactions are permanent. Originals are never changed. Copies are named `_REDACTED.pdf`.
- Up to seven checks on every copy. A copy that fails a check is not offered for download.
- Downloads as single files, a zip file, or into a folder where the browser allows it. A report with fingerprints lists what was done, without the hidden text.
- Colour copies at 150, 200 or 300 dpi, and a black and white option for small text-only copies.
- Works with no connection after the first load. The security policy limits the page to its own address.
- MIT licence. Third-party notices generated from the installed packages.

### Known problems at release

See [limits](/docs/limits/).

### Corrections

None yet.
