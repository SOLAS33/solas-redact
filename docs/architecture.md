# Architecture notes

For people changing the code. The user-facing description is in [how-it-works.md](how-it-works.md).

## Shape

```
file(s) ──► openAny() ──► SourceDoc (pages) ──► scanDoc() ──► Redaction[] ──► review (React)
                                                                                 │
                       download ◄── Blob ◄── buildRedacted() = flatten() + verify() ◄┘
```

Everything under `src/engine/` is plain TypeScript with no React. `src/app/` is the interface and holds no redaction logic.

## Core types (`src/engine/types.ts`)

- `SourceDoc` and `SourcePage`: what every input becomes. A page has a size in points (rotation already applied, origin top left), a list of `TextItem`s, and `render(canvas, scale)`.
- `TextItem`: a run of text on a baseline, with unit vectors along the baseline and "up", a width, a font size, and a lazy `charX()` giving the offset of every character boundary. An item with `whole` set redacts that whole rectangle (form fields, annotations, recognised words).
- `Redaction`: one rectangle on one page, with a `group` so a match that spans several runs or lines is accepted or rejected together, the rule name for the report, and the matched `text` for the review list only.

## Sources (`src/engine/sources/`)

| File | Input | Notes |
|---|---|---|
| `pdfSource.ts` | PDF | PDF.js. A tiny render of each page loads its fonts so glyph widths can be measured. Reads form field and text box values as whole-box items |
| `imageSource.ts` | Pictures | One page fitted to A4 |
| `layout.ts` | Text, email, Word | A4 layout engine using canvas text measurement, so positions are exact |
| `email.ts` | .eml | Headers, MIME parts, quoted-printable, base64, RFC 2047 words, charsets |
| `convert.ts` | Router | Detects by content and extension, builds blocks for Word (mammoth) and email, refuses unsupported types with an explanation |

## Search (`search.ts`, `patterns.ts`)

`buildPageText` joins runs into one string and adds a space or line break where the layout has one, keeping a span table back to each run. `findHits` folds the text (case, accents, length preserved) and applies the terms and patterns. Overlapping hits are merged. `itemSlice` turns a character range in a run into a rectangle using `charX`, then `mergeLineRects` joins neighbours on the same line. Padding is 2 points.

## Flatten (`flatten.ts`)

One canvas per page, at most 40 million pixels. Accepted boxes are filled with `#000` rounded outwards to whole pixels. The page is encoded as JPEG or packed to 1-bit (luminance 160 or above is white) and Flate-compressed. A new `PDFDocument` is created with `updateMetadata: false`, and each page gets only that picture. Nothing is read from the source file at this stage except what the page renderer drew.

## Verify (`verify.ts`)

See [verification.md](verification.md). `structureCheck` reads raw objects and deliberately avoids `PDFDocument.getPages()`, which normalises pages and adds empty `/Annots`, `/Font` and `/ExtGState` entries. Empty containers are accepted, filled ones are not.

## Pipeline (`pipeline.ts`)

`scanDoc` runs the search page by page (with text recognition on picture pages). `buildRedacted` runs flatten then verify and works out, per page, how many times each hidden text may still be readable because the reviewer kept it, for the deep check.

## Interface (`src/app/`)

`App.tsx` holds state and the queue for opening files. Steps are separate components. `PageView` in `ReviewStep.tsx` draws the page to an off-screen canvas, copies it into the visible canvas, and positions boxes as percentages of the page so they follow resizing.

## Build

`tools/copy-vendor.mjs` copies PDF.js support files and the text recognition engine into `public/vendor` (not committed). Vite builds the app to `dist/app/` and emits a precache list into the service worker. `tools/build-site.ts` renders `docs/*.md` and `site/home.md` into static HTML. `tools/licences.mjs` writes the third-party notices from the installed packages.

## Why no text layer in the output

An invisible text layer would make the copy searchable, and would be a second place where hidden words could survive. The decision is to keep the output provably text-free. If a future version adds text recognition of the redacted pages for searchability, it must run after redaction, on the redacted picture, and must be on the checks list.
