const historyList = document.getElementById('history-list');
const historySearch = document.getElementById('history-search');
const historyCount = document.getElementById('history-count');

function createTextElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
}

function renderHistory(events, locationNames, companyNames) {
    const query = historySearch.value.trim().toLocaleLowerCase('de');
    const visibleEvents = events.filter((event) => {
        const searchableText = [
            event.year,
            event.title,
            event.description,
            locationNames.get(event.location_id),
            companyNames.get(event.company_id)
        ].filter(Boolean).join(' ').toLocaleLowerCase('de');
        return searchableText.includes(query);
    });

    historyList.replaceChildren(...visibleEvents.map((event) => {
        const item = document.createElement('li');
        item.className = 'history-timeline-item';
        const date = createTextElement('time', 'history-timeline-date', String(event.year));
        date.dateTime = `${event.year}-01-01`;
        const content = document.createElement('div');
        content.className = 'history-timeline-content';
        content.append(createTextElement('h2', '', event.title));
        content.append(createTextElement('p', '', event.description));
        const context = [
            locationNames.get(event.location_id) || 'Unternehmensgeschichte',
            companyNames.get(event.company_id)
        ].filter(Boolean).join(' · ');
        content.append(createTextElement('p', 'history-timeline-meta', context));
        item.append(date, content);
        return item;
    }));

    historyCount.textContent = `${visibleEvents.length} von ${events.length} Ereignissen`;
}

Promise.all([
    fetch('data/history.json').then((response) => {
        if (!response.ok) throw new Error('history.json konnte nicht geladen werden.');
        return response.json();
    }),
    fetch('data/locations.json').then((response) => {
        if (!response.ok) throw new Error('locations.json konnte nicht geladen werden.');
        return response.json();
    }),
    fetch('data/companies.json').then((response) => {
        if (!response.ok) throw new Error('companies.json konnte nicht geladen werden.');
        return response.json();
    })
]).then(([events, locations, companies]) => {
    if (![events, locations, companies].every(Array.isArray)) {
        throw new Error('Mindestens eine Datenquelle hat ein ungültiges Format.');
    }

    const locationNames = new Map(locations.map((location) => [location.id, location.name]));
    const companyNames = new Map(companies.map((company) => [company.id, company.name]));
    const sortedEvents = events.slice().sort((first, second) => first.year - second.year || first.title.localeCompare(second.title, 'de'));
    const update = () => renderHistory(sortedEvents, locationNames, companyNames);
    historySearch.addEventListener('input', update);
    update();
}).catch((error) => {
    console.error('Geschichtsdaten konnten nicht geladen werden:', error);
    historyCount.textContent = 'Geschichtsdaten konnten nicht geladen werden';
});
