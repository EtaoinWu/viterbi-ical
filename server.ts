import { Application, Router } from "https://deno.land/x/oak@v14.1.1/mod.ts";
import {
  DOMParser,
  Element,
} from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import ical from "https://esm.sh/ical-generator@6.0.1";
import { parseDateRange } from "./parse_daterange.ts";

const app = new Application();
const router = new Router();

router.get("/viterbi-cs-calendar", async (ctx) => {
  const calendar = await generate_calendar();

  ctx.response.headers.set("Content-Type", "text/calendar");
  ctx.response.body = calendar.toString();
});

app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 4090 });
console.log("Server is running on port 4090");

async function generate_calendar() {
  const nowDate = new Date();
  const startDate = new Date(nowDate.getFullYear() - 1, nowDate.getMonth(), 2);
  const endDate = new Date(nowDate.getFullYear() + 1, nowDate.getMonth(), 2);
  const baseUrl = "https://viterbi.usc.edu/calendar/?month&calendar=7&date=";

  const calendar = ical({
    prodId: "//Example//Calendar//EN",
    name: "USC Viterbi CS Calendar",
  });

  let currentDate = startDate;
  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
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
            const { start, end } = parseDateRange(dateTime);

            calendar.createEvent({
              start: start,
              end: end,
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

    currentDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      currentDate.getDay(),
    );
  }
  return calendar;
}
