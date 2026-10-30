
import './style.css';
import Globe from 'globe.gl';
import * as THREE from 'three';
import { createNotebook } from './notes.js';

// ==========================================
// ATLAS CONFIGURATION
// ==========================================

const app = document.querySelector('#app');
const $ = id => document.getElementById(id);

const CONTINENTS = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
  'Antarctica'
];

const COLORS = {
  Africa: '#e7ae68',
  Asia: '#8198fa',
  Europe: '#e6c276',
  'North America': '#52bec8',
  'South America': '#52a9b6',
  Oceania: '#8b9bf5',
  Antarctica: '#b5c9df'
};

const DATA_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

const STORAGE_KEY = 'atlas-notes-v2';

// ==========================================
// APPLICATION STATE
// ==========================================

let globe = null;
let features = [];

// ==========================================
// ATLAS FIELD NOTES MODULE
// ==========================================

const notebook = createNotebook();

let activeNoteId = null;
let noteSearchQuery = '';
let notebookLocationFilter = 'all';
let noteSaveTimer = null;
let notebookWorkspaceOpen = false;

let selectedCountry = null;
let selectedContinent = null;
let selectedRegion = null;

let notes = {};
let activeKey = 'earth:Earth';

let resizeObserver = null;
let saveTimer = null;

// ==========================================
// LOAD SAVED NOTES
// ==========================================

try {
  notes = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || '{}'
  ) || {};
} catch (error) {
  console.warn('Could not read saved notes:', error);
  notes = {};
}

// ==========================================
// APPLICATION INTERFACE
// ==========================================

app.innerHTML = `
<header class="topbar">
  <div class="brand">
    <div class="brand-mark">◎</div>
    <div>
      <div class="brand-kicker">
        GEOGRAPHIC RESEARCH WORKSPACE
      </div>
      <div class="brand-name">
        ATLAS <span>Explorer</span>
      </div>
    </div>
  </div>

  <div class="status">
    <span class="status-dot"></span>
    <span id="status">Starting application</span>
  </div>
</header>

<main class="layout">

  <section class="world-panel">

    <div class="world-heading">
      <div>
        <div class="eyebrow">01 / GLOBAL EXPLORER</div>
        <div class="world-subtitle">
          Rotate · Zoom · Select a country
        </div>
      </div>

      <span class="map-pill" id="map-count">
        Preparing Earth
      </span>
    </div>

    <div id="globe"
         aria-label="Interactive 3D Earth globe">
    </div>

    <div id="loading" class="loading">
      <div class="loader"></div>
      <strong>Preparing Atlas</strong>
      <span id="loading-message">
        Loading geographic boundaries...
      </span>
    </div>

    <div id="error" class="error-panel hidden">
      <strong>Globe unavailable</strong>
      <p id="error-message"></p>
      <button id="retry" class="primary">
        Retry loading
      </button>
    </div>

    <div class="world-footer">
      <div class="legend">
        <span><i style="background:#52bec8"></i>Americas</span>
        <span><i style="background:#e7ae68"></i>Europe / Africa</span>
        <span><i style="background:#8198fa"></i>Asia / Oceania</span>
      </div>

      <div class="map-controls">
        <button id="home" title="Reset view">⌂</button>
        <button id="zoom-out" title="Zoom out">−</button>
        <button id="zoom-in" title="Zoom in">+</button>
      </div>
    </div>

  </section>

  <aside class="sidebar">

    <section>
      <div class="eyebrow">02 / CURRENT SELECTION</div>

      <nav id="breadcrumb"></nav>

      <h1 id="selected-name">Earth</h1>

      <p id="selected-meta">
        Explore the continents and countries of our world.
      </p>
    </section>

    <div class="divider"></div>

    <section>
      <div class="section-heading">
        <span class="eyebrow">03 / CONTINENTS</span>
        <span class="small-muted">Select to explore</span>
      </div>

      <div id="continents" class="continent-grid"></div>
    </section>

    <div class="divider"></div>

    <section>
      <div class="section-heading">
        <span class="eyebrow">04 / COUNTRIES</span>
        <span id="country-count" class="small-muted"></span>
      </div>

      <input
        id="search"
        class="field"
        placeholder="Search countries..."
      />

      <select id="region" class="field">
        <option value="">All subregions</option>
      </select>

      <div id="countries" class="country-list">
        <p class="empty">Loading countries...</p>
      </div>
    </section>

    <div class="divider"></div>

    <section>
      <div class="section-heading">
        <span class="eyebrow">05 / FIELD NOTES</span>
        <span id="save-status" class="saved-label">
          Local notebook
        </span>
      </div>

      <textarea
        id="note"
        placeholder="Record observations, research, ideas, or links..."
      ></textarea>

      <p class="hint">
        Notes are automatically saved in this browser.
      </p>

      <div class="button-row">
        <button id="save-note" class="primary">
          Save note
        </button>

        <button id="clear-note" class="secondary">
          Clear
        </button>
      </div>
    </section>

    <div class="divider"></div>

    <section>
      <div class="section-heading">
        <span class="eyebrow">06 / MY NOTEBOOK</span>
        <span id="note-count" class="small-muted">
          0 entries
        </span>
      </div>

      <div id="notebook" class="notebook">
        <p class="empty">
          Your saved notes appear here.
        </p>
      </div>
    </section>

    <footer>
      ATLAS / PROTOTYPE 01<br>
      Geographic boundaries: Natural Earth.<br>
      Notes stored locally on this device.
    </footer>

  </aside>
</main>
`;


