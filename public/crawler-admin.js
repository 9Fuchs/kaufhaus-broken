const feedList = document.getElementById('feed-list');
const feedMessage = document.getElementById('feed-message');
const manualForm = document.getElementById('crawl-input-form');
const manualMessage = document.getElementById('feedback-msg');
let sourceSha = null;

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

function renderFeeds(feeds) {
    feedList.replaceChildren();
    feeds.forEach((feed = {}) => {
        const row = document.createElement('div');
        row.className = 'feed-row';

        const enabledLabel = document.createElement('label');
        enabledLabel.className = 'feed-enabled';
        const enabled = document.createElement('input');
        enabled.type = 'checkbox';
        enabled.className = 'feed-enabled-input';
        enabled.checked = feed.enabled !== false;
        enabledLabel.append(enabled, document.createTextNode(' Aktiv'));

        const name = document.createElement('input');
        name.type = 'text';
        name.className = 'feed-name';
        name.value = feed.name || '';
        name.placeholder = 'Quellenname';
        name.setAttribute('aria-label', 'Quellenname');

        const url = document.createElement('input');
        url.type = 'url';
        url.className = 'feed-url';
        url.value = feed.url || '';
        url.placeholder = 'https://example.org/feed.xml';
        url.setAttribute('aria-label', 'RSS-Feed-URL');
        url.required = true;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'feed-remove';
        remove.textContent = 'Entfernen';
        remove.addEventListener('click', () => row.remove());

        row.append(enabledLabel, name, url, remove);
        feedList.append(row);
    });
}

async function loadSources() {
    showMessage(feedMessage, 'Lade Konfiguration …');
    try {
        const result = await adminRequest('/api/admin/data?file=source_config.json');
        sourceSha = result.sha;
        renderFeeds(result.data.feeds || []);
        document.getElementById('feed-keywords').value = (result.data.keywords || []).join('\n');
        showMessage(feedMessage, 'Konfiguration geladen.');
    } catch (error) {
        showMessage(feedMessage, error.message, true);
    }
}

document.getElementById('add-feed').addEventListener('click', () => {
    const feeds = [...feedList.querySelectorAll('.feed-row')].map((row) => ({
        name: row.querySelector('.feed-name').value,
        url: row.querySelector('.feed-url').value,
        enabled: row.querySelector('.feed-enabled-input').checked
    }));
    feeds.push({ name: '', url: '', enabled: true });
    renderFeeds(feeds);
    feedList.lastElementChild?.querySelector('.feed-name').focus();
});

document.getElementById('save-feeds').addEventListener('click', async () => {
    const feeds = [...feedList.querySelectorAll('.feed-row')].map((row) => ({
        name: row.querySelector('.feed-name').value.trim(),
        url: row.querySelector('.feed-url').value.trim(),
        enabled: row.querySelector('.feed-enabled-input').checked
    }));
    const keywords = document.getElementById('feed-keywords').value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);

    if (feeds.some((feed) => !feed.name || !feed.url || !feed.url.startsWith('https://'))) {
        showMessage(feedMessage, 'Jeder Feed braucht einen Namen und eine HTTPS-URL.', true);
        return;
    }

    try {
        const result = await adminRequest('/api/admin/data', {
            method: 'PUT',
            body: JSON.stringify({ file: 'source_config.json', data: { feeds, keywords }, sha: sourceSha })
        });
        sourceSha = result.sha;
        showMessage(feedMessage, 'Quellen gespeichert und in GitHub committet.');
    } catch (error) {
        showMessage(feedMessage, error.message, true);
    }
});

manualForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage(manualMessage, 'Speichere Vorschlag …');

    try {
        const submissions = await adminRequest('/api/admin/data?file=submissions.json');
        const values = new FormData(manualForm);
        const result = await adminRequest('/api/admin/submissions', {
            method: 'POST',
            body: JSON.stringify({
                title: values.get('title'),
                source_url: values.get('source_url'),
                text: values.get('text'),
                sha: submissions.sha
            })
        });
        manualForm.reset();
        showMessage(manualMessage, `Vorschlag ${result.id} wurde für die Datenpflege gespeichert.`);
    } catch (error) {
        showMessage(manualMessage, error.message, true);
    }
});

loadSources();