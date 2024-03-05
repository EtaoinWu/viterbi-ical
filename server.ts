import {
  Application,
  Router,
  send,
} from "https://deno.land/x/oak@v14.1.1/mod.ts";
import {
  DOMParser,
  Element,
} from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import ical, {
  ICalCalendar,
  ICalCalendarJSONData,
} from "https://esm.sh/ical-generator@6.0.1";
import { parseDateRange } from "./parse_daterange.ts";
import { kv_memoize } from "./kv_memo.ts";
import { DateTime } from "https://esm.sh/luxon@3.4.4";
import { timeZone } from "./shared.ts";

const isDenoDeploy = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;

const app = new Application();
const router = new Router();
const expire_time = isDenoDeploy ? 1000 * 60 * 30 : 1000 * 10; // 30 minutes

router.get("/", async (ctx) => {
  // sends index.md as html
  await send(ctx, "index.md.html");
});

router.get("/viterbi-calendar/:id", async (ctx) => {
  const id = ctx.params.id;
  console.log(
    `Generating calendar for ${id} requested by ${ctx.request.ip}...`,
  );
  const calendar = await generate_calendar(id);

  ctx.response.headers.set("Content-Type", "text/calendar");
  ctx.response.body = calendar;
});

app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: 4090 });

async function generate_calendar_month(
  id: string,
  year: string,
  month: string,
): Promise<ICalCalendarJSONData> {
  const calendar = ical({
    prodId: "//Example//Calendar//EN",
    name: "USC Viterbi Calendar",
  });

  const baseUrl =
    `https://viterbi.usc.edu/calendar/?month&calendar=${id}&date=`;

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
        const link = title_elem?.getAttribute("href");
        const dateTime = event.querySelector(".event_stats strong")
          ?.textContent;
        const location = event.querySelector(
          'p a[href^="http://web-app.usc.edu/maps/"]',
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

const generate_calendar_month_ = kv_memoize(
  "generate_calendar_month",
  generate_calendar_month,
  expire_time,
);

async function generate_calendar(id: string): Promise<string> {
  const now = DateTime.now().setZone(timeZone);
  const startDate = now.minus({ years: 1 }).startOf("month");
  const endDate = now.plus({ years: 1 }).startOf("month");

  const calendar = ical({
    prodId: "//Example//Calendar//EN",
    name: "USC Viterbi Calendar",
  });

  let currentDate = startDate;
  while (currentDate <= endDate) {
    const year = currentDate.toFormat("yyyy");
    const month = currentDate.toFormat("LL");

    const sub_calendar_json = await generate_calendar_month_(
      id,
      String(year),
      month,
    );

    const sub_calendar: ICalCalendar = ical(sub_calendar_json);
    for (const event of sub_calendar.events()) {
      calendar.createEvent(event);
    }

    currentDate = currentDate.plus({ months: 1 });
  }

  const result = calendar.toString();
  console.log(
    `${calendar.length()} events added to calendar, total length ${result.length}.`,
  );
  return result;
}