// ==========================================
// ATLAS FIELD NOTES WORKSPACE
// ==========================================

function createFieldNotesWorkspace() {

  const workspace = document.createElement('section');

  workspace.id = 'field-notes-workspace';
  workspace.className = 'field-notes-workspace hidden';

  workspace.innerHTML = `
    <div class="notes-header">

      <div>
        <div class="eyebrow">
          ATLAS / RESEARCH WORKSPACE
        </div>

        <h1>Field Notes</h1>

        <p>
          Your geographic research notebook.
        </p>
      </div>

      <button id="close-notes" class="secondary">
        Return to globe
      </button>

    </div>

    <div class="notes-layout">

      <aside class="notes-sidebar">

        <button id="new-note" class="primary">
          + Create new note
        </button>

        <input
          id="note-search"
          class="field"
          placeholder="Search your notebook..."
        />

        <select id="note-location-filter" class="field">
          <option value="all">All locations</option>
          <option value="earth">Earth</option>
          <option value="continent">Continents</option>
          <option value="region">Regions</option>
          <option value="country">Countries</option>
        </select>

        <div class="notes-sidebar-heading">
          YOUR RESEARCH
        </div>

        <div id="notes-list" class="notes-list"></div>

        <div class="notes-export">

          <button id="export-json" class="secondary">
            Export JSON
          </button>

          <button id="export-markdown" class="secondary">
            Export Markdown
          </button>

          <button id="import-json" class="secondary">
            Import JSON
          </button>

          <input
            type="file"
            id="import-file"
            accept=".json,application/json"
            hidden
          />

        </div>

      </aside>

      <main class="notes-editor">

        <div id="notes-empty" class="notes-empty">

          <div class="empty-icon">✎</div>

          <h2>Your research starts here</h2>

          <p>
            Select a location on the globe or create
            a new note to begin recording research.
          </p>

          <button id="empty-new-note" class="primary">
            Create your first note
          </button>

        </div>

        <div id="notes-edit-area" class="hidden">

          <div class="editor-location">
            <span>GEOGRAPHIC LOCATION</span>
            <strong id="editor-location-name"></strong>
          </div>

          <input
            id="editor-title"
            class="editor-title"
            placeholder="Untitled research note"
            maxlength="150"
          />

          <div class="editor-meta">
            <span id="editor-date"></span>
            <span id="editor-save-status">Saved locally</span>
          </div>

          <textarea
            id="editor-content"
            class="editor-content"
            placeholder="Start writing your research here..."
          ></textarea>

          <div class="editor-actions">

            <button id="delete-note" class="danger">
              Delete note
            </button>

            <button id="save-editor" class="primary">
              Save note
            </button>

          </div>

        </div>

      </main>

    </div>
  `;

  document.body.append(workspace);


// ==========================================
// GLOBE PAGE GEOGRAPHIC NOTES PANEL
// ==========================================

const globeNotesPanel = document.createElement('aside');

globeNotesPanel.id = 'globe-notes-panel';
globeNotesPanel.className = 'globe-notes-panel';

globeNotesPanel.innerHTML = `
  <div class="globe-notes-header">
    <div>
      <div class="eyebrow">ATLAS / RESEARCH</div>
      <h3 id="globe-notes-location">Selected location</h3>
    </div>

    <span id="globe-notes-count" class="notes-count">
      0 notes
    </span>
  </div>

  <div id="globe-notes-list"></div>

  <button id="globe-create-note" class="primary">
    + Add field note
  </button>
`;

document.body.append(globeNotesPanel);

// Create a note for the currently selected geography.

$('globe-create-note').addEventListener('click', () => {

  const selection = currentSelection();

  const note = notebook.create({
    key: currentKey(),
    type: selection.type,
    name: selection.name
  });

  activeNoteId = note.id;

  openSpecificFieldNote(note.id);

});


  // Hide the original legacy notes interface.
// Its saved data remains preserved in localStorage.

$('note')?.closest('section')?.classList.add(
  'legacy-notes-hidden'
);

$('notebook')?.closest('section')?.classList.add(
  'legacy-notes-hidden'
);

  // Add navigation to existing Atlas header.

  const brand = document.querySelector('.topbar');

  const nav = document.createElement('div');

  nav.className = 'atlas-navigation';

  nav.innerHTML = `
    <button id="open-globe" class="nav-button active">
      ◉ Globe
    </button>

    <button id="open-field-notes" class="nav-button">
      ✎ Field Notes
    </button>
  `;

  brand.append(nav);

// ==========================================
// ATLAS NAVIGATION EVENTS
// ==========================================

const fieldNotesButton = $('open-field-notes');
const globeButton = $('open-globe');
const closeNotesButton = $('close-notes');

fieldNotesButton.addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();

  console.log('Field Notes selected');

  openFieldNotes();
});

