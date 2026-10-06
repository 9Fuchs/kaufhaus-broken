/**
 * kaufhaus-broken - Timeline Module
 */

// Globale Funktion, die aus dem Leaflet-Popup heraus aufgerufen wird
async function loadLocationTimeline(locationId) {
    try {
        const response = await fetch('../data/timeline_events.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const events = await response.json();

        // Nur Events für den ausgewählten Standort filtern und chronologisch sortieren
        const locationEvents = events
        .filter(event => event.location_id === locationId)
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));

        renderTimeline(locationId, locationEvents);
    } catch (error) {
        console.error('Fehler beim Laden der Zeitleiste:', error);
    }
}

// Zeitstrahl im DOM/Sidebar rendern
function renderTimeline(locationId, events) {
    let timelineContainer = document.getElementById('timeline-sidebar');

    // Falls das Sidebar-Element noch nicht existiert, dynamisch anlegen
    if (!timelineContainer) {
        timelineContainer = document.createElement('aside');
        timelineContainer.id = 'timeline-sidebar';
        document.querySelector('main').appendChild(timelineContainer);
    }

    // Sidebar anzeigen und Befüllen
    timelineContainer.classList.add('open');

    if (events.length === 0) {
        timelineContainer.innerHTML = `
        <div class="timeline-header">
        <h3>Historie</h3>
        <button class="btn-close" onclick="closeTimeline()">&times;</button>
        </div>
        <p class="no-data">Keine historischen Ereignisse für diesen Standort hinterlegt.</p>
        `;
        return;
    }

    const eventsHTML = events.map(event => {
        const year = new Date(event.event_date).getFullYear();
        return `
        <div class="timeline-item timeline-${event.event_type.toLowerCase()}">
        <div class="timeline-badge">${year}</div>
        <div class="timeline-content">
        <h4>${event.title}</h4>
        <p>${event.description}</p>
        </div>
        </div>
        `;
    }).join('');

    timelineContainer.innerHTML = `
    <div class="timeline-header">
    <h3>Historie (${events.length} Einträge)</h3>
    <button class="btn-close" onclick="closeTimeline()">&times;</button>
    </div>
    <div class="timeline-list">
    ${eventsHTML}
    </div>
    `;
}

// Sidebar schließen
function closeTimeline() {
    const timelineContainer = document.getElementById('timeline-sidebar');
    if (timelineContainer) {
        timelineContainer.classList.remove('open');
    }
}
