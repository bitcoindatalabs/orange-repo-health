# Orange Repo Health: Architecture Summary

## 🏗️ System Overview

The **Orange Repo Health** application is built as a pure, static frontend single-page application (SPA). It is intentionally designed without build tools or bundlers to maximize simplicity, performance, and transparency.

The application interacts directly with the **GitHub REST API** from the client's browser, eliminating the need for a backend server or database.

## 📂 Project Structure

To align with standard GitHub Pages deployment practices, the source code is contained entirely within the `docs/` directory.

```text
orange-repo-health/
├── README.md                 # Project documentation
└── docs/                     # GitHub Pages root
    ├── index.html            # Main UI and layout structure
    ├── styles.css            # Custom styling and design system
    ├── app.js                # Core UI logic, state, and event handling
    └── githubApi.js          # Encapsulated GitHub API interaction layer
```

## 🧩 Components

### 1. Data Layer (`githubApi.js`)
This class handles all asynchronous interactions with the GitHub API.
- **Authentication**: Retrieves and sets Personal Access Tokens (PATs) from `localStorage` to bypass the unauthenticated limit of 60 requests/hour, upgrading it to 5,000 requests/hour.
- **Endpoints Queried**:
  - `/repos/{owner}/{repo}` for base metadata (stars, forks, description, last updated).
  - `/repos/{owner}/{repo}/contributors` for contributor density.
  - `/search/issues` for evaluating open vs. closed issues.
  - `/repos/{owner}/{repo}/pulls` to calculate recent merge ratios.

### 2. Presentation Layer (`index.html` & `styles.css`)
- **Branding**: Dynamically loads the **Bitcoin Data Labs** header and footer components for a unified ecosystem experience.
- **Design System**: Employs a custom Vanilla CSS design system leveraging CSS variables, a modern font (Inter), and glassmorphism.
- **No-Build Setup**: Scripts and stylesheets are loaded directly via standard HTML tags.

### 3. Application Logic (`app.js`)
- Acts as the controller linking the UI to the Data Layer.
- Parses user inputs (supporting both `owner/repo` formats and full GitHub URLs).
- **Comparison Engine**: Supports parallel fetching and rendering of two repositories simultaneously, highlighting the "winner" for each metric.
- **Vitality Score Algorithm**: Calculates a heuristic score (0-100) combining issue closure rates, PR merge rates, active contributors, and recent activity timestamps.

### 4. Advanced Insights (GraphQL)
- Employs a hybrid architecture that conditionally unlocks advanced metrics when a Personal Access Token is detected.
- Executes an optimized GraphQL query to calculate deep metrics:
  - **Bus Factor**: Evaluates key person risk by analyzing the author distribution of the last 100 commits.
  - **Code Review Rigor**: Calculates the average number of reviews and inline discussion threads per merged PR.

### 5. Caching Layer
- Utilizes `sessionStorage` with a 1-hour expiration policy.
- Caches authenticated and unauthenticated queries separately.
- Prevents redundant API calls for recently searched repositories, preserving the user's GitHub API rate limit.

## 🚀 Planned Features & Metrics Roadmap

To further enhance the capability of Orange Repo Health, the following features and creative metrics are planned for future iterations:

1. **Historical Trends (Time-Series Data)**: 
   - Fetch historical commit and issue data, displaying activity trends over time using a charting library (like Chart.js or D3).
2. **Ecosystem Integration**: 
   - Add deep links from `orange-ecosystem-map` nodes directly to this tool to instantly view the health of mapped repositories.
3. **Advanced Security & Dependency Metrics**: 
   - Surface Dependabot alerts and open security vulnerabilities if the user provides an authenticated token with repository access.
4. **Maintainer Responsiveness (Time-to-First-Touch)**:
   - Measure the median time it takes for a newly opened Issue or PR to receive a comment to gauge active community support.
5. **Issue Staleness (The Graveyard Ratio)**:
   - Track the percentage of open issues untouched in the last 6 months to identify overwhelming technical debt or maintainer burnout.
6. **Release Cadence (Shipping Velocity)**:
   - Analyze the median number of days between the last 5-10 releases to evaluate predictable maintenance cycles.
7. **Community Engagement Density**:
   - Evaluate non-code interactions (e.g., emoji reactions on issues) to measure the active user base beyond just core developers.
8. **First-Time Contributor Success Rate**:
   - Determine the percentage of PRs opened by first-time contributors that are successfully merged, indicating a welcoming ecosystem.
