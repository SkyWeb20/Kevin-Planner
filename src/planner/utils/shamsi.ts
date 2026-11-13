/**
 * 100% Offline, high-precision Solar Hijri (Shamsi / Jalali) date utilities.
 * Conforms mathematically to the Iranian national calendar.
 */

export const SHAMSI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
] as const

export const SHAMSI_WEEKDAYS = [
  'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'
] as const

export const SHAMSI_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)])
}

export function toEnglishDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
}

export function isLeapJalaliYear(jy: number): boolean {
  // 33-year cycle leap year algorithm for Jalali calendar
  const r = ((jy - (jy > 0 ? 474 : 473)) % 2820 + 474 + 38) * 682 % 2816
  return r < 682
}

export function getShamsiMonthDays(jy: number, jm: number): number {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  return isLeapJalaliYear(jy) ? 30 : 29
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  let gy = (jy <= 979) ? 621 : 1600
  jy -= (jy <= 979) ? 0 : 979
  let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186)
  gy += 400 * Math.floor(days / 146097)
  days %= 146097
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524)
    days %= 36524
    if (days >= 365) days++
  }
  gy += 4 * Math.floor(days / 1461)
  days %= 1461
  gy += Math.floor((days - 1) / 365)
  if (days > 0) days = (days - 1) % 365
  let gd = days + 1
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 0
  for (gm = 0; gm < 13; gm++) {
    const v = sal_a[gm]
    if (gd <= v) break
    gd -= v
  }
  return { gy, gm, gd }
}

export function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  let jy = (gy <= 1600) ? 0 : 979
  gy -= (gy <= 1600) ? 621 : 1600
  const gy2 = (gm > 2) ? (gy + 1) : gy
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1]
  jy += 33 * Math.floor(days / 12053)
  days %= 12053
  jy += 4 * Math.floor(days / 1461)
  days %= 1461
  jy += Math.floor((days - 1) / 365)
  if (days > 0) days = (days - 1) % 365
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30)
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30))
  return { jy, jm, jd }
}

/**
 * Returns day-of-week index in Iranian calendar:
 * 0: شنبه (Saturday)
 * 1: یکشنبه (Sunday)
 * ...
 * 6: جمعه (Friday)
 */
export function getShamsiDayOfWeek(jy: number, jm: number, jd: number): number {
  const g = jalaliToGregorian(jy, jm, jd)
  const d = new Date(g.gy, g.gm - 1, g.gd)
  return (d.getDay() + 1) % 7
}

/**
 * Converts a Gregorian Date or ISO date string (YYYY-MM-DD) or Shamsi string to { jy, jm, jd }
 */
export function parseDateToJalali(input: Date | string | null | undefined): { jy: number; jm: number; jd: number } {
  if (!input) {
    const now = new Date()
    return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  }

  if (input instanceof Date) {
    return gregorianToJalali(input.getFullYear(), input.getMonth() + 1, input.getDate())
  }

  const str = toEnglishDigits(String(input).trim())

  // Check if string is already Jalali format YYYY/MM/DD or YYYY-MM-DD with year > 1300 and < 1500
  const parts = str.split(/[-/.]/).map(Number)
  if (parts.length === 3 && parts[0] >= 1300 && parts[0] <= 1500) {
    return { jy: parts[0], jm: Math.min(12, Math.max(1, parts[1])), jd: Math.min(31, Math.max(1, parts[2])) }
  }

  // Otherwise assume ISO Gregorian YYYY-MM-DD
  const gDate = new Date(`${str}T12:00:00`)
  if (!Number.isNaN(gDate.getTime())) {
    return gregorianToJalali(gDate.getFullYear(), gDate.getMonth() + 1, gDate.getDate())
  }

  const fallback = new Date()
  return gregorianToJalali(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate())
}

/**
 * Returns Gregorian ISO YYYY-MM-DD from Jalali date
 */
export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const g = jalaliToGregorian(jy, jm, jd)
  const mm = String(g.gm).padStart(2, '0')
  const dd = String(g.gd).padStart(2, '0')
  return `${g.gy}-${mm}-${dd}`
}

/**
 * Returns formatted Shamsi date string, e.g. "۱۴۰۵/۰۸/۰۳" or "۳ آبان ۱۴۰۵" or "یکشنبه، ۳ آبان ۱۴۰۵"
 */
export function formatJalaliDisplay(
  input: Date | string | null | undefined,
  mode: 'full' | 'dayMonthYear' | 'numeric' | 'short' | 'monthYear' | 'day' = 'full'
): string {
  if (!input) return ''
  const { jy, jm, jd } = parseDateToJalali(input)
  const monthName = SHAMSI_MONTHS[jm - 1]
  const weekdayName = SHAMSI_WEEKDAYS[getShamsiDayOfWeek(jy, jm, jd)]

  if (mode === 'numeric') {
    const mm = String(jm).padStart(2, '0')
    const dd = String(jd).padStart(2, '0')
    return toPersianDigits(`${jy}/${mm}/${dd}`)
  }

  if (mode === 'short') {
    return `${toPersianDigits(jd)} ${monthName}`
  }

  if (mode === 'dayMonthYear') {
    return `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`
  }

  if (mode === 'monthYear') {
    return `${monthName} ${toPersianDigits(jy)}`
  }

  if (mode === 'day') {
    return toPersianDigits(jd)
  }

  return `${weekdayName}، ${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`
}

