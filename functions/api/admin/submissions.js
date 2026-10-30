import { readDataFile, writeDataFile } from '../../_lib/github.js';

const MAX_TEXT_LENGTH = 10000;

export async function onRequestPost({ request, env }) {
    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'Ungültiger JSON-Request.' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim() : '';
    if (!title || (!text && !sourceUrl) || text.length > MAX_TEXT_LENGTH) {
        return Response.json({ error: 'Bitte Titel und Text oder eine Quellen-URL angeben.' }, { status: 400 });
    }

    if (sourceUrl) {
        try {
            const parsedUrl = new URL(sourceUrl);
            if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
                throw new Error('URL nicht erlaubt');
            }
        } catch {
            return Response.json({ error: 'Bitte eine gültige HTTP- oder HTTPS-Quellen-URL angeben.' }, { status: 400 });
        }
    }

    try {
        const current = await readDataFile(env, 'submissions.json');
        if (!Array.isArray(current.data)) throw new Error('submissions.json muss ein JSON-Array enthalten.');
        if (current.sha !== body.sha) {
            return Response.json({ error: 'Die Vorschlagsdatei wurde geändert. Bitte erneut absenden.' }, { status: 409 });
        }

        current.data.push({
            id: `submission-${crypto.randomUUID()}`,
            crawled_at: new Date().toISOString(),
            source_type: sourceUrl ? 'manual_url' : 'manual_text',
            origin: 'Manuelle Eingabe',
            title,
            source_url: sourceUrl,
            snippet: text.slice(0, 250),
            manual_text: text,
            extracted_data: {},
            status: 'PENDING_REVIEW'
        });

        const saved = await writeDataFile(env, 'submissions.json', current.data, current.sha);
        if (saved.conflict) {
            return Response.json({ error: 'Die Vorschlagsdatei wurde zwischenzeitlich geändert. Bitte neu laden.' }, { status: 409 });
        }
        return Response.json({ ok: true, id: current.data[current.data.length - 1].id, sha: saved.sha }, { status: 201 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 502 });
    }
}