globeButton.addEventListener('click', event => {
  event.preventDefault();

  closeFieldNotes();
});

closeNotesButton.addEventListener('click', event => {
  event.preventDefault();

  closeFieldNotes();
});

  $('new-note').addEventListener('click', createNewFieldNote);

  $('empty-new-note').addEventListener(
    'click',
    createNewFieldNote
  );

  $('note-search').addEventListener('input', event => {
    noteSearchQuery = event.target.value;
    renderFieldNotesList();
  });

  $('note-location-filter').addEventListener(
    'change',
    event => {
      notebookLocationFilter = event.target.value;
      renderFieldNotesList();
    }
  );

  $('editor-title').addEventListener('input', scheduleNoteSave);

  $('editor-content').addEventListener(
    'input',
    scheduleNoteSave
  );

  $('save-editor').addEventListener('click', () => {
    saveActiveFieldNote(true);
  });

  $('delete-note').addEventListener('click', deleteActiveFieldNote);

  $('export-json').addEventListener('click', () => {
    downloadNotebook(
      notebook.exportJSON(),
      'atlas-field-notes.json',
      'application/json'
    );
  });

  $('export-markdown').addEventListener('click', () => {
    downloadNotebook(
      notebook.exportMarkdown(),
      'atlas-field-notes.md',
      'text/markdown'
    );
  });

  $('import-json').addEventListener('click', () => {
    $('import-file').click();
  });

  $('import-file').addEventListener('change', async event => {

    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const contents = await file.text();

      flushActiveFieldNote();

      const imported = notebook.importJSON(contents);

      renderFieldNotesList();

      showToast(`${imported} notes imported`);

    } catch (error) {
      console.error(error);
      showToast('Import failed. Check the JSON file.');
    }

    event.target.value = '';
  });

}

// ==========================================
// OPEN AND CLOSE WORKSPACE
// ==========================================

function openFieldNotes() {

  console.log('Opening Atlas Field Notes');

  flushActiveFieldNote();

  notebookWorkspaceOpen = true;

  const workspace = $('field-notes-workspace');
  const globeLayout = document.querySelector('.layout');

  if (!workspace || !globeLayout) {
    console.error('Atlas workspace elements missing');
    return;
  }

  workspace.classList.remove('hidden');
  globeLayout.classList.add('hidden');

  $('open-field-notes').classList.add('active');
  $('open-globe').classList.remove('active');

  renderFieldNotesList();

  openLocationNotes(currentSelection());
}


// ==========================================
// RENDER NOTES ON GLOBE PAGE
// ==========================================


function renderGlobeNotesPanel() {

  const panel = $('globe-notes-panel');

  if (!panel) return;

  const selection = currentSelection();
  const locationKey = currentKey();

  const locationNotes = notebook.forLocation(locationKey);

  // Update geographic heading.
  $('globe-notes-location').textContent =
    selection.name;

  // Update note count.
  $('globe-notes-count').textContent =
    `${locationNotes.length} ${
      locationNotes.length === 1 ? 'note' : 'notes'
    }`;

  const host = $('globe-notes-list');

  host.replaceChildren();

  if (!locationNotes.length) {

    const empty = document.createElement('p');

    empty.className = 'globe-notes-empty';

    empty.textContent =
      `No research notes have been created for ${selection.name}.`;

    host.append(empty);

    return;
  }

  locationNotes.forEach(note => {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'globe-note-preview';

    const title = document.createElement('strong');

    title.textContent =
      note.title || 'Untitled note';

    const preview = document.createElement('span');

    preview.textContent =
      note.content.trim().slice(0, 110) ||
      'No written content yet. Click to continue writing.';

    const date = document.createElement('small');

    date.textContent =
      'Updated ' +
      new Date(note.updatedAt).toLocaleDateString();

    button.append(title, preview, date);

    button.addEventListener('click', () => {
      openSpecificFieldNote(note.id);
    });

    host.append(button);

  });

}


