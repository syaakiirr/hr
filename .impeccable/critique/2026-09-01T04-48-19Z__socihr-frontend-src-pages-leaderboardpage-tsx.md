---
target: LeaderboardPage.tsx
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-09-01T04-48-19Z
slug: socihr-frontend-src-pages-leaderboardpage-tsx
---
# Design Critique: Staff Engagement Leaderboard (`LeaderboardPage.tsx`)

Method: degraded (single-context: spawn_agent unavailable in this session)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good loading & empty states; lacks real-time refresh indicator |
| 2 | Match System / Real World | 3 | Medal podium is intuitive; tier definitions implicit |
| 3 | User Control and Freedom | 3 | Department & search filters work; lacks instant "Reset Filters" action |
| 4 | Consistency and Standards | 3 | Emoji iconography diverges from SociHR's SVG design token standard |
| 5 | Error Prevention | 4 | Search and department selectors filter defensively without runtime crashes |
| 6 | Recognition Rather Than Recall | 3 | Point scoring formula is hidden; users must guess point weights |
| 7 | Flexibility and Efficiency | 2 | No column sorting (Score, Rate, Likes) and no `/` search keyboard shortcut |
| 8 | Aesthetic and Minimalist Design | 3 | Engaging podium layout; emoji glyphs slightly noisy on dark theme |
| 9 | Error Recovery | 3 | Clean empty state when search returns zero rows |
| 10 | Help and Documentation | 2 | Missing contextual tooltip for point breakdown formula |
| **Total** | | **29/40** | **Good** |

---

## Design Specificity Verdict

**LLM Assessment:**
The Leaderboard interface successfully translates HR social engagement monitoring into an engaging, gamified workplace recognition center. The top-3 podium creates clear visual hierarchy, and the Diamond/Gold/Silver tier system encourages positive peer competition. However, reliance on raw emoji glyphs (`👑`, `⭐`, `👍`, `💬`, `🔄`) introduces visual inconsistency against SociHR's crisp Geist typography and SVG icon token system outlined in `DESIGN.md`.

**Deterministic Scan:**
`detect.mjs` scan passed cleanly with 0 automated violations across Tailwind and CSS utility classes.

---

## Overall Impression
Strong, visually appealing layout that delivers instant recognition value for top performers. With refined SVG metrics, interactive column sorting, and scoring transparency, it transforms into an enterprise-grade gamification center.

---

## What's Working
1. **Tier 1 Top-3 Podium Layout:** Clear physical elevation between 1st place (`crown badge` + gold ring) and 2nd/3rd runners-up.
2. **Multi-Action Metric Breakdown:** Displays granular Likes, Comments, and Shares alongside overall completion rates.
3. **Smooth Theme Transition:** Adapts cleanly to both Dark Mode and Light Mode with appropriate contrast tokens.

---

## Priority Issues

### [P1] Scoring Transparency & Tooltip
- **Why it matters:** Users see aggregate points (e.g. `450 pts`) without knowing the formula weight (`Completed × 10 + Shares × 3 + Comments × 2 + Likes × 1`), leading to confusion on why ranks differ.
- **Fix:** Add an info tooltip icon next to "Score" explaining the point multiplier.
- **Suggested command:** `$impeccable clarify`

### [P2] Replace Raw Emojis with Micro SVG Badges
- **Why it matters:** Raw emojis vary across operating systems (Windows Segoe UI Emoji vs Apple Color Emoji) and break dark mode color harmony.
- **Fix:** Use curated Lucide/SVG icons with themed color fills (`#2563eb` for thumbs-up, `#6366f1` for message, `#16a34a` for repeat).
- **Suggested command:** `$impeccable polish`

### [P3] Interactive Table Sorting & Search Accelerator
- **Why it matters:** Power users (Alex) cannot sort columns by highest score, most shares, or lowest completion rate, nor press `/` to jump to the search box.
- **Fix:** Make table headers clickable to sort ascending/descending and bind the `/` keydown listener to the search input.
- **Suggested command:** `$impeccable layout`

---

## Persona Red Flags

- **Alex (Power User):** Cannot click column headers to sort by "Most Shares" or "Completion Rate" to discover specialized department champions.
- **Jordan (First-Timer):** Doesn't understand how points are accrued without an explanatory tooltip or scoring guide.
- **Sam (Accessibility):** Emojis inside table cells lack explicit `aria-label` or accessible text descriptions.
- **Riley (Stress Tester):** Filtering by a department with only 1 staff member causes the podium grid to span awkwardly as a single full-width box.

---

## Questions to Consider
1. Would adding a "Streak" counter (consecutive sessions with 100% completion) further motivate staff engagement?
2. Should department admins only see their own department podium while SuperAdmins see the company-wide podium?
