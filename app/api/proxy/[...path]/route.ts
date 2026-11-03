import { NextRequest } from "next/server";
import { proxy } from "@/server/proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, (await context.params).path);
}
export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
