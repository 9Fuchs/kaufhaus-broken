const navigationItems = [
    ['Karte', 'index.html'],
    ['Standorte', 'standorte.html'],
    ['Zeitleiste', 'zeitleiste.html'],
    ['Geschichte', 'geschichte.html'],
    ['Status', 'status.html'],
    ['Datenpflege', 'datenpflege.html'],
    ['Crawler', 'crawl.html'],
    ['Vorschläge', 'vorschlaege.html'],
    ['Hinweis melden', 'hinweise.html'],
    ['Ausnahmen', 'ausnahmen.html'],
    ['Quellen', 'quellen.html'],
    ['Impressum', 'impressum.html']
];

document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.site-header');
    const navigation = header?.querySelector('.site-nav');
    const toggle = header?.querySelector('.site-menu-toggle, .hamburger-menu');
    if (!header || !navigation) return;

    navigation.id = 'site-navigation';
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    navigation.replaceChildren(...navigationItems.map(([label, href]) => {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        if (href === currentPage) link.setAttribute('aria-current', 'page');
        return link;
    }));

    if (toggle) {
        toggle.className = 'site-menu-toggle';
        toggle.setAttribute('aria-controls', navigation.id);
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Menü öffnen');
        toggle.replaceChildren(...Array.from({ length: 3 }, () => {
            const line = document.createElement('span');
            line.className = 'menu-line';
            line.setAttribute('aria-hidden', 'true');
            return line;
        }));
    }

    const backToTop = document.createElement('button');
    backToTop.type = 'button';
    backToTop.className = 'back-to-top';
    backToTop.setAttribute('aria-label', 'Zum Seitenanfang springen');
    backToTop.title = 'Zum Seitenanfang';
    backToTop.textContent = '↑';
    backToTop.hidden = window.scrollY < 320;
    document.body.append(backToTop);

    const updateScrollControls = () => {
        const currentScrollY = window.scrollY;
        backToTop.hidden = currentScrollY < 320;

        if (currentScrollY <= 72 || header.classList.contains('menu-open')) {
            header.classList.remove('header-hidden');
        } else if (currentScrollY > lastScrollY + 6) {
            header.classList.add('header-hidden');
        } else if (currentScrollY < lastScrollY - 6) {
            header.classList.remove('header-hidden');
        }
        lastScrollY = currentScrollY;
    };

    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', updateScrollControls, { passive: true });
    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'auto' });
        updateScrollControls();
    });

    if (!toggle) return;

    const closeMenu = () => {
        header.classList.remove('menu-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Menü öffnen');
    };

    toggle.addEventListener('click', () => {
        const isOpen = header.classList.toggle('menu-open');
        header.classList.remove('header-hidden');
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.setAttribute('aria-label', isOpen ? 'Menü schließen' : 'Menü öffnen');
    });

    navigation.addEventListener('click', (event) => {
        if (event.target.closest('a')) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMenu();
    });

    window.matchMedia('(min-width: 721px)').addEventListener('change', closeMenu);
});