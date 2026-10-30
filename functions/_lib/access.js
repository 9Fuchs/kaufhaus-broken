function decodeSegment(segment) {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseSegment(segment) {
    return JSON.parse(new TextDecoder().decode(decodeSegment(segment)));
}

export async function verifyAdmin(request, env) {
    const token = request.headers.get('CF-Access-JWT-Assertion');
    const teamDomain = env.ACCESS_TEAM_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const audience = env.ACCESS_AUD;
    const allowedEmails = (env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);

    if (!token || !teamDomain || !audience || allowedEmails.length === 0) {
        return { ok: false, status: 503, error: 'Admin-Zugriff ist nicht vollständig konfiguriert.' };
    }

    try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Ungültiges Tokenformat');

        const header = parseSegment(parts[0]);
        const claims = parseSegment(parts[1]);
        if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Nicht unterstützter Token-Algorithmus');

        const issuer = `https://${teamDomain}`;
        const tokenAudiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
        const now = Math.floor(Date.now() / 1000);
        if (claims.iss !== issuer || !tokenAudiences.includes(audience) || !Number.isInteger(claims.exp) || claims.exp <= now || (claims.nbf && claims.nbf > now)) {
            throw new Error('Token-Ansprüche ungültig');
        }

        const keysResponse = await fetch(`${issuer}/cdn-cgi/access/certs`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000)
        });
        if (!keysResponse.ok) throw new Error('Access-Schlüssel konnten nicht geladen werden');
        const { keys } = await keysResponse.json();
        const jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA');
        if (!jwk) throw new Error('Signaturschlüssel nicht gefunden');

        const publicKey = await crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['verify']
        );
        const signedContent = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
        const signature = decodeSegment(parts[2]);
        if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signedContent)) {
            throw new Error('Token-Signatur ungültig');
        }

        const email = claims.email?.toLowerCase();
        if (!email || !allowedEmails.includes(email)) {
            return { ok: false, status: 403, error: 'Kein Admin-Zugriff für dieses Konto.' };
        }

        return { ok: true, email };
    } catch {
        return { ok: false, status: 401, error: 'Access-Anmeldung konnte nicht verifiziert werden.' };
    }
}