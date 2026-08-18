# Hybrid REST/GraphQL Implementation Plan

## Goal
Enhance the **Orange Repo Health** application by implementing a hybrid data-fetching architecture. 
- **Tier 1 (Anonymous Users)**: Continue using the GitHub REST API to instantly provide basic health metrics (Stars, Issues, Contributors) to anyone without requiring authentication.
- **Tier 2 (Power Users)**: Implement a locked "Advanced Insights" section that uses the GitHub GraphQL API to calculate deep, historical metrics (e.g., Bus Factor, Review Rigor). This section is only unlocked when the user provides a Personal Access Token (PAT).

## Proposed Changes

### 1. UI Layer (`docs/index.html` & `docs/styles.css`)
- **Advanced Insights Section**: Add a new HTML section below the main metrics grid.
- **Locked State**: If no PAT is found in `localStorage`, this section should have a visual "blur" or "glassmorphism lock" overlay with a lock icon 🔒 and a call-to-action button: *"Unlock Advanced Insights with a GitHub Token"*.
- **Unlocked State**: If a PAT is present, the overlay is removed, and the metrics are populated.

### 2. Data Layer (`docs/githubApi.js`)
- **GraphQL Endpoint**: Add a new method `fetchAdvancedMetrics(owner, repo)` that sends a `POST` request to `https://api.github.com/graphql`.
- **The GraphQL Query**: Write a single, optimized GraphQL query that fetches:
  1. The default branch's commit history (to calculate the **Bus Factor** by grouping commit authors).
  2. The last 30 merged Pull Requests and their associated `reviews` and `reviewThreads` (to calculate **Code Review Rigor**).
- **Error Handling**: Gracefully handle cases where the PAT lacks permissions or the GraphQL query fails, ensuring it doesn't break the Tier 1 REST metrics.

### 3. Application Logic (`docs/app.js`)
- Update the main `fetchAndDisplayMetrics` orchestrator.
- Always execute the `Promise.all` for the REST API metrics.
- **Conditional Fetch**: If `api.getToken()` returns a valid token, fire off the `api.fetchAdvancedMetrics()` in parallel.
- Map the GraphQL response to the new UI cards (e.g., updating a "Bus Factor: 85% by 1 developer" UI element).

## Verification Plan
1. **Unauthenticated Test**: Search for `bitcoin/bitcoin` without a token. Verify the base metrics load and the Advanced section remains locked/blurred.
2. **Authenticated Test**: Add a valid PAT. Search again. Verify the Advanced section unlocks and the Bus Factor / Review Rigor metrics populate correctly using the GraphQL data.
