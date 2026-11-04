# Front-end change log — 2026-08-20

Repo: `plana-usa/company-intelligence-platform` (branch `main`)
Preview: https://plana-usa.github.io/company-intelligence-platform/
Author: Scout | For: Vu

---

## 1. Acquisition Doc Studio — real Junkola mark in the sidebar

**File:** `acquisition/acquisition-doc-studio.html`
**Type:** Visual / branding fix

The sidebar header used a placeholder logo: a 26×26 red block with an orange
half-height bar underneath. Replaced with the actual PLANA polygon mark as an
inline SVG (`viewBox="30.52 20.5 154.96 175"`), filled with a linear gradient
from `#e50602` → `#e56203` running bottom-left to top-right.

- Mark is inline SVG at 26×26, `role="img"`, `aria-label="PLANA"`.
- Gradient is defined as `<linearGradient id="planaMarkGrad">` inside the
  studio's own `<defs>`.
- No layout change — the container keeps the same 26px footprint, now with
  flex centering instead of `position:relative` cropping.

**Note for Vu:** the gradient id `planaMarkGrad` is global to the document. If
this mark gets reused elsewhere on the same page, namespace the id per
instance so the two `<defs>` don't collide.

---

## 2. DD Admin — invite and handoff links pointed at a file that doesn't exist

**File:** `due-diligence/dd-admin.html`
**Type:** Bug fix (broken links — was producing 404s on the Pages site)

`dd-admin.html` built every outbound URL against `index.html`, but there is no
`index.html` inside `/due-diligence/` — the investor portal is
`due-diligence-answer-engine.html`. Result: every invite link generated from
the Invites tab 404'd, as did the answered-question handoff back to the portal.

Changed (5 lines):

| Line | Was | Now |
|------|-----|-----|
| 270 | `href="index.html"` → "Open index.html (investor portal)" | `href="due-diligence-answer-engine.html"` → "Open the investor portal" |
| 623 | `inviteUrl()` → `` `index.html?invite=…` `` | `` `due-diligence-answer-engine.html?invite=…` `` |
| 662 | `investorUrl` → `` `index.html?answered=1…` `` | `` `due-diligence-answer-engine.html?answered=1…` `` |
| 23, 29 | header comments spelling out the old `index.html?…` paths | updated to the real filename |

Affects both **Copy link** and the **Preview email** CTA in
Due Diligence → Invites, and the "answered" handoff from the admin back to
the portal.

**How to verify on the Pages site:**

1. Open `/due-diligence/dd-admin.html` → Invites → **Copy link** on any invite.
2. Paste it — it should now land on
   `/due-diligence/due-diligence-answer-engine.html?invite=…` and show the
   pre-filled sign-up card with "✓ Invited by …", not the invite-only wall.

---

## 3. Root index.html — TOC card opens the portal with a demo invite

**File:** `index.html` (repo root)
**Type:** Demo / review affordance

The Due Diligence Answer Engine card linked straight to
`due-diligence/due-diligence-answer-engine.html`, which means anyone opening it
from the table of contents hit the invite-only wall and could go no further.
The card now carries a demo invite handoff:

```
due-diligence/due-diligence-answer-engine.html?invite=demo&iname=Scout%20Underwood&iemail=scout.underwood@plana.aero&irole=Investor/lender&iby=Duc
```

- Kept as a **relative** path, matching every other card, so the TOC still
  works from a local copy as well as on GitHub Pages.
- Ampersands escaped as `&amp;` in the attribute.
- Card copy now says it "opens with a demo invite so it skips the invite-only
  wall," and the `.path` label shows `?invite=demo…` so it's obvious the link
  carries a query string.
- An HTML comment above the card explains why the params are there and says to
  strip them once real invite tokens exist.

**Note for Vu:** this is a presentation shortcut for review, not behavior to
port. On the real platform the TOC should link to the bare portal URL and let
the invite token come from an emailed link.

---

## Still open — carried over, not changed today

**The invite gate is presence-only.** `handleInviteGate()` in
`due-diligence-answer-engine.html` unlocks on *any* `?invite=` value; it never
validates the token. That's intentional for the click-through prototype (the
existing code comment says so), but on the real platform it needs:

1. A token generated and stored server-side against the invitee's email.
2. Single-use + expiry.
3. Validation on load (`GET /api/invites/:token`) rather than in the browser.
4. Acceptance writing back so the invite flips to "Accepted" in the
   dd-admin Invites list — today `dd-admin.html` and the portal can't share
   state, so that status is local-only.

Also worth deciding: whether the portal file should simply be renamed to
`due-diligence/index.html`, which would make the folder URL
(`/due-diligence/`) work on its own and match how the admin file originally
described it. Flagging rather than doing it — it changes the public URL that's
already been shared for review.
