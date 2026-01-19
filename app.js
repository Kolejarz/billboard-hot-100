const form = document.querySelector("#playlist-form");
const statusEl = document.querySelector("#status");
const resultsEl = document.querySelector("#results");
const playlistEl = document.querySelector("#playlist");
const rankingDateEl = document.querySelector("#ranking-date");
const rankingOffsetEl = document.querySelector("#ranking-offset");
const viewToggleButtons = document.querySelectorAll("[data-view]");

let validDates = [];

const formatDate = (date) => date.toISOString().slice(0, 10);
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const setStatus = (message, isError = false) => {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "inherit";
};

const fetchValidDates = async () => {
  const response = await fetch("valid_dates.json");
  if (!response.ok) {
    throw new Error("Unable to load valid dates.");
  }
  const data = await response.json();
  validDates = data.sort();
};

const ensureValidDates = async () => {
  if (!validDates.length) {
    await fetchValidDates();
  }
};

const findNextChartDate = (targetDate) => {
  const target = formatDate(targetDate);
  let left = 0;
  let right = validDates.length - 1;
  let result = null;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (validDates[mid] >= target) {
      result = validDates[mid];
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return result;
};

const formatOffset = (days) => {
  const unit = days === 1 ? "day" : "days";
  return `(+${days} ${unit})`;
};

const buildTargets = (birthDate, today) => {
  const targets = [];
  const seenDates = new Set();
  const month = birthDate.getUTCMonth();
  const day = birthDate.getUTCDate();

  for (let year = birthDate.getUTCFullYear(); year <= today.getUTCFullYear(); year += 1) {
    const target = new Date(Date.UTC(year, month, day));
    if (target > today) {
      break;
    }
    const chartDate = findNextChartDate(target);
    if (chartDate && !seenDates.has(chartDate)) {
      const chartDateObj = new Date(`${chartDate}T00:00:00Z`);
      const offsetDays = Math.round((chartDateObj - target) / MS_PER_DAY);
      seenDates.add(chartDate);
      targets.push({
        chartDate,
        year,
        offsetDays,
      });
    }
  }

  return targets;
};

const songLink = (service, song, artist) => {
  const query = encodeURIComponent(`${song} ${artist}`);
  if (service === "youtube") {
    return `https://www.youtube.com/results?search_query=${query}`;
  }
  return `https://open.spotify.com/search/${query}`;
};

const renderPlaylist = (groups) => {
  playlistEl.innerHTML = "";

  groups.forEach((group) => {
    const wrapper = document.createElement("div");
    wrapper.className = "chart-group";

    const heading = document.createElement("div");
    heading.className = "chart-heading";

    const title = document.createElement("div");
    title.className = "chart-title";
    title.textContent = `${group.year} Chart`;
    heading.appendChild(title);

    const date = document.createElement("div");
    date.className = "chart-date";
    date.textContent = `${group.date} ${formatOffset(group.offsetDays)}`;
    heading.appendChild(date);

    wrapper.appendChild(heading);

    const list = document.createElement("ul");
    list.className = "song-list";

    group.songs.forEach((song) => {
      const item = document.createElement("li");
      item.className = "song-item";

      const info = document.createElement("div");
      info.className = "song-info";

      const title = document.createElement("div");
      title.className = "song-title";
      title.textContent = song.song;

      const artist = document.createElement("div");
      artist.className = "song-artist";
      artist.textContent = song.artist;

      info.appendChild(title);
      info.appendChild(artist);
      item.appendChild(info);

      const meta = document.createElement("div");
      meta.className = "song-meta";
      meta.innerHTML = `
        <span>#${song.this_week}</span>
        <span>Last week: ${song.last_week ?? "—"}</span>
        <span>Peak: ${song.peak_position}</span>
        <span>Weeks: ${song.weeks_on_chart}</span>
      `;
      item.appendChild(meta);

      const links = document.createElement("div");
      links.className = "song-links";

      const yt = document.createElement("a");
      yt.href = songLink("youtube", song.song, song.artist);
      yt.target = "_blank";
      yt.rel = "noopener noreferrer";
      yt.textContent = "YouTube";

      const spotify = document.createElement("a");
      spotify.href = songLink("spotify", song.song, song.artist);
      spotify.target = "_blank";
      spotify.rel = "noopener noreferrer";
      spotify.textContent = "Spotify";

      links.appendChild(yt);
      links.appendChild(spotify);
      item.appendChild(links);

      list.appendChild(item);
    });

    wrapper.appendChild(list);
    playlistEl.appendChild(wrapper);
  });
};

const loadCharts = async (chartDates, count) => {
  const groups = [];

  for (const target of chartDates) {
    const response = await fetch(`date/${target.chartDate}.json`);
    if (!response.ok) {
      throw new Error(`Unable to load chart for ${target.chartDate}.`);
    }
    const chart = await response.json();
    const songs = chart.data.slice(0, count);

    groups.push({
      date: target.chartDate,
      year: target.year,
      offsetDays: target.offsetDays,
      songs,
    });
  }

  return groups;
};

const updateRankingPreview = async (birthValue) => {
  if (!birthValue) {
    rankingDateEl.value = "";
    rankingOffsetEl.textContent = "";
    return;
  }

  await ensureValidDates();
  const birthDate = new Date(`${birthValue}T00:00:00Z`);
  const chartDate = findNextChartDate(birthDate);
  if (!chartDate) {
    rankingDateEl.value = "Unavailable";
    rankingOffsetEl.textContent = "";
    return;
  }

  const chartDateObj = new Date(`${chartDate}T00:00:00Z`);
  const offsetDays = Math.round((chartDateObj - birthDate) / MS_PER_DAY);
  rankingDateEl.value = chartDate;
  rankingOffsetEl.textContent = formatOffset(offsetDays);
};

const setView = (view) => {
  resultsEl.classList.toggle("is-minimal", view === "minimal");
  viewToggleButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
    button.setAttribute("aria-pressed", button.dataset.view === view ? "true" : "false");
  });
};

const handleBirthDateInput = (event) => {
  updateRankingPreview(event.target.value).catch((error) => {
    console.error(error);
    rankingDateEl.value = "Unavailable";
    rankingOffsetEl.textContent = "";
  });
};

form.elements["birth-date"].addEventListener("input", handleBirthDateInput);
form.elements["birth-date"].addEventListener("change", handleBirthDateInput);

viewToggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setView(button.dataset.view);
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const birthValue = form.elements["birth-date"].value;
  const countValue = Number.parseInt(form.elements["song-count"].value, 10);

  if (!birthValue) {
    setStatus("Please select a date of birth.", true);
    resultsEl.hidden = true;
    return;
  }

  const count = Number.isFinite(countValue)
    ? Math.min(Math.max(countValue, 1), 100)
    : 10;
  form.elements["song-count"].value = count;

  try {
    setStatus("Loading charts...");
    resultsEl.hidden = true;

    await ensureValidDates();

    const birthDate = new Date(`${birthValue}T00:00:00Z`);
    const today = new Date();
    const chartDates = buildTargets(birthDate, today);

    if (!chartDates.length) {
      setStatus("No charts available after that date.", true);
      return;
    }

    const groups = await loadCharts(chartDates, count);
    renderPlaylist(groups);
    setView(resultsEl.classList.contains("is-minimal") ? "minimal" : "detailed");

    setStatus(`Loaded ${groups.length} charts.`);
    resultsEl.hidden = false;
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Something went wrong.", true);
    resultsEl.hidden = true;
  }
});

setStatus("Enter your birthday to begin.");
setView("detailed");
