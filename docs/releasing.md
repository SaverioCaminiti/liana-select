# Releasing

How a version of `liana-select` goes from `develop` to npm and to the
documentation site.

## Every release

1. Start the release from an up-to-date `develop`:
   `git flow release start X.Y.Z`. Versions follow
   [semantic versioning](https://semver.org/): a new feature is a minor version,
   a fix a patch version, and a change that breaks existing pages a major one.
2. On the release branch, set `"version": "X.Y.Z"` in `package.json` and turn the
   "Unreleased" section of `CHANGES.md` into `## X.Y.Z - YYYY-MM-DD`.
3. Check everything: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`,
   `pnpm test:all`, `pnpm build`, `pnpm site:build`. Commit.
4. Finish it: `git flow release finish X.Y.Z`. This merges into `main`, tags
   `X.Y.Z` and merges back into `develop`.
5. Push: `git push origin main develop X.Y.Z`. Then:
   - the "Deploy site to GitHub Pages" workflow publishes the site;
   - the "Publish to npm" workflow publishes the package, once trusted
     publishing is set up (see below).

## The first publication on npm

npm, pnpm and yarn all use the same registry, npmjs.com, so publishing once
makes the package available to all of them.

1. Create an account on [npmjs.com](https://www.npmjs.com/) and turn on
   two-factor authentication.
2. Log in from the repository: `pnpm login`.
3. Check out `main` at the release tag, with a clean working tree, and run
   `pnpm publish`. Its `prepublishOnly` script type-checks, lints, tests and
   builds before the upload. pnpm asks for the one-time password of the
   two-factor authentication.
4. Check the package page: https://www.npmjs.com/package/liana-select

## Automatic publication with trusted publishing

After the first publication, set up the "Publish to npm" workflow
(`.github/workflows/publish.yml`) so that each release tag publishes the
package without anyone typing a password, and with provenance: npm records
that the package was built by this repository's workflow.

1. On npmjs.com, open the settings of the `liana-select` package and add a
   trusted publisher: GitHub Actions, repository `SaverioCaminiti/liana-select`,
   workflow file `publish.yml`.
2. On GitHub, in the repository settings, under Secrets and variables, Actions,
   Variables, add `NPM_TRUSTED_PUBLISHING` with the value `true`.

Until then the workflow skips its job, so pushing a release tag does not fail.
It can also be started by hand from the Actions tab, for example to publish a
tag that was pushed before the setup.
