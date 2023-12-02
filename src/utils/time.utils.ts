// get days between two dates

import { log } from "./logger.utils.js";

// doesn't include the end date
export const getDaysBetween = (date1: Date, date2: Date) => {
  const date1LocalCopy = new Date(date1.getTime());
  log("time.utils", "getDaysBetween", "Date 1:", date1LocalCopy);
  const date2LocalCopy = new Date(date2.getTime());

  log("time.utils", "getDaysBetween", "Date 2:",date2LocalCopy);

  // set time to zero
  date1LocalCopy.setHours(0, 0, 0, 0);
  date2LocalCopy.setHours(0, 0, 0, 0);

  log("time.utils", "getDaysBetween", "Date 1 with time zero:",date1LocalCopy);
  log("time.utils", "getDaysBetween", "Date 1 with time zero:",date2LocalCopy);

  let difference = date1LocalCopy.getTime() - date2LocalCopy.getTime();
  difference = difference < 0 ? difference * -1 : difference;
  log("time.utils", "getDaysBetween", "Time difference between timestamps:",difference);
  const days = difference / (1000 * 60 * 60 * 24);
  log("time.utils", "getDaysBetween", "Difference between dates",days);
  return Math.ceil(days);
};

export const checkIfDate1IsGreaterThanEqualToDate2 = (date1: Date, date2: Date) => {
  const date1LocalCopy = new Date(date1.getTime());
  log("time.utils", "compareDates", "Date 1:", date1LocalCopy);
  const date2LocalCopy = new Date(date2.getTime());
  log("time.utils", "compareDates", "Date 2:",date2LocalCopy);

  // set time to zero
  date1LocalCopy.setHours(0, 0, 0, 0);
  date2LocalCopy.setHours(0, 0, 0, 0);

  log("time.utils", "getDaysBetween", "Date 1 with time zero:",date1LocalCopy);
  log("time.utils", "getDaysBetween", "Date 1 with time zero:",date2LocalCopy);

  return date1LocalCopy.getTime() >= date2LocalCopy.getTime();
}

export const checkIfDate1IsGreaterThanDate2 = (date1: Date, date2: Date) => {
  const date1LocalCopy = new Date(date1.getTime());
  log("time.utils", "compareDates", "Date 1:", date1LocalCopy);
  const date2LocalCopy = new Date(date2.getTime());
  log("time.utils", "compareDates", "Date 2:",date2LocalCopy);

  // set time to zero
  date1LocalCopy.setHours(0, 0, 0, 0);
  date2LocalCopy.setHours(0, 0, 0, 0);

  log("time.utils", "getDaysBetween", "Date 1 with time zero:",date1LocalCopy);
  log("time.utils", "getDaysBetween", "Date 1 with time zero:",date2LocalCopy);

  return date1LocalCopy.getTime() > date2LocalCopy.getTime();
}

export const checkIfDate1IsEqualToDate2 = (date1: Date, date2: Date) => {
  const date1LocalCopy = new Date(date1.getTime());
  log("time.utils", "compareDates", "Date 1:", date1LocalCopy);
  const date2LocalCopy = new Date(date2.getTime());
  log("time.utils", "compareDates", "Date 2:",date2LocalCopy);

  // set time to zero
  date1LocalCopy.setHours(0, 0, 0, 0);
  date2LocalCopy.setHours(0, 0, 0, 0);

  log("time.utils", "getDaysBetween", "Date 1 with time zero:",date1LocalCopy);
  log("time.utils", "getDaysBetween", "Date 1 with time zero:",date2LocalCopy);

  return date1LocalCopy.getTime() === date2LocalCopy.getTime();

}

export const getDaysBetweenIncludingLastDate = (date1: Date, date2: Date) =>
  getDaysBetween(date1, date2) + 1;

export const getTimestamp = (date: Date) => Math.ceil(date.getTime() / 1000);
export const stringToNumberTimestamp = (stringTimestamp: string) =>
  parseInt(stringTimestamp);
