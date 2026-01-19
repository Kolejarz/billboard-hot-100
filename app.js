const form = document.querySelector("#playlist-form");
const statusEl = document.querySelector("#status");
const resultsEl = document.querySelector("#results");
const playlistEl = document.querySelector("#playlist");

let validDates = [];

const formatDate = (date) => date.toISOString().slice(0, 10);

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

const buildTargets = (birthDate, today) => {
  const targets = [];
  const month = birthDate.getUTCMonth();
  const day = birthDate.getUTCDate();

  for (let year = birthDate.getUTCFullYear(); year <= today.getUTCFullYear(); year += 1) {
    const target = new Date(Date.UTC(year, month, day));
    if (target > today) {
      break;
    }
    const chartDate = findNextChartDate(target);
    if (chartDate && !targets.includes(chartDate)) {
      targets.push(chartDate);
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

    const heading = document.createElement("h3");
    heading.textContent = `${group.year} Chart • ${group.date}`;
    wrapper.appendChild(heading);

    const list = document.createElement("ul");
    list.className = "song-list";

    group.songs.forEach((song) => {
      const item = document.createElement("li");
      item.className = "song-item";

      const title = document.createElement("div");
      title.textContent = `${song.song} (${song.artist}) [${group.year}]`;
      item.appendChild(title);

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

  for (const date of chartDates) {
    const response = await fetch(`date/${date}.json`);
    if (!response.ok) {
      throw new Error(`Unable to load chart for ${date}.`);
    }
    const chart = await response.json();
    const songs = chart.data.slice(0, count);

    groups.push({
      date,
      year: date.slice(0, 4),
      songs,
    });
  }

  return groups;
};

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

    if (!validDates.length) {
      await fetchValidDates();
    }

    const birthDate = new Date(`${birthValue}T00:00:00Z`);
    const today = new Date();
    const chartDates = buildTargets(birthDate, today);

    if (!chartDates.length) {
      setStatus("No charts available after that date.", true);
      return;
    }

    const groups = await loadCharts(chartDates, count);
    renderPlaylist(groups);

    setStatus(`Loaded ${groups.length} charts.`);
    resultsEl.hidden = false;
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Something went wrong.", true);
    resultsEl.hidden = true;
  }
});

setStatus("Enter your birthday to begin.");
