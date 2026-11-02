# Contributing to HospiLink

Thanks for taking the time to improve HospiLink. This guide keeps contributions small, reviewable and safe.

## Getting started

1. Fork the repo and clone it.
2. Follow [Run it locally](README.md#run-it-locally) to start the backend (`backend/`) and the frontend (`frontend/`).
3. Read [`CLAUDE.md`](CLAUDE.md): it is the project memory and lists the architecture rules (multi-tenancy, response shape, RBAC, enums, money as integers...).

## Workflow

- One feature or fix per branch, branched from the latest `main`.
- Branch names: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>`.
- Small commits with [Conventional Commit](https://www.conventionalcommits.org/) messages (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- Open a pull request against `main` and fill in the template. PRs are merged with a regular merge commit (no squash, no rebase).

## Before you push

```bash
# backend
cd backend && npm run lint && npm test

# frontend
cd frontend && npm run lint && npm run build && npm test
```

When you touch a rule that the database enforces (triggers, constraints, conditional `UPDATE`, transactions), add a case to `backend/tests-int` as well. See [docs/INTEGRATION_TESTS.md](docs/INTEGRATION_TESTS.md).

## Code standards

- TypeScript strict, no `any`, no `@ts-ignore`, no inline `eslint-disable`.
- Every route uses `protect` and `authorize(...)`, validates input with zod, and scopes every query by the user's hospital.
- Every new controller path gets a test: happy path plus 400/401/403/404.
- Text shown to users goes through i18n (`en` and `ar`).
- Never commit secrets, `.env` files or uploaded patient files.

## Reporting bugs and security issues

Use the issue templates for bugs and ideas. For vulnerabilities, **do not open a public issue**: follow [SECURITY.md](SECURITY.md).
