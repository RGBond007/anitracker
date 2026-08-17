# Release Process

This document is for AniTracker maintainers.

## Versioning

AniTracker uses Semantic Versioning in the form `MAJOR.MINOR.PATCH`:

- `PATCH` fixes bugs without breaking compatibility: `1.2.0` → `1.2.1`.
- `MINOR` adds backward-compatible functionality: `1.2.0` → `1.3.0`.
- `MAJOR` introduces breaking changes: `1.2.0` → `2.0.0`.

Breaking changes include incompatible API or configuration changes, migrations that prevent a
supported rollback, removed behavior relied upon by clients, and changes that require operator
action during an upgrade. Large features are not automatically major releases when they preserve
compatibility.

Preview releases use suffixes such as `2.0.0-beta.1` and `2.0.0-rc.1`.

Because version 1.0.0 was published under MIT, the first release of the AGPL-licensed line should
be version 2.0.0. Existing copies of 1.0.0 remain available under the license under which they were
received.

## Preparing a release

1. Ensure CI passes on `main`.
2. Review all entries under `Unreleased` in [CHANGELOG.md](CHANGELOG.md).
3. Confirm database migrations from the previous release on a copy of representative data.
4. Verify a clean installation and an upgrade with Docker Compose.
5. Update the application version in `backend/app/version.py`, `backend/pyproject.toml`,
   `frontend/package.json`, and `frontend/package-lock.json`.
6. Move changelog entries into a versioned section with the release date in `YYYY-MM-DD` format.
7. Open and merge a release pull request.

Version metadata is currently duplicated; keep all four locations synchronized until it is
centralized.

## Publishing

After the release commit reaches `main`:

```bash
git tag -s vX.Y.Z -m "AniTracker X.Y.Z"
git push origin vX.Y.Z
```

Create a GitHub release from the tag. Use the corresponding changelog section as the release notes
and explicitly call out breaking changes, required operator actions, migrations, and security
fixes. Do not describe an unpublished container image as an installation option.

## After publishing

- Verify the release page, source archives, and documented installation path.
- Start a fresh `Unreleased` section in the changelog if needed.
- Update milestones and close the completed release milestone.
- Announce security fixes only after coordinated disclosure requirements are satisfied.

## Hotfixes

Branch from the affected release tag, apply the smallest safe fix, run the full validation suite,
increment `PATCH`, and document the fix. Merge the hotfix back into `main` to prevent regression.
