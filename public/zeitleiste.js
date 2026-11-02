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

async function renderTimeline() {
    const list = document.querySelector('#timeline-list');
    const count = document.querySelector('#timeline-count');
    const message = document.querySelector('#timeline-message');
    const search = document.querySelector('#timeline-search');
    const typeFilter = document.querySelector('#timeline-type');

    try {
        const [events, locations] = await Promise.all([
            getJSON('./data/timeline_events.json'),
            getJSON('./data/locations.json')
        ]);
        const locationNames = new Map(locations.map((location) => [location.id, location.name]));
        const sortedEvents = events.slice().sort((a, b) => a.event_date.localeCompare(b.event_date) || a.id - b.id);
        const eventTypes = [...new Set(sortedEvents.map((event) => event.event_type).filter(Boolean))].sort();
        for (const type of eventTypes) {
            const option = makeElement('option', '', type.replaceAll('_', ' '));
            option.value = type;
            typeFilter.append(option);
        }

        const update = () => {
            const query = search.value.trim().toLocaleLowerCase('de');
            const visibleEvents = sortedEvents.filter((event) => {
                const location = locationNames.get(event.location_id) || '';
                const text = [event.event_date, event.title, event.description, location, event.event_type]
                    .filter(Boolean).join(' ').toLocaleLowerCase('de');
                return text.includes(query) && (!typeFilter.value || event.event_type === typeFilter.value);
            });
            list.replaceChildren(...visibleEvents.map((event) => {
                const item = makeElement('li', 'event-entry');
                const date = makeElement('time', 'event-year', new Date(`${event.event_date}T00:00:00`).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' }));
                date.dateTime = event.event_date;
                item.append(date);
                const content = makeElement('div', 'event-copy');
                const locationName = locationNames.get(event.location_id) || 'Standort nicht zugeordnet';
                content.append(makeElement('span', 'event-type', (event.event_type || 'Ereignis').replaceAll('_', ' ')));
                content.append(makeElement('h3', '', event.title));
                content.append(makeElement('p', '', event.description));
                content.append(makeElement('p', 'event-meta', locationName));
                item.append(content);
                return item;
            }));
            setMessage(count, `${visibleEvents.length} von ${sortedEvents.length} Ereignissen`);
            setMessage(message, visibleEvents.length ? '' : 'Keine passenden Ereignisse gefunden.');
        };

        search.addEventListener('input', update);
        typeFilter.addEventListener('change', update);
        update();
    } catch (error) {
        console.error('Zeitleistendaten konnten nicht geladen werden:', error);
        setMessage(message, 'Die Zeitleistendaten konnten nicht geladen werden. Bitte prüfe, ob die Website über einen lokalen Webserver geöffnet ist.');
    }
}

renderTimeline();