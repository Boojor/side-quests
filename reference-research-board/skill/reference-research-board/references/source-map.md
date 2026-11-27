# Source map: where each medium lives, and how these tools get in

Read at intake question 4. A route marked **not proven** is tried on one item before a run
depends on it. When a route fails, say so in one line before using another (source gate).

| Medium | Where it lives | Route | Login | Proven? |
|---|---|---|---|---|
| Websites, product pages | Live sites; Awwwards, recent.design, One Page Love and similar for leads | Leads by a background research agent with web search; capture agent, headless Playwright, 1440 x 900 | No | **Yes**, on several boards. Land-book, Lapa Ninja, Siteinspire and Httpster blocked automated fetching |
| Free pictures (public domain, CC0) | Public Domain Image Archive (pdimagearchive.org); Cleveland Museum of Art open access; Rijksmuseum | The desktop app's built-in browser, or fetching the pages; download the image from its own page | No | **Yes** for the Public Domain Image Archive in the built-in browser (search, image pages and the rights fields read). Cleveland's open access API answered without a key. Rijksmuseum: policy page read, no board run yet |
| Social posts and ads | Instagram, Pinterest, Behance, ad libraries | **The user's own screenshots and saved images** | No | **Always works** |
| | | Meta Ad Library, Google Ads Transparency Center | Not known | **Not proven** |
| | | Pinterest and Behance pages | n/a | **Blocked** for these tools (sign-in wall, HTTP 403). Ask for screenshots instead |
| Print (letterheads, brochures, flyers, posters) | Brand books and PDFs, studio case studies, Fonts In Use | Fetch and download | No | **Yes**. Shipped print often appears only as mockups |
| Motion and video | Vimeo, YouTube, studio reels | Exact timestamps, then frames from the headless browser | No | **Yes** |
| Lines of writing | Writers' own pages | Save the page, check the line word for word (SKILL.md, Text mode) | No | **Yes** for the method; the save-and-search check in this form **not run yet** |

**Never for social:** Fonts In Use and poster galleries (mostly posters and print; a social board
failed on them).

## Free archives: the rights rule

An archive being "free" is not enough. Check each picture's own page:

- **Public Domain Image Archive:** every image page shows two fields, **Underlying rights** (for
  example "Public Domain Worldwide") and **Digital rights**. Keep a picture only when the
  underlying rights are "Public Domain Worldwide" and the digital rights carry no conditions
  (public domain mark, CC0, "No Rights Reserved"). Skip anything with attribution or share-alike
  conditions when the plan asked for pictures with no strings. The archive's own titles and tags
  are CC BY-NC: write card titles in your own words. Crediting the archive is not required but
  appreciated.
- **Cleveland Museum of Art:** open access images are CC0. The API needs no key, for example
  `https://openaccess-api.clevelandart.org/api/artworks/?q=engraving&has_image=1&cc0=1`
  (check `share_license_status` is `CC0` per item).
- **Rijksmuseum:** public domain or CC0 images may be used commercially without permission;
  credit appreciated. Newer works can still be in copyright: check the rights on each object's page.
- None of these pages addresses people's likeness or trademarks. A picture of a person or a brand
  is the user's call.

## Image search (any medium)

Google Images first. If it shows a human check, do not try to get past it: use Bing Images or
DuckDuckGo Images, but ask the user first (source gate). Always keep the **page** the image came from, never the search result or the
thumbnail URL, and capture or download from that page.

## Downloading images

Download each picture from its own page's image link, with the same safe `curl` as text mode: only `http` and
`https`, the URL in single quotes (skip any URL that contains a quote), a file name you choose:

```bash
mkdir -p candidates && curl -sL --proto '=http,https' --proto-redir '=http,https' --max-time 20 \
  --max-filesize 20000000 '<image url>' -o "candidates/<nn>-<short-name>.jpg"
```

Open each file before it goes on the contact sheet: if it is not a real JPEG or PNG picture, drop it.

## Contact sheet (step 3b)

Needs ImageMagick (`montage`).

```bash
montage ./candidates/*.jpg -font /System/Library/Fonts/Supplemental/Arial.ttf -pointsize 20 \
  -set label '%[basename]' -geometry 260x390+6+6 -tile 6x ./contact-<search>.jpg
```

Keep the candidate images in `candidates/` in the topic folder. Name every downloaded image yourself (only `a-z`, `0-9`, `-`, ending in `.jpg`; ImageMagick reads a PNG saved under that name too), never with a name taken from
the web, and keep the paths starting with `./` so no name can be read as an option. `<search>` follows the same rule.

Give the font as a path: without it, `montage` can fail to draw the labels. The path above is a
Mac font; on another system, point at any `.ttf` file. At most 24 images per sheet so the labels
stay readable.

## Search wording

- Narrow, job-shaped searches beat broad ones. "university open day instagram post" found full
  passes; "school admissions social media ad" found busy template-shop ads.
- Add what must be in the piece (for example "partner logos", "full bleed photo").
- In an archive, search for the thing in the picture ("comet", "moon phases", "constellation"),
  not for the format you are making ("poster").