// ==========================================
// OPEN A SPECIFIC NOTE IN FIELD NOTES
// ==========================================

function openSpecificFieldNote(noteId) {

  // Retrieve the requested note first.
  const note = notebook.get(noteId);

  if (!note) {
    console.error('Atlas note not found:', noteId);
    return;
  }

  // Save the previous note before switching.
  flushActiveFieldNote();

  // Open the detailed workspace.
  if (!notebookWorkspaceOpen) {
    openFieldNotes();
  }

  // Now select the requested note.
  displayFieldNote(note);

}

function closeFieldNotes() {

  flushActiveFieldNote();

  notebookWorkspaceOpen = false;

  $('field-notes-workspace').classList.add('hidden');

  document.querySelector('.layout').classList.remove('hidden');

  $('open-globe').classList.add('active');

  $('open-field-notes').classList.remove('active');

  renderGlobeNotesPanel();  
}

// ==========================================
// CREATE NOTES
// ==========================================

function createNewFieldNote() {

  flushActiveFieldNote();

  const selection = currentSelection();

  const note = notebook.create({
    key: currentKey(),
    type: selection.type,
    name: selection.name
  });

  activeNoteId = note.id;

  renderFieldNotesList();

  displayFieldNote(note);

  $('editor-title').focus();

}

// ==========================================
// DISPLAY NOTES FOR A LOCATION
// ==========================================

function openLocationNotes(selection) {

  const key = currentKey();

  const matching = notebook.forLocation(key);

  renderFieldNotesList();

  if (matching.length) {

    const selected = matching.find(
      note => note.id === activeNoteId
    ) || matching[0];

    activeNoteId = selected.id;

    displayFieldNote(selected);

  } else {

    activeNoteId = null;

    showEmptyEditor();

  }

}

// ==========================================
// DISPLAY INDIVIDUAL NOTE
// ==========================================

function displayFieldNote(note) {

  if (!note) {
    showEmptyEditor();
    return;
  }

  activeNoteId = note.id;

  $('notes-empty').classList.add('hidden');

  $('notes-edit-area').classList.remove('hidden');

  $('editor-location-name').textContent =
    note.locationName;

  $('editor-title').value = note.title;

  $('editor-content').value = note.content;

  $('editor-date').textContent =
    'Last modified: ' +
    new Date(note.updatedAt).toLocaleString();

  $('editor-save-status').textContent =
    'Saved locally';

  renderFieldNotesList();

}

function showEmptyEditor() {

  activeNoteId = null;

  $('notes-empty').classList.remove('hidden');

  $('notes-edit-area').classList.add('hidden');

}

// ==========================================
// AUTO-SAVE
// ==========================================

function scheduleNoteSave() {

  $('editor-save-status').textContent =
    'Unsaved changes';

  clearTimeout(noteSaveTimer);

  noteSaveTimer = setTimeout(() => {
    saveActiveFieldNote(false);
  }, 600);

}

function saveActiveFieldNote(showMessage = false) {

  clearTimeout(noteSaveTimer);

  if (!activeNoteId) return;

  const updated = notebook.update(activeNoteId, {
    title: $('editor-title').value,
    content: $('editor-content').value
  });

  if (!updated) return;

  $('editor-save-status').textContent =
    'Saved locally';

  $('editor-date').textContent =
    'Last modified: ' +
    new Date(updated.updatedAt).toLocaleString();

  renderFieldNotesList();

  if (showMessage) {
    showToast('Research note saved');
  }

}

function flushActiveFieldNote() {

  if (!notebookWorkspaceOpen || !activeNoteId) return;

  saveActiveFieldNote(false);

}

// ==========================================
// DELETE NOTES
// ==========================================

function deleteActiveFieldNote() {

  if (!activeNoteId) return;

  const confirmed = window.confirm(
    'Are you sure you want to permanently delete this note?'
  );

  if (!confirmed) return;

  clearTimeout(noteSaveTimer);

  notebook.delete(activeNoteId);

  activeNoteId = null;

  renderFieldNotesList();

  showEmptyEditor();

  showToast('Note deleted');

}

