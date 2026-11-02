const timelineList = document.getElementById('timeline-list');
const timelineSearch = document.getElementById('timeline-search');
const timelineType = document.getElementById('timeline-type');
const timelinePeriod = document.getElementById('timeline-period');
const timelineCompany = document.getElementById('timeline-company');
const timelineCount = document.getElementById('timeline-count');
let events = [];

const eventLabels = {
    OPENING: 'Eröffnung',
    RENAMING: 'Übernahme / Umbenennung',
    CLOSURE: 'Schließung',
    DEMOLITION: 'Rückbau',
    HISTORICAL: 'Unternehmensgeschichte'
};

function normalizedDate(event) {
    return event.event_date || `${event.year}-01-01`;
}

function displayLocation(locationId, locationNames) {
    if (!locationId) return '';
    return locationNames.get(locationId)
        || locationId.replace(/^loc-/, '').replace(/-/g, ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function renderTimeline() {
    const query = timelineSearch.value.trim().toLocaleLowerCase('de');
    const selectedType = timelineType.value;
    const selectedPeriod = timelinePeriod.value;
    const selectedCompany = timelineCompany.value;
    const visibleEvents = events.filter((event) => {
        const year = normalizedDate(event).slice(0, 4);
        const decade = `${Math.floor(Number(year) / 10) * 10}s`;
        const searchableText = [
            event.event_date,
            event.title,
            event.description,
            event.event_type,
            eventLabels[event.event_type],
            event.company_name,
            event.location_name
        ].filter(Boolean).join(' ').toLocaleLowerCase('de');
        return searchableText.includes(query)
            && (!selectedType || event.event_type === selectedType)
            && (!selectedPeriod || decade === selectedPeriod)
            && (!selectedCompany || event.company_id === selectedCompany);
    });

    timelineList.replaceChildren();
    timelineCount.textContent = `${visibleEvents.length} ${visibleEvents.length === 1 ? 'Ereignis' : 'Ereignisse'}`;

    if (visibleEvents.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'timeline-empty';
        empty.textContent = 'Für diese Auswahl sind keine Ereignisse erfasst.';
        timelineList.append(empty);
        return;
    }

    visibleEvents.forEach((event) => {
        const item = document.createElement('li');
        item.className = 'history-timeline-item';
        const date = normalizedDate(event);
        const year = document.createElement('time');
        year.className = 'history-timeline-date';
        year.dateTime = date;
        year.textContent = date.length > 4 ? new Intl.DateTimeFormat('de-DE', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) : date;

        const content = document.createElement('div');
        content.className = 'history-timeline-content';
        const heading = document.createElement('h2');
        heading.textContent = event.title || 'Ereignis ohne Titel';
        const meta = document.createElement('p');
        meta.className = 'history-timeline-meta';
        const parts = [event.company_name || 'Standortgeschichte', event.location_name].filter(Boolean);
        meta.textContent = `${eventLabels[event.event_type] || event.event_type || 'Meilenstein'} · ${parts.join(' · ')}`;
        const description = document.createElement('p');
        description.textContent = event.description || '';

        content.append(heading, meta, description);
        item.append(year, content);
        timelineList.append(item);
    });
}

Promise.all([
    fetch('data/history.json').then((response) => {
        if (!response.ok) throw new Error('history.json konnte nicht geladen werden.');
        return response.json();
    }),
    fetch('data/timeline_events.json').then((response) => {
        if (!response.ok) throw new Error('timeline_events.json konnte nicht geladen werden.');
        return response.json();
    }),
    fetch('data/companies.json').then((response) => {
        if (!response.ok) throw new Error('companies.json konnte nicht geladen werden.');
        return response.json();
    }),
    fetch('data/locations.json').then((response) => {
        if (!response.ok) throw new Error('locations.json konnte nicht geladen werden.');
        return response.json();
    })
]).then(([history, locationEvents, companies, locations]) => {
    if (![history, locationEvents, companies, locations].every(Array.isArray)) {
        throw new Error('Mindestens eine Datenquelle hat ein ungültiges Format.');
    }
    const companyNames = new Map(companies.map((company) => [company.id, company.name]));
    const locationNames = new Map(locations.map((location) => [location.id, `${location.name} · ${location.city}`]));
    events = [
        ...history.map((event) => ({
            ...event,
            event_type: 'HISTORICAL',
            company_name: companyNames.get(event.company_id) || 'Unternehmensgeschichte',
            location_name: displayLocation(event.location_id, locationNames)
        })),
        ...locationEvents.map((event) => ({
            ...event,
            company_name: '',
            location_name: displayLocation(event.location_id, locationNames)
        }))
    ].sort((a, b) => normalizedDate(a).localeCompare(normalizedDate(b)) || String(a.title).localeCompare(String(b.title), 'de'));

    const decades = [...new Set(events.map((event) => `${Math.floor(Number(normalizedDate(event).slice(0, 4)) / 10) * 10}s`))];
    decades.forEach((decade) => {
        const option = document.createElement('option');
        option.value = decade;
        option.textContent = decade;
        timelinePeriod.append(option);
    });
    const companiesInTimeline = [...new Set(events.map((event) => event.company_id).filter(Boolean))];
    companiesInTimeline.forEach((companyId) => {
        const option = document.createElement('option');
        option.value = companyId;
        option.textContent = companyNames.get(companyId) || companyId;
        timelineCompany.append(option);
    });
    const eventTypes = [...new Set(events.map((event) => event.event_type).filter(Boolean))].sort();
    eventTypes.forEach((eventType) => {
        const option = document.createElement('option');
        option.value = eventType;
        option.textContent = eventLabels[eventType] || eventType;
        timelineType.append(option);
    });
    renderTimeline();
}).catch((error) => {
    timelineCount.textContent = 'Ereignisse konnten nicht geladen werden';
    const item = document.createElement('li');
    item.className = 'timeline-empty is-error';
    item.textContent = error.message;
    timelineList.append(item);
});

timelineSearch.addEventListener('input', renderTimeline);
timelineType.addEventListener('change', renderTimeline);
timelinePeriod.addEventListener('change', renderTimeline);
timelineCompany.addEventListener('change', renderTimeline);