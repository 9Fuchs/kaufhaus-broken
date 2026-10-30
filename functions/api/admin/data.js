import { DATA_FILES, readDataFile, writeDataFile } from '../../_lib/github.js';

export async function onRequestGet({ request, env }) {
    const file = new URL(request.url).searchParams.get('file');
    if (!DATA_FILES.has(file)) return Response.json({ error: 'Unbekannte Datendatei.' }, { status: 400 });

    try {
        const result = await readDataFile(env, file);
        return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 502 });
    }
}

export async function onRequestPut({ request, env }) {
    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'Ungültiger JSON-Request.' }, { status: 400 });
    }

    if (typeof body.file !== 'string' || !DATA_FILES.has(body.file)) {
        return Response.json({ error: 'Unbekannte Datendatei.' }, { status: 400 });
    }
    if (typeof body.sha !== 'string' && body.sha !== null) {
        return Response.json({ error: 'Der aktuelle Datei-Stand fehlt.' }, { status: 400 });
    }

    try {
        const result = await writeDataFile(env, body.file, body.data, body.sha);
        if (result.conflict) {
            return Response.json({ error: 'Die Datei wurde zwischenzeitlich geändert. Bitte neu laden.', sha: result.sha }, { status: 409 });
        }
        return Response.json({ ok: true, sha: result.sha }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 502 });
    }
}