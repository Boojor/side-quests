# Hardened Docker sandbox for running untrusted code

Use when a package/repo/script is runnable and vetting leaves real uncertainty. Run it
isolated, observe behavior, then decide. **Linux code only**: macOS `.app`s need a VM, not
a container (see `mac-apps.md`).

## First: fetch the files inside a container (never on the host)

The read in Step 1 needs the raw files, and the locked-down run below has no network, so it
cannot download anything. Fetch in a separate, short-lived container first. Rules:

- **A new, empty folder for every fetch**, and nothing else mounted: never your home folder,
  your project, or a folder that holds anything of yours. Use `mkdir` without `-p`, so an
  existing folder stops the command instead of being reused.
- **The container only downloads and unpacks.** Never run the package, its install
  scripts or a build in this step. If a source can only be fetched by running its build
  code, stop and ask the user.
- **Names and URLs from the target go in as arguments, never pasted into the command.**
  Put them in the single-quoted variable at the top; the container receives it as `$1`.
  Before running, check every value that goes between those single quotes: a package name
  or version has only letters, digits and `@ / . _ - +`, and starts with a letter, digit
  or `@` (never `-`, which a tool would read as an option); a URL starts with `https://`
  and has no single quote (`'`), space or line break. If a value fails, stop and ask the
  user.
- Network is on here only because downloading needs it. Everything after this step uses
  the no-network recipe below, or reads the files in the fetch folder as plain text.
  Reading is fine; never run anything from it on the host.
- **Links in the download are never followed.** Before reading on the host, list and remove
  them inside a container: the same settings as the fetch plus `--network=none`, image
  `python:3.12-slim` whatever the fetch used, last line `find /work -type l -ls -delete`.
  It prints each link and where it pointed, then removes it. Record the list in the
  verdict. Removing a link never touches the file it points to, and a link that leaves the
  download (for example to `~/.ssh`) is itself a red flag.
- **Options before `--`, the target after it.** Every recipe puts its own options first,
  then `--`, then `"$1"`. A tool reads everything after `--` as a name, so an option placed
  after it would be fetched as a package.

**npm:**

```sh
PKG='<pkg>@<version>'
D="$PWD/_inspect-$(date +%Y%m%d-%H%M%S)"
mkdir "$D"
docker run --rm \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --memory=1g --cpus=1 \
  --pids-limit=128 \
  -e HOME=/tmp \
  -v "$D:/work" \
  -w /work \
  node:20-slim \
  sh -c 'npm pack --ignore-scripts -- "$1" && mkdir pkg && tar -xzf ./*.tgz -C pkg' sh "$PKG"
```

**Other sources:** the same first three lines and container settings; swap the image and
the last line.

- **pip, with a ready-made package (wheel):** `PKG='<pkg>==<version>'`, image
  `python:3.12-slim`, last line
  `sh -c 'pip download --no-deps --only-binary=:all: -d /work -- "$1" && python -m zipfile -e ./*.whl pkg' sh "$PKG"`.
  A wheel is a zip: the second command unpacks it so it can be read.
- **pip, source only (no wheel):** never drop `--only-binary`, because that runs the
  package's build code. Fetch the source archive itself, which runs nothing:
  `NAME='<pkg>'; VER='<version>'`, image `python:3.12-slim`, last line
  `python3 -c 'import json,os,sys,tarfile,urllib.request as u; d=json.load(u.urlopen("https://pypi.org/pypi/%s/%s/json" % (sys.argv[1], sys.argv[2]))); f=[x for x in d["urls"] if x["packagetype"]=="sdist"][0]; n=os.path.basename(f["filename"]); u.urlretrieve(f["url"], "/work/" + n); tarfile.open("/work/" + n).extractall("/work/pkg", filter="data"); print(n, f["digests"]["sha256"])' "$NAME" "$VER"`.
  It prints the archive's name and the SHA-256 that PyPI publishes for it.
- **Git repo:** `URL='<repo-url>'`, then `--entrypoint sh alpine/git` as the image and
  `-c 'git clone --depth 1 -- "$1" /work/repo && git -C /work/repo rev-parse HEAD > /work/commit.txt' sh "$URL"`.
  `commit.txt` holds the exact commit that was read. Never run `git` on the host inside
  `$D/repo`: its `.git` folder came from the target. Read the files as text only.
