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

function brandsFor(entry) {
    return Array.isArray(entry.blocked_brands) ? entry.blocked_brands : [entry.brand].filter(Boolean);
}

function renderExceptions() {
    const selectedBrand = brandFilter.value;
    const visibleEntries = exceptionEntries.filter((entry) => !selectedBrand || brandsFor(entry).includes(selectedBrand));
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
        addText(top, 'span', entry.example ? 'Beispieldatensatz' : 'Gemeldet', 'exception-badge');
        const reportedAt = entry.observed_at || entry.date_reported;
        addText(top, 'time', reportedAt ? `Stand ${reportedAt}` : 'Zeitpunkt nicht angegeben');
        card.append(top);
        const brands = brandsFor(entry);
        addText(card, 'h2', entry.branch_name || entry.city || brands.join(', ') || 'Markenausnahme');
        const locations = Array.isArray(entry.locations) ? entry.locations.join(', ') : entry.location_id;
        addText(card, 'p', [entry.product_group, locations, entry.city].filter(Boolean).join(' · ') || 'Filiale nicht angegeben', 'exception-location');
        if (brands.length) addText(card, 'p', `Betroffene Marken: ${brands.join(', ')}`, 'exception-display-note');
        const statusLabels = {
            restricted: 'Verkaufsstopp / Regalbereich gesperrt',
            clearance: 'Abverkauf'
        };
        addText(card, 'p', statusLabels[entry.status] || entry.status || 'Status nicht angegeben', `exception-status ${entry.status || ''}`);
        if (entry.display_note) addText(card, 'p', entry.display_note, 'exception-display-note');
        const offer = entry.offer_label || entry.discount;
        if (offer) addText(card, 'p', offer, 'exception-offer');
        if (entry.reason) addText(card, 'p', `Grund: ${entry.reason}`, 'exception-reason');
        if (entry.source_text) addText(card, 'p', `Quelle: ${entry.source_text}`, 'exception-reason');

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
        const brands = [...new Set(entries.flatMap(brandsFor))].sort((a, b) => a.localeCompare(b, 'de'));
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