// ==========================================
// RENDER NOTEBOOK LIST
// ==========================================

function renderFieldNotesList() {

  const host = $('notes-list');

  if (!host) return;

  host.replaceChildren();

  let entries = notebook.search(noteSearchQuery);

  if (notebookLocationFilter !== 'all') {

    entries = entries.filter(
      note => note.type === notebookLocationFilter
    );

  }

  if (!entries.length) {

    const empty = document.createElement('p');

    empty.className = 'empty';

    empty.textContent =
      'No notes found. Create a new note to get started.';

    host.append(empty);

    return;

  }

  entries.forEach(note => {

    const button = document.createElement('button');

    button.className = 'notes-list-item';

    if (note.id === activeNoteId) {
      button.classList.add('active');
    }

    const category = document.createElement('small');

    category.textContent =
      note.type.toUpperCase() +
      ' · ' +
      note.locationName;

    const title = document.createElement('strong');

    title.textContent =
      note.title || 'Untitled note';

    const preview = document.createElement('span');

    preview.textContent =
      note.content || 'No content yet';

    button.append(category, title, preview);

    button.addEventListener('click', () => {

      flushActiveFieldNote();

      displayFieldNote(note);

    });

    host.append(button);

  });

}

// ==========================================
// NOTE EXPORT
// ==========================================

function downloadNotebook(content, filename, mimeType) {

  const blob = new Blob([content], {
    type: mimeType
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  link.click();

  URL.revokeObjectURL(url);

  showToast('Notebook exported');

}

// ==========================================
// BASIC UTILITIES
// ==========================================

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function nameOf(feature) {
  const p = feature.properties || {};

  return p.ADMIN || p.NAME || p.name || 'Unknown country';
}

function continentOf(feature) {
  const c = feature.properties?.CONTINENT;

  return CONTINENTS.includes(c) ? c : 'Other';
}

function regionOf(feature) {
  return feature.properties?.SUBREGION ||
    feature.properties?.REGION_UN ||
    continentOf(feature);
}

function noteKey(type, name) {
  return `${type}:${name}`;
}

function currentSelection() {
  if (selectedCountry) {
    return {
      type: 'country',
      name: nameOf(selectedCountry)
    };
  }

  if (selectedRegion) {
    return {
      type: 'region',
      name: selectedRegion
    };
  }

  if (selectedContinent) {
    return {
      type: 'continent',
      name: selectedContinent
    };
  }

  return {
    type: 'earth',
    name: 'Earth'
  };
}

function currentKey() {
  const s = currentSelection();

  return noteKey(s.type, s.name);
}

// ==========================================
// NOTES MANAGEMENT
// ==========================================

function saveNotes(showMessage = false) {
  const value = $('note').value.trim();

  if (value) {
    notes[activeKey] = value;
  } else {
    delete notes[activeKey];
  }

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(notes)
    );

    $('save-status').textContent =
      value ? 'Saved locally' : 'No saved note';

  } catch (error) {
    $('save-status').textContent = 'Storage unavailable';
    console.error(error);
  }

  renderNotebook();

  if (showMessage) {
    showToast(value ? 'Note saved successfully' : 'Note cleared');
  }
}

function flushNotes() {
  clearTimeout(saveTimer);
  saveNotes();
}

function loadNote() {
  activeKey = currentKey();

  $('note').value = notes[activeKey] || '';

  $('save-status').textContent =
    notes[activeKey] ? 'Saved locally' : 'No saved note';
}

function showToast(message) {
  let toast = $('toast');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.append(toast);
  }

  toast.textContent = message;
  toast.classList.add('visible');

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2200);
}

// ==========================================
// GEOGRAPHIC NAVIGATION
// ==========================================

function updateSelection() {
  renderSelection();
  renderContinents();
  renderRegions();
  renderCountries();

  // Preserve the original notes interface.
  loadNote();

  // Update the geographic visualization.
  updateGlobe();

  // Refresh notes for the selected geographic location.
  if (typeof renderGlobeNotesPanel === 'function') {
    renderGlobeNotesPanel();
  }
}

function selectContinent(name) {
  flushNotes();

  selectedContinent = name;
  selectedRegion = null;
  selectedCountry = null;

  updateSelection();
}

function selectRegion(name) {
  flushNotes();

  selectedRegion = name || null;
  selectedCountry = null;

  updateSelection();
}

