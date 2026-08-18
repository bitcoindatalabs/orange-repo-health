# 🧠 Creative Repo Health Metrics Ideation

To build a truly world-class open-source health dashboard, we need to go beyond surface-level vanity metrics (like Stars or total Forks). 

Here is a breakdown of the raw data points available via the GitHub API and the **creative, high-signal metrics** we can derive from them to measure actual repository vitality.

---

## 1. The "Bus Factor" (Key Person Risk)
**Data Points Used:** `/repos/{owner}/{repo}/stats/contributors` (Commit history per author)
**The Metric:** What percentage of total contributions come from the top 1 or 2 developers?
- **Why it matters:** If a project has 50 contributors, but the founder makes 95% of the commits, the project is highly vulnerable if that founder steps away (a high "Bus Factor"). 
- **Health Indicator:** A lower percentage (e.g., top dev accounts for < 40% of commits) indicates a resilient, distributed team.

## 2. Maintainer Responsiveness (Time-to-First-Touch)
**Data Points Used:** `/repos/{owner}/{repo}/issues` & `/repos/{owner}/{repo}/issues/{issue_number}/comments`
**The Metric:** The median time it takes for a newly opened Issue or PR to receive a comment from a maintainer or collaborator.
- **Why it matters:** Fast response times keep external contributors motivated. A repo where PRs sit in silence for weeks feels "dead" to new developers.
- **Health Indicator:** < 48 hours is Excellent. > 2 weeks is At-Risk.

## 3. Code Review Rigor
**Data Points Used:** `/repos/{owner}/{repo}/pulls` & `/repos/{owner}/{repo}/pulls/{pull_number}/reviews`
**The Metric:** The average number of code reviews and review comments per merged Pull Request.
- **Why it matters:** Are PRs just being rubber-stamped and merged, or is there a healthy engineering culture of peer review? 
- **Health Indicator:** Averaging > 1 review and a few discussion comments per PR indicates a highly rigorous and secure engineering culture (crucial for Bitcoin projects).

## 4. Issue Staleness (The Graveyard Ratio)
**Data Points Used:** `/search/issues` (filtering by `updated` timestamp)
**The Metric:** The percentage of open issues that have not been touched, commented on, or updated in the last 6 months.
- **Why it matters:** Having 1,000 open issues isn't necessarily bad if they are actively tracked. Having 1,000 issues where 800 haven't been touched in two years indicates overwhelming technical debt or maintainer burnout.
- **Health Indicator:** A low staleness ratio (< 20%) means the backlog is actively groomed.

## 5. Release Cadence (Shipping Velocity)
**Data Points Used:** `/repos/{owner}/{repo}/releases`
**The Metric:** The median number of days between the last 5 to 10 releases.
- **Why it matters:** Software that isn't shipping is stagnating. 
- **Health Indicator:** Consistent, predictable release cycles (e.g., a minor release every 30-60 days) strongly signal an active, healthy maintenance cycle.

## 6. Community Engagement Density
**Data Points Used:** `/repos/{owner}/{repo}/issues` (Reactions `+1`, `heart`, etc.)
**The Metric:** The ratio of non-code interactions (emoji reactions, comments from non-maintainers) to the number of issues.
- **Why it matters:** Shows if the project has "fans" and an active user base, not just active coders. A high number of 👍 on issues means real users are waiting for fixes.

## 7. First-Time Contributor Success Rate
**Data Points Used:** GraphQL API (can filter PRs by author association `FIRST_TIMER`)
**The Metric:** The percentage of Pull Requests opened by first-time contributors that actually get merged vs. closed unmerged.
- **Why it matters:** This measures how welcoming and supportive the project is to new Bitcoin developers. If 90% of first-time PRs are closed without merging, the community is likely hostile or the codebase is too difficult to approach.

---

### Implementation Feasibility
Metrics **4 (Staleness)**, **5 (Release Cadence)**, and **6 (Engagement)** are relatively lightweight and can be calculated very quickly in the browser with 1 or 2 API calls.

Metrics **1 (Bus Factor)**, **2 (Responsiveness)**, and **3 (Review Rigor)** require paginating through historical data. These would be perfect for our SPA if we use the **GraphQL API** (which allows us to fetch exactly what we need in a single complex query) rather than making dozens of REST API calls.
