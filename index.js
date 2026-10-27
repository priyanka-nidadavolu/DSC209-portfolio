import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

// Step 2: latest three projects
const projects = await fetchJSON('./lib/projects.json');
const latestProjects = projects?.slice(0, 3);
const projectsContainer = document.querySelector('.projects');

// h3, because "Latest Projects" above them is already an h2
renderProjects(latestProjects, projectsContainer, 'h3');

// Step 3: GitHub profile stats
const githubData = await fetchGitHubData('priyanka-nidadavolu');
const profileStats = document.querySelector('#profile-stats');

if (profileStats) {
  profileStats.innerHTML = githubData
    ? `
      <dl>
        <dt>Public Repos</dt><dd>${githubData.public_repos}</dd>
        <dt>Public Gists</dt><dd>${githubData.public_gists}</dd>
        <dt>Followers</dt><dd>${githubData.followers}</dd>
        <dt>Following</dt><dd>${githubData.following}</dd>
      </dl>`
    : '<p>GitHub stats are unavailable right now.</p>';
}
