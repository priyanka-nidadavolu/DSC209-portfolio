import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const REPO_URL = 'https://github.com/priyanka-nidadavolu/DSC209-portfolio';

// Step 1.1: read loc.csv, converting each field to the right type
async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
  return data;
}

// Step 1.2: one object per commit
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      const ret = {
        id: commit,
        url: `${REPO_URL}/commit/${commit}`,
        author,
        date,
        time,
        timezone,
        datetime,
        // time of day as a decimal, e.g. 14.5 for 2:30pm
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      // Keep the raw lines available, but hidden from console.log and
      // Object.keys so the commit objects stay easy to read.
      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: true, // can be redefined or deleted later
        writable: false, // nobody should overwrite the lines
        enumerable: false, // hidden from enumeration / printing
      });

      return ret;
    });
}

// Step 1.3: summary stats
function renderCommitInfo(data, commits) {
  const container = d3.select('#stats');
  container.selectAll('*').remove();

  const dl = container.append('dl').attr('class', 'stats');
  const add = (label, value) => {
    const item = dl.append('div');
    item.append('dt').html(label);
    item.append('dd').text(value);
  };

  add('Total <abbr title="Lines of code">LOC</abbr>', data.length);
  add('Total commits', commits.length);

  // number of files
  const fileCount = d3.group(data, (d) => d.file).size;
  add('Files', fileCount);

  // longest file, in lines
  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.line),
    (d) => d.file,
  );
  const longestFile = d3.greatest(fileLengths, (d) => d[1]);
  add('Longest file', `${longestFile[0]} (${longestFile[1]} lines)`);

  // average file length
  add('Average file length', `${d3.format('.1f')(d3.mean(fileLengths, (d) => d[1]))} lines`);

  // deepest indentation
  add('Maximum depth', d3.max(data, (d) => d.depth));

  // average line length, in characters
  add('Average line length', `${d3.format('.1f')(d3.mean(data, (d) => d.length))} chars`);

  // the part of the day with the most commits
  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) =>
      new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' }),
  );
  const maxPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0];
  add('Most work done', maxPeriod);
}

// Step 2 & 4 & 5: scatterplot. The scales are global so the brush can use them.
let xScale;
let yScale;
let rScale;
let commits;
let data;

const width = 1000;
const height = 600;
const margin = { top: 10, right: 10, bottom: 30, left: 40 };
const usableArea = {
  top: margin.top,
  right: width - margin.right,
  bottom: height - margin.bottom,
  left: margin.left,
  width: width - margin.left - margin.right,
  height: height - margin.top - margin.bottom,
};

function renderScatterPlot(data, commits) {
  d3.select('#chart').selectAll('svg').remove();

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // Step 4: dot area (not radius) is proportional to lines edited
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  // Step 2.3: gridlines go first so they sit behind everything else
  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  // Step 2.2: axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  // Step 4.3: draw big dots first so small ones stay on top and hoverable
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  // Step 2.3 (optional): night = blue, day = orange
  const colorScale = d3
    .scaleSequential(d3.interpolateRgb('steelblue', 'darkorange'))
    .domain([0, 1]);
  const dayness = (hourFrac) => 1 - Math.abs(hourFrac - 12) / 12;

  const dots = svg.append('g').attr('class', 'dots');

  dots
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', (d) => colorScale(dayness(d.hourFrac)))
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => updateTooltipPosition(event))
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  createBrushSelector(svg);
}

// Step 3: tooltip
function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', { dateStyle: 'full' });
  time.textContent = commit.datetime?.toLocaleTimeString('en', { timeStyle: 'short' });
  author.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  document.getElementById('commit-tooltip').hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  const offset = 12;
  // keep the tooltip on screen near the right edge
  const maxLeft = window.innerWidth - tooltip.offsetWidth - offset;
  tooltip.style.left = `${Math.min(event.clientX + offset, Math.max(maxLeft, 0))}px`;
  tooltip.style.top = `${event.clientY + offset}px`;
}

// Step 5: brushing
let brushSelection = null;

function createBrushSelector(svg) {
  svg.call(d3.brush().on('start brush end', brushed));

  // The brush overlay sits on top of the dots and swallows hover events.
  // Lift everything after the overlay (selection box, handles) first, then the
  // dots, so the dots end up on top and stay hoverable inside a selection too.
  svg.selectAll('.overlay ~ *').raise();
  svg.select('.dots').raise();
}

function brushed(event) {
  brushSelection = event.selection;
  updateSelection();
  renderSelectionCount(brushSelection);
  renderLanguageBreakdown(brushSelection);
}

function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function updateSelection() {
  d3.selectAll('circle').classed('selected', (d) => isCommitSelected(brushSelection, d));
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commit${selectedCommits.length === 1 ? '' : 's'} selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  // lines edited by the selected commits, counted per language
  const lines = selectedCommits.flatMap((d) => d.lines);
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  container.innerHTML = '';
  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
      <div>
        <dt>${language}</dt>
        <dd>${count} lines (${formatted})</dd>
      </div>
    `;
  }
}

data = await loadData();
commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
