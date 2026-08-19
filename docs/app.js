/* app.js */

document.addEventListener('DOMContentLoaded', () => {
    const api = new GitHubAPI();

    // DOM Elements
    const searchForm = document.getElementById('search-form');
    const repoInput = document.getElementById('repo-input');
    const repoInput2 = document.getElementById('repo-input-2');
    const compareWrapper = document.getElementById('compare-wrapper');
    const toggleCompareBtn = document.getElementById('toggle-compare-btn');
    const errorMessage = document.getElementById('error-message');
    const loadingIndicator = document.getElementById('loading-indicator');
    const dashboardContainer = document.getElementById('dashboard-container');
    const dashboardTemplate = document.getElementById('dashboard-template');

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
        // Automatically re-analyze if there is an active search
        if (repoInput.value.trim() && dashboardContainer.innerHTML !== '') {
            searchForm.dispatchEvent(new Event('submit'));
        }
    });

    toggleCompareBtn.addEventListener('click', () => {
        if (compareWrapper.style.display === 'none') {
            compareWrapper.style.display = 'flex';
            toggleCompareBtn.textContent = '- Remove comparison';
        } else {
            compareWrapper.style.display = 'none';
            repoInput2.value = '';
            toggleCompareBtn.textContent = '+ Compare with another repository';
        }
    });

    // Quick Audit Buttons
    document.querySelectorAll('.quick-audit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const repo1 = btn.getAttribute('data-repo1');
            const repo2 = btn.getAttribute('data-repo2');
            
            if (repo1 && repo2) {
                repoInput.value = repo1;
                repoInput2.value = repo2;
                compareWrapper.style.display = 'flex';
                toggleCompareBtn.textContent = '- Remove comparison';
            } else {
                const repo = btn.getAttribute('data-repo');
                repoInput.value = repo;
                repoInput2.value = '';
                compareWrapper.style.display = 'none';
                toggleCompareBtn.textContent = '+ Compare with another repository';
            }
            
            searchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        });
    });

    function parseRepoInput(raw) {
        let str = raw.trim();
        if (!str) return null;
        
        if (str.includes('github.com')) {
            if (!str.startsWith('http')) {
                str = 'https://' + str;
            }
            try {
                const parts = new URL(str).pathname.split('/').filter(Boolean);
                if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
            } catch (e) {
                // fallback to split below
            }
        }
        
        const parts = str.split('/');
        if (parts.length === 2) return { owner: parts[0], repo: parts[1] };
        
        return null;
    }

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const inputs = [parseRepoInput(repoInput.value)];
        if (compareWrapper.style.display !== 'none' && repoInput2.value.trim()) {
            inputs.push(parseRepoInput(repoInput2.value));
        }

        if (inputs.some(i => !i)) {
            showError('Please enter a valid repository format (e.g., owner/repo)');
            return;
        }

        hideError();
        showLoading();
        
        try {
            await fetchAndDisplayMetrics(inputs);
        } catch (error) {
            showError(error.message);
        } finally {
            hideLoading();
        }
    });

    async function fetchAndDisplayMetrics(repoInputs) {
        dashboardContainer.innerHTML = '';
        dashboardContainer.className = repoInputs.length > 1 ? 'dashboard-container comparison-layout' : 'dashboard-container';
        
        // Fetch all repos in parallel
        const results = await Promise.all(repoInputs.map(input => fetchRepoData(input.owner, input.repo)));

        // Comparison Logic
        if (results.length > 1) {
            compareResults(results[0], results[1]);
        }

        // Render UI
        results.forEach(result => renderDashboard(result));

        dashboardContainer.style.display = repoInputs.length > 1 ? 'grid' : 'block';
    }

    async function fetchRepoData(owner, repo) {
        const [repoData, totalContributors, issues, prs, staleIssues, commitActivity] = await Promise.all([
            api.fetchRepo(owner, repo),
            api.fetchTotalContributors(owner, repo),
            api.fetchIssueStats(owner, repo),
            api.fetchRecentPRStats(owner, repo),
            api.fetchStaleIssues(owner, repo),
            api.fetchCommitActivity(owner, repo)
        ]);
        
        const totalIssues = issues.open + issues.closed;
        const issueRate = totalIssues > 0 ? Math.round((issues.closed / totalIssues) * 100) : 0;
        const staleRatio = issues.open > 0 ? Math.round((staleIssues / issues.open) * 100) : 0;
        const prRate = prs.total > 0 ? Math.round((prs.merged / prs.total) * 100) : 0;
        const lastUpdate = new Date(repoData.updated_at);
        const daysSinceUpdate = (new Date() - lastUpdate) / (1000 * 60 * 60 * 24);
        
        let recentCommits = 0;
        if (commitActivity && commitActivity.length > 0) {
            const last4Weeks = commitActivity.slice(-4);
            recentCommits = last4Weeks.reduce((sum, week) => sum + week.total, 0);
        }

        let advancedData = null;
        let busFactor = 0;
        let activeMaintainers = 0;
        let avgReviews = 0;
        let avgThreads = 0;

        if (api.getToken()) {
            try {
                advancedData = await api.fetchAdvancedMetrics(owner, repo);
                if (advancedData) {
                    // Bulletproof Fallback for Code Velocity if stats API returned 202 Accepted (0 commits)
                    const commitsNodes = advancedData.repository?.defaultBranchRef?.target?.history?.nodes;
                    if (recentCommits === 0 && commitsNodes && commitsNodes.length > 0) {
                        const fourWeeksAgo = new Date();
                        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
                        recentCommits = commitsNodes.filter(c => {
                            if (!c.committedDate) return false;
                            return new Date(c.committedDate) >= fourWeeksAgo;
                        }).length;
                    }
                    const commits = commitsNodes || [];
                    const authorCounts = {};
                    let totalCommits = 0;
                    commits.forEach(commit => {
                        // Skip merge commits
                        if (commit?.parents?.totalCount > 1) return;
                        
                        const authorName = commit?.author?.user?.login || commit?.author?.name || 'Unknown';
                        authorCounts[authorName] = (authorCounts[authorName] || 0) + 1;
                        totalCommits++;
                    });
                    const sortedAuthors = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]);
                    let commitSum = 0;
                    for (const [author, count] of sortedAuthors) {
                        busFactor++;
                        commitSum += count;
                        if (commitSum >= totalCommits * 0.5) break;
                    }
                    
                    const prList = advancedData.repository?.pullRequests?.nodes || [];
                    let totalReviews = 0;
                    let totalThreadsCount = 0;
                    const maintainerSet = new Set();
                    prList.forEach(pr => {
                        totalReviews += pr?.reviews?.totalCount || 0;
                        totalThreadsCount += pr?.reviewThreads?.totalCount || 0;
                        if (pr?.mergedBy?.login) maintainerSet.add(pr.mergedBy.login);
                    });
                    avgReviews = prList.length > 0 ? parseFloat((totalReviews / prList.length).toFixed(1)) : 0;
                    avgThreads = prList.length > 0 ? parseFloat((totalThreadsCount / prList.length).toFixed(1)) : 0;
                    activeMaintainers = maintainerSet.size;
                }
            } catch (error) {
                console.error("Advanced metrics error:", error);
            }
        }
        return {
            owner, repo, repoData, totalContributors, recentCommits, commitActivity, issueRate, staleIssues, staleRatio, prRate, issues, lastUpdate, advancedData, busFactor, avgReviews, avgThreads, activeMaintainers,
            winners: {}
        };
    }

    function compareResults(r1, r2) {
        if (r1.totalContributors > r2.totalContributors) r1.winners.totalContributors = true; else if (r2.totalContributors > r1.totalContributors) r2.winners.totalContributors = true;
        if (r1.recentCommits > r2.recentCommits) r1.winners.recentCommits = true; else if (r2.recentCommits > r1.recentCommits) r2.winners.recentCommits = true;
        if (r1.issueRate > r2.issueRate) r1.winners.issueRate = true; else if (r2.issueRate > r1.issueRate) r2.winners.issueRate = true;
        if (r1.staleRatio < r2.staleRatio) r1.winners.staleRatio = true; else if (r2.staleRatio < r1.staleRatio) r2.winners.staleRatio = true;
        if (r1.prRate > r2.prRate) r1.winners.prRate = true; else if (r2.prRate > r1.prRate) r2.winners.prRate = true;
        
        if (r1.activeMaintainers > r2.activeMaintainers) r1.winners.activeMaintainers = true; else if (r2.activeMaintainers > r1.activeMaintainers) r2.winners.activeMaintainers = true;
        if (r1.busFactor > r2.busFactor) r1.winners.busFactor = true; else if (r2.busFactor > r1.busFactor) r2.winners.busFactor = true;
        if (r1.avgReviews > r2.avgReviews) r1.winners.avgReviews = true; else if (r2.avgReviews > r1.avgReviews) r2.winners.avgReviews = true;
    }

    function renderDashboard(result) {
        const clone = dashboardTemplate.content.cloneNode(true);
        const { repoData, winners, advancedData } = result;
        const numFormatter = new Intl.NumberFormat('en-US');

        clone.querySelector('.repo-name').textContent = repoData.full_name;
        clone.querySelector('.repo-description').textContent = repoData.description || 'No description available.';
        clone.querySelector('.stat-stars').textContent = numFormatter.format(repoData.stargazers_count);
        clone.querySelector('.stat-forks').textContent = numFormatter.format(repoData.forks_count);
        clone.querySelector('.stat-created').textContent = new Date(repoData.created_at).toLocaleDateString();
        clone.querySelector('.stat-updated').textContent = result.lastUpdate.toLocaleDateString();

        clone.querySelector('.metric-total-contributors').textContent = numFormatter.format(result.totalContributors);
        if (winners.totalContributors) clone.querySelector('.metric-total-contributors-card').classList.add('metric-winner');

        clone.querySelector('.metric-velocity-commits').textContent = numFormatter.format(result.recentCommits);
        if (winners.recentCommits) clone.querySelector('.metric-velocity-card').classList.add('metric-winner');
        
        const sparklineContainer = clone.querySelector('#velocity-sparkline');
        if (result.commitActivity && result.commitActivity.length > 0) {
            const maxCommits = Math.max(...result.commitActivity.map(w => w.total));
            result.commitActivity.slice(-12).forEach(week => {
                const bar = document.createElement('div');
                bar.className = 'sparkline-bar';
                const heightPercent = maxCommits > 0 ? (week.total / maxCommits) * 100 : 0;
                bar.style.height = `${Math.max(5, heightPercent)}%`;
                bar.title = `${week.total} commits`;
                sparklineContainer.appendChild(bar);
            });
        }

        clone.querySelector('.metric-issues').textContent = `${result.issueRate}%`;
        clone.querySelector('.issues-open').textContent = numFormatter.format(result.issues.open);
        clone.querySelector('.issues-closed').textContent = numFormatter.format(result.issues.closed);
        clone.querySelector('.metric-issues-bar').style.width = `${result.issueRate}%`;
        if (winners.issueRate) clone.querySelector('.metric-issues-card').classList.add('metric-winner');

        clone.querySelector('.metric-stale-ratio').textContent = `${result.staleRatio}%`;
        clone.querySelector('.issues-stale').textContent = numFormatter.format(result.staleIssues);
        clone.querySelector('.metric-stale-bar').style.width = `${result.staleRatio}%`;
        if (winners.staleRatio) clone.querySelector('.metric-stale-card').classList.add('metric-winner');

        clone.querySelector('.metric-prs').textContent = `${result.prRate}%`;
        clone.querySelector('.metric-prs-bar').style.width = `${result.prRate}%`;
        if (winners.prRate) clone.querySelector('.metric-prs-card').classList.add('metric-winner');

        const advancedContainer = clone.querySelector('.advanced-metrics-container');
        if (api.getToken()) {
            advancedContainer.classList.remove('locked');
            if (advancedData) {
                clone.querySelector('.metric-active-maintainers').textContent = result.activeMaintainers;
                if (winners.activeMaintainers) clone.querySelector('.metric-active-maintainers-card').classList.add('metric-winner');

                clone.querySelector('.metric-bus-factor').textContent = result.busFactor;
                clone.querySelector('.bus-factor-subtitle').textContent = `${result.busFactor} developer(s) made 50% of recent commits`;
                if (winners.busFactor) clone.querySelector('.metric-bus-factor-card').classList.add('metric-winner');

                clone.querySelector('.metric-review-rigor').textContent = result.avgReviews;
                clone.querySelector('.review-rigor-subtitle').textContent = `Avg ${result.avgReviews} reviews, ${result.avgThreads} threads per PR`;
                if (winners.avgReviews) clone.querySelector('.metric-review-rigor-card').classList.add('metric-winner');
            } else {
                clone.querySelector('.metric-active-maintainers').textContent = "Error";
                clone.querySelector('.bus-factor-subtitle').textContent = "Error loading metrics";
                clone.querySelector('.review-rigor-subtitle').textContent = "Error loading metrics";
            }
        } else {
            advancedContainer.classList.add('locked');
            clone.querySelector('.metric-active-maintainers').textContent = "--";
            clone.querySelector('.metric-bus-factor').textContent = "--";
            clone.querySelector('.metric-review-rigor').textContent = "--";
        }

        const unlockBtn = clone.querySelector('.unlock-advanced-btn');
        if (unlockBtn) {
            unlockBtn.addEventListener('click', () => {
                settingsModal.style.display = 'flex';
            });
        }
        
        const viewSampleBtn = clone.querySelector('.view-sample-btn');
        if (viewSampleBtn) {
            viewSampleBtn.addEventListener('click', () => {
                advancedContainer.classList.remove('locked');
                clone.querySelector('.metric-bus-factor').textContent = '14';
                clone.querySelector('.bus-factor-subtitle').textContent = 'High redundancy (Sample)';
                clone.querySelector('.metric-review-rigor').textContent = '5.1';
                clone.querySelector('.review-rigor-subtitle').textContent = 'Reviews per PR (Sample)';
            });
        }

        dashboardContainer.appendChild(clone);
    }

    function showLoading() {
        dashboardContainer.style.display = 'none';
        errorMessage.style.display = 'none';
        
        // Remove centered state for smooth transition upwards
        document.querySelector('.main-content').classList.remove('is-centered');
        
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