function centroid(feature) {
  const points = [];

  function collect(value) {
    if (!Array.isArray(value)) return;

    if (
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      points.push(value);
      return;
    }

    value.forEach(collect);
  }

  collect(feature.geometry?.coordinates);

  if (!points.length) return null;

  let sin = 0;
  let cos = 0;
  let lat = 0;

  points.forEach(point => {
    const rad = point[0] * Math.PI / 180;

    sin += Math.sin(rad);
    cos += Math.cos(rad);
    lat += point[1];
  });

  return [
    Math.atan2(sin, cos) * 180 / Math.PI,
    lat / points.length
  ];
}

function selectCountry(feature) {
  flushNotes();

  selectedCountry = feature;
  selectedContinent = continentOf(feature);
  selectedRegion = regionOf(feature);

  updateSelection();

  const center = centroid(feature);

  if (globe && center) {
    globe.controls().autoRotate = false;

    globe.pointOfView({
      lat: center[1],
      lng: center[0],
      altitude: 1.6
    }, 900);
  }
}

// ==========================================
// SELECTION DISPLAY
// ==========================================

function renderSelection() {
  const current = currentSelection();

  $('selected-name').textContent = current.name;

  const breadcrumb = $('breadcrumb');

  breadcrumb.replaceChildren();

  function add(name, callback) {
    const button = document.createElement('button');

    button.textContent = name;
    button.addEventListener('click', callback);

    breadcrumb.append(button);
  }

  add('Earth', () => {
    flushNotes();

    selectedCountry = null;
    selectedContinent = null;
    selectedRegion = null;

    updateSelection();
  });

  if (selectedContinent) {
    breadcrumb.append(
      document.createTextNode(' / ')
    );

    add(selectedContinent, () => {
      selectContinent(selectedContinent);
    });
  }

  if (selectedRegion) {
    breadcrumb.append(
      document.createTextNode(' / ')
    );

    add(selectedRegion, () => {
      selectRegion(selectedRegion);
    });
  }

  if (selectedCountry) {
    breadcrumb.append(
      document.createTextNode(' / ')
    );

    const label = document.createElement('span');

    label.textContent = nameOf(selectedCountry);

    breadcrumb.append(label);
  }

  if (selectedCountry) {
    $('selected-meta').textContent =
      `Country · ${selectedContinent} · ${selectedRegion}`;

  } else if (selectedRegion) {
    $('selected-meta').textContent =
      `Geographic subregion · ${selectedContinent}`;

  } else if (selectedContinent) {
    const count = features.filter(
      f => continentOf(f) === selectedContinent
    ).length;

    $('selected-meta').textContent =
      `${count} mapped geographic features`;

  } else {
    $('selected-meta').textContent =
      'Explore the continents and countries of our world.';
  }
}

// ==========================================
// CONTINENT DISPLAY
// ==========================================

function renderContinents() {
  const host = $('continents');

  host.replaceChildren();

  CONTINENTS.forEach(continent => {
    const count = features.filter(
      f => continentOf(f) === continent
    ).length;

    if (!count) return;

    const button = document.createElement('button');

    button.className = 'continent-button';

    if (selectedContinent === continent) {
      button.classList.add('active');
    }

    const dot = document.createElement('span');

    dot.className = 'continent-dot';
    dot.style.background = COLORS[continent];

    const label = document.createElement('span');

    label.textContent = continent;

    const amount = document.createElement('span');

    amount.className = 'count';
    amount.textContent = count;

    button.append(dot, label, amount);

    button.addEventListener('click', () => {
      selectContinent(continent);
    });

    host.append(button);
  });
}

// ==========================================
// GEOGRAPHIC SUBREGIONS
// ==========================================

function renderRegions() {
  const select = $('region');

  const previous = selectedRegion;

  select.replaceChildren();

  const defaultOption = document.createElement('option');

  defaultOption.value = '';
  defaultOption.textContent = 'All subregions';

  select.append(defaultOption);

  const regions = [
    ...new Set(
      features
        .filter(f =>
          !selectedContinent ||
          continentOf(f) === selectedContinent
        )
        .map(regionOf)
        .filter(Boolean)
    )
  ].sort();

  regions.forEach(region => {
    const option = document.createElement('option');

    option.value = region;
    option.textContent = region;

    select.append(option);
  });

  select.value = regions.includes(previous)
    ? previous
    : '';
}

// ==========================================
// COUNTRY LIST AND SEARCH
// ==========================================

