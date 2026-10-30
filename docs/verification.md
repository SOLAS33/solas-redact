---
title: The checks on every copy
description: What Solas Redact checks in each finished file before it can be downloaded, and what those checks cannot show.
order: 3
---

Solas Redact checks every copy after making it. A copy that fails any check is discarded and cannot be downloaded. The checks run in the browser on the finished file, not on the data used to make it.

## The checks

| Check | How it is done | What a pass shows |
|---|---|---|
| **Page count and page sizes match** | The finished file is opened with PDF.js and each page size is compared with the original, within 0.05 points | No page was lost or resized |
| **No readable text is left in the file** | PDF.js reads the text and the annotations of every page | The text layer is empty and there are no annotations or form fields |
| **Every black box is solid black** | Each page with boxes is rendered from the finished file and the pixels inside every box, one pixel in from the edge, are read | The boxes are in the file and are black. The limit is a brightness of 48 out of 255 to allow for JPEG noise |
| **The file contains only page pictures** | The raw objects of the file are read (not through pdf-lib's page helper, which adds empty entries). Each page may hold only a picture and the operators that place it | No fonts, text operators, forms, links, scripts, attachments, bookmarks, metadata stream or encryption. Empty containers are allowed |
| **No original metadata is carried over** | The Info dictionary may only hold Producer, Creator, CreationDate and ModDate | No title, author, subject or keywords |
| **Redacted text and original metadata are not in the file** | The raw bytes of the file are searched, as text, as UTF-8 and as UTF-16, for each hidden text and each original metadata value of 4 or more characters | None of them is present anywhere in the file |
| **Reading the finished pages finds none of the hidden words** (optional) | Each page that has boxes is rendered at 200 dpi and read with text recognition. A hidden word may be found at most as many times as you chose to keep it | A box is not in the wrong place and no hidden word is plainly readable |

The first six run for every copy. The seventh is on by default and can be switched off, because it takes about a second or more per page.

## What the checks cannot show

- **They cannot know what you meant to hide.** If a name is on the page and is not under a box, every check passes. This is why review exists.
- **The pixel check reads inside the boxes, not around them.** A box that starts a little late would leave the first stroke of a letter visible and still pass. The test suite measures this separately (below), and the box edges are padded, but the check inside a live copy is not a proof for every font.
- **Text recognition can miss words**, especially small, curved or low-contrast text. It adds confidence. It is not proof.
- **A text found in the raw bytes check must be 4 characters or longer.** Shorter hidden texts are not searched for, because short strings turn up by chance in compressed pictures.
- **A passed check is about the file, not the situation.** It does not tell you whether a person can work out the hidden detail from what remains, for example from the length of a box or from other pages.

## Checks outside the app

The browser test suite does not trust the app's own report. After the app makes and downloads the copies, the test opens the downloaded files with other code:

- A separate build of PDF.js, run in Node, reads the text and annotations. Both must be empty.
- The raw bytes of each file are searched for every secret and every original metadata value used in the test files, as plain text, UTF-8 and UTF-16.
- pdf-lib reads the title, author, subject, keywords, producer and encryption entries.
- The original page and the copy are both rendered in Node, and every dark pixel inside the hidden word's own area on the original must be black in the copy. In the last run, the standard test page had 676 such pixels with 0 uncovered, and a page turned a quarter turn had 662 with 0 uncovered.
- The SHA-256 of the originals is taken before and after, and must match.

The [test results](/docs/testing/) list every check.
