import { verifyAdmin } from '../../_lib/access.js';

export async function onRequest(context) {
    const result = await verifyAdmin(context.request, context.env);
    if (!result.ok) {
        return Response.json({ error: result.error }, {
            status: result.status,
            headers: { 'Cache-Control': 'no-store' }
        });
    }

    context.data.adminEmail = result.email;
    return context.next();
}