import { generate_calendar_month } from './generate_calendar_month.ts';

const id = "7";
const year = "2024";
const month = "04";
const ical_json = await generate_calendar_month(id, year, month);
console.log(ical_json);
