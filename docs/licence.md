---
title: Licence and legal notes
description: Solas Redact's licence, every component it includes and the terms of each, what it costs to run, and what you need to do to give it away.
order: 8
---

This page records the licensing position of Solas Redact version {{version}}. It was written from the licence files of the installed packages and from the sources linked below. It is not legal advice. Anyone who plans to build a business on Solas Redact, or to promote it for use in legal work, should have a solicitor read it.

## The licence

Solas Redact is released under the **MIT licence**. The full text is in the [LICENSE file]({{repo}}/blob/main/LICENSE) and at the end of this section. The [Open Source Initiative](https://opensource.org/license/mit) publishes the same text.

In plain terms the MIT licence lets anyone use, copy, modify, merge, publish, distribute, sublicense and sell the software, free of charge. It has one condition: the copyright notice and permission notice must be included in all copies or substantial portions of the software. It states that the software is provided "as is", without warranty of any kind, and that the authors are not liable for claims or damages arising from its use.

Copyright holder: Solas33, 2026.

## Why MIT

Every package Solas Redact includes is under a permissive licence (the list is below), so any permissive or copyleft licence could have been chosen for Solas Redact's own code. MIT was chosen because it is short, widely understood by lawyers and developers, and matches Solas33's other open tools.

| Choice | What it adds | Why not chosen |
|---|---|---|
| MIT (chosen) | Shortest text. Allows closed-source reuse | None for a free tool |
| Apache-2.0 | An express patent licence, and the duty to pass on a NOTICE file if the work has one. Section 4 requires giving recipients a copy of the licence and marking changed files | Longer, and adds paperwork for people who copy the code. Reasonable if patent risk worries you |
| AGPL-3.0 | Anyone who runs a changed copy as a network service must offer its source | Would stop closed forks, but would also deter many offices and developers from adopting it. Not needed for a tool that runs on the user's own computer |

Changing later is possible for new versions. Versions already released under MIT stay MIT.

## What Solas Redact includes

Solas Redact's production dependency tree has {{package_count}} packages, listed from the installed files by `npm run licences`: {{licence-counts}}.

{{third-party-table}}

Two notes on the list. The package `duck` labels its licence only as "BSD"; its licence file is the BSD 2-clause text, which the notices file includes. PDF.js also has an optional Node-only drawing package (`@napi-rs/canvas`) that is used by the test suite, is never sent to a browser, and is left out of the list because it differs by operating system.

The text of every licence, with each package's copyright notice, is in [third-party-notices.txt](/third-party-notices.txt) and in the repository as `THIRD-PARTY-NOTICES.txt`. It is generated from the packages themselves, not typed.

Not every package in the list is sent to your browser. The list is the whole production tree, which is the safe way to count. The browser receives PDF.js, pdf-lib, fflate, mammoth, tesseract.js and React with their small helper libraries.

### Support files that are served with the tool

{{vendor-table}}

Points to know:

- **PDF.js** is licensed under Apache-2.0 by the Mozilla contributors. Its licence is shipped in the package and in the notices file.
- **The Foxit standard font files** that PDF.js uses come with a BSD-style licence from the PDFium authors, included beside them (`LICENSE_FOXIT`). Solas Redact serves them unchanged.
- **The Liberation fonts** that PDF.js can also use are **not** served by Solas Redact. The licence file in the PDF.js package describes them as licensed under the GNU General Public License version 2 with an exception for documents that embed the font. Serving them unchanged would likely be allowed, but would add obligations (a copy of the GPL and an offer of source). Leaving them out costs nothing legally and only changes how a few PDFs that rely on standard fonts are drawn. See [limits](/docs/limits/).
- **The English text recognition data** comes from the `@tesseract.js-data/eng` package, which names MIT as its licence. The upstream project it is built from, the Tesseract [tessdata_best](https://github.com/tesseract-ocr/tessdata_best) repository, states that "All data in the repository are licensed under the Apache-2.0 License". Both are permissive. Solas Redact ships the notice for the package and the Apache-2.0 text for the engine.
- **Tesseract and tesseract.js** are Apache-2.0. Apache-2.0 section 4 requires giving anyone who receives the work a copy of the licence. The notices file does that.
- **Nothing is loaded from other servers.** No CDN, no Google Fonts, no analytics. That also means there are no third-party terms of service to accept for visitors.

## What it costs

| Item | Cost | Source |
|---|---|---|
| Source code on GitHub, public repository | Free | [GitHub terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) allow public repositories on a free plan |
| Automatic tests on every change | Free for public repositories on standard runners | [GitHub Actions billing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions) says the use of standard GitHub-hosted runners is free in public repositories |
| Hosting the site | Free | Cloudflare states that "Requests to static assets are free and unlimited" ([Workers static assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)). Solas Redact is static files only |
| Hosting limits that matter | 20,000 files per version and 25 MiB per file on the Free plan | [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/). Solas Redact's largest file is about 4 MB |
| Domain | No extra cost | A subdomain of an existing Solas33 domain |
| Running costs per use | None | The tool works on the user's own computer. There is no server to pay for |

Prices and limits can change. Re-read the linked pages before you rely on them.

## Giving it away: what you need to do

1. **Keep the licence files in the repository and in the site.** `LICENSE` and `THIRD-PARTY-NOTICES.txt` are in the repository root and the notices are served at `/third-party-notices.txt`. The build regenerates the notices from the installed packages.
2. **Do not change the licence text.** If you add your name as another copyright holder, add it to the line, do not remove the existing one.
3. **Do not use other people's trademarks as your own.** Adobe and Acrobat are trademarks of Adobe Inc. Solas Redact's pages mention redaction tools only to describe what they do, and do not claim any link with them or any compatibility. Keep it that way.
4. **Check the name.** "Solas Redact" was chosen after a search of GitHub and the web for redaction tools turned up no other tool of that name, but a search is not a trade mark clearance. Before you promote the name widely, search the Irish and EU trade mark registers (IPOS and EUIPO) in the software classes. If the name is taken, rename the project. The code does not depend on it.
5. **Say what it is and what it is not.** The site says that Solas Redact gives no warranty, does not replace review, and is not legal advice. Keep those words visible.
6. **Take care with contributions.** GitHub's terms say that adding content to a repository that has a licence notice licenses that content under the same terms. Contributors keep their copyright. No separate contributor agreement is used.

## Things this page does not settle

- **Patents.** The MIT licence has no express patent licence. We did not search for patents on PDF redaction. We know of none that Solas Redact was built to use, and all its components are widely used open source libraries. That is a statement of what we looked at, not a legal opinion.
- **Who owns the code.** Parts of Solas Redact were written with an AI coding assistant working under the direction of the owner. The law on copyright in AI-assisted work is still developing, and we have taken no legal advice on it. The MIT licence works as a grant from whoever holds the rights.
- **Liability.** The licence disclaims warranty and liability. Consumer and professional rules in some places can limit what a disclaimer achieves. If you offer Solas Redact to clients as part of a paid service, put your own terms around it.
- **Professional use.** If you use Solas Redact in legal, medical or public-sector work, the duty to check the result stays with you. See [limits](/docs/limits/).
- **Export and encryption rules.** Solas Redact contains no encryption of its own. It uses the browser's SHA-256 for fingerprints. We have not looked into export rules.
- **Data protection law.** See [privacy](/docs/privacy/).

## The MIT licence text

```text
MIT License

Copyright (c) 2026 Solas33

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
