const getJSON = async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
    return response.json();
};

const makeElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
};

const setMessage = (element, text) => {
    element.textContent = text;
};

async function renderExceptions() {
    const container = document.querySelector('#exclusions-container');
    const message = makeElement('p', 'data-message');
    container.replaceChildren(message);

    try {
        const exclusions = await getJSON('./data/exclusions.json');
        if (!Array.isArray(exclusions)) throw new Error('Das Ausschluss-Dataset hat kein Listenformat.');
        if (exclusions.length === 0) {
            setMessage(message, 'Keine aktuellen Markenausschlüsse erfasst.');
            return;
        }

        const table = makeElement('table', 'status-table');
        const header = makeElement('thead');
        const headerRow = makeElement('tr');
        for (const title of ['Filiale', 'Rabatt / Regel', 'Gesperrte Marken', 'Status', 'Grund / gemeldet']) {
            headerRow.append(makeElement('th', '', title));
        }
        header.append(headerRow);
        const body = makeElement('tbody');

        for (const item of exclusions) {
            const row = makeElement('tr');
            const locations = item.locations || (item.location ? [item.location] : []);
            const locationCell = makeElement('td');
            locationCell.append(makeElement('strong', '', item.city || 'Unbekannter Ort'));
            if (locations.length) {
                locationCell.append(makeElement('br'));
                locationCell.append(document.createTextNode(locations.join(', ')));
            }
            row.append(locationCell);
            row.append(makeElement('td', '', item.discount || 'Keine Angabe'));
            row.append(makeElement('td', '', Array.isArray(item.blocked_brands) ? item.blocked_brands.join(', ') : 'Keine Angabe'));
            row.append(makeElement('td', '', [item.status, item.date_reported].filter(Boolean).join(' · ')));
            row.append(makeElement('td', '', item.reason || item.source_text || 'Keine Angabe'));
            body.append(row);
        }

        table.append(header, body);
        const wrapper = makeElement('div', 'table-responsive');
        wrapper.append(table);
        container.replaceChildren(wrapper);
    } catch (error) {
        console.error('Ausschlussdaten konnten nicht geladen werden:', error);
        setMessage(message, `Die Ausschlussdaten konnten nicht geladen werden: ${error.message}`);
    }
}

