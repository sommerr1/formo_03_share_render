import type { Config } from "@netlify/functions";
import { purgeExpiredRenders } from "../lib/store.js";
import { purgeOldVisits } from "../lib/visitStore.js";

export default async () => {
  const removed = await purgeExpiredRenders();
  const visitsRemoved = await purgeOldVisits();
  console.log(
    `purge-scheduled: removed ${removed} expired render(s), ${visitsRemoved} old visit(s)`,
  );
  return new Response(JSON.stringify({ removed, visitsRemoved }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = {
  schedule: "@daily",
};