- **A single file** (a shell script, a `.crx`, a `.dmg`): `URL='<file-url>'`, image
  `python:3.12-slim`, last line
  `python3 -c 'import sys,urllib.request as u; u.urlretrieve(sys.argv[1], "/work/download")' "$URL"`.
  Read a script as text. A `.crx` is a zip with a short header in front: unpack it with the
  same container settings plus `--network=none`, last line
  `python -m zipfile -e /work/download /work/crx`
  (the header is skipped). A `.dmg` or `.pkg` is then checked with `mac-apps.md`.
- **Other package managers** (brew, cargo, gem, go): the same pattern, with that
  ecosystem's own image and its download-only command. These are not tested: say so in the
  verdict.

**Record what was read:** the exact version (or the commit from `commit.txt`), and the
download's SHA-256, so the verdict names exactly what was read. Hashing is reading, so it
is fine on the host. One pattern per command: `shasum -a 256 "$D"/*.tgz` (npm),
`"$D"/*.whl` (wheel), `"$D"/*.tar.gz` (source archive) or `"$D"/download` (single file).
In zsh a pattern that matches nothing stops the whole command. For a source archive, the
host hash must equal the SHA-256 the PyPI recipe printed; a mismatch is a stop.

## Default: deny everything, then observe

Start with **no network** and a throwaway, read-only filesystem. Most malware reveals itself
by *trying* to phone home or read secrets, which a locked-down container makes visible and harmless.

```sh
docker run --rm \
  --network=none \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid \
  --memory=2g --cpus=2 \
  --pids-limit=256 \
  -v "$D:/work:ro" \
  -w /work \
  <minimal-image> <command>
```

What each line does (kept out of the command: a comment after a `\` ends the command there):

- No `-it`: Claude's shell has no terminal attached, and `-t` would fail there. Add `-it`
  only when you run it yourself in a terminal.
- `--network=none`: no network at all (first run: see what it TRIES to do)
- `--cap-drop ALL`: drop all Linux capabilities
- `--security-opt no-new-privileges`: the process can never gain more rights than it starts with
- `--read-only`: root filesystem read-only
- `--tmpfs /tmp:rw,noexec,nosuid`: scratch space in RAM, wiped on exit, non-executable
- `--memory=2g --cpus=2`, `--pids-limit=256`: resource caps (prevents fork bombs / mining)
- `-v "$D:/work:ro"`: the code to inspect, mounted READ-ONLY
- `<minimal-image> <command>`: e.g. `node:20-slim`, `python:3.12-slim`

## If it genuinely needs network

Only after a no-network pass looks clean, and only with the user's yes. Re-run **without**
`--network=none`, and watch egress:

```sh
# In another terminal, watch what the container talks to:
docker run ... <image> &          # start the sandbox
# then inspect connections from the host, or run mitmproxy / tcpdump in a sidecar
```

Prefer an explicit allowlist (egress firewall / proxy) over open network if your setup
supports it. Never give an untrusted container your host network (`--network=host`).

## Never do these with untrusted code

- ❌ `-v /:/host` or mounting your home dir read-write: gives it your files.
- ❌ `--privileged`, `--cap-add SYS_ADMIN`, or mounting the Docker socket
  (`/var/run/docker.sock`): instant host takeover.
- ❌ `--network=host`.
- ❌ Passing real secrets via `-e` / env or bind-mounting `~/.ssh`, `~/.aws`, `.env`.

## Stronger isolation (when the stakes are higher)

Standard containers **share the host kernel**: a kernel exploit can escape. For
higher-assurance runs:
- **gVisor:** add `--runtime=runsc` (user-space kernel, much smaller escape surface).
- **A real VM** (UTM, Lima, Parallels) for the highest assurance, or for non-Linux targets.

## Honest caveat (always state this)

A container raises the bar a lot but is **not** a guarantee. Treat the sandbox as "observe
safely and catch the obvious," not "proven safe." For a determined, targeted threat, use a
disposable VM and assume the worst.
