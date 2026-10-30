---
title: Research and citation
description: Why black boxes over PDF text fail, what studies found, how to cite Solas Redact, and the sources used on this site.
order: 10
---

## Why this tool exists

A black rectangle drawn over text in a PDF hides the text from the eye and leaves it in the file. Anyone can select the area, copy it and paste it into another program. This has leaked trade secrets, personal details and the names of witnesses in court filings.

### What the studies and accounts say

- **Timothy Lee, Princeton, 2011.** Lee ran a program over 1.8 million documents in a collection of federal court records (PACER). It flagged about 2,000 that had redaction boxes. In 194 of those, the redaction did not work. The leaked material included trade secrets, personal information and the names of witnesses, jurors or plaintiffs. Lee wrote that "Extracting the information can be as easy as cutting and pasting." He cautioned that his sample was not random, and estimated that there were "thousands, and probably tens of thousands, of documents in Pacer with failed redactions." Source: [ABA Journal, 31 May 2011](https://www.abajournal.com/news/article/tens_of_thousands_of_pacer_documents_could_have_failed_redactions_study_sug).
- **Eugene Volokh, 7 January 2020.** Volokh describes a lawyer who used Google Docs to black-highlight passages and saved the file as a PDF, and a court filing in which the supposedly secret material could be copied out "with three keystrokes". His advice is to use a tool that actually deletes the underlying text, to check that the redaction is complete, and to note that printing, blacking out and scanning is the safest method but is not allowed where a court requires text-searchable PDFs. Source: [Reason, Volokh Conspiracy](https://reason.com/2020/01/07/avoid-super-embarrassing-redaction-failures/).

Both pages were fetched and checked when this page was written, on {{built}}.

### What Solas Redact takes from them

- The safest method is the one that leaves nothing to find. Solas Redact builds a new file from page pictures, which is the digital form of print, black out and scan.
- The result must be checked, not assumed. Solas Redact checks every copy, and the test suite checks the downloaded files with separate code.
- The cost of the method is a copy with no text layer. That is a real cost where text-searchable files are required, and Solas Redact says so in its [limits](/docs/limits/).

## How to cite Solas Redact

Please give the version, the date you used it and the address of the source code.

> Solas33. *Solas Redact: permanent redaction in the browser*, version {{version}}. 2026. {{repo}}

A machine-readable [CITATION.cff]({{repo}}/blob/main/CITATION.cff) is in the repository. If you cite a figure from this site, such as the number of tests, give the page and the date it was built ({{built}}), because the figures change with each version. The [changelog](/docs/changelog/) lists every version.

## Corrections

If you find an error on this site or in the software, [open an issue]({{repo}}/issues). Do not attach a document that holds real personal data. Corrections that change a published statement are listed in the changelog with the date.

## Sources used on this site

| Claim | Source |
|---|---|
| PACER failed redaction study (1.8 million documents, about 2,000 with boxes, 194 failed) | [ABA Journal](https://www.abajournal.com/news/article/tens_of_thousands_of_pacer_documents_could_have_failed_redactions_study_sug) |
| Examples of failed redactions, advice, text-searchable filing requirement | [Reason, Volokh Conspiracy](https://reason.com/2020/01/07/avoid-super-embarrassing-redaction-failures/) |
| Eircode format: seven characters, a three-character routing key and a four-character unique identifier, no letter O | [Eircode](https://www.eircode.ie/what-is-eircode) |
| PPS number format: seven digits followed by one or two letters, with sources that disagree on the letters | [Microsoft Purview](https://learn.microsoft.com/en-NZ/purview/sit-defn-ireland-personal-public-service-number), [Wikipedia](https://en.wikipedia.org/wiki/Personal_Public_Service_Number), [python-stdnum](https://arthurdejong.org/python-stdnum/doc/2.0/stdnum.ie.pps) |
| Cloudflare: "Requests to static assets are free and unlimited" | [Cloudflare documentation](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) |
| Cloudflare Free plan static asset limits: 20,000 files per version, 25 MiB per file | [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/) |
| GitHub-hosted runners are free in public repositories | [GitHub Docs](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions) |
| Content added to a repository with a licence notice is licensed under the same terms | [GitHub Terms of Service, section D.6](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) |
| Tesseract trained data is Apache-2.0 | [tessdata_best](https://github.com/tesseract-ocr/tessdata_best) |
| MIT licence text and terms | [Open Source Initiative](https://opensource.org/license/mit) |
| Apache-2.0 section 4 (redistribution) | [Apache Software Foundation](https://www.apache.org/licenses/LICENSE-2.0.txt) |
| Package licences | The licence files of the installed packages, read by `tools/licences.mjs` |
| Test figures | The test suite and `tests/e2e/stress.ts`, run by the project |
