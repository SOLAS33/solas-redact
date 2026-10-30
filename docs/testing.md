---
title: Test results
description: What the automated tests cover, the latest results, and how to run them.
order: 11
---

The tests run on every change in a public repository and can be run by anyone with `npm test` and `npm run test:e2e`. The results on this page were written by the test run itself, not typed.

## Latest run

| | |
|---|---|
| Browser test | **{{e2e-passed}} checks passed, {{e2e-failed}} failed** |
| Date of the run | {{e2e-date}} |
| Browser | {{e2e-chrome}} |
| Unit tests | **{{unit-tests}} passed** |

## Browsers

{{e2e-browsers}}

## What the browser test does

The test starts a real browser, serves the built site with its real security headers, and works through the interface as a person would. It adds seven files, plus one that must be refused:

- a three-page PDF with real text, standard fonts, document properties, an attachment, a text form field with a value, and a link
- a scanned PDF (a page that is only a picture of text) and the same picture as a PNG
- a text file, an email, and a Word file
- a PDF page turned a quarter turn
- an Excel file, which must be refused with a plain explanation

It then searches for names and for email addresses, PPS numbers, Eircodes, phone numbers, IBANs and dates, reviews the matches, keeps one match, draws a box by hand, confirms the permanent-redaction notice, makes the copies, and downloads them one by one, as a zip file and as a report. Further short runs make a copy by hand at 2560 pixels wide, with Undo and page turning, and a black and white copy.

After that it checks the downloaded files with code that is separate from the app. [How these checks work](/docs/verification/) is written out.

## Every check in the latest run

{{e2e-list}}

## Speed and size

Measured with `tests/e2e/stress.ts` on a Windows 11 PC with Chrome, on a text PDF of 120 pages (0.14 MB), finding one name and one email address on every page (240 boxes), with the final reading check switched off.

| Setting | Search | Make and check | Copy size |
|---|---|---|---|
| Standard colour, 150 dpi | about 5 s | about 26 s | 50.5 MB |
| Black and white, 300 dpi | about 5 s | about 45 s | 1.6 MB |

These are one run each. They show the order of size, not a promise.

## What the tests do not cover

- Browsers other than Chrome, and phones.
- Real-world documents. The test files are made by the test suite. Documents made by other programs, with other fonts and layouts, can behave differently. If you find one that does, please report it without attaching the document.
- Documents over 120 pages, and files of hundreds of megabytes.
- Text recognition on anything other than clear, large, English text.
- Languages other than English for text recognition.

## Run the tests

```bash
npm ci
npm test                 # unit tests
npm run build
npm run test:e2e         # real Chrome; set CHROME_PATH if needed
```
