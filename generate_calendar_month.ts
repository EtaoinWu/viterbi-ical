import {
  DOMParser,
  Element
} from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import ical, { ICalCalendarJSONData } from "https://esm.sh/ical-generator@6.0.1";
import { parseDateRange } from "./parse_daterange.ts";
import { kv_memoize } from "./kv_memo.ts";
import { expire_time } from "./parameters.ts";


export async function generate_calendar_month(
  id: string,
  year: string,
  month: string
): Promise<ICalCalendarJSONData> {
  const calendar = ical({
    prodId: "//Example//Calendar//EN",
    name: "USC Viterbi Calendar",
  });

  const baseUrl = `https://viterbi.usc.edu/calendar/?month&calendar=${id}&date=`;

  const url = `${baseUrl}${month}/01/${year}`;

  try {
    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html")!;
    const events = doc.querySelector("#events");

    events?.querySelectorAll("li").forEach((node) => {
      try {
        const event = node as Element;
        const title_elem = event.querySelector("h3 a");
        const title = title_elem?.textContent;
        const rel_link = title_elem?.getAttribute("href");
        const link = rel_link ? new URL(rel_link, url).toString() : undefined;
        const dateTime = event.querySelector(".event_stats strong")
          ?.textContent;
        const location = event.querySelector(
          'p a[href^="http://web-app.usc.edu/maps/"]'
        )?.textContent;
        const details = event.querySelector("blockquote")?.textContent;

        if (title && dateTime) {
          const date_range = parseDateRange(dateTime);

          calendar.createEvent({
            ...date_range,
            summary: title,
            location: location,
            description: details,
            url: link,
          });
        }
      } catch (error) {
        console.error(`Error parsing event:`, error);
      }
    });
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
  }

  return calendar.toJSON();
}
export const generate_calendar_month_ = kv_memoize(
  "generate_calendar_month",
  generate_calendar_month,
  expire_time
);
