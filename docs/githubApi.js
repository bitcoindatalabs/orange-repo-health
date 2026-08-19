/* githubApi.js */

class GitHubAPI {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        this.token = localStorage.getItem('github_pat') || null;
    }

    setToken(token) {
        if (token) {
            this.token = token;
            localStorage.setItem('github_pat', token);
        } else {
            this.token = null;
            localStorage.removeItem('github_pat');
        }
    }

    getToken() {
        return this.token;
    }

    getHeaders() {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
        };
        if (this.token) {
            headers['Authorization'] = `token ${this.token}`;
        }
        return headers;
    }

    async _withCache(key, fetcher) {
        const fullKey = `repo_health_cache_${key}_${this.token ? 'auth' : 'unauth'}`;
        const cached = sessionStorage.getItem(fullKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                // 1 hour cache expiration
                if (Date.now() - parsed.timestamp < 60 * 60 * 1000) {
                    return parsed.data;
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

        const data = await fetcher();
        
        try {
            sessionStorage.setItem(fullKey, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        } catch (e) {
            // Ignore storage full errors
        }
        
        return data;
    }

    async fetchRepo(owner, repo) {
        return this._withCache(`repo_${owner}_${repo}`, async () => {
            const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, {
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                if (response.status === 404) throw new Error('Repository not found');
                if (response.status === 403) throw new Error('API Rate Limit Exceeded. Please add a Personal Access Token in Settings.');
                throw new Error('Failed to fetch repository data');
            }
            
            return await response.json();
        });
    }

    async fetchTotalContributors(owner, repo) {
        return this._withCache(`total_contributors_${owner}_${repo}`, async () => {
            // Fetch with per_page=1 to get the Link header for the last page
            const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/contributors?per_page=1&anon=1`, {
                headers: this.getHeaders()
            });
            if (!response.ok) return 0;
            
            const linkHeader = response.headers.get('Link');
            if (linkHeader) {
                const match = linkHeader.match(/page=(\d+)>; rel="last"/);
                if (match) {
                    return parseInt(match[1], 10);
                }
            }
            
            // If no Link header, there is only 1 page (so 0 or 1 contributors)
            const data = await response.json();
            return data.length;
        });
    }

    async fetchContributorsCount(owner, repo) {
        return this._withCache(`contributors_${owner}_${repo}`, async () => {
            const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/contributors?per_page=100`, {
                headers: this.getHeaders()
            });
            if (!response.ok) return 0;
            
            const data = await response.json();
            return data.length;
        });
    }

    async fetchCommitActivity(owner, repo) {
        return this._withCache(`commit_activity_${owner}_${repo}`, async () => {
            const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/stats/commit_activity`, {
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                // If 202 Accepted, GitHub is caching it in the background. Return empty for now.
                if (response.status === 202) return [];
                return [];
            }
            
            const data = await response.json();
            // Expected format: array of 52 weeks { days: [], total: x, week: timestamp }
            return data;
        });
    }

    async fetchIssueStats(owner, repo) {
        return this._withCache(`issues_${owner}_${repo}`, async () => {
            // Get total issues (open + closed)
            const openResponse = await fetch(`${this.baseUrl}/search/issues?q=repo:${owner}/${repo}+type:issue+state:open`, {
                headers: this.getHeaders()
            });
            const closedResponse = await fetch(`${this.baseUrl}/search/issues?q=repo:${owner}/${repo}+type:issue+state:closed`, {
                headers: this.getHeaders()
            });

            let openCount = 0;
            let closedCount = 0;

            if (openResponse.ok) {
                const data = await openResponse.json();
                openCount = data.total_count || 0;
            }

            if (closedResponse.ok) {
                const data = await closedResponse.json();
                closedCount = data.total_count || 0;
            }

            return { open: openCount, closed: closedCount };
        });
    }

    async fetchStaleIssues(owner, repo) {
        return this._withCache(`stale_issues_${owner}_${repo}`, async () => {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            const dateStr = sixMonthsAgo.toISOString().split('T')[0];
            
            const response = await fetch(`${this.baseUrl}/search/issues?q=repo:${owner}/${repo}+type:issue+state:open+updated:<${dateStr}`, {
                headers: this.getHeaders()
            });
            
            if (!response.ok) return 0;
            
            const data = await response.json();
            return data.total_count || 0;
        });
    }

    async fetchRecentPRStats(owner, repo) {
        return this._withCache(`prs_${owner}_${repo}`, async () => {
            // Fetch recent PRs
            const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls?state=all&per_page=30`, {
                headers: this.getHeaders()
            });
            
            if (!response.ok) return { merged: 0, total: 0 };
            
            const prs = await response.json();
            const total = prs.length;
            const merged = prs.filter(pr => pr.merged_at !== null).length;
            
            return { merged, total };
        });
    }
    async fetchAdvancedMetrics(owner, repo) {
        return this._withCache(`advanced_${owner}_${repo}`, async () => {
            if (!this.token) {
                throw new Error("Personal Access Token required for advanced metrics.");
            }

            const query = `
            query($owner: String!, $repo: String!) {
              repository(owner: $owner, name: $repo) {
                defaultBranchRef {
                  target {
                    ... on Commit {
                      history(first: 100) {
                        nodes {
                          committedDate
                          author {
                            user {
                              login
                            }
                            name
                          }
                          parents {
                            totalCount
                          }
                        }
                      }
                    }
                  }
                }
                pullRequests(states: MERGED, last: 100, orderBy: {field: UPDATED_AT, direction: DESC}) {
                  nodes {
                    mergedBy {
                      login
                    }
                    reviews {
                      totalCount
                    }
                    reviewThreads {
                      totalCount
                    }
                  }
                }
              }
            }
            `;

            const response = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: {
                    ...this.getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query,
                    variables: { owner, repo }
                })
            });

            if (!response.ok) {
                throw new Error('GraphQL request failed');
            }

            const data = await response.json();
            
            if (data.errors) {
                throw new Error(data.errors[0].message);
            }

            return data.data;
        });
    }
}
