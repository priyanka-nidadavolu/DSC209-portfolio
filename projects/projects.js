import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const title = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');

// Lab 5, Step 4: shared state. Both the search bar and the pie slices
// filter the same list, so they both read from these two variables.
let query = '';
let selectedYear = null;

// Donut: a non-zero inner radius leaves room for the count in the middle
let arcGenerator = d3.arc().innerRadius(30).outerRadius(50);

// Years are ordered, so they get one hue from light (oldest) to dark (newest)
// instead of unrelated categorical colors. The domain is every year in the
// data, so a year keeps its color while the search filters the pie.
let allYears = [...new Set(projects.map((p) => p.year))].sort();
let colors = d3
  .scaleOrdinal()
  .domain(allYears)
  .range(
    allYears.map((_, i) => {
      let t = allYears.length > 1 ? i / (allYears.length - 1) : 1;
      return `oklch(${85 - t * 45}% ${0.04 + t * 0.08} 230)`;
    }),
  );

// Step 4.3: case-insensitive search across every field of a project
function searchProjects(list) {
  return list.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });
}

// Steps 1 to 3 and 4.4: draw the donut, center label and legend
function renderPieChart(projectsGiven, visibleCount) {
  let rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );
  rolledData.sort((a, b) => b[0].localeCompare(a[0]));
  let data = rolledData.map(([year, count]) => ({ value: count, label: year }));

  // sort(null) keeps slices in legend order (newest first, clockwise) instead of by size
  let sliceGenerator = d3.pie().value((d) => d.value).sort(null).padAngle(0.015);
  let arcData = sliceGenerator(data);
  let arcs = arcData.map((d) => arcGenerator(d));

  let svg = d3.select('#projects-plot');
  let legend = d3.select('.legend');
  svg.selectAll('path, circle, text').remove();
  legend.selectAll('li').remove();

  // empty search: show a faint ring instead of nothing
  if (data.length === 0) {
    svg.append('circle').attr('class', 'track').attr('r', 40);
  }

  arcs.forEach((arc, i) => {
    // direction from the center to the middle of the slice, used to nudge
    // the slice outward on hover
    let [cx, cy] = arcGenerator.centroid(arcData[i]);
    let len = Math.hypot(cx, cy) || 1;

    svg
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(data[i].label))
      .attr('data-year', data[i].label)
      .attr('style', `--dx:${(cx / len) * 2.5}px; --dy:${(cy / len) * 2.5}px`)
      .attr('class', data[i].label === selectedYear ? 'selected' : null)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', `${data[i].label}: ${data[i].value} projects`)
      .attr('aria-pressed', data[i].label === selectedYear)
      .on('click', () => toggleYear(data[i].label))
      .on('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleYear(data[i].label);
        }
      });
  });

  // count in the middle of the donut
  svg.append('text').attr('class', 'center-count').attr('y', 3).text(visibleCount);
  svg
    .append('text')
    .attr('class', 'center-label')
    .attr('y', 13)
    .text(selectedYear ? `in ${selectedYear}` : visibleCount === 1 ? 'project' : 'projects');

  data.forEach((d) => {
    legend
      .append('li')
      .attr('style', `--color:${colors(d.label)}`)
      .attr('class', d.label === selectedYear ? 'legend-item selected' : 'legend-item')
      .on('click', () => toggleYear(d.label))
      .html(`<span class="swatch"></span> ${d.label} <em>${d.value}</em>`);
  });
}

// Step 5.2: click a wedge or legend entry to select that year, click again to deselect
function toggleYear(year) {
  let hadFocus = document.activeElement?.matches?.('#projects-plot path');
  selectedYear = selectedYear === year ? null : year;
  update();
  // re-rendering replaces the wedges, so put keyboard focus back where it was
  if (hadFocus) {
    document.querySelector(`#projects-plot path[data-year="${year}"]`)?.focus();
  }
}

// The one place that decides what is visible. The pie reflects the search
// results, and the project list applies the search AND the selected year
// together. This is the Step 5.4 fix: the original lab filtered the list by
// year alone on a click, which threw the search query away.
function update() {
  let searched = searchProjects(projects);

  // if the search no longer contains the selected year, drop the selection
  if (selectedYear && !searched.some((p) => p.year === selectedYear)) {
    selectedYear = null;
  }

  let visible = selectedYear ? searched.filter((p) => p.year === selectedYear) : searched;

  renderProjects(visible, projectsContainer, 'h2');
  if (visible.length === 0) {
    projectsContainer.innerHTML = '<p>No projects match your search.</p>';
  }
  renderPieChart(searched, visible.length);

  if (title && projects) {
    title.textContent = `${visible.length} ${visible.length === 1 ? "Project" : "Projects"}`;
  }
}

// Step 4.2: "input" updates as you type
searchInput.addEventListener('input', (event) => {
  query = event.target.value;
  update();
});

update();
