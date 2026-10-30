---
title: File types
description: Which files Solas Redact accepts, how each is converted to PDF, and what the conversion changes.
order: 4
---

Every file ends up as a redacted PDF. A PDF is used as it is. Other accepted files are first turned into PDF pages inside the browser, and those pages are redacted in the same way.

## Accepted

| Type | Extensions | How it is converted | What changes |
|---|---|---|---|
| PDF | .pdf | Not converted | Nothing before redaction. A password-protected PDF asks for the password. The copy has no password |
| Picture | .png .jpg .jpeg .webp .gif .bmp .avif | One page, scaled to fit A4 (portrait or landscape to suit the picture) | No text layer. Use text recognition or draw boxes. Animated GIFs use the first frame. Which formats open depends on your browser |
| Word | .docx | Text of headings, paragraphs, lists and tables is read with [mammoth](https://github.com/mwilliamson/mammoth.js) and laid out as plain pages | Fonts, page layout, images, headers, footers and comments may be missing. Compare with the original |
| Email | .eml | Main headers (From, To, Cc, Bcc, Subject, Date) and the readable body | Other headers, attachments and formatting are left out. Attachment names are listed in a note so you can redact the attachments separately |
| Text | .txt .csv .tsv .log .md | Laid out in a fixed-width font on A4 pages | Long lines wrap. Files over 6 MB are refused. Text in UTF-8, UTF-16 with a mark, or Windows-1252 is read |

Converted pages are A4. A very long text file is cut after 1,500 pages and Solas Redact says so.

## Not accepted yet

Solas Redact refuses these with a plain message and does not upload them anywhere.

| Type | What to do |
|---|---|
| Word 97 to 2003 (.doc), Excel (.xls, .xlsx), PowerPoint (.ppt, .pptx), RTF, OpenDocument (.odt, .ods, .odp) | Open the file in its own program, choose Save as PDF (or Print, then Microsoft Print to PDF), and add the PDF |
| Outlook message (.msg) | Save as .eml or print to PDF from Outlook |
| TIFF, HEIC, SVG | Save as PNG or JPEG, or print to PDF |
| Web page (.html) | Print to PDF from the browser |

Exporting from the original program is the better route for Office files anyway. It keeps the layout you are used to, and the copy then looks like the document.

## Checking a converted file

A converted file is a new document and may not look the same as the original. Solas Redact shows a note above the page for each converted file. Read the converted pages in the review step before you make the copy.

## Hidden content in the original

A converted Word or email file is a new document built from the text Solas Redact reads. Whatever Solas Redact does not read does not reach the PDF. We have not tested which hidden Word content the reader skips, such as deleted text in tracked changes or comments, so do not count on conversion to remove it. If the original holds sensitive hidden content, do not send the original. Send the redacted PDF only.
