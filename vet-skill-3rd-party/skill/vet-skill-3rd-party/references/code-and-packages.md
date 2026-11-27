# Vetting code: packages, repos, and scripts

Covers npm / pip / brew / cargo / gem / go modules, GitHub repos, and shell scripts
(`curl | bash`). Goal: see what it does *before* it runs, especially at install time.

## 1. Install-time execution (highest-value check)

Malware overwhelmingly runs at install, before you ever "use" the tool.

- **npm:** inspect `package.json` for `preinstall` / `install` / `postinstall` scripts.
  - `npm view -- '<pkg>' scripts` (name in single quotes, checked first as in
    `docker-sandbox.md`) and look at the published tarball, not just the repo.
  - A *new* dependency that has an install script is high-signal. Prefer installing with
    `--ignore-scripts` until vetted.
- **pip:** `setup.py` runs arbitrary code on install. Read it. Prefer wheels (`.whl`) over
  sdists, and download + inspect (inside Docker, see section 2) before `pip install`.
- **Shell scripts / `curl | bash`:** never pipe straight to a shell. Download first, read
  the whole thing, check for base64/eval/hidden second-stage downloads, *then* run.

## 2. Source ≠ artifact

The GitHub repo can look clean while the published package differs.
- Download the actual published artifact (`npm pack <pkg>`, `pip download`) and read *that*.
  Download it inside a container: `docker-sandbox.md`, "First: fetch the files inside a container".
- Compare against the repo. Mismatch, or "no repo at all," is a red flag.

## 3. Reputation & provenance (weak positive signals only)

- **Age / churn:** when was it first published? When was the latest version / ownership
  change? Treat <60 days, or a very recent maintainer change, with extra care.
- **Maintainers:** single or anonymous maintainer, no history → higher risk.
- **Typosquat:** is the name one keystroke from a far-more-popular package? Suggest the
  popular one.
- **Download trend:** a sudden spike or near-zero usage on a lookalike name is suspicious.

## 4. Behavior in the code

Skim (or grep) the source/tarball for:
- Reads of secrets: `process.env`, `~/.ssh`, `~/.aws`, `.env`, keychain, browser cookie DBs.
- Network egress to unfamiliar hosts; dynamically-built URLs; telemetry that isn't disclosed.
- `eval`, `Function()`, `child_process` / `os.system` / `subprocess`, dynamic `require`.
- Obfuscation: minified-only, base64/hex blobs, packed payloads.

## 5. Cross-check known-bad

- OpenSSF Malicious Packages repo (consumable via OSV), `osv.dev`, `osv-scanner`.
- Ecosystem advisories (GitHub advisories; `npm audit` only in a project that already has
  a lockfile listing the package). For Python, use the osv.dev lookup (end of this file) instead of
  running `pip-audit`: it can build packages, which runs their code on your computer.
- Dedicated scanners (Socket, Snyk, OpenSSF Scorecard): suggest them to the user as a second
  opinion; do not run them yourself.

## 6. When in doubt → sandbox

If it's runnable and the above leaves real uncertainty, run it in the hardened Docker
sandbox (`docker-sandbox.md`) with `--network=none` first, observe what it *tries* to do,
then decide.

## Quick triage commands (read-only)

```sh
npm view -- '<pkg>' versions time maintainers dist.tarball scripts # metadata + install scripts (name checked first, single quotes)
```

For known-bad entries before install, look the exact package and version up on `osv.dev`
(its website or its query API). `osv-scanner` needs a lockfile, so it fits a project that
already uses the package, not a package you have not installed yet.

**Getting the real artifact** (`npm pack`, `pip download`, a Git clone) happens **inside a
container, never on the host**: `docker-sandbox.md`, section "First: fetch the files inside
a container". A plain `pip download` of a source-only package runs its build code, so on the
host it is not read-only.
