import { initMap } from './map.js';
import { loadLocationTimeline } from './timeline.js';

document.addEventListener('DOMContentLoaded', async () => {
    const nav = document.querySelector('.site-nav');
    const menuButton = document.querySelector('.hamburger-menu');
    if (nav && menuButton) menuButton.addEventListener('click', () => {
        const isExpanded = nav.classList.toggle('active');
        menuButton.setAttribute('aria-expanded', String(isExpanded));
        menuButton.setAttribute('aria-label', isExpanded ? 'Menü schließen' : 'Menü öffnen');
    });

    if (!document.querySelector('#map')) return;

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