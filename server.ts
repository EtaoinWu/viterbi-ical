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
import { gunzip, gzip } from "https://deno.land/x/compress@v0.4.5/mod.ts";

const app = new Application();
const router = new Router();
const expire_time = 1000 * 60 * 30; // 30 minutes

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

const kv = await Deno.openKv();

function kv_memoize<T>(
  salt: string,
  fn: (...xs: string[]) => Promise<T>,
  expireIn: number = 1000 * 10,
): typeof fn {
  return async (...xs: string[]) => {
    const key = [salt, ...xs];
    const cached = await kv.get<Uint8Array>(key);
    if (cached.value !== null) {
      console.log(`Cache hit for ${key.join(".")}`);
      const compressed = cached.value;
      const encoded = gunzip(compressed);
      const stringified = new TextDecoder().decode(encoded);
      return JSON.parse(stringified) as T;
    } else {
      console.log(`Cache miss for ${key.join(".")}`);
      const result = await fn(...xs);
      const stringified = JSON.stringify(result);
      const encoded = new TextEncoder().encode(stringified);
      const compressed = gzip(encoded);
      console.log(`Item size: ${encoded.length} -> ${compressed.length}`);
      await kv.set(key, compressed, { expireIn });
      return result;
    }
  };
}

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
  const nowDate = new Date();
  const startDate = new Date(
    nowDate.getFullYear() - 1,
    nowDate.getMonth(),
    nowDate.getDay(),
  );
  const endDate = new Date(
    nowDate.getFullYear() + 1,
    nowDate.getMonth(),
    nowDate.getDay(),
  );

  const calendar = ical({
    prodId: "//Example//Calendar//EN",
    name: "USC Viterbi Calendar",
  });

  let currentDate = startDate;
  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");

    const sub_calendar_json = await generate_calendar_month_(
      id,
      String(year),
      month,
    );

    const sub_calendar: ICalCalendar = ical(sub_calendar_json);
    for (const event of sub_calendar.events()) {
      calendar.createEvent(event);
    }

    currentDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      currentDate.getDay(),
    );
  }

  const result = calendar.toString();
  console.log(
    `${calendar.length()} events added to calendar, total length ${result.length}.`,
  );
  return result;
}
