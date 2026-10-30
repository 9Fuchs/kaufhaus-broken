const feedList = document.getElementById('configured-feeds');
const processedSources = document.getElementById('processed-sources');
const dataPageMap = document.getElementById('data-page-map');

const dataUsage = [
    ['locations.json', ['index.html', 'standorte.html'], 'Filialadressen, Koordinaten und aktueller Standortstatus'],
    ['standorte.json', ['standorte.html'], 'Geprüfte Immobilien-, Miet-, Verkaufs- und Schließungsangaben'],
    ['exclusions.json', ['ausnahmen.html'], 'Markenausschlüsse, Verkaufsstopps und Abverkäufe'],
    ['history.json', ['zeitleiste.html'], 'Historische Unternehmensmeilensteine'],
    ['timeline_events.json', ['zeitleiste.html'], 'Standortbezogene Ereignisse'],
    ['companies.json', ['zeitleiste.html'], 'Unternehmensnamen zu historischen Meilensteinen'],
    ['submissions.json', ['datenpflege.html', 'status.html'], 'Ungeprüfte RSS- und manuelle Crawler-Vorschläge'],
    ['crawler_status.json', ['status.html'], 'Letzte RSS-Läufe, Feed-Ergebnisse und Trefferzahlen'],
    ['source_config.json', ['crawl.html'], 'Aktive RSS-Feeds und Suchbegriffe'],
    ['tenants.json', [], 'Mieternutzungen; derzeit keine öffentliche HTML-Einbindung'],
    ['changelog.json', [], 'Änderungsprotokoll; derzeit keine öffentliche HTML-Einbindung']
];

function appendText(parent, tag, text) {
    const element = document.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
}

function appendLink(parent, url, label) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    parent.append(link);
}

function addDataUsageRows() {
    dataUsage.forEach(([file, pages, description]) => {
        const row = document.createElement('tr');
        appendText(row, 'td', file);
        const pageCell = document.createElement('td');
        if (pages.length) {
            pages.forEach((page, index) => {
                if (index) pageCell.append(document.createTextNode(' · '));
                const link = document.createElement('a');
                link.href = page;
                link.textContent = page;
                pageCell.append(link);
            });
        } else {
            pageCell.textContent = 'Keine öffentliche Einbindung';
        }
        row.append(pageCell);
        appendText(row, 'td', description);
        dataPageMap.append(row);
    });
}

function addFeedRows(config) {
    feedList.replaceChildren();
    const feeds = Array.isArray(config.feeds) ? config.feeds : [];
    const activeFeeds = feeds.filter((feed) => feed.enabled !== false);
    if (!activeFeeds.length) {
        appendText(feedList, 'li', 'Derzeit sind keine RSS-Feeds aktiv.');
        return;
    }

    activeFeeds.forEach((feed) => {
        const item = document.createElement('li');
        appendLink(item, feed.url, feed.name || new URL(feed.url).hostname);
        feedList.append(item);
    });
}

function validHttpUrl(value) {
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) ? url : null;
    } catch {
        return null;
    }
}

function collectSources(value, file, sources) {
    if (Array.isArray(value)) {
        value.forEach((item) => collectSources(item, file, sources));
        return;
    }
    if (!value || typeof value !== 'object') return;

    const sourceUrl = validHttpUrl(value.source_url);
    if (sourceUrl) {
        const status = file === 'submissions.json'
            ? value.status === 'PENDING_REVIEW' ? 'Wartet auf manuelle Prüfung' : 'Crawler-Vorschlag'
            : 'Im Datensatz gespeichert';
        sources.push({
            file,
            url: sourceUrl.href,
            title: value.title || value.name || sourceUrl.hostname,
            date: value.crawled_at || value.observed_at || '',
            status
        });
    }

    Object.values(value).forEach((child) => collectSources(child, file, sources));
}

function renderSources(sources) {
    processedSources.replaceChildren();
    const uniqueSources = [...new Map(sources.map((source) => [`${source.file}|${source.url}`, source])).values()]
        .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'de'));

    if (!uniqueSources.length) {
        const row = document.createElement('tr');
        const cell = appendText(row, 'td', 'Noch keine konkreten Artikel-URLs in den JSON-Datensätzen gespeichert.');
        cell.colSpan = 4;
        processedSources.append(row);
        return;
    }

    uniqueSources.forEach((source) => {
        const row = document.createElement('tr');
        const titleCell = document.createElement('td');
        appendLink(titleCell, source.url, source.title);
        row.append(titleCell);
        appendText(row, 'td', source.date || 'Datum nicht angegeben');
        appendText(row, 'td', source.file);
        appendText(row, 'td', source.status);
        processedSources.append(row);
    });
}

addDataUsageRows();

Promise.all([
    fetch('data/source_config.json').then((response) => {
        if (!response.ok) throw new Error('source_config.json konnte nicht geladen werden.');
        return response.json();
    }),
    ...dataUsage.map(([file]) => fetch(`data/${file}`).then((response) => {
        if (!response.ok) throw new Error(`${file} konnte nicht geladen werden.`);
        return response.json();
    }))
]).then(([config, ...dataFiles]) => {
    addFeedRows(config);
    const sources = [];
    dataUsage.forEach(([file], index) => collectSources(dataFiles[index], file, sources));
    renderSources(sources);
}).catch((error) => {
    feedList.replaceChildren(appendText(document.createElement('li'), 'span', error.message));
    const row = document.createElement('tr');
    const cell = appendText(row, 'td', error.message);
    cell.colSpan = 4;
    processedSources.replaceChildren(row);
});