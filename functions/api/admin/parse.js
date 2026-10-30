import { readDataFile, writeDataFile } from '../../_lib/github.js';

const MAX_INPUT_LENGTH = 10000;
const MAX_PAGE_BYTES = 500000;
const BRANDS = ['Galeria', 'Karstadt', 'Kaufhof', 'Hertie', 'Horten'];

function parsePageText(html) {
    const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const text = html
        .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<!--([\s\S]*?)-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;|&#34;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/\s+/g, ' ')
        .trim();
    return { title: title.replace(/<[^>]+>/g, '').trim(), text };
}

function extractEntities(text) {
    const brands = BRANDS.filter((brand) => new RegExp(`\\b${brand}\\b`, 'i').test(text));
    const years = [...new Set(text.match(/\b(?:19|20)\d{2}\b/g) || [])];
    const ownerCandidates = [...text.matchAll(/\b(?:Immobilien)?Eigent[uü]mer(?:in)?\s*(?:ist|sind|:|\-)?\s*([^.;\n]{2,100})/gi)]
        .map((match) => match[1].trim());
    const rentAmounts = [...text.matchAll(/\b(?:Miete|Mietbelastung|Mietpreis)[^\n€]{0,50}([\d.]+(?:,[\d]{1,2})?)\s*(?:€|Euro)/gi)]
        .map((match) => match[1]);
    const municipalCandidates = [...text.matchAll(/\b(?:Stadt|Kommune)\s+([A-ZÄÖÜ][\wÄÖÜäöüß-]*(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß-]*){0,2})\s+(?:kauft|übernimmt|erwirbt)/g)]
        .map((match) => match[1]);
    return {
        brands_mentioned: brands,
        years_mentioned: years,
        detected_title: brands.length ? `Mögliches Update für ${brands.join(', ')}` : 'Manueller Vorschlag',
        property_signals: {
            owner_candidates: ownerCandidates,
            sale_offer_mentioned: /\b(?:steht|steht zum|wird zum)\s+Verkauf\b|\bVerkaufsangebot\b/i.test(text),
            rent_amounts_eur: [...new Set(rentAmounts)],
            municipal_acquisition_candidates: [...new Set(municipalCandidates)]
        }
    };
}

function isPublicHttpsUrl(value) {
    let url;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    const host = url.hostname.toLowerCase();
    const isIpLiteral = host.includes(':') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
    return url.protocol === 'https:' && !url.username && !url.password
        && (!url.port || url.port === '443') && !isIpLiteral && host.includes('.')
        && host !== 'localhost' && !host.endsWith('.localhost') && !host.endsWith('.local');
}

async function fetchTargetPage(initialUrl) {
    let currentUrl = initialUrl;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
        if (!isPublicHttpsUrl(currentUrl)) throw new Error('Ziel und Weiterleitungen müssen auf öffentliche HTTPS-Adressen zeigen.');
        const response = await fetch(currentUrl, {
            redirect: 'manual',
            headers: { 'User-Agent': 'kaufhaus-broken-crawler/1.0', Accept: 'text/html' },
            signal: AbortSignal.timeout(10000)
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get('Location');
            if (!location || redirects === 3) throw new Error('Zu viele oder ungültige Weiterleitungen der Zielseite.');
            currentUrl = new URL(location, currentUrl).toString();
            continue;
        }
        if (!response.ok) throw new Error(`Zielseite antwortet mit HTTP ${response.status}.`);
        if (!(response.headers.get('Content-Type') || '').toLowerCase().includes('text/html')) {
            throw new Error('Die Zieladresse liefert keine HTML-Seite.');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Die Zielseite enthält keinen lesbaren Inhalt.');
        const chunks = [];
        let total = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                total += value.byteLength;
                if (total > MAX_PAGE_BYTES) throw new Error('Die Zielseite überschreitet die maximale Größe von 500 KB.');
                chunks.push(value);
            }
        } finally {
            await reader.cancel().catch(() => {});
        }
        const bytes = new Uint8Array(total);
        let offset = 0;
        chunks.forEach((chunk) => {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        });
        return { html: new TextDecoder().decode(bytes), finalUrl: currentUrl };
    }
    throw new Error('Die Zielseite konnte nicht geladen werden.');
}

