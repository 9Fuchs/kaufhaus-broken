export const DATA_FILES = new Set([
    'locations.json',
    'companies.json',
    'history.json',
    'tenants.json',
    'timeline_events.json',
    'changelog.json',
    'submissions.json',
    'source_config.json'
]);

const MAX_FILE_BYTES = 1_000_000;

function configuration(env) {
    const [owner, repository] = (env.GITHUB_REPOSITORY || '').split('/');
    if (!env.GITHUB_TOKEN || !owner || !repository) {
        throw new Error('GitHub-Speicher ist nicht vollständig konfiguriert.');
    }

    return {
        owner,
        repository,
        branch: env.GITHUB_BRANCH || 'main',
        token: env.GITHUB_TOKEN
    };
}

function githubHeaders(token) {
    return {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'kaufhaus-broken-admin'
    };
}

function contentsUrl(config, file) {
    const path = `public/data/${file}`.split('/').map(encodeURIComponent).join('/');
    return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repository)}/contents/${path}?ref=${encodeURIComponent(config.branch)}`;
}

function decodeContent(content) {
    const binary = atob(content.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function encodeContent(content) {
    const bytes = new TextEncoder().encode(content);
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}

export async function readDataFile(env, file) {
    if (!DATA_FILES.has(file)) throw new Error('Diese Datendatei ist nicht freigegeben.');

    const config = configuration(env);
    const response = await fetch(contentsUrl(config, file), { headers: githubHeaders(config.token) });
    if (response.status === 404) return { data: file === 'source_config.json' ? { feeds: [], keywords: [] } : [], sha: null };
    if (!response.ok) throw new Error(`GitHub konnte ${file} nicht lesen (HTTP ${response.status}).`);

    const result = await response.json();
    let data;
    try {
        data = JSON.parse(decodeContent(result.content));
    } catch {
        throw new Error(`${file} enthält kein gültiges JSON.`);
    }
    return { data, sha: result.sha };
}

export async function writeDataFile(env, file, data, expectedSha) {
    if (!DATA_FILES.has(file)) throw new Error('Diese Datendatei ist nicht freigegeben.');
    if (file === 'source_config.json') {
        if (!data || !Array.isArray(data.feeds) || !Array.isArray(data.keywords)) {
            throw new Error('Quellen benötigen eine feeds- und keywords-Liste.');
        }
    } else if (!Array.isArray(data)) {
        throw new Error('Diese Datendatei muss ein JSON-Array enthalten.');
    }

    const content = `${JSON.stringify(data, null, 2)}\n`;
    if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) {
        throw new Error('Die JSON-Datei überschreitet die erlaubte Größe.');
    }

    const current = await readDataFile(env, file);
    if (current.sha !== expectedSha) {
        return { conflict: true, sha: current.sha };
    }

    const config = configuration(env);
    const response = await fetch(contentsUrl(config, file), {
        method: 'PUT',
        headers: { ...githubHeaders(config.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: `Update ${file} via admin`,
            content: encodeContent(content),
            sha: current.sha || undefined,
            branch: config.branch
        })
    });

    if (response.status === 409 || response.status === 422) {
        return { conflict: true };
    }
    if (!response.ok) throw new Error(`GitHub konnte ${file} nicht speichern (HTTP ${response.status}).`);

    const result = await response.json();
    return { conflict: false, sha: result.content.sha };
}

export function isValidRecordFile(file) {
    return DATA_FILES.has(file) && file !== 'source_config.json';
}