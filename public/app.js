import { initMap } from './map.js';
import { loadLocationTimeline } from './timeline.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Standort-Daten laden
        const response = await fetch('./data/locations.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const locations = await response.json();

        // Karte initialisieren mit Callback für Timeline
        initMap(locations, (locationId) => {
            loadLocationTimeline(locationId);
        });

    } catch (error) {
        console.error('Fehler beim Initialisieren der App:', error);
    }
});