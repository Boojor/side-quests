# Vetting browser extensions (Chrome / Arc / Edge / Firefox)

Extensions can read and change everything you do in the browser, including passwords typed
into pages. They also get silently *updated*, so a clean extension can turn malicious later.
Cannot be Dockerized → this is advisory + safer-handling.

## 1. Permissions vs. purpose (the core test)

Read the extension's `manifest.json` (or the Web Store "permissions" disclosure).

- **`host_permissions` / `content_scripts` matches:** `<all_urls>` or `*://*/*` means it can
  read & change **every** site, including banking and email. Justified for a password
  manager or ad-blocker; **not** for a calculator, theme, or single-site tool.
- **High-power permissions to scrutinize:** `tabs`, `webRequest` / `webRequestBlocking`,
  `cookies`, `scripting`, `debugger`, `nativeMessaging` (can talk to a local app),
  `management`, `proxy`, `downloads`.
- **The canonical tell:** trivial stated function + "read and change all your data on all
  websites" = likely compromised or malicious. Reject.

## 2. Publisher & listing signals

- Who publishes it? Established vendor vs. anonymous developer.
- Listing age, last update, review authenticity (floods of generic 5-stars = suspicious).
- Generic name, poor grammar, unprofessional icon, "free premium / speed boost" promises.
- Does it merely replicate a built-in browser feature? (Common malware cover.)
- Search recent security news for the extension name (extensions do get caught and pulled).

## 3. Behavior (if you can get the source)

- Get the unpacked source (a CRX is a zip with a short header: fetch and unpack it inside a
  container, `docker-sandbox.md`, "A single file") or use an extension-source viewer.
- Background service worker: look for network calls to unfamiliar hosts, reading cookies/
  form fields, injecting remote scripts (`fetch(...).then(eval)`), or analytics that isn't
  disclosed.
- Remote-hosted code (loading JS from a server at runtime) = it can change behavior anytime.

## 4. Ongoing risk

- After any update, re-check: new permission requests or changed behavior post-update are
  warning signs (the "compromised after acquisition" pattern). Never auto-approve new perms.

## Safer-handling recommendations

- Install in a **dedicated / throwaway browser profile**, not the one with your logged-in
  banking/email sessions.
- Grant **site access "on click"** or to specific sites instead of "all sites" where the
  browser allows it.
- Keep the extension count low: each one is attack surface.
- For anything sensitive (password/email/finance), prefer first-party or well-known vendors.
