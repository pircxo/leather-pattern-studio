# Contributing

Start with `npm run setup` and `npm run dev` from the repository root. See [README](README.md) for the service stack and the Flutter companion.

Keep changes focused and include a regression check for changed behavior. New geometry logic must be reflected in both language implementations and the shared fixtures. Interactive controls must work with a keyboard and pass accessibility checks.

Before submitting:

```bash
npm test
npm run test:api
npm run build
npm run format:check
apps/api/.venv/bin/ruff check apps/api apps/worker packages/core_py scripts
apps/api/.venv/bin/ruff format --check apps/api apps/worker packages/core_py scripts
npm run test:e2e
```

Format TypeScript/CSS with `npm run format` and Python with `apps/api/.venv/bin/ruff format apps/api apps/worker packages/core_py scripts`. Flutter changes should pass `flutter analyze`, `flutter test` and `flutter build web` inside `apps/mobile_flutter`.

Report bugs with reproduction steps, expected/actual behavior and runtime versions. Do not include real customer information, credentials or private database exports in issue reports.