async function renderSubmissions() {
    const container = document.querySelector('#submissions-container');
    const message = makeElement('p', 'data-message');
    container.replaceChildren(message);

    try {
        const submissions = await getJSON('./data/submissions.json');
        if (!Array.isArray(submissions)) throw new Error('Das Vorschlags-Dataset hat kein Listenformat.');
        if (submissions.length === 0) {
            setMessage(message, 'Keine veröffentlichten Vorschläge vorhanden. Neue Crawler-Funde bleiben zunächst lokal in crawler/raw_submissions.json und werden nicht automatisch veröffentlicht.');
            return;
        }

        const list = makeElement('div', 'submission-list');
        for (const submission of submissions) {
            const card = makeElement('article', 'submission-card');
            card.append(makeElement('h2', '', submission.title || 'Ohne Titel'));
            card.append(makeElement('p', '', `Status: ${submission.status || 'Nicht angegeben'}`));
            if (submission.snippet) card.append(makeElement('p', '', submission.snippet));

            const sourceUrl = submission.source_url;
            if (sourceUrl) {
                try {
                    const parsedUrl = new URL(sourceUrl);
                    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                        throw new Error('Unsupported source URL protocol');
                    }
                    const source = makeElement('a', '', submission.origin || sourceUrl);
                    source.href = parsedUrl.href;
                    source.target = '_blank';
                    source.rel = 'noopener noreferrer';
                    card.append(source);
                } catch {
                    card.append(makeElement('p', '', `Quelle: ${sourceUrl}`));
                }
            } else if (submission.origin) {
                card.append(makeElement('p', '', `Quelle: ${submission.origin}`));
            }

            const extracted = submission.extracted_data;
            if (extracted && typeof extracted === 'object') {
                const details = Object.entries(extracted)
                    .filter(([, value]) => value !== null && value !== undefined && value !== '')
                    .map(([key, value]) => `${key.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
                    .join(' · ');
                if (details) card.append(makeElement('p', 'event-meta', details));
            }
            list.append(card);
        }
        container.replaceChildren(list);
    } catch (error) {
        console.error('Vorschläge konnten nicht geladen werden:', error);
        setMessage(message, `Die Vorschläge konnten nicht geladen werden: ${error.message}`);
    }
}

async function renderStatus() {
    const body = document.querySelector('#data-status-body');
    const summary = document.querySelector('#data-status-summary');
    const datasets = [
        ['Standorte', './data/locations.json'],
        ['Unternehmen', './data/companies.json'],
        ['Mieter', './data/tenants.json'],
        ['Zeitleistenereignisse', './data/timeline_events.json'],
        ['Geschichtsereignisse', './data/history.json'],
        ['Ausnahmen', './data/exclusions.json'],
        ['Vorschläge', './data/submissions.json'],
        ['Änderungsübersicht', './data/changelog.json']
    ];

    const results = await Promise.all(datasets.map(async ([name, path]) => {
        try {
            const data = await getJSON(path);
            if (!Array.isArray(data)) throw new Error('Erwartet wurde eine JSON-Liste.');
            return { name, count: data.length, error: null };
        } catch (error) {
            console.error(`Datensatz ${name} ist nicht verfügbar:`, error);
            return { name, count: null, error: error.message };
        }
    }));

    for (const result of results) {
        const row = makeElement('tr');
        row.append(makeElement('th', '', result.name));
        row.append(makeElement('td', '', result.error ? 'Fehler' : 'OK'));
        const countLabel = result.count === 1 ? 'Eintrag' : 'Einträge';
        row.append(makeElement('td', '', result.error || `${result.count} ${countLabel}`));
        body.append(row);
    }

    const failed = results.filter((result) => result.error).length;
    setMessage(
        summary,
        failed
            ? `${results.length - failed} von ${results.length} veröffentlichten Datensätzen sind lesbar; ${failed} Datensatz/Datensätze benötigen Prüfung. Live-Aufrufe und Crawler-Läufe werden hier nicht erfasst.`
            : `${results.length} veröffentlichte Datensätze sind lesbar. Live-Aufrufe und Crawler-Läufe werden hier nicht erfasst.`
    );
}

async function renderHistory() {
    const list = document.querySelector('#history-list');
    const count = document.querySelector('#history-count');
    const message = document.querySelector('#history-message');
    const search = document.querySelector('#history-search');

    try {
        const [events, locations, companies] = await Promise.all([
            getJSON('./data/history.json'),
            getJSON('./data/locations.json'),
            getJSON('./data/companies.json')
        ]);
        const locationNames = new Map(locations.map((location) => [location.id, location.name]));
        const companyNames = new Map(companies.map((company) => [company.id, company.name]));
        const sortedEvents = events.slice().sort((a, b) => a.year - b.year || a.title.localeCompare(b.title, 'de'));

        const update = () => {
            const query = search.value.trim().toLocaleLowerCase('de');
            const visibleEvents = sortedEvents.filter((event) => {
                const text = [event.year, event.title, event.description, locationNames.get(event.location_id), companyNames.get(event.company_id)]
                    .filter(Boolean).join(' ').toLocaleLowerCase('de');
                return text.includes(query);
            });
            list.replaceChildren(...visibleEvents.map((event) => {
                const item = makeElement('li', 'event-entry');
                item.append(makeElement('span', 'event-year', event.year));
                const content = makeElement('div', 'event-copy');
                content.append(makeElement('h3', '', event.title));
                content.append(makeElement('p', '', event.description));
                const location = event.location_id ? locationNames.get(event.location_id) : 'Unternehmensgeschichte';
                const company = companyNames.get(event.company_id);
                content.append(makeElement('p', 'event-meta', [location, company].filter(Boolean).join(' · ')));
                item.append(content);
                return item;
            }));
            setMessage(count, `${visibleEvents.length} von ${sortedEvents.length} Ereignissen`);
            setMessage(message, visibleEvents.length ? '' : 'Keine passenden Ereignisse gefunden.');
        };

        search.addEventListener('input', update);
        update();
    } catch (error) {
        console.error('Geschichtsdaten konnten nicht geladen werden:', error);
        setMessage(message, 'Die Geschichtsdaten konnten nicht geladen werden. Bitte prüfe, ob die Website über einen lokalen Webserver geöffnet ist.');
    }
}

function initHintForm() {
    const form = document.querySelector('#hint-form');
    const status = document.querySelector('#hint-status');
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const token = formData.get('cf-turnstile-response');
        if (!token) {
            setMessage(status, 'Bitte schließe zuerst die Sicherheitsprüfung ab.');
            return;
        }

        submitButton.disabled = true;
        setMessage(status, 'Hinweis wird gesendet …');
        try {
            const response = await fetch('/api/hinweis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: formData.get('subject'),
                    location: formData.get('location'),
                    category: formData.get('category'),
                    message: formData.get('message'),
                    email: formData.get('email'),
                    website: formData.get('website'),
                    turnstileToken: token
                })
            });
            const result = await response.json().catch(() => null);
            if (!response.ok) throw new Error(result?.error || 'Der Versand ist momentan nicht eingerichtet.');

            form.reset();
            window.turnstile?.reset();
            setMessage(status, 'Danke. Dein Hinweis wurde per E-Mail übermittelt.');
        } catch (error) {
            const message = error.message === 'Failed to fetch'
                ? 'Der Versand ist momentan nicht erreichbar. Bitte versuche es später erneut.'
                : error.message;
            setMessage(status, message || 'Senden nicht möglich. Bitte versuche es später erneut.');
            window.turnstile?.reset();
        } finally {
            submitButton.disabled = false;
        }
    });
}

const page = document.querySelector('[data-page]')?.dataset.page;
if (page === 'history') renderHistory();
if (page === 'hints') initHintForm();
if (page === 'exceptions') renderExceptions();
if (page === 'submissions') renderSubmissions();
if (page === 'status') renderStatus();
