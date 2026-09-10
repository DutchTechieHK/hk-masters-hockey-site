const ALLOWED_DESTINATIONS = new Set(["/dashboard", "/schedule"]);

export function parseLoginParameters(search) {
  const params = new URLSearchParams(search);
  const requestedDestination = params.get("next") || "/dashboard";
  return {
    email: params.get("email")?.trim() || "",
    destination: ALLOWED_DESTINATIONS.has(requestedDestination) ? requestedDestination : "/dashboard",
  };
}