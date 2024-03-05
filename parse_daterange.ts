import { parse } from "https://esm.sh/date-fns@3.3.1";

export type DateTimeRange = {
  start: Date;
  end: Date;
};

export type AllDayRange = {
  start: Date;
  allday: true;
};

export type DateRange = DateTimeRange | AllDayRange;

export function parseDateRange(
  dateRangeString: string,
): DateRange {
  if (!dateRangeString.includes(" @ ")) {
    const dateStr = dateRangeString;
    const dateFormat = "EEE, MMM dd, yyyy";
    const date = parse(dateStr, dateFormat, new Date());
    return { start: date, allday: true };
  } else {
    const [dateStr, timeRangeStr] = dateRangeString.split(" @ ");
    const [startTimeStr, endTimeStr] = timeRangeStr.split(" - ");

    const dateFormat = "EEE, MMM dd, yyyy";
    const timeFormat = "hh:mm a";

    const date = parse(dateStr, dateFormat, new Date());
    const startTime = parse(startTimeStr, timeFormat, date);
    const endTime = parse(endTimeStr, timeFormat, date);

    return { start: startTime, end: endTime };
  }
}
