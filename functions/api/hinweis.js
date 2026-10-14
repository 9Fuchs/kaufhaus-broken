import { connect } from 'cloudflare:sockets';

const allowedCategories = new Set([
    'Standortdaten',
    'Historisches Ereignis',
    'Nachnutzung',
    'Sonstiges'
]);
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const encoder = new TextEncoder();

function jsonResponse(body, status = 200) {
    return Response.json(body, {
        status,
        headers: { 'Cache-Control': 'no-store' }
    });
}

function encodeBase64(value) {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    let binary = '';
    for (let index = 0; index < bytes.length; index += 8192) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    }
    return btoa(binary);
}

function encodeBase64Lines(value) {
    const encoded = encodeBase64(value);
    return encoded.match(/.{1,76}/g)?.join('\r\n') || '';
}

function withTimeout(promise, milliseconds) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('SMTP timeout')), milliseconds);
        })
    ]).finally(() => clearTimeout(timer));
}

async function sendSmtpEmail(env, payload) {
    const username = env.SMTP_USERNAME?.trim();
    const password = env.SMTP_PASSWORD;
    const hostname = env.SMTP_HOST?.trim();
    const recipient = (env.HINTS_TO_EMAIL || username)?.trim();

    if (!username || !password || !hostname || !recipient) {
        throw new Error('SMTP configuration is incomplete');
    }
    if (!emailPattern.test(username) || !emailPattern.test(recipient) || !/^[a-z0-9.-]+$/i.test(hostname)) {
        throw new Error('SMTP configuration is invalid');
    }

    const socket = connect({ hostname, port: 465 }, { secureTransport: 'on' });
    const reader = socket.readable.getReader();
    const writer = socket.writable.getWriter();
    let buffer = '';

    const readLine = async () => {
        while (!buffer.includes('\r\n')) {
            const { value, done } = await reader.read();
            if (done) throw new Error('SMTP connection closed');
            buffer += new TextDecoder().decode(value, { stream: true });
        }
        const lineEnd = buffer.indexOf('\r\n');
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);
        return line;
    };

    const readResponse = async () => {
        const lines = [];
        let responseCode;
        while (true) {
            const line = await withTimeout(readLine(), 10000);
            const match = line.match(/^(\d{3})([ -])/);
            if (!match) throw new Error('Invalid SMTP response');
            responseCode = Number(match[1]);
            lines.push(line);
            if (match[2] === ' ') return { code: responseCode, lines };
        }
    };

    const expect = async (expectedCode) => {
        const response = await readResponse();
        if (response.code !== expectedCode) throw new Error('SMTP command rejected');
        return response;
    };

    const command = async (value, expectedCode) => {
        await writer.write(encoder.encode(`${value}\r\n`));
        return expect(expectedCode);
    };

    try {
        await expect(220);
        await command('EHLO kaufhaus-broken.ff9x.net', 250);
        const authPayload = encodeBase64(`\0${username}\0${password}`);
        await command(`AUTH PLAIN ${authPayload}`, 235);
        await command(`MAIL FROM:<${username}>`, 250);
        await command(`RCPT TO:<${recipient}>`, 250);
        await command('DATA', 354);

        const messageBody = [
            'Neuer Hinweis zu kaufhaus-broken',
            '',
            `Betreff: ${payload.subject}`,
            `Standort: ${payload.location || 'Nicht angegeben'}`,
            `Kategorie: ${payload.category}`,
            `Kontakt-E-Mail: ${payload.email || 'Nicht angegeben'}`,
            '',
            'Beschreibung:',
            payload.message
        ].join('\n');
        const headers = [
            `From: <${username}>`,
            `To: <${recipient}>`,
            ...(payload.email ? [`Reply-To: <${payload.email}>`] : []),
            'Subject: Neuer Hinweis zu kaufhaus-broken',
            `Date: ${new Date().toUTCString()}`,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            encodeBase64Lines(messageBody)
        ].join('\r\n');
        const dotStuffedMessage = headers
            .split('\r\n')
            .map((line) => line.startsWith('.') ? `.${line}` : line)
            .join('\r\n');

        await writer.write(encoder.encode(`${dotStuffedMessage}\r\n.\r\n`));
        await expect(250);
        await command('QUIT', 221);
    } finally {
        reader.releaseLock();
        writer.releaseLock();
        await socket.close();
    }
}

async function verifyTurnstile(token, secret, hostname) {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true
        && result.hostname === hostname
        && result.action === 'kaufhaus-hinweis';
}

export async function onRequestPost({ request, env }) {
    const origin = request.headers.get('Origin');
    const requestUrl = new URL(request.url);
    if (origin && origin !== requestUrl.origin) {
        return jsonResponse({ error: 'Ungültige Anfrage.' }, 403);
    }

    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > 10000) return jsonResponse({ error: 'Die Nachricht ist zu groß.' }, 413);

    let payload;
    try {
        const rawBody = await request.text();
        if (rawBody.length > 10000) return jsonResponse({ error: 'Die Nachricht ist zu groß.' }, 413);
        payload = JSON.parse(rawBody);
    } catch {
        return jsonResponse({ error: 'Ungültige Formulardaten.' }, 400);
    }

    if (typeof payload.website === 'string' && payload.website.trim()) {
        return jsonResponse({ ok: true }, 202);
    }

    const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
    const location = typeof payload.location === 'string' ? payload.location.trim() : '';
    const category = typeof payload.category === 'string' ? payload.category : '';
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    const token = typeof payload.turnstileToken === 'string' ? payload.turnstileToken : '';

    if (!subject || subject.length > 120 || location.length > 120 || !allowedCategories.has(category)
        || !message || message.length > 3000 || (email && (email.length > 254 || !emailPattern.test(email)))
        || !token || token.length > 2048) {
        return jsonResponse({ error: 'Bitte prüfe die Eingaben und versuche es erneut.' }, 400);
    }
    if (!env.TURNSTILE_SECRET_KEY || !env.SMTP_HOST || !env.SMTP_USERNAME || !env.SMTP_PASSWORD) {
        return jsonResponse({ error: 'Der Formularversand ist noch nicht vollständig eingerichtet.' }, 503);
    }

    try {
        const validToken = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, requestUrl.hostname);
        if (!validToken) return jsonResponse({ error: 'Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen.' }, 400);
        await sendSmtpEmail(env, { subject, location, category, message, email });
        return jsonResponse({ ok: true });
    } catch {
        return jsonResponse({ error: 'Der Versand ist momentan nicht möglich. Bitte versuche es später erneut.' }, 502);
    }
}