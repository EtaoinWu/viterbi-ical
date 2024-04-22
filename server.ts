import {
  Application,
  Router,
  send,
} from "https://deno.land/x/oak@v14.1.1/mod.ts";
import ical, {
  ICalCalendar,
} from "https://esm.sh/ical-generator@6.0.1";
import { DateTime } from "https://esm.sh/luxon@3.4.4";
import { timeZone } from "./shared.ts";
import { generate_calendar_month_ } from "./generate_calendar_month.ts";

const app = new Application();
const router = new Router();

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
