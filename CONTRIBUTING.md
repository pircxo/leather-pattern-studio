# Contributing to Leather Pattern Studio

Thanks for considering a contribution. This project started as a real internal
tool for [My Star Georgia](https://mystar.ge) and was open-sourced so other
small leather-goods makers (and anyone curious about parametric pattern
generation) can use and extend it.

## Ground rules

- **Be kind and specific.** Bug reports and feature requests should include
  steps to reproduce, expected vs. actual behaviour, and environment details.
- **Small PRs over big ones.** A focused PR that does one thing is much
  easier to review than a sweeping rewrite.
- **Tests travel with code.** New geometry logic needs a `pytest` case; new
  UI behaviour needs a Vitest (and, where relevant, `jest-axe`) case.
- **Accessibility is not optional.** Any new interactive component must be
  operable by keyboard alone and must pass the automated `axe-core` check in
  `packages/ui`.

## Project layout

```
packages/ui/        Accessible React + TypeScript component primitives
apps/web/            React + TypeScript frontend (pattern configurator)
apps/api/            FastAPI REST backend (source-of-truth geometry + storage)
apps/worker/         Redis/RQ background worker (async export jobs)
apps/mobile_flutter/ Flutter companion viewer
docs/                API design notes and architecture rationale
```

## Local development

See the root `README.md` for how to run each service. The short version:

```bash
docker compose up --build
```

## Code style

- TypeScript/React: `npm run lint` (ESLint + Prettier) in each JS package.
- Python: `ruff check .` and `black .` in `apps/api` and `apps/worker`.
- Flutter: `flutter analyze` in `apps/mobile_flutter`.

## Reporting issues

Open a GitHub issue with the `bug` or `enhancement` label. For anything
security-related, please email the maintainer directly rather than filing a
public issue.
