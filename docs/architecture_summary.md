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
- **Vitality Score Algorithm**: Calculates a heuristic score (0-100) combining issue closure rates, PR merge rates, active contributors, and recent activity timestamps.

## 🚀 Planned Features (Roadmap)

To further enhance the capability of Orange Repo Health, the following features are planned for future iterations:

1. **Repository Comparison Tool**: 
   - Allow users to input two repositories simultaneously to generate a side-by-side comparison of their health metrics.
2. **Historical Trends (Time-Series Data)**: 
   - Integrate with the GitHub GraphQL API to fetch historical commit and issue data, displaying activity trends over time using a charting library (like Chart.js or D3).
3. **Ecosystem Integration**: 
   - Add deep links from `orange-ecosystem-map` nodes directly to this tool to instantly view the health of mapped repositories.
4. **Caching & Rate Limit Optimization**: 
   - Implement `sessionStorage` or `IndexedDB` caching to prevent redundant API calls for recently searched repositories, saving API rate limits.
5. **Advanced Security & Dependency Metrics**: 
   - Surface Dependabot alerts and open security vulnerabilities if the user provides an authenticated token with repository access.
