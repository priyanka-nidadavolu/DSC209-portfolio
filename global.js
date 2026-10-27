console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Step 2 (superseded by Step 3, kept for reference)
// let navLinks = $$('nav a');
// let currentLink = navLinks.find(
//   (a) => a.host === location.host && a.pathname === location.pathname,
// );
// currentLink?.classList.add('current');

// Step 3: automatic navigation menu
const BASE_PATH =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? '/' // Local server
    : '/DSC209-portfolio/'; // GitHub Pages repo name

let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'cv/', title: 'CV' },
  { url: 'contact/', title: 'Contact' },
  { url: 'https://github.com/priyanka-nidadavolu', title: 'GitHub' },
];

let nav = document.createElement('nav');
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  let title = p.title;

  url = !url.startsWith('http') ? BASE_PATH + url : url;

  let a = document.createElement('a');
  a.href = url;
  a.textContent = title;

  a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname,
  );
  if (a.host !== location.host) {
    a.target = '_blank';
  }

  nav.append(a);
}

// Step 4: dark mode switcher
document.body.insertAdjacentHTML(
  'afterbegin',
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>`,
);

let select = document.querySelector('.color-scheme select');

// Show which scheme "Automatic" currently resolves to
let osDark = matchMedia('(prefers-color-scheme: dark)');
function updateAutoLabel() {
  select.querySelector('option[value="light dark"]').textContent =
    `Automatic (${osDark.matches ? 'Dark' : 'Light'})`;
}
updateAutoLabel();
osDark.addEventListener('change', updateAutoLabel);

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty('color-scheme', colorScheme);
  select.value = colorScheme;
}

if ('colorScheme' in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

select.addEventListener('input', function (event) {
  console.log('color scheme changed to', event.target.value);
  setColorScheme(event.target.value);
  localStorage.colorScheme = event.target.value;
});

// Step 5: better contact form
let form = document.querySelector('form');

form?.addEventListener('submit', function (event) {
  event.preventDefault();

  let data = new FormData(form);
  let params = [];

  for (let [name, value] of data) {
    params.push(`${name}=${encodeURIComponent(value)}`);
  }

  let url = form.action + '?' + params.join('&');
  location.href = url;
});

// Lab 4, Step 1.2: load JSON from a URL
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

// Lab 4, Step 1.4: render one project, or an array of projects, into a container
const HEADING_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  if (!(containerElement instanceof Element)) {
    console.error('renderProjects: containerElement is not a valid DOM element');
    return;
  }

  if (!HEADING_LEVELS.includes(headingLevel)) {
    console.warn(`renderProjects: invalid heading level "${headingLevel}", using h2`);
    headingLevel = 'h2';
  }

  // Accept a single project object as well as an array
  projects = Array.isArray(projects) ? projects : projects ? [projects] : [];

  // Clear existing content so re-rendering doesn't duplicate articles
  containerElement.innerHTML = '';

  if (projects.length === 0) {
    containerElement.innerHTML = '<p>No projects to show yet.</p>';
    return;
  }

  for (let project of projects) {
    const article = document.createElement('article');

    // Image paths are stored relative to the site root, so prefix BASE_PATH
    // (external URLs are left alone)
    const image = project.image
      ? project.image.startsWith('http')
        ? project.image
        : BASE_PATH + project.image
      : '';
    const title = project.title ?? 'Untitled project';
    const heading = project.url
      ? `<a href="${project.url.startsWith('http') ? project.url : BASE_PATH + project.url}"${
          project.url.startsWith('http') ? ' target="_blank"' : ''
        }>${title}</a>`
      : title;

    article.innerHTML = `
      <${headingLevel}>${heading}</${headingLevel}>
      ${image ? `<img src="${image}" alt="${title}">` : '<div class="no-image"></div>'}
      <div class="project-text">
        <p>${project.description ?? ''}</p>
        ${project.year ? `<p class="project-year">${project.year}</p>` : ''}
      </div>
    `;

    containerElement.appendChild(article);
  }
}

// Lab 4, Step 3: GitHub API
export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}
