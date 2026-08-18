# 📊 Orange Repo Health

**Orange Repo Health** is a lightweight, frontend-only web application designed to instantly analyze and display the health metrics of any open-source GitHub repository. It is part of the Bitcoin Data Labs suite of tools.

## 🚀 Features

- **Instant Health Metrics**: View Stars, Forks, and Last Update dates.
- **Contributor Diversity**: Get an estimate of active contributors.
- **Issue Resolution**: View the ratio of open to closed issues.
- **PR Merge Rate**: Track the merge success rate of recent Pull Requests.
- **Vitality Score**: A custom heuristic score from 0-100 indicating the overall health and activity level of the repository.

## 🛠️ Tech Stack

- **Vanilla JavaScript**: Zero build steps or bundlers.
- **Vanilla CSS**: Custom premium styling with a responsive layout and dark mode support.
- **GitHub API**: Directly fetches real-time data from GitHub.
- **GitHub Pages**: Hosted entirely via GitHub Pages from the `docs/` directory.

## 💻 How to Run Locally

Since this is a purely static frontend application, you do not need Node.js or any build tools.

1. Clone the repository:
   ```bash
   git clone https://github.com/sorukumar/orange-repo-health.git
   ```
2. Open `docs/index.html` directly in your web browser.
   
*Alternatively, you can serve it using Python:*
```bash
cd orange-repo-health
python3 -m http.server 8000
```
Then navigate to `http://localhost:8000/docs/index.html`.

## 🔑 GitHub API Limits

Unauthenticated requests to the GitHub API are limited to **60 requests per hour**. 
To avoid hitting this limit, click the **Settings (gear icon)** next to the search bar in the app and provide a GitHub Personal Access Token (PAT). This will increase your limit to **5,000 requests per hour**. The token is stored securely in your browser's local storage.

---

*Created by [Bitcoin Data Labs](https://bitcoindatalabs.org) as a contribution to the transparency of the Bitcoin open source ecosystem.*