export async function onRequestPost({ request, env }) {
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > 20000) return Response.json({ error: 'Die Eingabe ist zu groß.' }, { status: 413 });

    let input;
    try {
        input = await request.json();
    } catch {
        return Response.json({ error: 'Ungültige JSON-Anfrage.' }, { status: 400 });
    }

    const text = typeof input.text === 'string' ? input.text.trim() : '';
    const requestedUrl = typeof input.source_url === 'string' ? input.source_url.trim() : '';
    const titleOverride = typeof input.title === 'string' ? input.title.trim().slice(0, 200) : '';
    if (!text && !requestedUrl) return Response.json({ error: 'Bitte eine Ziel-URL oder Freitext angeben.' }, { status: 400 });
    if (text.length > MAX_INPUT_LENGTH) return Response.json({ error: 'Der Freitext darf höchstens 10.000 Zeichen enthalten.' }, { status: 400 });

    try {
        const configResult = await readDataFile(env, 'source_config.json');
        const keywords = Array.isArray(configResult.data.keywords) ? configResult.data.keywords : [];
        const parserInput = [];
        let finalUrl = '';
        let pageTitle = '';

        if (requestedUrl) {
            if (!isPublicHttpsUrl(requestedUrl)) {
                return Response.json({ error: 'Bitte eine öffentliche HTTPS-Zieladresse ohne Zugangsdaten angeben.' }, { status: 400 });
            }
            const page = await fetchTargetPage(requestedUrl);
            const parsedPage = parsePageText(page.html);
            finalUrl = page.finalUrl;
            pageTitle = parsedPage.title;
            parserInput.push(parsedPage.text);
        }
        if (text) parserInput.push(text);

        const combinedText = parserInput.join('\n\n').slice(0, MAX_INPUT_LENGTH + MAX_PAGE_BYTES);
        const matchesKeyword = keywords.length === 0 || keywords.some((keyword) => {
            if (typeof keyword !== 'string' || !keyword.trim()) return false;
            return new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(combinedText);
        });
        if (!matchesKeyword) {
            return Response.json({ ok: true, added: 0, message: 'Keine konfigurierten Suchbegriffe gefunden.' });
        }

        const extractedData = extractEntities(combinedText);
        const suggestion = {
            id: `submission-${crypto.randomUUID()}`,
            crawled_at: new Date().toISOString(),
            source_type: requestedUrl ? 'url_scrape' : 'manual_text',
            origin: finalUrl || 'Manuelle Freitext-Eingabe',
            title: titleOverride || pageTitle || extractedData.detected_title,
            source_url: finalUrl,
            snippet: combinedText.slice(0, 250),
            manual_text: text,
            extracted_data: extractedData,
            status: 'PENDING_REVIEW'
        };

        const submissions = await readDataFile(env, 'submissions.json');
        if (!Array.isArray(submissions.data)) throw new Error('submissions.json muss ein JSON-Array enthalten.');
        const duplicate = submissions.data.some((item) => item.source_url === suggestion.source_url && item.title === suggestion.title);
        if (duplicate) return Response.json({ ok: true, added: 0, message: 'Dieser Vorschlag ist bereits vorhanden.' });

        submissions.data.push(suggestion);
        const saved = await writeDataFile(env, 'submissions.json', submissions.data, submissions.sha);
        if (saved.conflict) return Response.json({ error: 'Die Vorschlagsdatei wurde zwischenzeitlich geändert. Bitte erneut versuchen.' }, { status: 409 });
        return Response.json({ ok: true, added: 1, id: suggestion.id }, { status: 201 });
    } catch (error) {
        return Response.json({ error: error.message || 'Die Eingabe konnte nicht verarbeitet werden.' }, { status: 502 });
    }
}