const dataFiles = [
    'locations.json',
    'companies.json',
    'history.json',
    'tenants.json',
    'timeline_events.json',
    'changelog.json',
    'submissions.json'
];
const fileSelect = document.getElementById('data-file');
const editor = document.getElementById('json-editor');
const dataMessage = document.getElementById('data-message');
const submissionsContainer = document.getElementById('submissions-container');
let currentSha = null;

async function adminRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Anfrage fehlgeschlagen (${response.status}).`);
    return result;
}

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle('is-error', isError);
}

async function loadFile() {
    showMessage(dataMessage, 'Lade JSON …');
    try {
        const result = await adminRequest(`/api/admin/data?file=${encodeURIComponent(fileSelect.value)}`);
        if (!Array.isArray(result.data)) throw new Error('Die Datei enthält kein JSON-Array und kann hier nicht bearbeitet werden.');
        currentSha = result.sha;
        editor.value = JSON.stringify(result.data, null, 2);
        showMessage(dataMessage, `${fileSelect.value} geladen.`);
    } catch (error) {
        showMessage(dataMessage, error.message, true);
    }
}

function createTextElement(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
}

function renderSubmissions(submissions) {
    submissionsContainer.replaceChildren();
    const pending = submissions.filter((submission) => submission.status === 'PENDING_REVIEW');
    if (pending.length === 0) {
        submissionsContainer.append(createTextElement('p', 'Keine offenen Vorschläge.'));
        return;
    }

    pending.forEach((submission) => {
        const card = document.createElement('article');
        card.className = 'submission-card';
        card.append(createTextElement('h3', submission.title || 'Ohne Titel'));
        card.append(createTextElement('p', `${submission.source_type || 'Quelle'} · ${submission.crawled_at || 'Zeitpunkt unbekannt'}`));
        if (submission.source_url) {
            const link = document.createElement('a');
            link.href = submission.source_url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = submission.source_url;
            card.append(link);
        }
        if (submission.manual_text) {
            card.append(createTextElement('pre', submission.manual_text, 'submission-snippet'));
        } else if (submission.snippet) {
            card.append(createTextElement('p', submission.snippet, 'submission-snippet'));
        }

        const actions = document.createElement('div');
        actions.className = 'submission-actions';
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.textContent = 'Vorschlag als JSON kopieren';
        copyButton.addEventListener('click', async () => {
            const suggestion = {
                title: submission.title || '',
                source_url: submission.source_url || '',
                source_type: submission.source_type || '',
                snippet: submission.snippet || '',
                extracted_data: submission.extracted_data || {}
            };
            try {
                await navigator.clipboard.writeText(JSON.stringify(suggestion, null, 2));
                showMessage(dataMessage, 'Vorschlag kopiert. In die passende JSON-Datei einfügen und Felder prüfen.');
            } catch {
                showMessage(dataMessage, 'Zwischenablage nicht verfügbar. Öffne den Vorschlag über die JSON-Datei manuell.', true);
            }
        });
        actions.append(copyButton);
        card.append(actions);
        submissionsContainer.append(card);
    });
}

async function loadSubmissions() {
    try {
        const result = await adminRequest('/api/admin/data?file=submissions.json');
        if (!Array.isArray(result.data)) throw new Error('submissions.json enthält kein JSON-Array.');
        renderSubmissions(result.data);
    } catch (error) {
        submissionsContainer.replaceChildren(createTextElement('p', error.message, 'is-error'));
    }
}

document.getElementById('reload-data').addEventListener('click', loadFile);
fileSelect.addEventListener('change', loadFile);

document.getElementById('add-json-row').addEventListener('click', () => {
    try {
        const data = JSON.parse(editor.value);
        if (!Array.isArray(data)) throw new Error('Die JSON-Datei muss ein Array sein.');
        data.push({});
        editor.value = JSON.stringify(data, null, 2);
        showMessage(dataMessage, 'Leerer Eintrag ergänzt. Felder vor dem Speichern ausfüllen.');
    } catch (error) {
        showMessage(dataMessage, error.message, true);
    }
});

document.getElementById('save-data').addEventListener('click', async () => {
    let data;
    try {
        data = JSON.parse(editor.value);
        if (!Array.isArray(data)) throw new Error('Die JSON-Datei muss ein Array sein.');
    } catch (error) {
        showMessage(dataMessage, `JSON kann nicht gespeichert werden: ${error.message}`, true);
        return;
    }

    showMessage(dataMessage, 'Speichere JSON …');
    try {
        const result = await adminRequest('/api/admin/data', {
            method: 'PUT',
            body: JSON.stringify({ file: fileSelect.value, data, sha: currentSha })
        });
        currentSha = result.sha;
        showMessage(dataMessage, `${fileSelect.value} wurde in GitHub committet.`);
        if (fileSelect.value === 'submissions.json') renderSubmissions(data);
    } catch (error) {
        showMessage(dataMessage, error.message, true);
    }
});

loadFile();
loadSubmissions();