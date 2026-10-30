const exceptionList = document.getElementById('exception-list');
const brandFilter = document.getElementById('exception-brand');
const exceptionCount = document.getElementById('exception-count');
let exceptionEntries = [];

function addText(parent, tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    parent.append(element);
    return element;
}

function renderExceptions() {
    const selectedBrand = brandFilter.value;
    const visibleEntries = exceptionEntries.filter((entry) => !selectedBrand || entry.brand === selectedBrand);
    exceptionList.replaceChildren();
    exceptionCount.textContent = `${visibleEntries.length} ${visibleEntries.length === 1 ? 'Eintrag' : 'Einträge'}`;

    if (visibleEntries.length === 0) {
        addText(exceptionList, 'p', 'Keine Markenausnahmen für diese Auswahl erfasst.', 'empty-state');
        return;
    }

    visibleEntries.forEach((entry) => {
        const card = document.createElement('article');
        card.className = `exception-card${entry.example ? ' is-example' : ''}`;
        const top = document.createElement('div');
        top.className = 'exception-card-top';
        addText(top, 'span', entry.example ? 'Beispieldatensatz' : 'Erfasst', 'exception-badge');
        addText(top, 'time', entry.observed_at ? `Stand ${entry.observed_at}` : 'Zeitpunkt nicht angegeben');
        card.append(top);
        addText(card, 'h2', entry.brand || 'Marke nicht angegeben');
        addText(card, 'p', `${entry.product_group || 'Warengruppe nicht angegeben'} · ${entry.branch_name || entry.location_id || 'Filiale nicht angegeben'}`, 'exception-location');
        const statusLabels = {
            restricted: 'Verkaufsstopp / Regalbereich gesperrt',
            clearance: 'Abverkauf'
        };
        addText(card, 'p', statusLabels[entry.status] || 'Status nicht angegeben', `exception-status ${entry.status || ''}`);
        addText(card, 'p', entry.display_note || 'Kein Hinweis zum Regalbereich angegeben.', 'exception-display-note');
        addText(card, 'p', entry.offer_label || 'Keine Rabattaktion angegeben.', 'exception-offer');
        addText(card, 'p', `Grund: ${entry.reason || 'nicht angegeben'}`, 'exception-reason');

        if (entry.source_url) {
            const source = document.createElement('a');
            source.href = entry.source_url;
            source.target = '_blank';
            source.rel = 'noopener noreferrer';
            source.textContent = 'Quelle öffnen';
            card.append(source);
        }
        exceptionList.append(card);
    });
}

brandFilter.addEventListener('change', renderExceptions);

fetch('data/exclusions.json')
    .then((response) => {
        if (!response.ok) throw new Error('Die Ausnahmen-Datei konnte nicht geladen werden.');
        return response.json();
    })
    .then((entries) => {
        if (!Array.isArray(entries)) throw new Error('exclusions.json muss ein JSON-Array enthalten.');
        exceptionEntries = entries;
        const brands = [...new Set(entries.map((entry) => entry.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
        brands.forEach((brand) => {
            const option = document.createElement('option');
            option.value = brand;
            option.textContent = brand;
            brandFilter.append(option);
        });
        renderExceptions();
    })
    .catch((error) => {
        exceptionCount.textContent = 'Daten konnten nicht geladen werden';
        addText(exceptionList, 'p', error.message, 'is-error');
    });