function renderCountries() {
  const host = $('countries');

  host.replaceChildren();

  const query = $('search')
    .value
    .trim()
    .toLowerCase();

  const matching = features
    .filter(f =>
      (!selectedContinent ||
        continentOf(f) === selectedContinent) &&

      (!selectedRegion ||
        regionOf(f) === selectedRegion) &&

      nameOf(f).toLowerCase().includes(query)
    )
    .sort((a, b) =>
      nameOf(a).localeCompare(nameOf(b))
    );

  $('country-count').textContent =
    `${matching.length} results`;

  if (!matching.length) {
    const empty = document.createElement('p');

    empty.className = 'empty';
    empty.textContent = 'No matching countries found.';

    host.append(empty);

    return;
  }

  matching.forEach(feature => {
    const button = document.createElement('button');

    button.className = 'country-button';

    if (selectedCountry === feature) {
      button.classList.add('active');
    }

    const label = document.createElement('span');

    label.textContent = nameOf(feature);

    const arrow = document.createElement('span');

    arrow.textContent = '↗';

    button.append(label, arrow);

    button.addEventListener('click', () => {
      selectCountry(feature);
    });

    host.append(button);
  });
}

// ==========================================
// SAVED NOTEBOOK DISPLAY
// ==========================================

function renderNotebook() {
  const host = $('notebook');

  host.replaceChildren();

  const entries = Object.entries(notes)
    .filter(([, value]) =>
      typeof value === 'string' && value.trim()
    )
    .sort(([a], [b]) => a.localeCompare(b));

  $('note-count').textContent =
    `${entries.length} entries`;

  if (!entries.length) {
    const empty = document.createElement('p');

    empty.className = 'empty';
    empty.textContent =
      'Your saved notes appear here.';

    host.append(empty);

    return;
  }

  entries.slice(0, 40).forEach(([key, value]) => {
    const button = document.createElement('button');

    button.className = 'note-entry';

    const colon = key.indexOf(':');

    const type = key.slice(0, colon);
    const name = key.slice(colon + 1);

    const title = document.createElement('strong');

    title.textContent = name;

    const category = document.createElement('small');

    category.textContent = type.toUpperCase();

    const preview = document.createElement('span');

    preview.textContent = value;

    button.append(category, title, preview);

    button.addEventListener('click', () => {
      flushNotes();

      if (type === 'country') {
        const feature = features.find(
          f => nameOf(f) === name
        );

        if (feature) {
          selectCountry(feature);
        }

      } else if (type === 'continent') {
        selectContinent(name);

      } else if (type === 'region') {
        const feature = features.find(
          f => regionOf(f) === name
        );

        if (feature) {
          selectedContinent = continentOf(feature);
          selectRegion(name);
        }

      } else {
        selectedCountry = null;
        selectedContinent = null;
        selectedRegion = null;

        updateSelection();
      }

      $('note').focus();
    });

    host.append(button);
  });
}

// ==========================================
// GLOBE COUNTRY HIGHLIGHTING
// ==========================================

function updateGlobe() {
  if (!globe) return;

  globe
    .polygonsData(features)

    .polygonCapColor(f => {
      if (f === selectedCountry) {
        return '#fff0a8';
      }

      return COLORS[continentOf(f)] || '#8798aa';
    })

    .polygonStrokeColor(f => {
      return f === selectedCountry
        ? '#ffffff'
        : 'rgba(210,230,255,0.7)';
    })

    .polygonAltitude(f => {
      if (f === selectedCountry) {
        return 0.08;
      }

      if (
        selectedContinent &&
        continentOf(f) === selectedContinent
      ) {
        return 0.025;
      }

      return 0.006;
    });
}

// ==========================================
// INITIALIZE THE 3D GLOBE
// ==========================================

