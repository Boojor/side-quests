# Vetting Mac apps and binaries (.dmg / .pkg / .app / CLI)

Can't be cleanly Dockerized on macOS → advisory + safer-handling. Focus on provenance
(signature/notarization) and what it installs for persistence.

## 1. Signature & notarization (provenance)

Put the file's full path (it starts with `/`) in a single-quoted variable first, and check
it has no single quote (`'`) or line break: `APP='/path/to/App.app'`. Every command below
uses `"$APP"`, never the path pasted in.

- **Code signature:** `codesign -dv --verbose=2 "$APP"`: note the `Authority` and
  `TeamIdentifier`. A real "Developer ID Application: <Vendor> (TEAMID)" chain is good;
  "ad-hoc" / "not signed" is a red flag for downloaded software. `-dv` only displays the
  signature; to check it is intact, also run `codesign --verify --deep --strict --verbose=2 "$APP"`.
- **Notarization / Gatekeeper:** `spctl --assess --type execute --verbose "$APP"`
  → "accepted, source=Notarized Developer ID" is what you want. "rejected" means Apple
  hasn't notarized it. For a `.pkg` installer use `--type install` instead of
  `--type execute`. A plain command-line binary is not judged by `spctl`: rely on the
  `codesign` checks above.
- **Quarantine:** `xattr -p com.apple.quarantine "$APP"` shows a browser, Mail or AirDrop
  download (expected there; its absence on a file the user downloaded in a browser is
  odd). A file fetched with the Docker recipe or any command-line tool never has it.
  Instructions telling the user to run `xattr -cr` are a red flag.

## 2. Reputation & hash check

- Does the vendor/domain match the real project? (Watch for lookalike download sites.)
- Hash the installer (`shasum -a 256 "$APP"`) and check it against the vendor's published hash
  and/or VirusTotal. Many AV hits on a "normal" app = stop.

## 3. What does it install? (persistence)

Inspect before install. Use the fetch folder (`$D`) from the download step; if the file is
already on disk and there is no fetch folder yet, make a new one first, exactly as there:
`D="$PWD/_inspect-$(date +%Y%m%d-%H%M%S)"` and `mkdir "$D"`. `${D:?}` below stops the
command if `$D` is empty.

**Links first, every time.** An unpacked `.pkg` or a mounted `.dmg` can hold links that
point outside it (for example `Scripts/postinstall -> ../../../.ssh/id_rsa`). Before
reading anything inside, list them: `find "${D:?}/expanded" -type l -ls` (or
`"${D:?}/mnt"`), which prints each link and where it points. Record the list in the
verdict, never open a listed link, and read only regular files. A link in `Scripts`, or
one that leaves the folder, is a red flag. (An `.app` bundle normally has a few internal
links such as `Versions/Current`.)

- **`.pkg`:** `pkgutil --check-signature "$APP"` (a `.pkg` has its own signature type;
  `codesign` reports it as not signed), then
  `pkgutil --expand-full "$APP" "${D:?}/expanded"` (writes only into that folder, payload
  unpacked). List links as above, then read every regular file under `Scripts`
  (`preinstall`, `postinstall`): they run as root during install.
- **`.dmg`:** mount it read-only inside the fetch folder, without opening it in Finder:
  `hdiutil attach -readonly -nobrowse -mountpoint "${D:?}/mnt" "$APP"`. Mounting runs
  nothing. Check that the output names only one mount point; if it names more (extra
  volumes under `/Volumes`), detach each printed `/dev/disk` device too and treat it as a
  red flag. List links as above, check the `.app` or `.pkg` inside with the steps above,
  then `hdiutil detach "${D:?}/mnt"`.

After install, check what it added. These checks read your own Mac's startup folders and
extension lists:
- LaunchAgents / LaunchDaemons: `~/Library/LaunchAgents`, `/Library/LaunchAgents`,
  `/Library/LaunchDaemons`.
- System / kernel extensions: `systemextensionsctl list`, and `kmutil showloaded | grep -v com.apple`
  (`kextstat` on older macOS).
- Login items, privileged helper tools, `sudo`/admin prompts during install.
- Privacy grants it requests: Accessibility, Input Monitoring, Full Disk Access, Screen
  Recording, camera/mic. Judge each against the app's stated purpose.

## 4. Bring the user in

- "Do you recognize this vendor / did you download it from their official site?"
- "It wants <Accessibility / Full Disk Access / Input Monitoring>: expected for this app?"

## Safer-handling recommendations

- Prefer the **Mac App Store** or the vendor's official notarized build over random mirrors.
- For uncertain software, install/run inside a disposable **VM** (UTM/Parallels), not the
  host. macOS apps can't be contained by Docker the way Linux code can.
- After install, re-scan persistence (the section 3 checks, or KnockKnock) to confirm it
  only added what it should.
