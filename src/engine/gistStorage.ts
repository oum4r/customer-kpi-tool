import type { AppData } from '../types';

// ============================================================
// Constants
// ============================================================

const GIST_API = 'https://api.github.com/gists';
const GIST_FILENAME = 'kpi-tool-data.json';
const GIST_DESCRIPTION = 'Customer KPI Tool — Cloud Data';

// ============================================================
// Types
// ============================================================

interface GistFile {
  filename: string;
  content: string;
  raw_url?: string;
}

interface GistResponse {
  id: string;
  html_url: string;
  files: Record<string, GistFile>;
}

// ============================================================
// Helpers
// ============================================================

function headers(pat: string): HeadersInit {
  return {
    Authorization: `Bearer ${pat}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
  };
}

/**
 * Prepare AppData for Gist storage.
 * Strips the PAT itself from the stored data (it stays in localStorage only).
 */
function prepareForStorage(data: AppData): AppData {
  return {
    ...data,
    settings: {
      ...data.settings,
      githubPAT: undefined, // Never store the PAT in the Gist
      gistId: undefined,    // Gist ID is stored locally, not in the Gist
    },
  };
}

// ============================================================
// Public API
// ============================================================

/**
 * Validate that a PAT has the gist scope and is working.
 * Returns true if the token is valid, false otherwise.
 */
export async function testConnection(pat: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: headers(pat),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Create a new secret Gist with the app data.
 * Returns the Gist ID.
 */
export async function createGist(pat: string, data: AppData): Promise<string> {
  const res = await fetch(GIST_API, {
    method: 'POST',
    headers: headers(pat),
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false,
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(prepareForStorage(data), null, 2),
        },
      },
    }),
  });

  if (!res.ok) {
    const status = res.status;
    if (status === 401) throw new Error('Invalid or expired token.');
    if (status === 403) throw new Error('Rate limit exceeded. Try again later.');
    throw new Error(`Failed to create Gist (HTTP ${status}).`);
  }

  const gist: GistResponse = await res.json();
  return gist.id;
}

/**
 * Read AppData from an existing Gist.
 * Returns the parsed data, or null if the file is missing/empty.
 */
export async function readGist(pat: string, gistId: string): Promise<AppData | null> {
  const res = await fetch(`${GIST_API}/${gistId}`, {
    headers: headers(pat),
  });

  if (!res.ok) {
    const status = res.status;
    if (status === 401) throw new Error('Invalid or expired token.');
    if (status === 404) throw new Error('Gist not found. It may have been deleted.');
    if (status === 403) throw new Error('Rate limit exceeded. Try again later.');
    throw new Error(`Failed to read Gist (HTTP ${status}).`);
  }

  const gist: GistResponse = await res.json();
  const file = gist.files[GIST_FILENAME];

  if (!file || !file.content) return null;

  try {
    return JSON.parse(file.content) as AppData;
  } catch {
    return null;
  }
}

/**
 * Update an existing Gist with new app data.
 */
export async function updateGist(pat: string, gistId: string, data: AppData): Promise<void> {
  const res = await fetch(`${GIST_API}/${gistId}`, {
    method: 'PATCH',
    headers: headers(pat),
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(prepareForStorage(data), null, 2),
        },
      },
    }),
  });

  if (!res.ok) {
    const status = res.status;
    if (status === 401) throw new Error('Invalid or expired token.');
    if (status === 404) throw new Error('Gist not found. It may have been deleted.');
    if (status === 403) throw new Error('Rate limit exceeded. Try again later.');
    throw new Error(`Failed to update Gist (HTTP ${status}).`);
  }
}
