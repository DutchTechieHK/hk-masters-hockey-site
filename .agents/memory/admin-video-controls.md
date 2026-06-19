---
name: Admin tutorial video controls & sound
description: Why tutorial clips can play silently and how the control bar / unmute is gated
---

# Admin tutorial video controls & sound

The admin "Tutorials" page (hk-masters) opens each admin-video-series clip in a
**new tab** via `window.open` (it used to be an `<iframe allow="autoplay">`, but
that was dropped due to nested-routing/iframe display issues in production).

`VideoWithControls` renders its control bar — which is the ONLY unmute affordance
— based on `showControls`. Historically that was `isIframed` only
(`window.self !== window.top`). So a clip opened in a standalone tab rendered a
bare `<VideoTemplate>` with **no controls**, and since `<audio autoPlay>` is
unmuted, the browser autoplay policy blocks it → clip plays **silently with no
way to unmute**.

**Rule:** standalone viewing tabs must pass `?view=1`; controls show when
`isIframed || URLSearchParams.has('view')`. The Tutorials page appends `?view=1`.

**Why:** the SAME standalone clip URLs are reused by the **Download MP4 export**
(`buildExportUrl` in VideoWithControls), which must render chrome-free for clean
recordings. So you cannot just always show controls — gate on the flag, and keep
export URLs flag-free.

**How to apply:** if adding new entry points to a clip, append `?view=1` for human
viewing, omit it for export/recording. Recording itself is triggered by
externally-injected `window.startRecording`/`stopRecording` globals (see
`lib/video/hooks.ts`), NOT a URL param — don't try to detect recording via query
string. Unmuted autoplay stays browser-blocked, so audible playback always
requires a user gesture (the unmute click); don't expect auto-sound on load.
