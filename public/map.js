const STATUS_COLORS = {
    active: '#2ecc71',            // 🟢 Aktiv
    closing_announced: '#f1c40f', // 🟡 Schließung angekündigt
    closed: '#e74c3c',           // 🔴 Geschlossen
    demolished: '#34495e',       // ⚫ Abgerissen
    repurposed: '#3498db'        // 🔵 Nachnutzung
};

export function createMarkerIcon(status) {
    const color = STATUS_COLORS[status] || '#95a5a6';
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
            <path fill="${color}" stroke="#ffffff" stroke-width="2" d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z"/>
            <circle cx="12" cy="12" r="5" fill="#ffffff"/>
        </svg>`;
    
    return L.divIcon({
        className: 'custom-svg-marker',
        html: svg,
        iconSize: [28, 42],
        iconAnchor: [14, 42],
        popupAnchor: [0, -36]
    });
}

export function initMap(locations, onLocationSelect) {
    const map = L.map('map').setView([51.1657, 10.4515], 6); // Zentriert auf Deutschland

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    locations.forEach(loc => {
        if (!loc.lat || !loc.lng) return;

        const marker = L.marker([loc.lat, loc.lng], {
            icon: createMarkerIcon(loc.current_status)
        }).addTo(map);

        const popupContent = document.createElement('div');
        const title = document.createElement('h4');
        title.textContent = loc.name;
        const address = document.createElement('p');
        address.textContent = `${loc.street}, ${loc.postal_code} ${loc.city}`;
        const detailsButton = document.createElement('button');
        detailsButton.className = 'btn-details';
        detailsButton.textContent = 'Historie & Details anzeigen';
        popupContent.append(title, address, detailsButton);

        detailsButton.addEventListener('click', () => {
            onLocationSelect(loc.id);
        });

        marker.bindPopup(popupContent);
    });

    return map;
}
