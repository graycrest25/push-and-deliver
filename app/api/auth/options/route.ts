import "server-only";
export const dynamic = "force-dynamic";
export function GET() {
  // OAuth audience is public configuration. No backend address or credentials.
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  return Response.json(
    {
      googleClientId: /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(
        clientId,
      )
        ? clientId
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
