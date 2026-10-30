---
title: Privacy
description: Where your files go when you use Solas Redact (nowhere), what the page is allowed to do, and how to check it yourself.
order: 6
---

## Short answer

Your files are read, searched and redacted inside your browser tab. They are not sent to us or to anyone else. Solas Redact has no server code, no account and no analytics, and sets no cookies. On 30 October 2026 we read the response headers of five pages on the live site and none set a cookie.

## Where the work happens

- The files you add are read into the memory of the browser tab.
- Searching, text recognition, drawing the pages, building the new PDF and checking it all run in your browser. The PDF reader, the text recognition engine and its English data are files served from the same address as the page.
- The copies are held in memory until you download them. Closing the tab, pressing Start again or pressing Finish and clear everything discards them.
- Downloads go where your browser puts downloads. Solas Redact cannot see or remove them afterwards.

## What the page is allowed to do

The site sends a Content Security Policy with every page. In plain terms it says:

- Scripts, styles, images, fonts and workers may only come from the site's own address.
- The page may only connect to its own address. It cannot send data to any other server.
- The page may not be shown inside another site.
- The page may not use the location, camera, microphone, payment or USB features of the browser.

The policy is in [public/_headers]({{repo}}/blob/main/public/_headers) in the source code. The test suite loads the app with exactly this policy and fails if the browser reports a violation.

## What is stored in the browser

Nothing about your documents. The test suite checks that after a full run the page holds no entries in local storage, session storage or IndexedDB, that the only caches are Solas Redact's own, and that no document is in any cache.

Solas Redact installs a small service worker so the tool opens with no connection. It keeps the files of the tool itself (and, the first time they are used, the text recognition engine and PDF fonts). It does not see or keep your documents. Its code is [public/app/sw.js]({{repo}}/blob/main/public/app/sw.js).

## What the host can see

The files of the site are served by Cloudflare. Like any web host, it can see that a browser asked for the site's files, with the usual request details such as the address of the computer. It never receives your documents, because the page never sends them. Solas Redact does not add trackers, third-party fonts, or advertising. The only external service involved is the host.

## The report

The report you can download holds file names, page counts, counts of what each rule hid, and SHA-256 fingerprints of the originals and the copies. It does not contain the hidden text. File names and fingerprints can themselves be personal or confidential, so treat the report with the same care as the files.

## How to check this yourself

1. Open Solas Redact and let it load.
2. Open the developer tools of your browser (F12) and the Network panel.
3. Add a file and make a copy. You will see requests for Solas Redact's own files and none to any other address, and none that carry your file.
4. Or switch your computer to flight mode after the page has loaded. Everything still works.

The source code is public, so you can also read it. The search and conversion code is in `src/engine`, and the only place a file leaves the page is the download link you press.

## Data protection

Solas Redact is a tool that runs on your computer. We do not receive your documents or the personal data in them, so we do not process that data. Your organisation remains responsible for how it uses the tool and for what it sends on. This page describes how the software behaves. It is not legal advice. Ask your data protection officer or solicitor if you need a view for your own circumstances.
