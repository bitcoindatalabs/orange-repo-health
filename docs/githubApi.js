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

    async fetchRepo(owner, repo) {
        const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, {
            headers: this.getHeaders()
        });
        
        if (!response.ok) {
            if (response.status === 404) throw new Error('Repository not found');
            if (response.status === 403) throw new Error('API Rate Limit Exceeded. Please add a Personal Access Token in Settings.');
            throw new Error('Failed to fetch repository data');
        }
        
        return await response.json();
    }

    async fetchContributorsCount(owner, repo) {
        // Fetch contributors. By default GitHub returns max 30 per page.
        // We'll just fetch the first page to estimate active contributors (or top 100).
        const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/contributors?per_page=100`, {
            headers: this.getHeaders()
        });
        if (!response.ok) return 0;
        
        // A hack to get total count without paginating everything is to check the Link header,
        // but for simplicity, returning the length of the top contributors list.
        const data = await response.json();
        return data.length;
    }

    async fetchIssueStats(owner, repo) {
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
    }

    async fetchRecentPRStats(owner, repo) {
        // Fetch recent PRs
        const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls?state=all&per_page=30`, {
            headers: this.getHeaders()
        });
        
        if (!response.ok) return { merged: 0, total: 0 };
        
        const prs = await response.json();
        const total = prs.length;
        const merged = prs.filter(pr => pr.merged_at !== null).length;
        
        return { merged, total };
    }
}
