---
name: github-optimizer
description: Audit, optimize and maintain GitHub repository discoverability, README positioning, metadata topics, and developer marketing.
---

# GitHub Repository Optimizer

## When to Use This Skill

Use this skill when:
- Preparing a repository for public launch or open-source release.
- Auditing existing repositories for SEO, discoverability, and conversion.
- Optimizing README structure, value proposition, and documentation hierarchy.
- Configuring repository metadata (topics, description, social preview, license).
- Ensuring technical credibility (automated CI workflows, test badges, clean formatting).

## Core Principles

1. Strict No-Emoji Policy
   - Professional open-source tools communicate rigor through clear typography, structured tables, and technical precision.
   - Never use emojis in titles, headers, bullet points, commits, or metadata.

2. Answer-First Architecture
   - Define what the tool is in the first sentence.
   - State the target audience and solved problem within the top 300 pixels.
   - Display a functional visual preview (screenshot or demo) immediately above the fold.

3. Complete Privacy and Data Protection
   - Never commit real personal data (names, emails, phones, documents) into repository history or screenshots.
   - Use explicit placeholders complying with privacy regulations (e.g. LGPD, GDPR).
   - Ensure SQLite, temporary storage, and local artifacts are ignored in .gitignore.

4. Fast Time-to-Value (TTV)
   - The Quickstart must require no more than 3 shell commands.
   - Tests must execute deterministically with zero configuration out-of-the-box.

## Optimization Checklist

### 1. Metadata and Discoverability
- Name: Concise, hyphenated, keyword-rich.
- Description: 5 to 15 words highlighting core technologies and primary value.
- Topics: Maximize all 20 allowed GitHub topics covering domain, runtime, frameworks, and architecture.
- License: Official open-source license (MIT, Apache 2.0).

### 2. High-Impact README Layout
- Header: Project title and descriptive subtitle.
- Badges: CI status, runtime version, test count, license, language.
- Visual Demo: High-contrast screenshot or interactive recording.
- Comparison Matrix: Clear differentiation against traditional alternatives (e.g. Local-first vs SaaS).
- Architecture and Tech Stack: Explanation of core modules and algorithmic layers.
- Quickstart: Copy-paste commands for setup, test, and dev server execution.
- Project Structure: Clean ASCII file tree without internal scratch directories.

### 3. Continuous Integration and Quality Signals
- GitHub Actions workflow running automated test suites on push and pull request.
- Zero flaky tests.
