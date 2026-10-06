/**
 * kaufhaus-broken - Map Module (Leaflet.js)
 */

// Globales Map-Objekt & Marker-Gruppe
let map = null;
let markersGroup = null;

// Farb-Mapping für Marker basierend auf dem Gebäudestatus
const STATUS_COLORS = {
    active: '#2ecc71',            // 🟢 Aktiv / Betrieb
    closing_announced: '#f1c40f', // 🟡 Schließung angekündigt
    closed: '#e74c3c',           // 🔴 Geschlossen
    demolished: '#34495e',       // ⚫ Abgerissen / Rückbau
    repurposed: '#3498db',       // 🔵 Nachnutzung / Umgenutzt
    default: '#95a5a6'           // ⚪ Unbekannt
};

// SVG-Marker Generierung
function createCustomIcon(status) {
    const color = STATUS_COLORS[status] || STATUS_COLORS.default;
    const svgMarker = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
            <path fill="${color}" stroke="#ffffff" stroke-width="2"
                  d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z"/>
            <circle cx="12" cy="12" r="5" fill="#ffffff"/>
        </svg>
    `;
    return L.divIcon({
        className: 'custom-map-marker',
        html: svgMarker,
        iconSize: [28, 42],
        iconAnchor: [14, 42],
        popupAnchor: [0, -36]
    });
}

// Map initialisieren
function initMap() {
    // Zentrieren auf Deutschland
    map = L.map('map', {
        center: [51.1657, 10.4515],
        zoom: 6,
        zoomControl: true
    });

    // OpenStreetMap Tile Layer (DSGVO-konform / keine Tracker)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> Contributors'
    }).addTo(map);

    markersGroup = L.layerGroup().addTo(map);

    // Standorte laden
    loadLocations();
}

// Fetch der Standorte aus JSON
async function loadLocations() {
    try {
        const response = await fetch('../data/locations.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const locations = await response.json();
        renderMarkers(locations);
    } catch (error) {
        console.error('Fehler beim Laden der Standorte:', error);
    }
}

// Marker auf der Karte platzieren
function renderMarkers(locations) {
    markersGroup.clearLayers();

    locations.forEach(loc => {
        if (!loc.lat || !loc.lng) return;

        const icon = createCustomIcon(loc.current_status);
        const marker = L.marker([loc.lat, loc.lng], { icon });

        // Popup-HTML mit Basisdaten & Trigger für Timeline
        const popupContent = `
            <div class="location-popup">
                <h3>${loc.name}</h3>
                <p><strong>Adresse:</strong> ${loc.street}, ${loc.postal_code} ${loc.city}</p>
                <p><strong>Status:</strong> <span class="badge badge-${loc.current_status}">${formatStatus(loc.current_status)}</span></p>
                ${loc.year_built ? `<p><strong>Baujahr:</strong> ${loc.year_built}</p>` : ''}
                ${loc.year_demolished ? `<p><strong>Abrissjahr:</strong> ${loc.year_demolished}</p>` : ''}
                <hr>
                <button class="btn-timeline" onclick="loadLocationTimeline('${loc.id}')">
                    Historie & Zeitstrahl anzeigen
                </button>
            </div>
        `;

        marker.bindPopup(popupContent);
        markersGroup.addLayer(marker);
    });
}

// Statuslesbare Bezeichnungen
function formatStatus(status) {
    const labels = {
        active: 'Aktiv',
        closing_announced: 'Schließung angekündigt',
        closed: 'Geschlossen',
        demolished: 'Abgerissen / Rückbau',
        repurposed: 'Nachnutzung'
    };
    return labels[status] || status;
}

// DOM-Ready Start
document.addEventListener('DOMContentLoaded', initMap);
