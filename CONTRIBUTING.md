# Contributing

Thank you for helping. A few rules keep a redaction tool trustworthy.

## Rules that do not change

1. **Nothing leaves the page.** No network calls except to the site's own address, no analytics, no remote fonts, no CDN. The Content Security Policy in `public/_headers` enforces this and the browser test fails on a violation.
2. **A copy that fails a check is never offered.** Do not add a way round this.
3. **Originals are never written to.** Output is always a new file.
4. **No document text in reports, logs or the console.** The report holds counts and fingerprints only.
5. **State limits plainly.** If a change adds a limit, add it to `docs/limits.md`.

## Before you open a pull request

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The browser test needs Chrome. Set `CHROME_PATH` if it is not in a standard place. Add or change a browser check when you change behaviour that a person would see or rely on. If you add a pattern, add a unit test with both a match and a near miss.

## Documents in issues and tests

Never attach real documents or real personal data. Make a small test document with made-up details. The test fixtures in `tests/fixtures/make.ts` show how.

## Licence of contributions

Ebon is MIT licensed. By opening a pull request you agree that your contribution is licensed under the same terms (this is how GitHub's terms work for a repository with a licence notice). You keep your copyright. If you add a dependency, run `npm run licences` and make sure its licence is permissive (MIT, BSD, ISC, Apache-2.0 or similar). Do not add copyleft code, or fonts or data with unclear terms.

## Writing style

Documentation uses plain, specific sentences: lead with the noun, use numbers rather than adjectives, say limits flatly, use Irish or British spelling, and avoid slogans, rhetorical questions and em dashes.
