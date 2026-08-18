/* app.js */

document.addEventListener('DOMContentLoaded', () => {
    const api = new GitHubAPI();

    // DOM Elements
    const searchForm = document.getElementById('search-form');
    const repoInput = document.getElementById('repo-input');
    const errorMessage = document.getElementById('error-message');
    const loadingIndicator = document.getElementById('loading-indicator');
    const dashboard = document.getElementById('dashboard');

    // Modal Elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const patInput = document.getElementById('pat-input');

    // Initialization
    if (api.getToken()) {
        patInput.value = api.getToken();
    }

    // Event Listeners
    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'flex';
    });

    const closeModal = () => {
        settingsModal.style.display = 'none';
    };

    closeModalBtn.addEventListener('click', closeModal);
    
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeModal();
        }
    });

    saveSettingsBtn.addEventListener('click', () => {
        api.setToken(patInput.value.trim());
        closeModal();
    });

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rawInput = repoInput.value.trim();
        let owner, repo;

        // Parse input: can be URL or owner/repo format
        if (rawInput.includes('github.com/')) {
            const parts = new URL(rawInput).pathname.split('/').filter(Boolean);
            if (parts.length >= 2) {
                owner = parts[0];
                repo = parts[1];
            }
        } else {
            const parts = rawInput.split('/');
            if (parts.length === 2) {
                owner = parts[0];
                repo = parts[1];
            }
        }

        if (!owner || !repo) {
            showError('Please enter a valid repository format (e.g., owner/repo)');
            return;
        }

        hideError();
        showLoading();
        
        try {
            await fetchAndDisplayMetrics(owner, repo);
        } catch (error) {
            showError(error.message);
        } finally {
            hideLoading();
        }
    });

    async function fetchAndDisplayMetrics(owner, repo) {
        // Fetch all data in parallel
        const [repoData, contributors, issues, prs] = await Promise.all([
            api.fetchRepo(owner, repo),
            api.fetchContributorsCount(owner, repo),
            api.fetchIssueStats(owner, repo),
            api.fetchRecentPRStats(owner, repo)
        ]);

        // Update UI
        document.getElementById('repo-name').textContent = repoData.full_name;
        document.getElementById('repo-description').textContent = repoData.description || 'No description available.';
        
        // Formatter
        const numFormatter = new Intl.NumberFormat('en-US');
        
        document.getElementById('stat-stars').textContent = numFormatter.format(repoData.stargazers_count);
        document.getElementById('stat-forks').textContent = numFormatter.format(repoData.forks_count);
        
        const lastUpdate = new Date(repoData.updated_at);
        document.getElementById('stat-updated').textContent = lastUpdate.toLocaleDateString();

        // Contributors
        const contribEl = document.getElementById('metric-contributors');
        contribEl.textContent = contributors >= 100 ? '100+' : contributors;

        // Issues
        const totalIssues = issues.open + issues.closed;
        const issueRate = totalIssues > 0 ? Math.round((issues.closed / totalIssues) * 100) : 0;
        document.getElementById('metric-issues').textContent = `${issueRate}%`;
        document.getElementById('issues-open').textContent = numFormatter.format(issues.open);
        document.getElementById('issues-closed').textContent = numFormatter.format(issues.closed);

        // PRs
        const prRate = prs.total > 0 ? Math.round((prs.merged / prs.total) * 100) : 0;
        document.getElementById('metric-prs').textContent = `${prRate}%`;

        // Calculate Vitality Score (Basic Heuristic)
        let score = 0;
        
        // +30 for good issue resolution (> 70%)
        if (issueRate > 70) score += 30;
        else if (issueRate > 40) score += 15;
        
        // +30 for PR merges
        if (prRate > 50) score += 30;
        else if (prRate > 20) score += 15;
        
        // +20 for active contributors
        if (contributors > 50) score += 20;
        else if (contributors > 10) score += 10;
        else if (contributors > 1) score += 5;
        
        // +20 for recent updates (within last 30 days)
        const daysSinceUpdate = (new Date() - lastUpdate) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 30) score += 20;
        else if (daysSinceUpdate < 90) score += 10;

        // Display Score
        document.getElementById('vitality-score').textContent = score;
        document.getElementById('vitality-progress').style.width = `${score}%`;

        // Determine color based on score
        const progressFill = document.getElementById('vitality-progress');
        if (score >= 80) progressFill.style.backgroundColor = '#10b981'; // Green
        else if (score >= 50) progressFill.style.backgroundColor = '#f59e0b'; // Yellow
        else progressFill.style.backgroundColor = '#ef4444'; // Red

        dashboard.style.display = 'block';
    }

    function showLoading() {
        dashboard.style.display = 'none';
        loadingIndicator.style.display = 'flex';
    }

    function hideLoading() {
        loadingIndicator.style.display = 'none';
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.style.display = 'block';
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }
});
