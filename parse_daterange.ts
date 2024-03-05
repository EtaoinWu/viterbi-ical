import { parse } from "https://esm.sh/date-fns@3.3.1";

export function parseDateRange(dateRangeString: string): { start: Date; end: Date } {
  const [dateStr, timeRangeStr] = dateRangeString.split(" @ ");
  const [startTimeStr, endTimeStr] = timeRangeStr.split(" - ");

  const dateFormat = "EEE, MMM dd, yyyy";
  const timeFormat = "hh:mm a";

  const date = parse(dateStr, dateFormat, new Date());
  const startTime = parse(startTimeStr, timeFormat, date);
  const endTime = parse(endTimeStr, timeFormat, date);

  return { start: startTime, end: endTime };
}
