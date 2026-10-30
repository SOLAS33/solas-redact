# Security policy

Ebon is used to remove sensitive details from documents, so a flaw that lets hidden content survive is a security problem.

## What to report

- A redacted copy that still holds text, metadata or pictures that should have been removed, and that passes Ebon's own checks.
- A way to make the page send a document or its text to another address.
- A way to make Ebon write over or change an original file.
- Anything in the dependencies that affects the above.

## How to report

Open a private security advisory at https://github.com/SOLAS33/ebon/security/advisories/new. If that is not possible, open an ordinary issue that describes the problem **without** the document and without any real personal data, and ask for a private contact.

Please include the browser and version, the version of Ebon (shown in the page header), and a way to reproduce the problem with a made-up document. Do not send real personal data.

## What to expect

This is a small project with no paid support. We will read reports, confirm or explain, and publish a fix and a note in the [changelog](docs/changelog.md) for anything that affects what a copy contains. There is no bug bounty.

## Scope notes

- The checks in the app are described in [docs/verification.md](docs/verification.md), along with what they cannot show.
- Known limits are in [docs/limits.md](docs/limits.md). A limit that is already listed there is not a vulnerability, but a clearer way to warn people about it is welcome.
