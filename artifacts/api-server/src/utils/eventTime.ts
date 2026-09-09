export const EVENT_TIME_ZONE = "Asia/Hong_Kong";

export function formatEventDateTime(value: Date): { eventDate: string; eventTime: string } {
  return {
    eventDate: value.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: EVENT_TIME_ZONE,
    }),
    eventTime: `${value.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: EVENT_TIME_ZONE,
    })} HKT`,
  };
}