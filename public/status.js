const crawlerHealth = document.getElementById('crawler-health');
const crawlerLastRun = document.getElementById('crawler-last-run');
const feedHealth = document.getElementById('feed-health');
const feedDetail = document.getElementById('feed-detail');
const jsonHealth = document.getElementById('json-health');
const jsonDetail = document.getElementById('json-detail');
const submissionCount = document.getElementById('submission-count');
const submissionDetail = document.getElementById('submission-detail');
const dataVolume = document.getElementById('data-volume');
const feedLog = document.getElementById('feed-log');
const runHistory = document.getElementById('run-history');
const manualLog = document.getElementById('manual-log');
const analyticsRequests = document.getElementById('analytics-requests');
const analyticsUniques = document.getElementById('analytics-uniques');
const analyticsMessage = document.getElementById('analytics-message');
const analyticsDays = document.getElementById('analytics-days');

function formatNumber(value) {
    return new Intl.NumberFormat('de-DE').format(value || 0);
}

function formatDate(value) {
    if (!value) return 'Noch kein protokollierter Lauf';
    return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function addCell(row, value, className = '') {
    const cell = document.createElement('td');
    cell.textContent = value;
    if (className) cell.className = className;
    row.append(cell);
}

function renderMetrics(metrics) {
    const crawler = metrics.crawler || {};
    const lastRun = crawler.last_run_at || crawler.finished_at || crawler.started_at;
    const runAgeMs = lastRun ? Date.now() - new Date(lastRun).getTime() : Number.POSITIVE_INFINITY;
    const stale = runAgeMs > 36 * 60 * 60 * 1000;
    if (stale && crawler.success !== null) {
        crawlerHealth.textContent = 'Lauf veraltet';
        crawlerHealth.className = 'metric-value health-warning';
    } else if (crawler.failed_feeds > 0 && crawler.successful_feeds > 0) {
        crawlerHealth.textContent = 'Teilweise gestört';
        crawlerHealth.className = 'metric-value health-warning';
    } else if (crawler.success === true) {
        crawlerHealth.textContent = crawler.failed_feeds ? 'Teilweise gestört' : 'Gesund';
        crawlerHealth.className = `metric-value ${crawler.failed_feeds ? 'health-warning' : 'health-ok'}`;
    } else if (crawler.success === false) {
        crawlerHealth.textContent = 'Fehler';
        crawlerHealth.className = 'metric-value health-error';
    } else {
        crawlerHealth.textContent = 'Noch kein Lauf';
        crawlerHealth.className = 'metric-value health-unknown';
    }
    crawlerLastRun.textContent = lastRun
        ? `${formatDate(lastRun)} · ${crawler.trigger || 'Trigger unbekannt'} · ${crawler.duration_seconds ?? '—'} s`
        : 'Nach dem ersten geplanten oder manuellen Lauf erscheinen hier Messwerte.';

    const configuredFeeds = metrics.feedsConfigured || 0;
    const successfulFeeds = crawler.successful_feeds || 0;
    const failedFeeds = crawler.failed_feeds || 0;
    feedHealth.textContent = configuredFeeds === 0
        ? 'Keine Feeds aktiv'
        : lastRun ? `${successfulFeeds} / ${configuredFeeds} erfolgreich` : `${configuredFeeds} aktiv`;
    feedHealth.className = `metric-value ${configuredFeeds === 0 || failedFeeds ? 'health-warning' : lastRun ? 'health-ok' : 'health-unknown'}`;
    feedDetail.textContent = lastRun
        ? `${failedFeeds} fehlgeschlagen · ${crawler.processed_items || 0} Treffer verarbeitet`
        : 'Noch keine Feed-Abrufe protokolliert.';

    submissionCount.textContent = formatNumber(metrics.suggestions?.pending);
    submissionDetail.textContent = `${formatNumber(metrics.suggestions?.total)} gesamt · ${formatNumber(metrics.suggestions?.rss)} RSS · ${formatNumber(metrics.suggestions?.manual)} manuell · ${formatNumber(crawler.new_suggestions)} neu beim letzten RSS-Lauf`;

    manualLog.replaceChildren();
    const manualRuns = metrics.suggestions?.manualRuns || [];
    if (!manualRuns.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = 'Noch keine manuellen Einspeisungen vorhanden.';
        row.append(cell);
        manualLog.append(row);
    } else {
        manualRuns.forEach((manualRun) => {
            const row = document.createElement('tr');
            addCell(row, formatDate(manualRun.at));
            addCell(row, manualRun.title);
            const sourceCell = document.createElement('td');
            if (manualRun.source_url) {
                const link = document.createElement('a');
                link.href = manualRun.source_url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = manualRun.source_url;
                sourceCell.append(link);
            } else {
                sourceCell.textContent = 'Freitext';
            }
            row.append(sourceCell);
            addCell(row, manualRun.status);
            manualLog.append(row);
        });
    }

    const health = metrics.jsonHealth || { total: 0, healthy: 0, errors: [] };
    jsonHealth.textContent = `${health.healthy} / ${health.total} gültig`;
    jsonHealth.className = `metric-value ${health.errors.length ? 'health-error' : 'health-ok'}`;
    jsonDetail.textContent = health.errors.length
        ? `Fehler: ${health.errors.map((entry) => entry.file).join(', ')}`
        : 'Alle überwachten Dateien sind gültiges JSON.';

    dataVolume.replaceChildren();
    Object.entries(metrics.datasets || {}).forEach(([file, dataset]) => {
        const item = document.createElement('div');
        item.className = 'data-volume-item';
        const value = document.createElement('strong');
        value.textContent = dataset.healthy ? formatNumber(dataset.count) : 'Ungültig';
        const label = document.createElement('span');
        label.textContent = file;
        item.append(value, label);
        dataVolume.append(item);
    });

    runHistory.replaceChildren();
    const runs = crawler.runs || [];
    if (!runs.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 6;
        cell.textContent = 'Noch keine abgeschlossenen Läufe protokolliert.';
        row.append(cell);
        runHistory.append(row);
    } else {
        runs.forEach((run) => {
            const row = document.createElement('tr');
            addCell(row, formatDate(run.finished_at || run.last_run_at || run.started_at));
            addCell(row, run.trigger || '—');
            const state = run.success ? 'Erfolgreich' : run.successful_feeds ? 'Teilweise' : 'Fehler';
            const stateClass = run.success ? 'health-ok' : run.successful_feeds ? 'health-warning' : 'health-error';
            addCell(row, state, stateClass);
            addCell(row, `${run.successful_feeds || 0} / ${run.configured_feeds || 0}`);
            addCell(row, String(run.processed_items || 0));
            addCell(row, String(run.new_suggestions || 0));
            runHistory.append(row);
        });
    }

    feedLog.replaceChildren();
    const feeds = crawler.feeds || [];
    if (!feeds.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = lastRun ? 'Keine Feed-Details protokolliert.' : 'Noch keine Feed-Läufe vorhanden.';
        row.append(cell);
        feedLog.append(row);
    } else {
        feeds.forEach((feed) => {
            const row = document.createElement('tr');
            addCell(row, feed.name || feed.url || 'RSS-Feed');
            addCell(row, feed.success ? 'Erfolgreich' : 'Fehlgeschlagen', feed.success ? 'health-ok' : 'health-error');
            addCell(row, String(feed.matched_items || 0));
            addCell(row, feed.error || '—');
            feedLog.append(row);
        });
    }

    renderAnalytics(metrics.cloudflare || {});
}

function renderAnalytics(analytics) {
    analyticsDays.replaceChildren();
    if (!analytics.configured) {
        analyticsRequests.textContent = 'Nicht konfiguriert';
        analyticsUniques.textContent = 'Nicht konfiguriert';
        analyticsMessage.textContent = 'Zone-ID und Analytics-Token müssen in Cloudflare Pages als Variablen/Secret gesetzt werden.';
        return;
    }
    if (!analytics.available) {
        analyticsRequests.textContent = 'Nicht verfügbar';
        analyticsUniques.textContent = 'Nicht verfügbar';
        analyticsMessage.textContent = analytics.error || 'Cloudflare hat keine Zugriffsdaten geliefert.';
        return;
    }

    analyticsRequests.textContent = formatNumber(analytics.requests30d);
    analyticsUniques.textContent = analytics.latestUniqueClients === null ? 'Keine Daten' : formatNumber(analytics.latestUniqueClients);
    analyticsMessage.textContent = 'Unique Clients sind Cloudflare-Tageswerte und keine verifizierte Anzahl realer Personen.';
    const maxRequests = Math.max(1, ...analytics.days.map((day) => day.requests));
    analytics.days.forEach((day) => {
        const bar = document.createElement('div');
        bar.className = 'analytics-day';
        bar.title = `${day.date}: ${formatNumber(day.requests)} Anfragen`;
        const fill = document.createElement('span');
        fill.style.height = `${Math.max(3, (day.requests / maxRequests) * 100)}%`;
        const label = document.createElement('small');
        label.textContent = day.date.slice(8);
        bar.append(fill, label);
        analyticsDays.append(bar);
    });
}

fetch('/api/admin/metrics', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Statusdaten nicht verfügbar (${response.status}).`);
        return result;
    })
    .then(renderMetrics)
    .catch((error) => {
        crawlerHealth.textContent = 'Status nicht verfügbar';
        crawlerHealth.className = 'metric-value health-error';
        crawlerLastRun.textContent = error.message;
        feedHealth.textContent = '—';
        jsonHealth.textContent = '—';
        submissionCount.textContent = '—';
        runHistory.replaceChildren();
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 6;
        cell.textContent = error.message;
        row.append(cell);
        runHistory.append(row);
        feedLog.replaceChildren();
        manualLog.replaceChildren();
        analyticsRequests.textContent = '—';
        analyticsUniques.textContent = '—';
    });