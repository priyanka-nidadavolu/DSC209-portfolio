import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

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
    })
    // Lab 8 Step 3.3: oldest first, so the story and the slider move forward in time
    .sort((a, b) => a.datetime - b.datetime);
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

// Lab 8: commits up to the slider/scroll position
let filteredCommits;

// night = blue, day = orange (Lab 6 Step 2.3, optional)
const colorScale = d3
  .scaleSequential(d3.interpolateRgb('steelblue', 'darkorange'))
  .domain([0, 1]);
const dayness = (hourFrac) => 1 - Math.abs(hourFrac - 12) / 12;

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
  const xAxis = d3.axisBottom(xScale).ticks(6); // fewer ticks so labels don't collide in the narrower chart
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .attr('class', 'x-axis') // Lab 8 Step 1.2: so updateScatterPlot can find it
    .call(xAxis);

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis')
    .call(yAxis);

  // Step 4.3: draw big dots first so small ones stay on top and hoverable
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  const dots = svg.append('g').attr('class', 'dots');
  drawDots(dots, sortedCommits);

  createBrushSelector(svg);
}

// Shared by renderScatterPlot and updateScatterPlot.
// Lab 8 Step 1.3: key each circle by commit id so D3 reuses the same
// <circle> for the same commit and the dots don't jump around.
function drawDots(dots, sortedCommits) {
  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
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
}

// Lab 8 Step 1.2: update the existing chart instead of drawing a new one
function updateScatterPlot(data, commits) {
  const svg = d3.select('#chart').select('svg');

  // With a single commit the date range is one point and the axis breaks,
  // so pad it by half a day on each side.
  let [minDate, maxDate] = d3.extent(commits, (d) => d.datetime);
  if (+minDate === +maxDate) {
    minDate = d3.timeHour.offset(minDate, -12);
    maxDate = d3.timeHour.offset(maxDate, 12);
  }
  xScale = xScale.domain([minDate, maxDate]).nice();

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const xAxis = d3.axisBottom(xScale).ticks(6); // fewer ticks so labels don't collide in the narrower chart

  // clear out the old x-axis and draw the new one
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  const dots = svg.select('g.dots');
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  drawDots(dots, sortedCommits);

  // keep the brush highlight and counts in sync with the new dot positions
  updateSelection();
  renderSelectionCount(brushSelection);
  renderLanguageBreakdown(brushSelection);
}

// Step 3: tooltip
function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-clock');
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
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commit${selectedCommits.length === 1 ? '' : 's'} selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
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
filteredCommits = commits;

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

// ---------------------------------------------------------------------------
// Lab 8 Step 1.1: slider for the max commit time
// ---------------------------------------------------------------------------
let commitProgress = 100;

const timeScale = d3
  .scaleTime()
  .domain([d3.min(commits, (d) => d.datetime), d3.max(commits, (d) => d.datetime)])
  .range([0, 100]);

let commitMaxTime = timeScale.invert(commitProgress);

const slider = document.getElementById('commit-progress');
const timeElement = document.getElementById('commit-time');

// Redraw everything that depends on commitMaxTime
function updateForMaxTime() {
  timeElement.textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  timeElement.dateTime = commitMaxTime.toISOString();

  // Step 1.2: only keep commits up to commitMaxTime
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  updateScatterPlot(data, filteredCommits);
  renderCommitInfo(
    filteredCommits.flatMap((d) => d.lines),
    filteredCommits,
  );
  updateFileDisplay(filteredCommits);
}

function onTimeSliderChange() {
  commitProgress = Number(slider.value);
  commitMaxTime = timeScale.invert(commitProgress);
  updateForMaxTime();
}

slider.addEventListener('input', onTimeSliderChange);

// ---------------------------------------------------------------------------
// Lab 8 Step 2: unit visualization, one dot per line of code
// ---------------------------------------------------------------------------
const colors = d3.scaleOrdinal(d3.schemeTableau10);

function updateFileDisplay(filteredCommits) {
  const lines = filteredCommits.flatMap((d) => d.lines);

  // Step 2.3: biggest file first
  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    })
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join(
      // only runs when a file's row is first created
      (enter) =>
        enter.append('div').call((div) => {
          div.append('dt');
          div.append('dd');
        }),
    );

  // file name, with its line count underneath
  filesContainer
    .select('dt')
    .html((d) => `<code>${d.name}</code><small>${d.lines.length} lines</small>`);

  // Step 2.2 + 2.4: one dot per line, colored by technology
  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${colors(d.type)}`);
}

// ---------------------------------------------------------------------------
// Lab 8 Step 3: scrollytelling
// ---------------------------------------------------------------------------
d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html((d, i) => {
    const fileCount = d3.rollups(
      d.lines,
      (D) => D.length,
      (line) => line.file,
    ).length;

    return `
      <p>
        On ${d.datetime.toLocaleString('en', { dateStyle: 'full', timeStyle: 'short' })},
        I made <a href="${d.url}" target="_blank">${i > 0 ? 'another commit' : 'my first commit'}</a>.
        It touched ${d.totalLines} lines that are still in the site today, across
        ${fileCount} file${fileCount === 1 ? '' : 's'}.
      </p>
    `;
  });

function onStepEnter(response) {
  const commit = response.element.__data__;

  commitMaxTime = commit.datetime;
  // keep the slider in step with the story
  commitProgress = timeScale(commitMaxTime);
  slider.value = commitProgress;

  updateForMaxTime();
}

const scroller = scrollama();
scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
  })
  .onStepEnter(onStepEnter);

// draw the initial state (all commits)
onTimeSliderChange();
