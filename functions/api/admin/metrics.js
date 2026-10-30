import { readDataFile } from '../../_lib/github.js';

const DATASET_FILES = [
    'locations.json',
    'companies.json',
    'history.json',
    'tenants.json',
    'timeline_events.json',
    'exclusions.json',
    'standorte.json',
    'submissions.json'
];
const STATUS_FILES = [...DATASET_FILES, 'crawler_status.json', 'source_config.json'];

function recordCount(file, data) {
    if (Array.isArray(data)) return data.length;
    if (file === 'standorte.json') {
        return (data.property_records?.length || 0) + (data.closure_list?.records?.length || 0) + (data.closure_waves?.length || 0);
    }
    return 0;
}

async function getCloudflareAnalytics(env) {
    const zoneId = env.CLOUDFLARE_ZONE_ID;
    const token = env.CLOUDFLARE_ANALYTICS_TOKEN;
    if (!zoneId || !token) return { configured: false, available: false, days: [] };
    if (!/^[a-f\d]{32}$/i.test(zoneId)) return { configured: true, available: false, days: [], error: 'CLOUDFLARE_ZONE_ID ist ungültig.' };

    const until = new Date();
    until.setUTCDate(until.getUTCDate() - 1);
    const since = new Date(until);
    since.setUTCDate(since.getUTCDate() - 29);
    const sinceDate = since.toISOString().slice(0, 10);
    const untilDate = until.toISOString().slice(0, 10);
    const query = `query { viewer { zones(filter: { zoneTag: "${zoneId}" }) { httpRequests1dGroups(limit: 30, filter: { date_geq: "${sinceDate}", date_leq: "${untilDate}" }) { dimensions { date } sum { requests } uniq { uniques } } } } }`;

    try {
        const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query }),
            signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) throw new Error(`Cloudflare API HTTP ${response.status}`);
        const result = await response.json();
        if (result.errors?.length) throw new Error('Cloudflare GraphQL-Abfrage fehlgeschlagen.');
        const groups = result.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
        const days = groups.map((group) => ({
            date: group.dimensions.date,
            requests: group.sum?.requests || 0,
            uniqueClients: group.uniq?.uniques || 0
        })).sort((a, b) => a.date.localeCompare(b.date));
        return {
            configured: true,
            available: true,
            requests30d: days.reduce((total, day) => total + day.requests, 0),
            latestUniqueClients: days.find((day) => day.date === untilDate)?.uniqueClients ?? null,
            days
        };
    } catch (error) {
        return {
            configured: true,
            available: false,
            days: [],
            error: error instanceof Error ? error.message : 'Cloudflare-Metriken nicht verfügbar.'
        };
    }
}

export async function onRequestGet({ env }) {
    const results = await Promise.all(STATUS_FILES.map(async (file) => {
        try {
            return { file, ...await readDataFile(env, file), healthy: true };
        } catch (error) {
            return { file, data: null, sha: null, healthy: false, error: error.message };
        }
    }));
    const byFile = new Map(results.map((result) => [result.file, result]));
    const crawler = byFile.get('crawler_status.json').data || { success: null, runs: [] };
    const submissions = byFile.get('submissions.json').data;
    const safeSubmissions = Array.isArray(submissions) ? submissions : [];
    const manualRuns = safeSubmissions
        .filter((submission) => ['manual_text', 'manual_url', 'url_scrape'].includes(submission.source_type))
        .sort((a, b) => String(b.crawled_at || '').localeCompare(String(a.crawled_at || '')))
        .slice(0, 10)
        .map((submission) => ({
            at: submission.crawled_at || '',
            title: submission.title || 'Ohne Titel',
            source_url: submission.source_url || '',
            status: submission.status || 'Unbekannt'
        }));
    const sourceConfig = byFile.get('source_config.json').data;
    const feeds = Array.isArray(sourceConfig?.feeds) ? sourceConfig.feeds : [];
    const datasets = Object.fromEntries(DATASET_FILES.map((file) => {
        const result = byFile.get(file);
        return [file, { count: result.healthy ? recordCount(file, result.data) : null, healthy: result.healthy }];
    }));
    const errors = results.filter((result) => !result.healthy).map(({ file, error }) => ({ file, error }));

    return Response.json({
        crawler,
        feedsConfigured: feeds.filter((feed) => feed.enabled !== false).length,
        suggestions: {
            total: safeSubmissions.length,
            pending: safeSubmissions.filter((submission) => submission.status === 'PENDING_REVIEW').length,
            rss: safeSubmissions.filter((submission) => submission.source_type === 'rss').length,
            manual: safeSubmissions.filter((submission) => ['manual_text', 'manual_url', 'url_scrape'].includes(submission.source_type)).length,
            manualRuns
        },
        datasets,
        jsonHealth: { total: STATUS_FILES.length, healthy: STATUS_FILES.length - errors.length, errors },
        cloudflare: await getCloudflareAnalytics(env)
    }, { headers: { 'Cache-Control': 'no-store' } });
}