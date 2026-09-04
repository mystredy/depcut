"use client";

import { usePublicSiteSettings } from "@/queries/site";

export type SiteDateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
export type SiteTimeFormat = "12h" | "24h";

const pad = (n: number) => String(n).padStart(2, "0");

/** admin/settings/general's Date Format. Deliberately not Intl/date-fns —
 * the three formats it offers are exact literal token orders an admin
 * picked, not a locale's own convention, so a fixed-field template is the
 * direct implementation rather than a locale lookup standing in for one. */
export function formatSiteDate(value: Date | string | number, format: SiteDateFormat): string {
  const d = new Date(value);
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const yyyy = d.getFullYear();
  if (format === "DD/MM/YYYY") return `${dd}/${mm}/${yyyy}`;
  if (format === "YYYY-MM-DD") return `${yyyy}-${mm}-${dd}`;
  return `${mm}/${dd}/${yyyy}`;
}

/** admin/settings/general's Time Format (12-hour or 24-hour). */
export function formatSiteTime(value: Date | string | number, format: SiteTimeFormat): string {
  const d = new Date(value);
  if (format === "24h") return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const hour = d.getHours() % 12 || 12;
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  return `${hour}:${pad(d.getMinutes())} ${ampm}`;
}

/** The site's chosen date/time format, bound and ready to call, for a client
 * component displaying a timestamp — an admin table's "Joined" or "Created"
 * column, a support ticket's date. Falls back to the same defaults the
 * settings row itself defaults to while the query is still loading, so nothing
 * has to branch on `isPending` just to print a date. Applied so far to a
 * couple of representative admin list pages (see admin/users/page.tsx) — most
 * of the admin panel's own toLocaleDateString() calls haven't been swept onto
 * this yet. */
export function useSiteDateFormat() {
  const { data } = usePublicSiteSettings();
  const dateFormat = (data?.settings.dateFormat as SiteDateFormat | undefined) ?? "MM/DD/YYYY";
  const timeFormat = (data?.settings.timeFormat as SiteTimeFormat | undefined) ?? "12h";
  return {
    formatDate: (value: Date | string | number) => formatSiteDate(value, dateFormat),
    formatDateTime: (value: Date | string | number) =>
      `${formatSiteDate(value, dateFormat)} ${formatSiteTime(value, timeFormat)}`,
    formatTime: (value: Date | string | number) => formatSiteTime(value, timeFormat),
  };
}
