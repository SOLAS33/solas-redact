---
title: How it works
description: The method Solas Redact uses to remove text and details permanently, and the trade-offs of that method.
order: 2
---

## The short version

Solas Redact draws each page of the document to a picture, paints solid black boxes into the picture, and builds a new PDF out of the pictures alone. Nothing from the original file is copied across except what is visible on the page, and the boxes cover part of that.

This is the approach to redaction that can be proved from the finished file. A tool that edits the text inside a PDF has to find every place the text is stored: the page content, fonts, annotations, form fields, bookmarks, the document outline, attachments and old saved versions inside the file. A tool that builds a new file from pictures has nothing left to find.

## The stages

### 1. Read

- A **PDF** is opened with [PDF.js](https://mozilla.github.io/pdf.js/), the PDF reader from Mozilla. Solas Redact reads each page's text with its position, plus the text of form fields and text boxes.
- A **picture** becomes one page, scaled to fit A4 in portrait or landscape.
- **Word, email and text files** are converted to pages of text laid out by the browser, so that Solas Redact knows where every character is. See [formats](/docs/formats/).

### 2. Find

Solas Redact joins the text of each page into one string and searches it for your words and patterns. A match that spans several runs of text, or a line break, is still one match. Each match becomes one or more boxes.

The position of a box inside a line of text comes from the real width of each letter in the font the page uses, measured in the browser and scaled so the line ends exactly where the PDF says it ends. A box starts about 2 points before the first letter and ends about 2 points after the last. The test suite checks this against the standard Helvetica widths, and checks the pixels (see [verification](/docs/verification/)).

A page with fewer than 10 characters of text is treated as a picture of a page. If text recognition is on, Solas Redact reads it with [Tesseract](https://github.com/tesseract-ocr/tesseract) and every recognised word becomes a text run that is hidden as a whole box.

### 3. Review

You see each page with the boxes on it and decide what stays. Nothing is made until every file is marked as checked and you have confirmed that the redactions are permanent.

### 4. Flatten

For each page:

1. Draw the page to a canvas at the chosen resolution.
2. Fill each accepted box with solid black, rounding outwards to whole pixels.
3. Encode the canvas as a JPEG, or as a 1-bit black and white image.
4. Add the picture to a new PDF whose page is the same size as the original.

The new PDF is written by [pdf-lib](https://pdf-lib.js.org/). Its only metadata is the producer name (Solas Redact and its version) and the date it was made. Pages keep their original size, and turned pages (for example a landscape scan stored as a page turned 90 degrees) keep their appearance.

{{quality-table}}

### 5. Check

The finished file is opened again with a separate pass of the PDF reader and examined. The [verification page](/docs/verification/) lists every check. If any fails, the copy is thrown away and you are told which one.

## What is removed, and what remains

| Removed from the copy | Why |
|---|---|
| Text layer, fonts | The copy has no text at all |
| Document information: title, author, subject, keywords, original creator and producer | A new file is written; none of it is copied |
| XMP metadata | Same |
| Attachments, embedded files | Same |
| Form fields and their values | Flattened into the picture. Hidden values are not drawn |
| Comments, highlights, stamps, links | Visible ones are drawn into the picture. Links stop working |
| Bookmarks, document outline, tags, JavaScript | Not copied |
| Hidden layers | Not drawn |
| Earlier versions kept inside the file | Not copied |

| Remains | Note |
|---|---|
| Everything you can see on the page that is not under a box | By design. Review decides what is under a box |
| Page count and page sizes | Same as the original |
| The date the copy was made, and the name Solas Redact | The only metadata |

## Trade-offs

- **No text in the copy.** You cannot search it, select text, or use a screen reader on it. Some courts and tribunals require text-searchable PDFs. [Eugene Volokh notes](https://reason.com/2020/01/07/avoid-super-embarrassing-redaction-failures/) that this rules out the print, black out and scan method for those filings, and the same applies here. See [limits](/docs/limits/).
- **Larger files for colour.** In one test, a 120-page text document went from 0.14 MB to 50.5 MB at the standard colour setting and to 1.6 MB in black and white. See [limits](/docs/limits/).
- **Greys and colour are lost in black and white mode.** Use it for text documents, not photographs or signatures.

## What Solas Redact does not try to do

Solas Redact does not guess what is sensitive. It finds what you tell it to find, and what you draw. It does not recognise faces or objects in pictures, and it does not read text embedded in a picture on a page that also has real text, unless you draw a box there. See [limits](/docs/limits/).
