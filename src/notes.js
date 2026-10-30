
const STORAGE_KEY = 'atlas-field-notes-v1';
const LEGACY_KEY = 'atlas-notes-v2';

function makeId() {
  return globalThis.crypto?.randomUUID?.() ||
    `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

function readLegacyNotes() {
  return safeParse(
    localStorage.getItem(LEGACY_KEY) || '{}',
    {}
  );
}

function normalizeNotes(data) {
  if (!Array.isArray(data)) return [];

  return data.filter(note =>
    note &&
    typeof note.id === 'string' &&
    typeof note.locationKey === 'string' &&
    typeof note.title === 'string' &&
    typeof note.content === 'string'
  );
}

function migrateLegacyNotes() {
  const legacy = readLegacyNotes();
  const migrated = [];

  for (const [key, content] of Object.entries(legacy)) {
    if (typeof content !== 'string' || !content.trim()) {
      continue;
    }

    const separator = key.indexOf(':');

    const type = separator >= 0
      ? key.slice(0, separator)
      : 'earth';

    const name = separator >= 0
      ? key.slice(separator + 1)
      : 'Earth';

    migrated.push({
      id: makeId(),
      locationKey: key,
      type,
      locationName: name,
      title: `Imported note — ${name}`,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  return migrated;
}

function loadNotes() {
  const existing = safeParse(
    localStorage.getItem(STORAGE_KEY) || 'null',
    null
  );

  if (Array.isArray(existing)) {
    return normalizeNotes(existing);
  }

  const migrated = migrateLegacyNotes();

  if (migrated.length) {
    saveNotes(migrated);
  }

  return migrated;
}

function saveNotes(notes) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(notes)
  );
}

export function createNotebook() {
  let notes = loadNotes();

  function persist() {
    saveNotes(notes);
  }

  return {
    all() {
      return [...notes].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      );
    },

    forLocation(locationKey) {
      return notes
        .filter(note => note.locationKey === locationKey)
        .sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt)
        );
    },

    get(id) {
      return notes.find(note => note.id === id) || null;
    },

    create(location) {
      const now = new Date().toISOString();

      const note = {
        id: makeId(),
        locationKey: location.key,
        type: location.type,
        locationName: location.name,
        title: '',
        content: '',
        createdAt: now,
        updatedAt: now
      };

      notes.unshift(note);
      persist();

      return note;
    },

    update(id, changes) {
      const note = notes.find(item => item.id === id);

      if (!note) return null;

      note.title = String(changes.title ?? note.title);
      note.content = String(changes.content ?? note.content);
      note.updatedAt = new Date().toISOString();

      persist();

      return { ...note };
    },

    delete(id) {
      const previousLength = notes.length;

      notes = notes.filter(note => note.id !== id);

      if (notes.length !== previousLength) {
        persist();
        return true;
      }

      return false;
    },

    search(query) {
      const term = query.trim().toLowerCase();

      if (!term) return this.all();

      return this.all().filter(note =>
        note.title.toLowerCase().includes(term) ||
        note.content.toLowerCase().includes(term) ||
        note.locationName.toLowerCase().includes(term)
      );
    },

    exportJSON() {
      return JSON.stringify(notes, null, 2);
    },

    exportMarkdown() {
      return notes.map(note => {
        const date = new Date(
          note.updatedAt
        ).toLocaleString();

        return [
          `# ${note.title || 'Untitled note'}`,
          '',
          `Location: ${note.locationName}`,
          `Category: ${note.type}`,
          `Last updated: ${date}`,
          '',
          note.content,
          '',
          '---',
          ''
        ].join('\n');
      }).join('\n');
    },

    importJSON(json) {
      const imported = normalizeNotes(
        JSON.parse(json)
      );

      const existingIds = new Set(
        notes.map(note => note.id)
      );

      const additions = imported.filter(
        note => !existingIds.has(note.id)
      );

      notes = [...additions, ...notes];

      persist();

      return additions.length;
    },

    count(locationKey) {
      return notes.filter(
        note => note.locationKey === locationKey
      ).length;
    }
  };
}
