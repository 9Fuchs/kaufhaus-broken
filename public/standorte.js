const locationBody = document.getElementById('location-table-body');
const closureBody = document.getElementById('closure-table-body');
const locationCount = document.getElementById('location-count');
const closureSummary = document.getElementById('closure-summary');
const locationSearch = document.getElementById('location-search');
const locationStatus = document.getElementById('location-status');
const locationSale = document.getElementById('location-sale');
let locations = [];
let propertyRecords = [];
let verifiedClosures = [];
let standorteData = {};

function appendCell(row, value, className = '') {
    const cell = document.createElement('td');
    cell.textContent = value;
    if (className) cell.className = className;
    row.append(cell);
    return cell;
}

function appendSource(cell, url) {
    if (!url) {
        cell.textContent = 'Kein Beleg';
        return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Quelle';
    cell.append(link);
}

function statusLabel(status) {
    return {
        active: 'Aktiv',
        closed: 'Geschlossen',
        closing_announced: 'Schließung angekündigt',
        demolished: 'Abgerissen',
        repurposed: 'Nachgenutzt'
    }[status] || 'Nicht angegeben';
}

function getVerifiedPropertyMap() {
    return new Map(propertyRecords
        .filter((record) => record.review_status === 'verified' && record.location_id
            && [record.owner_source_url, record.sale_offer_url, record.rent_source_url, record.municipal_source_url].some(Boolean))
        .map((record) => [record.location_id, record]));
}

function renderClosures() {
    closureBody.replaceChildren();
    const closedLocations = locations.filter((location) => location.current_status === 'closed' || location.current_status === 'demolished');
    const verifiedRows = verifiedClosures.filter((record) => record.review_status === 'verified' && record.source_url);

    if (verifiedRows.length) {
        verifiedRows.forEach((record) => {
            const location = locations.find((item) => item.id === record.location_id);
            const row = document.createElement('tr');
            appendCell(row, location?.name || record.location_id || 'Standort nicht zugeordnet');
            appendCell(row, location?.city || '');
            appendCell(row, record.status || 'Geschlossen');
            appendCell(row, record.closure_date || '');
            appendSource(appendCell(row, ''), record.source_url);
            closureBody.append(row);
        });
        closureSummary.textContent = `${verifiedRows.length} manuell geprüfte Einträge der Juli-2026-Liste sind veröffentlicht. Der Sollumfang laut Projektangabe beträgt ${standorteData.closure_list?.expected_count || 33}.`;
        return;
    }

    closedLocations.forEach((location) => {
        const row = document.createElement('tr');
        appendCell(row, location.name);
        appendCell(row, location.city);
        appendCell(row, statusLabel(location.current_status));
        appendCell(row, location.closed_year || '');
        appendCell(row, 'Historischer Projektdatensatz');
        closureBody.append(row);
    });
    const expectedCount = standorteData.closure_list?.expected_count || 33;
    closureSummary.textContent = `Im Projekt sind ${closedLocations.length} ältere geschlossene oder abgerissene Standorte erfasst. Eine belegte Juli-2026-Liste mit ${expectedCount} Filialen liegt noch nicht vor; diese Tabelle ist kein Ersatz dafür.`;
}

function renderWaves(waves) {
    const container = document.getElementById('closure-waves');
    container.replaceChildren();
    waves.forEach((wave) => {
        const item = document.createElement('article');
        item.className = 'wave-item';
        const heading = document.createElement('h3');
        heading.textContent = wave.title || wave.period || 'Recherchepunkt';
        item.append(heading);
        const status = document.createElement('p');
        status.className = 'review-status';
        status.textContent = wave.verification_status === 'verified' ? 'Quelle geprüft' : 'Noch quellenpflichtig';
        item.append(status);
        if (wave.source_url && wave.verification_status === 'verified') appendSource(item, wave.source_url);
        container.append(item);
    });
}

function renderLocations() {
    const query = locationSearch.value.trim().toLocaleLowerCase('de');
    const selectedStatus = locationStatus.value;
    const selectedSale = locationSale.value;
    const propertyMap = getVerifiedPropertyMap();
    const visible = locations.filter((location) => {
        const searchText = `${location.name} ${location.city} ${location.postal_code}`.toLocaleLowerCase('de');
        const property = propertyMap.get(location.id);
        const saleValue = property?.sale_status || 'unknown';
        return (!query || searchText.includes(query))
            && (!selectedStatus || location.current_status === selectedStatus)
            && (!selectedSale || saleValue === selectedSale);
    });

    locationBody.replaceChildren();
    visible.forEach((location) => {
        const property = propertyMap.get(location.id);
        const row = document.createElement('tr');
        appendCell(row, `${location.name} · ${location.city}`);
        appendCell(row, statusLabel(location.current_status));
        const ownerText = property?.property_owner && property.owner_source_url
            ? `${property.property_owner}${property.owner_as_of ? ` (Stand ${property.owner_as_of})` : ''}`
            : 'Nicht verifiziert';
        appendCell(row, ownerText);
        const saleText = property?.sale_status === 'yes' && property.sale_offer_url
            ? `Zum Verkauf angeboten${property.sale_offer_note ? `: ${property.sale_offer_note}` : ''}`
            : property?.sale_status === 'no' && property.sale_offer_url
                ? 'Kein Angebot vermerkt'
                : 'Nicht verifiziert';
        appendCell(row, saleText);
        const rentAndCity = [];
        if (Number.isFinite(property?.monthly_rent_eur) && property.rent_source_url) rentAndCity.push(`${property.monthly_rent_eur.toLocaleString('de-DE')} € / Monat`);
        if (property?.municipal_acquisition && property.municipal_source_url) rentAndCity.push(property.municipal_acquisition);
        appendCell(row, rentAndCity.join(' · ') || 'Keine verifizierte Angabe');
        const sourceCell = appendCell(row, '');
        const sourceUrls = [...new Set([
            property?.owner_source_url,
            property?.sale_offer_url,
            property?.rent_source_url,
            property?.municipal_source_url
        ].filter(Boolean))];
        if (sourceUrls.length) {
            sourceUrls.forEach((url, index) => {
                if (index) sourceCell.append(document.createTextNode(' · '));
                appendSource(sourceCell, url);
            });
        } else {
            sourceCell.textContent = 'Kein Beleg';
        }
        locationBody.append(row);
    });
    locationCount.textContent = `${visible.length} von ${locations.length} Standorten`;
}

for (const filter of [locationSearch, locationStatus, locationSale]) {
    filter.addEventListener('input', renderLocations);
    filter.addEventListener('change', renderLocations);
}

Promise.all([
    fetch('data/locations.json').then((response) => {
        if (!response.ok) throw new Error('locations.json konnte nicht geladen werden.');
        return response.json();
    }),
    fetch('data/standorte.json').then((response) => {
        if (!response.ok) throw new Error('standorte.json konnte nicht geladen werden.');
        return response.json();
    })
]).then(([locationData, propertyData]) => {
    if (!Array.isArray(locationData) || !Array.isArray(propertyData.property_records)) {
        throw new Error('Die Standortdaten haben ein ungültiges Format.');
    }
    locations = locationData;
    propertyRecords = propertyData.property_records;
    verifiedClosures = propertyData.closure_list?.records || [];
    standorteData = propertyData;
    renderClosures();
    renderWaves(propertyData.closure_waves || []);
    renderLocations();
}).catch((error) => {
    locationCount.textContent = error.message;
    closureSummary.textContent = error.message;
});