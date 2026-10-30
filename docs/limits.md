---
title: Limits
description: What Solas Redact cannot do, where it can be wrong, and how big a job it has been tested on.
order: 7
---

These are the known limits of version {{version}}. Each one is stated as found, not as a promise to fix.

## What the copy is

1. **The copy has no text.** It is made of page pictures. You cannot search it, select text in it or read it with a screen reader. Some courts and tribunals require text-searchable PDFs, so check before you file a copy. Solas Redact does not add a text layer back, because that would put the hidden words' neighbours in a layer that has to be checked as well.
2. **Colour copies are large.** In one test, a 120-page text document of 0.14 MB became 50.5 MB at the standard colour setting (about 420 KB a page) and 1.6 MB in black and white at 300 dpi. Dense text pages compress poorly as JPEG.
3. **Black and white mode drops greys and colour.** Photographs and signatures turn into patterns of black and white dots. Use it for text.
4. **Links, bookmarks, comments, form fields and attachments are gone.** Visible comments, stamps and form values are drawn into the page.

## What it can find

5. **Text in the PDF's text layer is found by what it says.** Text drawn as pictures is not. A scanned page is read with text recognition only if it has fewer than 10 characters of real text. A page with real text and also a picture of text, such as a stamped signature block, is not recognised in the picture part. Draw a box there.
6. **Text recognition is English only and can be wrong.** It misses small, faint or curved text and reads some characters wrongly. A misread word is not matched by your search. The optional final check reads the copy and can catch some of these. Review scanned pages by eye.
7. **Text drawn at an angle or in unusual ways has had less testing.** Pages turned a quarter turn are tested. Text on a slope, text that runs top to bottom in one column, or text built from separate letters placed one by one has not been tested.
8. **Search does not understand meaning.** It finds "Seán Murphy" and not "the applicant" or "Mr M." Patterns find shapes such as PPS numbers, not whether the number is real.
9. **A name split by a hyphen at a line end is not joined.** Search for each part, or draw a box.

## Fidelity

10. **Fonts that are not stored in a PDF are drawn with fonts on your computer.** Some PDFs name standard fonts such as Helvetica and do not include them. The position of a box inside a long line is worked out from the letter widths of the font your browser uses, scaled to the width the PDF reports for the line. Where your computer's font has the same widths as the original (Arial for Helvetica, for example) boxes fit to within a point. Where it does not, a box inside a long line can be off by several points. The review screen draws the boxes over the page exactly as it will be written, so check them there. Solas Redact does not ship the Liberation fonts that PDF.js can use for this, because of their licence (see [licence](/docs/licence/)).
11. **Word files are converted as plain text.** Layout, images, headers, footers and comments may be missing. Compare with the original. Excel, PowerPoint, Outlook .msg and older .doc files are not accepted. See [file types](/docs/formats/).
12. **Very large pages are drawn smaller.** A page that would need more than 40 million pixels at the chosen resolution is drawn at a lower resolution. A poster-sized page at 300 dpi is the usual case.
13. **A password-protected PDF asks for its password, and the copy has none.**

## Size and speed

14. **Tested size.** A 120-page text PDF: searching took about 5 seconds, and making and checking the copy took about 26 seconds at 150 dpi in colour, or about 45 seconds at 300 dpi in black and white. Peak memory in the page was about 168 MB of script memory in colour mode, not counting the browser's picture memory. The deep check, which reads each finished page with text recognition, adds about a second or more per page. These were measured once on a Windows 11 PC with Chrome. Your times will differ.
15. **Not tested size.** Documents over a few hundred pages, single files over 100 MB, and batches of hundreds of files have not been tested. A zip file of the copies is built in memory, so a very large batch may not fit. Download the copies one at a time instead.
16. **Text recognition downloads nothing, and it is slow.** The English data is 2.9 MB and is served with the tool. Recognition takes roughly one second per page on a current PC.

## Browsers

17. **Tested in {{e2e-chrome}} on Windows only.** Other browsers are untested. Solas Redact uses features that older browsers lack, such as regular expression look-behind and module workers. Save to a folder needs a browser that has the File System Access API, such as Chrome. Other browsers use ordinary downloads and zip files.
18. **Phones and tablets are untested.** The layout is built for a desktop screen.

## What a person must still do

19. **Review is not optional.** Solas Redact marks what you tell it to look for. It cannot know that "the claimant" next to a unique job title identifies a person.
20. **Solas Redact is not legal advice and gives no guarantee.** The licence says the software is provided as it is, without warranty. If a mistake would be costly, have a second person check the copy, and keep your originals in a safe place.
