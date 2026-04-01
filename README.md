# COINCUBE — Sovereign Banking Deck

Investor pitch deck for [COINCUBE](https://coincube.io), served via GitHub Pages at **[deck.coincube.io](https://deck.coincube.io)**.

## Overview

A single-page HTML slide deck with keyboard/swipe navigation, built for presenting COINCUBE's pre-seed raise. No build step, no dependencies — just static files.

## Usage

Navigate slides with arrow keys, spacebar, or swipe on mobile. Click the left/right arrows in the nav bar, or tap the left/right thirds of the screen.

## Deployment

This repo is deployed automatically via GitHub Pages from the `main` branch.

**DNS:** A `CNAME` record for `deck` pointing to `<org>.github.io` is required. The `CNAME` file in the repo root handles the GitHub side.

## Structure

```
index.html          # The full deck (HTML + CSS + JS, self-contained)
CNAME               # Custom domain config for GitHub Pages
artwork/            # Referenced images only (Kage, product, favicon)
```

## PDF Export

A static PDF version of the deck is maintained separately in the design repo. The export uses Playwright to render each slide at 1920x1080 with the nav bar and arrows hidden.
