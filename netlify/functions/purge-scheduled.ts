import type { Config } from "@netlify/functions";
import { purgeExpiredRenders } from "../lib/store.js";

export default async () => {
  const removed = await purgeExpiredRenders();
  console.log(`purge-scheduled: removed ${removed} expired render(s)`);
  return new Response(JSON.stringify({ removed }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = {
  schedule: "@daily",
};
