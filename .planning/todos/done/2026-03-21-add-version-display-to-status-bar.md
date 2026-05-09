---
created: 2026-03-21T22:29:58.333Z
title: Add version display to status bar
area: ui
files: []
---

## Problem

The GSD status bar (used in Claude Code sessions) doesn't show the current GSD version. Users have no quick way to see which version they're running without checking manually.

## Solution

Add the GSD version number to the status bar display. Pull version from package.json or the existing version detection logic and append it to the bar output.
