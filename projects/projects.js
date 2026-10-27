import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');

// Step 1.6: count the projects
const title = document.querySelector('.projects-title');
if (title && projects) {
  title.textContent = `${projects.length} Projects`;
}