function setupGlobe() {
  const container = $('globe');

  globe = Globe()(container)

    .backgroundColor('rgba(0,0,0,0)')

    .globeImageUrl(
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
    )

    .bumpImageUrl(
      'https://unpkg.com/three-globe/example/img/earth-topology.png'
    )

    .showAtmosphere(true)

    .atmosphereColor('#4b9bda')

    .atmosphereAltitude(0.16)

    .polygonsData(features)

    .polygonCapColor(f =>
      COLORS[continentOf(f)] || '#8798aa'
    )

    .polygonSideColor(() =>
      'rgba(20,50,80,0.4)'
    )

    .polygonStrokeColor(() =>
      'rgba(210,230,255,0.7)'
    )

    .polygonAltitude(0.006)

    .polygonLabel(f => `
      <div class="tooltip">
        <strong>${escapeHTML(nameOf(f))}</strong>
        <br>
        ${escapeHTML(continentOf(f))}
        <br>
        ${escapeHTML(regionOf(f))}
        <br>
        <span>Click to explore</span>
      </div>
    `)

    .onPolygonClick(feature => {
      selectCountry(feature);
    })

    .onPolygonHover(feature => {
      container.style.cursor =
        feature ? 'pointer' : 'grab';
    })

    .width(container.clientWidth)

    .height(container.clientHeight);

  // ========================================
  // MOUSE AND CAMERA CONTROLS
  // ========================================

  const controls = globe.controls();

  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;

  controls.enableDamping = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.enablePan = false;

  globe.pointOfView({
    lat: 20,
    lng: 5,
    altitude: 2.2
  });

  // ========================================
  // THREE.JS LIGHTING
  // ========================================

  const ambient = new THREE.AmbientLight(
    0xffffff,
    0.65
  );

  globe.scene().add(ambient);

  const directional = new THREE.DirectionalLight(
    0xffffff,
    1.2
  );

  directional.position.set(2, 1, 3);

  globe.scene().add(directional);

  // ========================================
  // RESET GLOBE POSITION
  // ========================================

  $('home').addEventListener('click', () => {
    controls.autoRotate = true;

    globe.pointOfView({
      lat: 20,
      lng: 5,
      altitude: 2.2
    }, 700);
  });

  // ========================================
  // ZOOM IN
  // ========================================

  $('zoom-in').addEventListener('click', () => {
    const position = globe.pointOfView();

    globe.pointOfView({
      ...position,
      altitude: Math.max(
        0.8,
        position.altitude * 0.8
      )
    }, 300);
  });

  // ========================================
  // ZOOM OUT
  // ========================================

  $('zoom-out').addEventListener('click', () => {
    const position = globe.pointOfView();

    globe.pointOfView({
      ...position,
      altitude: Math.min(
        5,
        position.altitude * 1.2
      )
    }, 300);
  });

  // ========================================
  // RESPONSIVE GLOBE RESIZING
  // ========================================

  resizeObserver = new ResizeObserver(() => {
    if (!globe) return;

    globe
      .width(container.clientWidth)
      .height(container.clientHeight);
  });

  resizeObserver.observe(container);
}

// ==========================================
// APPLICATION EVENT HANDLERS
// ==========================================

function setupEvents() {

  // Geographic region selection

  $('region').addEventListener('change', event => {
    selectRegion(event.target.value);
  });

  // Country search

  $('search').addEventListener('input', () => {
    renderCountries();
  });

  // Automatic note saving

  $('note').addEventListener('input', () => {

    $('save-status').textContent =
      'Unsaved changes';

    clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {
      saveNotes();
    }, 500);

  });

  // Manual save

  $('save-note').addEventListener('click', () => {

    clearTimeout(saveTimer);

    saveNotes(true);

  });

  // Clear note

  $('clear-note').addEventListener('click', () => {

    clearTimeout(saveTimer);

    $('note').value = '';

    saveNotes(true);

  });

  // Save before leaving the page

  window.addEventListener('beforeunload', flushNotes);
}

// ==========================================
// LOAD GEOGRAPHIC DATA
// ==========================================

async function loadData() {

  $('status').textContent =
    'Loading geographic data';

  $('loading-message').textContent =
    'Downloading Natural Earth country boundaries...';

  const response = await fetch(DATA_URL);

  if (!response.ok) {
    throw new Error(
      `Country dataset returned HTTP ${response.status}`
    );
  }

  const data = await response.json();

  features = (data.features || []).filter(feature => {

    return (
      feature.geometry &&
      CONTINENTS.includes(continentOf(feature))
    );

  });

  if (!features.length) {
    throw new Error(
      'No usable geographic features were found.'
    );
  }

}

// ==========================================
// START ATLAS
// ==========================================

async function init() {

  setupEvents();

  $('error').classList.add('hidden');

  $('loading').classList.remove('hidden');

  try {

    // Load country boundaries

    await loadData();

    $('loading-message').textContent =
      'Building your interactive 3D Earth...';

    // Initialize the globe

    setupGlobe();

    // Populate interface

    updateSelection();

    renderNotebook();

    // Update status

    $('map-count').textContent =
      `${features.length} mapped features`;

    $('loading').classList.add('hidden');

    $('status').textContent =
      'Atlas ready';

    console.log('Atlas initialized successfully.');

  } catch (error) {

    console.error(
      'Atlas initialization error:',
      error
    );

    $('loading').classList.add('hidden');

    $('error').classList.remove('hidden');

    $('error-message').textContent =
      error.message;

    $('status').textContent =
      'Globe unavailable';

  }

}

// ==========================================
// RETRY BUTTON
// ==========================================

$('retry').addEventListener('click', () => {
  init();
});

// ==========================================
// LAUNCH APPLICATION
// ==========================================

createFieldNotesWorkspace();

init();
