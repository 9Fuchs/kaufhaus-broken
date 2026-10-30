import { connect } from 'cloudflare:sockets';

const MAX_MESSAGE_LENGTH = 10000;
const ALLOWED_SUBJECTS = new Set([
    'Korrektur zu einem Standort',
    'Ergänzung oder Quellenhinweis',
    'Datenschutz- oder Löschanliegen',
    'Sonstiges'
]);

function jsonResponse(data, status = 200) {
    return Response.json(data, {
        status,
        headers: { 'Cache-Control': 'no-store' }
    });
}

function encodeBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}

function encodeBase64Lines(value) {
    return encodeBase64(value).match(/.{1,76}/g)?.join('\r\n') || '';
}

function validEmail(value) {
    return typeof value === 'string'
        && value.length <= 254
        && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
        && !/[\r\n]/.test(value);
}

async function sendSmtpMessage(env, message) {
    const host = env.SMTP_HOST || 'securesmtp.t-online.de';
    const port = Number(env.SMTP_PORT || '465');
    const username = env.SMTP_USER;
    const password = env.SMTP_PASSWORD;
    const recipient = env.CONTACT_TO_EMAIL;

    if (!username || !password || !validEmail(username) || !validEmail(recipient) || port !== 465) {
        throw new Error('SMTP ist nicht vollständig konfiguriert.');
    }

    const socket = connect({ hostname: host, port }, { secureTransport: 'on' });
    const reader = socket.readable.getReader();
    const writer = socket.writable.getWriter();
    const decoder = new TextDecoder();
    let buffered = '';
    const timeout = setTimeout(() => socket.close().catch(() => {}), 15000);

    async function readLine() {
        while (!buffered.includes('\n')) {
            const { value, done } = await reader.read();
            if (done) throw new Error('SMTP-Verbindung wurde unerwartet geschlossen.');
            buffered += decoder.decode(value, { stream: true });
        }
        const lineEnd = buffered.indexOf('\n');
        const line = buffered.slice(0, lineEnd).replace(/\r$/, '');
        buffered = buffered.slice(lineEnd + 1);
        return line;
    }

    async function readResponse(expectedCodes) {
        const lines = [];
        let line = await readLine();
        const code = line.slice(0, 3);
        lines.push(line);
        while (line.startsWith(`${code}-`)) {
            line = await readLine();
            lines.push(line);
        }
        if (!expectedCodes.includes(code)) throw new Error(`SMTP-Antwort ${code}`);
        return lines.join('\n');
    }

    async function sendCommand(command, expectedCodes) {
        await writer.write(new TextEncoder().encode(`${command}\r\n`));
        return readResponse(expectedCodes);
    }

    try {
        await socket.opened;
        await readResponse(['220']);
        await sendCommand('EHLO kaufhaus-broken', ['250']);
        await sendCommand('AUTH LOGIN', ['334']);
        await sendCommand(encodeBase64(username), ['334']);
        await sendCommand(encodeBase64(password), ['235']);
        await sendCommand(`MAIL FROM:<${username}>`, ['250']);
        await sendCommand(`RCPT TO:<${recipient}>`, ['250', '251']);
        await sendCommand('DATA', ['354']);

        const subject = `=?UTF-8?B?${encodeBase64(message.subject)}?=`;
        const headers = [
            `From: kaufhaus-broken <${username}>`,
            `To: <${recipient}>`,
            `Reply-To: <${message.replyEmail}>`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64'
        ].join('\r\n');
        const body = encodeBase64Lines(message.body);
        await writer.write(new TextEncoder().encode(`${headers}\r\n\r\n${body}\r\n.\r\n`));
        await readResponse(['250']);
        await sendCommand('QUIT', ['221']);
    } finally {
        clearTimeout(timeout);
        reader.releaseLock();
        writer.releaseLock();
        await socket.close().catch(() => {});
    }
}

export async function onRequestGet({ env }) {
    return jsonResponse({ email: env.CONTACT_TO_EMAIL || '' });
}

export async function onRequestPost({ request, env }) {
    if (!env.CONTACT_TO_EMAIL || !env.SMTP_USER || !env.SMTP_PASSWORD) {
        return jsonResponse({ error: 'Der E-Mail-Versand ist noch nicht konfiguriert.' }, 503);
    }
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > 20000) return jsonResponse({ error: 'Die Nachricht ist zu groß.' }, 413);

    let input;
    try {
        input = await request.json();
    } catch {
        return jsonResponse({ error: 'Ungültige Anfrage.' }, 400);
    }

    if (typeof input.website === 'string' && input.website.trim()) return jsonResponse({ ok: true });
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const replyEmail = typeof input.replyEmail === 'string' ? input.replyEmail.trim() : '';
    const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
    const body = typeof input.message === 'string' ? input.message.trim() : '';

    const validSubject = ALLOWED_SUBJECTS.has(subject)
        || (subject.startsWith('Standorthinweis: ') && subject.length <= 160 && !/[\r\n]/.test(subject));
    if (!name || name.length > 120 || /[\r\n]/.test(name)
        || !validEmail(replyEmail) || !validSubject
        || !body || body.length > MAX_MESSAGE_LENGTH) {
        return jsonResponse({ error: 'Bitte prüfe Name, Rückfrageadresse, Betreff und Nachricht.' }, 400);
    }

    try {
        await sendSmtpMessage(env, { name, replyEmail, subject, body: `Name: ${name}\n\n${body}` });
        return jsonResponse({ ok: true });
    } catch (error) {
        console.error('SMTP delivery failed', error instanceof Error ? error.message : 'unknown error');
        return jsonResponse({ error: 'Die Nachricht konnte derzeit nicht zugestellt werden. Bitte versuche es später erneut.' }, 502);
    }
}