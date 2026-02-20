export const SELECTORS = {
  captcha: ".px-captcha-container",
  openDatePicker: "#date-picker, [data-cy=\"date-picker\"]",
  calendarDayButtons: "div[data-cy=\"bt-cal-day\"]",
  nextMonth: "a.nextMonth",
  timeSlotButtons: "button[data-cy^=\"book-now-time-slot-box-\"], button[class*=\"time-slot\"]",
  submit: "button[type=\"submit\"][data-cy=\"submit\"]",
  reservationPax: "[aria-label=\"reservation pax\"]",
  reservationDate: "[aria-label=\"reservation date\"]",
  reservationTime: "[aria-label=\"reservation time\"]"
} as const;
