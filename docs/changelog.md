---
title: Changelog
description: Every version of Solas Redact, what changed, and corrections to published statements.
order: 12
---

## 1.1.0 (30 October 2026)

A new design and a simpler way to work. What the app removes and how it checks a copy have not changed.

- Two choices at the start: redact by hand, or scan for words.
- By hand goes straight to the page. A list of files appears only when a file needs attention.
- The workspace fills the whole window on any monitor. The old limit of 900 pixels on the page is gone, and Fit width uses the full width.
- One Undo, also on Ctrl+Z, covers every change to the boxes. The arrow keys turn the page.
- The per-file "Checked" tick and "Mark all files as checked" are gone. The confirmation now names files with nothing hidden and pages you have not viewed.
- Search, quality and checking options moved behind Search options and Output options. Page quality and the final reading check are now set when you create the copies.
- Fonts (Inter Tight and IBM Plex Mono, both under the SIL Open Font License) are served from our own address.
- A shorter website. The detail moved to the documentation, which now uses the full width of the screen.
- Browser tests now also run in Edge, Brave and Firefox, and cover the by-hand flow and full-width layout.

## 1.0.1 (30 October 2026)

- Fixed: on browsers older than about Chrome 145, a copy could not be finished. The file was refused with a technical error and nothing unsafe was offered. Solas Redact now uses the PDF library's build for older browsers, and all 89 browser checks pass in Chrome 130 as well as a current browser.

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
