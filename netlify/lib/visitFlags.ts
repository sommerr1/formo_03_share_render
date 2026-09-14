/** Kill-switch: set VISIT_ANALYTICS_ENABLED=false on Netlify to disable without redeploy rollback. */
export function visitAnalyticsEnabled(): boolean {
  const raw = process.env.VISIT_ANALYTICS_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false;
  }
  return true;
}
