import { DateTime } from "https://esm.sh/luxon@3.4.4";
import { timeZone } from "./shared.ts";

export type DateTimeRange = {
  start: DateTime;
  end: DateTime;
};

export type AllDayRange = {
  start: DateTime;
  allday: true;
};

export type DateRange = DateTimeRange | AllDayRange;

export function parseDateRange(
  dateRangeString: string,
): DateRange {
  if (!dateRangeString.includes(" @ ")) {
    const dateStr = dateRangeString;
    const dateFormat = "EEE, MMM dd, yyyy";
    const date = DateTime.fromFormat(dateStr, dateFormat, { zone: timeZone });
    return { start: date, allday: true };
  } else {
    const [dateStr, timeRangeStr] = dateRangeString.split(" @ ");
    const [startTimeStr, endTimeStr] = timeRangeStr.split(" - ");

    const dateFormat = "EEE, MMM dd, yyyy hh:mm a";

    const startTime = DateTime.fromFormat(
      `${dateStr} ${startTimeStr}`,
      dateFormat,
      { zone: timeZone },
    );

    const endTime = DateTime.fromFormat(
      `${dateStr} ${endTimeStr}`,
      dateFormat,
      { zone: timeZone },
    );

    return { start: startTime, end: endTime };
  }
}
