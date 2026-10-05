# Cross-language geometry fixture

`panel-cases.json` is the executable contract between the two places panel
geometry gets computed:

- `packages/core_py/core_py/geometry.py` (Python, the server-side source
  of truth)
- `apps/web/src/geometry/panel.ts` (TypeScript, the client-side live
  preview)

Both `apps/api/tests/test_geometry_fixture.py` and
`apps/web/src/geometry/panel.test.ts` load this same file and assert their
own implementation's output against it. Neither test suite calls into the
other language — the fixture is the thing they're both honest about,
independently. If someone changes a formula in one implementation without
updating the other (or this fixture), one of the two suites fails in CI.

This is a deliberately low-tech way to keep two deliberately-duplicated
implementations from silently drifting apart — see `ARCHITECTURE.md` for
why the duplication exists in the first place.
