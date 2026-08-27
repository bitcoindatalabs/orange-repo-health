/* app.js — Orange Repo Health v2 */

document.addEventListener('DOMContentLoaded', () => {
    const api = new GitHubAPI();
    const numFormatter = new Intl.NumberFormat('en-US');
    const numFormat = (n) => (n === null || n === undefined) ? '--' : numFormatter.format(n);

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
    const togglePatVisibilityBtn = document.getElementById('toggle-pat-visibility');

    // Initialization
    if (api.getToken()) {
        patInput.value = api.getToken();
    }

    // ==============================
    // EVENT LISTENERS
    // ==============================
    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'flex';
    });

    const closeModal = () => {
        settingsModal.style.display = 'none';
    };

    closeModalBtn.addEventListener('click', closeModal);

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeModal();
    });

    saveSettingsBtn.addEventListener('click', () => {
        api.setToken(patInput.value.trim());
        closeModal();
        // Automatically re-analyze if there is an active search
        if (repoInput.value.trim() && dashboardContainer.innerHTML !== '') {
            searchForm.dispatchEvent(new Event('submit'));
        }
    });

    if (togglePatVisibilityBtn) {
        togglePatVisibilityBtn.addEventListener('click', () => {
            const icon = togglePatVisibilityBtn.querySelector('i');
            if (patInput.type === 'password') {
                patInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                patInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }

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

    // ==============================
    // HEALTH SIGNAL & QUALITATIVE LABELS
    // ==============================
    function computeHealthSignal(result) {
        const { recentCommits, daysSinceUpdate } = result;

        if (daysSinceUpdate > 180 && recentCommits === 0) {
            return { label: 'Dormant', class: 'health-dormant', icon: '⚫' };
        }
        if (recentCommits === 0 && daysSinceUpdate > 30) {
            return { label: 'Critical', class: 'health-critical', icon: '🔴' };
        }
        if (recentCommits < 5) {
            return { label: 'Slow', class: 'health-warning', icon: '🟡' };
        }
        return { label: 'Active', class: 'health-active', icon: '🟢' };
    }

    function buildHealthSummary(result) {
        const parts = [];
        if (result.recentCommits > 0) parts.push(`${numFormat(result.recentCommits)} commits/month`);
        if (result.activeMaintainers > 0) parts.push(`${result.activeMaintainers} maintainer${result.activeMaintainers > 1 ? 's' : ''}`);
        if (result.totalContributors !== null && result.totalContributors > 0) parts.push(`${numFormat(result.totalContributors)} contributors`);
        return parts.length > 0 ? parts.join(' · ') : 'No recent activity detected';
    }

    function getVelocityLabel(commits) {
        if (commits === 0) return { text: 'Dormant', class: 'label-dormant' };
        if (commits < 5) return { text: 'Low Activity', class: 'label-low' };
        if (commits < 20) return { text: 'Moderate', class: 'label-moderate' };
        if (commits < 50) return { text: 'Active', class: 'label-good' };
        return { text: 'Very Active', class: 'label-excellent' };
    }

    function getBusFactorLabel(bf) {
        if (bf <= 1) return { text: 'High Risk', class: 'label-critical' };
        if (bf <= 3) return { text: 'Moderate', class: 'label-moderate' };
        if (bf <= 5) return { text: 'Good', class: 'label-good' };
        return { text: 'Excellent', class: 'label-excellent' };
    }

    function getTtmLabel(ttmDays, result) {
        if (ttmDays < 1.5 && result.avgReviews < 1.0) {
            return { text: 'Rubber Stamping Risk', class: 'label-critical' };
        }
        return null;
    }

    // ==============================
    // METRIC DEFINITIONS (for comparison table)
    // ==============================
    const METRIC_DEFS = [
        { type: 'section', label: 'Activity & Growth' },
        {
            name: 'Code Velocity', hint: 'Commits in last 4 weeks',
            key: 'recentCommits', format: v => numFormat(v),
            qualitative: getVelocityLabel, higherIsBetter: true
        },
        {
            name: 'PR Acceptance Rate', hint: 'Based on the 30 most recently opened PRs',
            key: 'prRate', format: v => `${v}%`, higherIsBetter: true
        },
        {
            name: 'Contributor Base', hint: 'All-time distinct contributors',
            key: 'totalContributors', format: v => numFormat(v), higherIsBetter: true
        },
        { type: 'section', label: 'Governance & Quality', requiresToken: true },
        {
            name: 'Time to Merge', hint: 'Avg days to merge (last 100 merged PRs)',
            key: 'ttmDays', format: v => `${v} days`,
            noWinner: true, qualitative: getTtmLabel, requiresToken: true
        },
        {
            name: 'Bus Factor', hint: 'Devs who own 50% of last 100 commits',
            key: 'busFactor', format: v => v,
            qualitative: getBusFactorLabel, higherIsBetter: true, requiresToken: true
        },
        {
            name: 'Active Maintainers', hint: 'Distinct devs who merged the last 100 PRs',
            key: 'activeMaintainers', format: v => v, higherIsBetter: true, requiresToken: true
        },
        {
            name: 'Review Depth', hint: 'Avg reviews per PR (last 100 merged)',
            key: 'avgReviews', format: v => v,
            subtitleFn: r => `${r.avgReviews} reviews, ${r.avgThreads} threads`,
            higherIsBetter: true, requiresToken: true
        },
        { type: 'section', label: 'Deep Diagnostics', collapsible: true },
        {
            name: 'Issue Resolution Rate', hint: 'Percentage of all-time issues closed',
            key: 'issueRate', format: v => `${v}%`,
            subtitleFn: r => `${numFormat(r.issues.open)} open / ${numFormat(r.issues.closed)} closed`,
            higherIsBetter: true, deepDiagnostic: true
        },
        {
            name: 'Abandoned Issues', hint: 'Open issues with no activity in 6+ months',
            key: 'staleRatio', format: v => `${v}%`,
            subtitleFn: r => `${numFormat(r.staleIssues)} stale`,
            higherIsBetter: false, deepDiagnostic: true
        },
        { type: 'section', label: 'Lifetime Scale (Reference)', collapsible: true },
        {
            name: 'Total Commits', hint: 'All-time commits on default branch',
            key: 'totalLifetimeCommits', format: v => v === null ? '--' : numFormat(v),
            higherIsBetter: true, requiresToken: true, deepDiagnostic: true
        },
        {
            name: 'Total Issues Logged', hint: 'All-time open + closed issues',
            key: 'totalIssues', format: v => numFormat(v),
            higherIsBetter: true, deepDiagnostic: true
        },
        {
            name: 'Repository Age', hint: 'Years since creation',
            key: 'ageYears', format: v => `${v} yrs`,
            higherIsBetter: true, deepDiagnostic: true
        },
    ];

    // ==============================
    // INPUT PARSING
    // ==============================
    function parseRepoInput(raw) {
        let str = raw.trim();
        if (!str) return null;

        if (str.includes('github.com')) {
            if (!str.startsWith('http')) str = 'https://' + str;
            try {
                const parts = new URL(str).pathname.split('/').filter(Boolean);
                if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
            } catch (e) { /* fallback below */ }
        }

        const parts = str.split('/');
        if (parts.length === 2) return { owner: parts[0], repo: parts[1] };
        return null;
    }

    // ==============================
    // FORM SUBMIT
    // ==============================
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

    // ==============================
    // DATA FETCHING
    // ==============================
    async function fetchAndDisplayMetrics(repoInputs) {
        dashboardContainer.innerHTML = '';

        const results = await Promise.all(repoInputs.map(input => fetchRepoData(input.owner, input.repo)));

        if (results.length > 1) {
            compareResults(results[0], results[1]);
            renderComparisonView(results[0], results[1]);
        } else {
            renderSingleDashboard(results[0]);
        }

        dashboardContainer.style.display = 'block';
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
        const createdDate = new Date(repoData.created_at);
        const ageYears = parseFloat(((new Date() - createdDate) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1));

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
        let ttmDays = 0;
        let totalLifetimeCommits = null;

        if (api.getToken()) {
            try {
                advancedData = await api.fetchAdvancedMetrics(owner, repo);
                if (advancedData) {
                    totalLifetimeCommits = advancedData.repository?.defaultBranchRef?.target?.history?.totalCount || null;

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
                    for (const [, count] of sortedAuthors) {
                        busFactor++;
                        commitSum += count;
                        if (commitSum >= totalCommits * 0.5) break;
                    }

                    const prList = advancedData.repository?.pullRequests?.nodes || [];
                    let totalReviews = 0;
                    let totalThreadsCount = 0;
                    let totalTtmMs = 0;
                    let ttmCount = 0;
                    const maintainerSet = new Set();
                    
                    prList.forEach(pr => {
                        totalReviews += pr?.reviews?.totalCount || 0;
                        totalThreadsCount += pr?.reviewThreads?.totalCount || 0;
                        if (pr?.mergedBy?.login) maintainerSet.add(pr.mergedBy.login);
                        
                        if (pr.createdAt && pr.mergedAt) {
                            const created = new Date(pr.createdAt);
                            const merged = new Date(pr.mergedAt);
                            totalTtmMs += (merged - created);
                            ttmCount++;
                        }
                    });
                    avgReviews = prList.length > 0 ? parseFloat((totalReviews / prList.length).toFixed(1)) : 0;
                    avgThreads = prList.length > 0 ? parseFloat((totalThreadsCount / prList.length).toFixed(1)) : 0;
                    activeMaintainers = maintainerSet.size;
                    ttmDays = ttmCount > 0 ? parseFloat((totalTtmMs / ttmCount / (1000 * 60 * 60 * 24)).toFixed(1)) : 0;
                }
            } catch (error) {
                console.error("Advanced metrics error:", error);
            }
        }

        return {
            owner, repo, repoData, totalContributors, recentCommits, commitActivity,
            issueRate, staleIssues, staleRatio, prRate, issues, lastUpdate, daysSinceUpdate, totalIssues, ageYears,
            advancedData, busFactor, avgReviews, avgThreads, activeMaintainers, ttmDays, totalLifetimeCommits,
            winners: {}
        };
    }

    // ==============================
    // COMPARISON LOGIC
    // ==============================
    function compareResults(r1, r2) {
        METRIC_DEFS.filter(m => m.key).forEach(metric => {
            const v1 = r1[metric.key];
            const v2 = r2[metric.key];

            // Skip if either value is null/undefined or they're equal
            if (v1 == null || v2 == null || v1 === v2) return;
            // Skip token-required metrics if no token
            if (metric.requiresToken && !api.getToken()) return;
            // Skip if metric intentionally doesn't declare a winner
            if (metric.noWinner) return;

            if (metric.higherIsBetter) {
                if (v1 > v2) r1.winners[metric.key] = true;
                else r2.winners[metric.key] = true;
            } else {
                if (v1 < v2) r1.winners[metric.key] = true;
                else r2.winners[metric.key] = true;
            }
        });
    }

    // ==============================
    // SINGLE REPO RENDERING
    // ==============================
    function renderSingleDashboard(result) {
        const clone = dashboardTemplate.content.cloneNode(true);
        const { repoData, advancedData } = result;

        // --- Capture all element references BEFORE appending (DocumentFragment empties on append) ---
        const repoNameEl = clone.querySelector('.repo-name');
        const repoDescEl = clone.querySelector('.repo-description');
        const starsEl = clone.querySelector('.stat-stars');
        const forksEl = clone.querySelector('.stat-forks');
        const createdEl = clone.querySelector('.stat-created');
        const updatedEl = clone.querySelector('.stat-updated');
        const healthBadge = clone.querySelector('.health-badge-pill');
        const healthSummary = clone.querySelector('.health-summary-line');
        const velocityEl = clone.querySelector('.metric-velocity-commits');
        const velLabelEl = clone.querySelector('.velocity-label');
        const sparklineContainer = clone.querySelector('#velocity-sparkline');
        const prsEl = clone.querySelector('.metric-prs');
        const prsBarEl = clone.querySelector('.metric-prs-bar');
        const contribEl = clone.querySelector('.metric-total-contributors');
        const advancedContainer = clone.querySelector('.advanced-metrics-container');
        const bfEl = clone.querySelector('.metric-bus-factor');
        const bfSubEl = clone.querySelector('.bus-factor-subtitle');
        const bfLabelEl = clone.querySelector('.bus-factor-label');
        const amEl = clone.querySelector('.metric-active-maintainers');
        const amSubEl = clone.querySelector('.active-maintainers-subtitle');
        const rrEl = clone.querySelector('.metric-review-rigor');
        const rrSubEl = clone.querySelector('.review-rigor-subtitle');
        const ttmEl = clone.querySelector('.metric-ttm');
        const ttmLabelEl = clone.querySelector('.ttm-label');
        const lifetimeCommitsEl = clone.querySelector('.metric-lifetime-commits');
        const totalIssuesEl = clone.querySelector('.metric-total-issues');
        const ageEl = clone.querySelector('.metric-age');
        const issuesEl = clone.querySelector('.metric-issues');
        const issuesOpenEl = clone.querySelector('.issues-open');
        const issuesClosedEl = clone.querySelector('.issues-closed');
        const issuesBarEl = clone.querySelector('.metric-issues-bar');
        const staleEl = clone.querySelector('.metric-stale-ratio');
        const staleCountEl = clone.querySelector('.issues-stale');
        const staleBarEl = clone.querySelector('.metric-stale-bar');
        const unlockBtn = clone.querySelector('.unlock-advanced-btn');
        const viewSampleBtn = clone.querySelector('.view-sample-btn');
        const deepSection = clone.querySelector('.deep-diagnostics-section');
        const toggleBtn = clone.querySelector('.section-toggle-btn');

        // --- Tier 1: Hero Health Card ---
        repoNameEl.textContent = repoData.full_name;
        repoDescEl.textContent = repoData.description || 'No description available.';
        starsEl.textContent = numFormat(repoData.stargazers_count);
        forksEl.textContent = numFormat(repoData.forks_count);
        createdEl.textContent = new Date(repoData.created_at).toLocaleDateString();
        updatedEl.textContent = result.lastUpdate.toLocaleDateString();

        const health = computeHealthSignal(result);
        healthBadge.className = `health-badge-pill ${health.class}`;
        healthBadge.textContent = `${health.icon} ${health.label}`;
        healthSummary.textContent = buildHealthSummary(result);

        // --- Tier 2: Activity & Growth ---
        velocityEl.textContent = numFormat(result.recentCommits);
        const velLabel = getVelocityLabel(result.recentCommits);
        velLabelEl.textContent = velLabel.text;
        velLabelEl.className = `qualitative-label ${velLabel.class}`;

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

        prsEl.textContent = `${result.prRate}%`;
        prsBarEl.style.width = `${result.prRate}%`;

        contribEl.textContent = result.totalContributors === null ? '--' : numFormat(result.totalContributors);
        if (result.totalContributors === null) {
            contribEl.title = 'GitHub is computing this value. Try again in 30 seconds.';
        }

        // --- Tier 2: Governance & Quality ---
        if (api.getToken()) {
            advancedContainer.classList.remove('locked');
            if (advancedData) {
                amEl.textContent = result.activeMaintainers;
                amSubEl.textContent = 'Across last 100 merged PRs';

                bfEl.textContent = result.busFactor;
                bfSubEl.textContent = `${result.busFactor} developer(s) made 50% of recent commits`;
                const bfLabel = getBusFactorLabel(result.busFactor);
                bfLabelEl.textContent = bfLabel.text;
                bfLabelEl.className = `qualitative-label ${bfLabel.class}`;

                rrEl.textContent = result.avgReviews;
                rrSubEl.textContent = `Avg ${result.avgReviews} reviews, ${result.avgThreads} threads per PR`;

                if (ttmEl) ttmEl.textContent = `${result.ttmDays} days`;
                if (ttmLabelEl) {
                    const ttmLabel = getTtmLabel(result.ttmDays, result);
                    if (ttmLabel) {
                        ttmLabelEl.textContent = ttmLabel.text;
                        ttmLabelEl.className = `qualitative-label ttm-label ${ttmLabel.class}`;
                        ttmLabelEl.style.display = 'inline-block';
                    } else {
                        ttmLabelEl.style.display = 'none';
                    }
                }
                if (lifetimeCommitsEl) lifetimeCommitsEl.textContent = result.totalLifetimeCommits === null ? '--' : numFormat(result.totalLifetimeCommits);
            } else {
                amEl.textContent = 'Error';
                bfSubEl.textContent = 'Error loading metrics';
                rrSubEl.textContent = 'Error loading metrics';
                if (ttmEl) ttmEl.textContent = '--';
                if (lifetimeCommitsEl) lifetimeCommitsEl.textContent = '--';
            }
        } else {
            advancedContainer.classList.add('locked');
            amEl.textContent = '--';
            bfEl.textContent = '--';
            rrEl.textContent = '--';
            if (ttmEl) ttmEl.textContent = '--';
            if (lifetimeCommitsEl) lifetimeCommitsEl.textContent = '--';
        }

        // --- Tier 3: Deep Diagnostics ---
        issuesEl.textContent = `${result.issueRate}%`;
        issuesOpenEl.textContent = numFormat(result.issues.open);
        issuesClosedEl.textContent = numFormat(result.issues.closed);
        issuesBarEl.style.width = `${result.issueRate}%`;

        staleEl.textContent = `${result.staleRatio}%`;
        staleCountEl.textContent = numFormat(result.staleIssues);
        staleBarEl.style.width = `${result.staleRatio}%`;

        // --- Tier 4: Lifetime Scale ---
        if (totalIssuesEl) totalIssuesEl.textContent = numFormat(result.totalIssues);
        if (ageEl) ageEl.textContent = `${result.ageYears} yrs`;

        // --- Event Handlers (use captured references — valid after append) ---
        if (unlockBtn) {
            unlockBtn.addEventListener('click', () => {
                settingsModal.style.display = 'flex';
            });
        }

        if (viewSampleBtn) {
            viewSampleBtn.addEventListener('click', () => {
                advancedContainer.classList.remove('locked');
                bfEl.textContent = '14';
                bfSubEl.textContent = 'High redundancy (Sample)';
                const sampleBfLabel = getBusFactorLabel(14);
                bfLabelEl.textContent = sampleBfLabel.text;
                bfLabelEl.className = `qualitative-label ${sampleBfLabel.class}`;
                amEl.textContent = '48';
                amSubEl.textContent = 'Across last 100 merged PRs (Sample)';
                rrEl.textContent = '5.1';
                rrSubEl.textContent = 'Avg 5.1 reviews per PR (Sample)';
                if (ttmEl) ttmEl.textContent = '4.2 days';
                if (lifetimeCommitsEl) lifetimeCommitsEl.textContent = '45,219';
            });
        }

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                deepSection.classList.toggle('is-expanded');
            });
        }

        // Append to DOM
        dashboardContainer.appendChild(clone);
    }

    // ==============================
    // COMPARISON VIEW RENDERING
    // ==============================
    function renderComparisonView(r1, r2) {
        const wrapper = document.createElement('div');
        wrapper.className = 'comparison-view';

        // Build hero cards side-by-side
        wrapper.appendChild(buildComparisonHeroes(r1, r2));

        // Build comparison table
        wrapper.appendChild(buildComparisonTable(r1, r2));

        dashboardContainer.appendChild(wrapper);
    }

    function buildComparisonHeroes(r1, r2) {
        const container = document.createElement('div');
        container.className = 'comparison-heroes';

        [r1, r2].forEach(result => {
            const health = computeHealthSignal(result);
            const card = document.createElement('div');
            card.className = 'hero-health-card';
            card.innerHTML = `
                <div class="hero-content">
                    <div class="hero-info">
                        <h3 class="repo-name">${escapeHtml(result.repoData.full_name)}</h3>
                        <p class="repo-description">${escapeHtml(result.repoData.description || 'No description available.')}</p>
                        <div class="repo-badges">
                            <span class="badge"><i class="fas fa-star"></i> ${numFormat(result.repoData.stargazers_count)}</span>
                            <span class="badge"><i class="fas fa-code-branch"></i> ${numFormat(result.repoData.forks_count)}</span>
                            <span class="badge">Created: ${new Date(result.repoData.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="hero-health">
                        <span class="health-badge-pill ${health.class}">${health.icon} ${health.label}</span>
                        <p class="health-summary-line">${escapeHtml(buildHealthSummary(result))}</p>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
        return container;
    }

    function buildComparisonTable(r1, r2) {
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'comparison-table-wrapper';

        const table = document.createElement('table');
        table.className = 'comparison-table';

        // Thead — sticky repo names
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Metric</th>
                <th><a href="https://github.com/${escapeHtml(r1.repoData.full_name)}" target="_blank" rel="noopener">${escapeHtml(r1.repoData.full_name)}</a></th>
                <th><a href="https://github.com/${escapeHtml(r2.repoData.full_name)}" target="_blank" rel="noopener">${escapeHtml(r2.repoData.full_name)}</a></th>
            </tr>
        `;
        table.appendChild(thead);

        // Tbody — metrics
        const tbody = document.createElement('tbody');
        const hasToken = !!api.getToken();

        METRIC_DEFS.forEach(metric => {
            // --- Section Headers ---
            if (metric.type === 'section') {
                if (metric.collapsible) {
                    // Collapsible "Deep Diagnostics" toggle row
                    const toggleRow = document.createElement('tr');
                    toggleRow.className = 'section-toggle-row';
                    toggleRow.innerHTML = `<td colspan="3">${metric.label} <i class="fas fa-chevron-down toggle-icon"></i></td>`;
                    toggleRow.addEventListener('click', () => {
                        toggleRow.classList.toggle('is-expanded');
                        tbody.querySelectorAll('.deep-diagnostics-row').forEach(row => {
                            row.classList.toggle('is-visible');
                        });
                    });
                    tbody.appendChild(toggleRow);

                } else if (metric.requiresToken && !hasToken) {
                    // Governance section locked — show prompt
                    const sectionRow = document.createElement('tr');
                    sectionRow.className = 'section-header-row';
                    sectionRow.innerHTML = `<td colspan="3">${metric.label}</td>`;
                    tbody.appendChild(sectionRow);

                    const promptRow = document.createElement('tr');
                    promptRow.className = 'token-prompt-row';
                    promptRow.innerHTML = `
                        <td colspan="3">
                            <div class="token-prompt">
                                <i class="fas fa-lock" style="color: var(--text-secondary);"></i>
                                <span>Add a GitHub token to unlock Governance metrics</span>
                                <button class="btn-primary unlock-table-btn">Add Token</button>
                            </div>
                        </td>
                    `;
                    promptRow.querySelector('.unlock-table-btn').addEventListener('click', () => {
                        settingsModal.style.display = 'flex';
                    });
                    tbody.appendChild(promptRow);

                } else {
                    // Regular section header
                    const sectionRow = document.createElement('tr');
                    sectionRow.className = 'section-header-row';
                    sectionRow.innerHTML = `<td colspan="3">${metric.label}</td>`;
                    tbody.appendChild(sectionRow);
                }
                return;
            }

            // Skip token-required metrics if no token (prompt row already shown)
            if (metric.requiresToken && !hasToken) return;

            // --- Metric Rows ---
            const row = document.createElement('tr');
            if (metric.deepDiagnostic) row.className = 'deep-diagnostics-row';

            // Metric name cell
            const nameCell = document.createElement('td');
            nameCell.className = 'metric-name-cell';
            nameCell.innerHTML = `
                <span class="ct-metric-name">${metric.name}</span>
                <span class="ct-metric-hint">${metric.hint}</span>
            `;
            row.appendChild(nameCell);

            // Value cells for each repo
            [r1, r2].forEach(result => {
                const value = result[metric.key];
                const isWinner = result.winners[metric.key];

                const cell = document.createElement('td');
                cell.className = 'metric-value-cell' + (isWinner ? ' winner-cell' : '');

                const displayValue = metric.format(value);
                let subtitle = '';
                let qualLabel = '';

                if (metric.subtitleFn) {
                    subtitle = metric.subtitleFn(result);
                }
                if (metric.qualitative) {
                    const ql = metric.qualitative(value, result);
                    if (ql) {
                        qualLabel = `<span class="qualitative-label ${ql.class}">${ql.text}</span>`;
                    }
                }

                cell.innerHTML = `
                    <div class="ct-value">${displayValue}</div>
                    ${subtitle ? `<div class="ct-subtitle">${subtitle}</div>` : ''}
                    ${qualLabel}
                `;
                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        return tableWrapper;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==============================
    // UI HELPERS
    // ==============================
    function showLoading() {
        dashboardContainer.style.display = 'none';
        errorMessage.style.display = 'none';
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
