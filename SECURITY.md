# Security Policy

HospiLink is a portfolio project and not a certified medical product; it must not be used with real patient data. Security reports are still taken seriously.

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's private reporting instead:
[Report a vulnerability](https://github.com/Ayaalmadhon2004/HospiLink/security/advisories/new).

Include what you found, steps to reproduce, and the impact you expect. You can expect an acknowledgement within a few days.

## Scope

In scope: authentication and sessions, role checks, hospital (tenant) isolation, device ingestion, exports, and anything that exposes another user's data.

Out of scope: findings that need a compromised machine, volumetric DoS, and the free-tier cold starts of the hosting providers.

## What is already in place

httpOnly cookie sessions with token revocation, role checks loaded from the database, per-hospital scoping of every query, zod validation, rate limits, 2FA (TOTP), audit log, helmet/CSP headers, plus automated gitleaks and OWASP ZAP workflows. Details: [docs/SECURITY_SCANNING.md](docs/SECURITY_SCANNING.md).
