# HK Masters Hockey – Content Guide

This is your beginner's cheat-sheet for editing the public website.  
Each entry below tells you which file to open, the URL it lives at, and exactly what to change.

---

## Pages

### 1. Home
**File:** `src/pages/Home.jsx`  
**URL:** `/hk-masters-web/`

What to change:
- `heroImageUrl` — set this to the path of your hero banner image (e.g. `"/images/hero.jpg"`)
- Hero headline and sub-headline — look for the `<h1>` and `<p>` tags inside the `<section>` with `bg-[#006B3C]`
- Welcome intro paragraph — the `<p>` below "Welcome to HK Masters Hockey"
- Club stats (`80+`, `3`, `15+`) — update these three numbers in the `upcomingEvents` and stats grid
- `upcomingEvents` array (lines 10–30) — replace with real upcoming events (name, date, location, description)
- `sponsorLogos` array (lines 33–38) — replace each `name` with a real sponsor name, and swap the placeholder `<div>` for an `<img>` tag pointing to the logo file

---

### 2. About
**File:** `src/pages/About.jsx`  
**URL:** `/hk-masters-web/about`

What to change:
- Mission statement paragraphs — two `<p>` tags in the "Our Mission" section
- `committee` array (lines 7–14) — replace name, role, and add a real `image` path for each person. When `image` is set, the `<img>` will render automatically
- `timeline` array (lines 17–47) — update years, event names, and detail descriptions

---

### 3. Teams
**File:** `src/pages/Teams.jsx`  
**URL:** `/hk-masters-web/teams`

What to change:
- `squads` array (lines 7–50) — for each squad, update:
  - `name` and `shortName`
  - `description` paragraph
  - `photo` — set to a real image path; the page will render it automatically
  - `playerCount`, `coach`, `captain`
- "Join the Team" CTA paragraph — update eligibility info and season dates

---

### 4. Events
**File:** `src/pages/Events.jsx`  
**URL:** `/hk-masters-web/events`

What to change:
- `upcomingEvents` array (lines 6–30) — add or edit events (name, date, location, description)
- `pastEvents` array (lines 32–47) — add past events with optional `result` field (shown as a red badge)

---

### 5. Rotterdam 2026
**File:** `src/pages/Rotterdam2026.jsx`  
**URL:** `/hk-masters-web/rotterdam-2026`

What to change:
- `keyDates` array (lines 7–20) — update dates and milestone descriptions
- `squads` array (lines 22–43) — update pool groups and first match details once the draw is done
- Tournament overview paragraphs — two `<p>` tags in the "About the Tournament" section
- Travel & Logistics boxes — three cards (Flights, Accommodation, Kit) — replace placeholder text with real info
- `teamManagementUrl` (line 46) — update if the team management app is served at a different path
- "Team Members Only" button — links to the team management portal for squad members

---

### 6. Media
**File:** `src/pages/Media.jsx`  
**URL:** `/hk-masters-web/media`

What to change:
- `galleryPhotos` array (lines 17–27) — set `src` to a real image path for each photo (e.g. `"/images/gallery/photo-name.jpg"`), and update `caption`. When `src` is set, `<img>` renders automatically
- `videos` array (lines 30–42) — set `youtubeId` to a real YouTube video ID. To find the ID: copy the part after `v=` in a YouTube URL (e.g. `dQw4w9WgXcQ`)

---

### 7. Sponsors
**File:** `src/pages/Sponsors.jsx`  
**URL:** `/hk-masters-web/sponsors`

What to change:
- `tiers` array — three tiers: Gold, Silver, Bronze. In each tier, update:
  - `sponsors` list: set `name` and `logo` path for each sponsor. When `logo` is set, the real image renders
  - `description` — the tier benefit description
- `sponsorshipEmail` (near the top) — replace with the real sponsorship contact email

---

### 8. Contact
**File:** `src/pages/Contact.jsx`  
**URL:** `/hk-masters-web/contact`

What to change:
- `contactDetails` object (lines 20–30) — update `email`, `phone`, `address`, and `social` URLs
- `mapsEmbedSrc` (line 33) — paste the Google Maps iframe `src` URL here (see comment in the file)
- Contact form — currently shows a demo success state. To make it live:
  1. Sign up at [Formspree](https://formspree.io) (free tier available)
  2. Replace `onSubmit` with a real form `action` attribute pointing to your Formspree endpoint

---

## Shared Files

### Layout (Navigation + Footer)
**File:** `src/components/Layout.jsx`

- Club logo (top-left) — replace the `HK` text div with `<img src="..." />` pointing to your crest
- Footer tagline — the `<p>` inside the "Club Info" column
- Footer email link — update `info@hkmastershockey.com` to the real club email
- Social media links in footer — update `href="#"` to real URLs

### Colours
**File:** `src/index.css`

The Hong Kong Masters brand palette is defined at the top:
- `--color-hk-green`: `#006B3C` (primary green)
- `--color-hk-green-light`: `#00914F`
- `--color-hk-green-dark`: `#004A2A`
- `--color-hk-red`: `#DE2910` (HK red accent)

To change brand colours, update these values.

---

## Adding Images

1. Place image files in `public/images/` (create the folder if it doesn't exist)
2. Reference them as `/images/your-file.jpg` in the code
3. For squad photos: `public/images/teams/`
4. For gallery photos: `public/images/gallery/`
5. For sponsor logos: `public/images/sponsors/`

---

## Tips

- Every editable piece of content has a `// TODO:` comment directly above it in the code — search for `TODO` to find them all quickly
- When an `image` or `logo` field is `null`, a placeholder is shown automatically. Set it to a real path to show the real image
- The site is fully static — no database, no backend, no login required
