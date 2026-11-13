<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import PersianDatePicker from './components/PersianDatePicker.vue'
import { formatJalaliDisplay, toPersianDigits, parseDateToJalali, SHAMSI_MONTHS } from './utils/shamsi'

type ViewKey =
  | 'dashboard' | 'today' | 'week' | 'month' | 'goals' | 'habits' | 'library' | 'roadmap' | 'schedule'
  | 'history' | 'finance' | 'notes' | 'stats' | 'settings' | 'workspace'
type Priority = 'important' | 'medium' | 'low' | 'none'
type ThemeKey = 'emerald' | 'ocean' | 'sunset' | 'lavender' | 'midnight'
type ThemeOption = {
  key: ThemeKey
  name: string
  description: string
  primary: string
  secondary: string
  accent: string
  icon: string
}
type Task = {
  id: string; title: string; description: string; category: string; minutes: number; xp: number
  priority: Priority; repeat: 'daily' | 'weekly' | 'once'; doneDates: string[]; elapsed: number
  reminder?: string; planned?: boolean
}
type Goal = { id: string; title: string; type: string; target: string; deadline: string; steps: { id: string; title: string; done: boolean }[] }
type Habit = { id: string; title: string; detail: string; doneDates: string[]; tag: 'روزانه' | 'هفتگی' }
type LibraryItem = { id: string; title: string; type: 'کتاب' | 'پادکست' | 'فیلم'; status: string; rating?: number; note?: string }
type Transaction = { id: string; title: string; category: string; amount: number; type: 'income' | 'expense'; date: string }
type Note = { id: string; title: string; body: string; date: string; kind: 'روزانه' | 'هفتگی' | 'ماهانه' }
type Account = { id: string; name: string; balance: number }
type Debt = { id: string; title: string; person: string; total: number; paid: number; due: string; direction: 'من طلب دارم' | 'من بدهکارم' }
type WorkspaceRecord = {
  id: string; moduleId: string; title: string; detail: string; person: string; category: string
  status: string; date: string; due: string; amount: number; secondary: number; front: string; back: string
  interval: number; notes: string
}
type WorkspaceField = { key: keyof Omit<WorkspaceRecord, 'id' | 'moduleId'>; label: string; type: 'text' | 'textarea' | 'date' | 'time' | 'number' | 'select'; options?: string[]; unit?: string }
type WorkspaceModule = { id: string; group: string; title: string; icon: string; description: string; fields: WorkspaceField[]; metric?: 'amount' | 'secondary'; unit?: string }
type NavItem = { key: ViewKey; label: string; icon: string; moduleId?: string }
type NavGroup = { label: string; icon: string; items: NavItem[] }
type PlannerData = {
  tasks: Task[]; goals: Goal[]; habits: Habit[]; library: LibraryItem[]; transactions: Transaction[]
  notes: Note[]; reminders: string[]; settings: { darkMode: boolean; theme?: ThemeKey; streakCategory: string; xpMode: string; waterGoal: number; calorieGoal: number }
  completedDates: string[]; freeDates: string[]; sleepByDate: Record<string, string>; ratings: Record<string, number>; dailyNote: string
  accounts: Account[]; debts: Debt[]; weekJournal: string; monthJournal: string
  workspaceRecords: WorkspaceRecord[]
}
type ModalKind = 'task' | 'goal' | 'habit' | 'library' | 'income' | 'expense' | 'note' | 'account' | 'debt' | 'workspace' | null

const categories = ['شغل و حرفه', 'مادیات', 'سلامت جسمی و روحی', 'رشد و توسعه فردی', 'تفریح و سرگرمی', 'معنویات', 'خانواده و روابط عاطفی', 'سایر']
const today = new Date()
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const shiftDate = (date: Date, amount: number) => { const next = new Date(date); next.setDate(next.getDate() + amount); return next }
const keyToday = dayKey(today)
const workspaceRecord = (id: string, moduleId: string, title: string, values: Partial<WorkspaceRecord> = {}): WorkspaceRecord => ({
  id, moduleId, title, detail: '', person: '', category: '', status: '', date: keyToday, due: '', amount: 0, secondary: 0, front: '', back: '', interval: 1, notes: '', ...values,
})
const field = (key: WorkspaceField['key'], label: string, type: WorkspaceField['type'] = 'text', options?: string[], unit?: string): WorkspaceField => ({ key, label, type, options, unit })
const workspaceModules: WorkspaceModule[] = [
  { id: 'calories', group: 'سلامتی', title: 'کالری‌شماری', icon: 'mdi-food-apple-outline', description: 'وعده‌ها را ثبت کن و مجموع کالری روز را با هدف روزانه مقایسه کن.', fields: [field('category', 'وعده', 'select', ['صبحانه', 'میان‌وعده', 'ناهار', 'عصرانه', 'شام']), field('amount', 'کالری', 'number', undefined, 'کیلوکالری'), field('date', 'تاریخ', 'date'), field('notes', 'ترکیبات یا یادداشت', 'textarea')], metric: 'amount', unit: 'کیلوکالری' },
  { id: 'water', group: 'سلامتی', title: 'آب مصرفی', icon: 'mdi-cup-water', description: 'آب روزانه را با میانبرهای سریع یا مقدار دلخواه ثبت کن.', fields: [field('amount', 'مقدار', 'number', undefined, 'میلی‌لیتر'), field('date', 'تاریخ', 'date'), field('notes', 'یادداشت', 'textarea')], metric: 'amount', unit: 'میلی‌لیتر' },
  { id: 'exercise', group: 'سلامتی', title: 'ورزش‌ها', icon: 'mdi-dumbbell', description: 'نوع تمرین، مدت، شدت و یادداشت هر جلسه را نگه دار.', fields: [field('category', 'نوع ورزش', 'select', ['پیاده‌روی', 'دویدن', 'تمرین قدرتی', 'یوگا', 'شنا', 'دوچرخه‌سواری', 'سایر']), field('secondary', 'مدت', 'number', undefined, 'دقیقه'), field('amount', 'کالری مصرف‌شده', 'number', undefined, 'کیلوکالری'), field('date', 'تاریخ', 'date'), field('notes', 'یادداشت تمرین', 'textarea')], metric: 'secondary', unit: 'دقیقه تمرین' },
  { id: 'mood', group: 'سلامتی', title: 'مود ترکر', icon: 'mdi-emoticon-outline', description: 'حال روزت را امتیاز بده و محرک‌ها یا اتفاق‌های همراهش را ثبت کن.', fields: [field('amount', 'حال امروز از ۱ تا ۵', 'number'), field('category', 'حس غالب', 'select', ['آرام', 'خوشحال', 'باانرژی', 'خسته', 'نگران', 'غمگین', 'سایر']), field('date', 'تاریخ', 'date'), field('notes', 'چه چیزی روی حالم اثر گذاشت؟', 'textarea')], metric: 'amount', unit: 'امتیاز حال' },
  { id: 'sleep', group: 'سلامتی', title: 'الگوی خواب', icon: 'mdi-sleep', description: 'ساعت خواب و بیداری، کیفیت خواب و روند استراحتت را دنبال کن.', fields: [field('category', 'زمان خواب', 'time'), field('status', 'زمان بیداری', 'time'), field('amount', 'مدت خواب', 'number', undefined, 'ساعت'), field('secondary', 'کیفیت از ۱ تا ۵', 'number'), field('date', 'تاریخ', 'date'), field('notes', 'یادداشت', 'textarea')], metric: 'amount', unit: 'ساعت خواب' },
  { id: 'weight', group: 'سلامتی', title: 'ثبت وزن', icon: 'mdi-weight-kilogram', description: 'وزن را در تاریخ‌های مختلف ثبت کن و روند اندازه‌گیری‌ها را مرور کن.', fields: [field('amount', 'وزن', 'number', undefined, 'کیلوگرم'), field('date', 'تاریخ اندازه‌گیری', 'date'), field('notes', 'یادداشت', 'textarea')], metric: 'amount', unit: 'کیلوگرم' },
  { id: 'sizes', group: 'سلامتی', title: 'اندازه‌های بدن', icon: 'mdi-ruler', description: 'اندازه‌های بدن را برای هر ناحیه با تاریخ ثبت کن.', fields: [field('category', 'ناحیه', 'select', ['دور کمر', 'دور باسن', 'دور سینه', 'بازو', 'ران', 'سایر']), field('amount', 'اندازه', 'number', undefined, 'سانتی‌متر'), field('date', 'تاریخ اندازه‌گیری', 'date'), field('notes', 'یادداشت', 'textarea')], metric: 'amount', unit: 'سانتی‌متر' },
  { id: 'projects', group: 'پروژه و کسب‌وکار', title: 'پروژه‌ها و تسک‌ها', icon: 'mdi-briefcase-outline', description: 'پروژه را با مسئول، مهلت، مرحله و برآورد مالی نگه دار؛ کارهای روزانه را هم به پروژه پیوند بده.', fields: [field('person', 'مشتری یا همکار'), field('category', 'مرحله', 'select', ['برنامه‌ریزی', 'در حال انجام', 'بازبینی', 'تحویل‌شده', 'متوقف']), field('due', 'مهلت', 'date'), field('amount', 'بودجه یا مبلغ قرارداد', 'number', undefined, 'تومان'), field('notes', 'شرح پروژه و گام بعدی', 'textarea')] },
  { id: 'contracts', group: 'پروژه و کسب‌وکار', title: 'پروژه‌های قراردادی', icon: 'mdi-file-sign', description: 'مشتری، مبلغ، تاریخ تحویل و وضعیت قراردادها را یک‌جا مدیریت کن.', fields: [field('person', 'کارفرما / مشتری'), field('amount', 'مبلغ قرارداد', 'number', undefined, 'تومان'), field('date', 'تاریخ شروع', 'date'), field('due', 'تاریخ تحویل', 'date'), field('category', 'وضعیت قرارداد', 'select', ['پیشنهاد', 'در انتظار امضا', 'فعال', 'تحویل‌شده', 'لغوشده']), field('notes', 'شرح تعهدات', 'textarea')], metric: 'amount', unit: 'تومان قرارداد' },
  { id: 'delegated', group: 'پروژه و کسب‌وکار', title: 'کارهای وابسته به دیگران', icon: 'mdi-account-clock-outline', description: 'منتظر چه کسی هستی، چه چیزی را تحویل می‌دهد و چه زمانی باید پیگیری کنی؟', fields: [field('person', 'مسئول انجام'), field('category', 'نوع وابستگی'), field('date', 'تاریخ درخواست', 'date'), field('due', 'موعد پیگیری', 'date'), field('status', 'وضعیت', 'select', ['در انتظار', 'پیگیری لازم', 'دریافت شد', 'لغو شد']), field('notes', 'جزئیات پیگیری', 'textarea')] },
  { id: 'savings', group: 'مدیریت مالی', title: 'پس‌انداز', icon: 'mdi-piggy-bank-outline', description: 'برای هدف پس‌انداز مبلغ هدف، موجودی فعلی و موعد را ثبت کن.', fields: [field('amount', 'مبلغ هدف', 'number', undefined, 'تومان'), field('secondary', 'پس‌اندازشده', 'number', undefined, 'تومان'), field('due', 'تاریخ هدف', 'date'), field('notes', 'یادداشت', 'textarea')], metric: 'secondary', unit: 'تومان پس‌انداز' },
  { id: 'installments', group: 'مدیریت مالی', title: 'اقساط', icon: 'mdi-credit-card-clock-outline', description: 'مبلغ قسط، پرداخت‌های انجام‌شده و سررسیدهای بعدی را دنبال کن.', fields: [field('person', 'وام‌دهنده / فروشگاه'), field('amount', 'مبلغ هر قسط', 'number', undefined, 'تومان'), field('secondary', 'تعداد اقساط باقی‌مانده', 'number'), field('due', 'سررسید بعدی', 'date'), field('status', 'وضعیت', 'select', ['فعال', 'پرداخت شد', 'عقب‌افتاده', 'تسویه‌شده']), field('notes', 'یادداشت', 'textarea')], metric: 'amount', unit: 'تومان هر قسط' },
  { id: 'checks', group: 'مدیریت مالی', title: 'چک‌ها', icon: 'mdi-checkbook', description: 'چک‌های دریافتی و پرداختی، شماره، مبلغ و تاریخ سررسید را ثبت کن.', fields: [field('person', 'طرف حساب'), field('category', 'جهت', 'select', ['دریافتی', 'پرداختی']), field('amount', 'مبلغ', 'number', undefined, 'تومان'), field('date', 'تاریخ صدور', 'date'), field('due', 'سررسید', 'date'), field('status', 'وضعیت', 'select', ['در انتظار', 'وصول شد', 'پرداخت شد', 'برگشت خورد']), field('notes', 'شماره چک / بانک', 'textarea')], metric: 'amount', unit: 'تومان چک' },
  { id: 'car', group: 'مدیریت مالی', title: 'هزینه‌های خودرو', icon: 'mdi-car-wrench', description: 'سوخت، سرویس، بیمه و کیلومتر خودرو را با تاریخچه ثبت کن.', fields: [field('category', 'نوع هزینه', 'select', ['سوخت', 'سرویس', 'تعمیر', 'بیمه', 'عوارض', 'پارکینگ', 'سایر']), field('amount', 'هزینه', 'number', undefined, 'تومان'), field('secondary', 'کیلومترشمار', 'number', undefined, 'کیلومتر'), field('date', 'تاریخ', 'date'), field('notes', 'یادداشت', 'textarea')], metric: 'amount', unit: 'تومان هزینه خودرو' },
  { id: 'appointments', group: 'مدیریت مالی', title: 'نوبت‌دهی مشتریان', icon: 'mdi-calendar-account-outline', description: 'مشتری، خدمت، زمان نوبت، مبلغ و وضعیت حضور را مدیریت کن.', fields: [field('person', 'نام مشتری'), field('category', 'خدمت'), field('date', 'تاریخ نوبت', 'date'), field('due', 'ساعت نوبت', 'time'), field('amount', 'مبلغ خدمت', 'number', undefined, 'تومان'), field('status', 'وضعیت', 'select', ['رزرو شده', 'تأیید شد', 'انجام شد', 'لغو شد', 'عدم حضور']), field('notes', 'یادداشت مشتری', 'textarea')], metric: 'amount', unit: 'تومان نوبت‌ها' },
  { id: 'courseSales', group: 'مدیریت مالی', title: 'فروش دوره‌ها', icon: 'mdi-school-outline', description: 'فروش هر دوره، هنرجو، مبلغ پرداختی و مانده را مدیریت کن.', fields: [field('person', 'هنرجو / خریدار'), field('category', 'نام دوره'), field('amount', 'مبلغ کل', 'number', undefined, 'تومان'), field('secondary', 'مبلغ پرداخت‌شده', 'number', undefined, 'تومان'), field('date', 'تاریخ فروش', 'date'), field('status', 'وضعیت', 'select', ['ثبت‌نام اولیه', 'در حال پرداخت', 'تسویه‌شده', 'بازپرداخت‌شده']), field('notes', 'یادداشت', 'textarea')], metric: 'secondary', unit: 'تومان دریافت‌شده' },
  { id: 'wishlist', group: 'مدیریت مالی', title: 'خواسته‌ها و نیازها', icon: 'mdi-heart-outline', description: 'چیزهایی که می‌خواهی یا لازم داری را با اولویت و هزینه‌ی تقریبی فهرست کن.', fields: [field('category', 'دسته', 'select', ['نیاز', 'خواسته', 'خانه', 'کار', 'سلامت', 'سایر']), field('amount', 'هزینه‌ی تقریبی', 'number', undefined, 'تومان'), field('status', 'اولویت', 'select', ['ضروری', 'مهم', 'بعداً', 'خریداری‌شده']), field('due', 'زمان دلخواه', 'date'), field('notes', 'دلیل یا جزئیات', 'textarea')], metric: 'amount', unit: 'تومان برآورد' },
  { id: 'pets', group: 'لایف‌استایل', title: 'امور پت', icon: 'mdi-paw-outline', description: 'مراقبت، واکسن، دارو، غذا و قرارهای دامپزشکی حیوان خانگی را نگه دار.', fields: [field('category', 'نوع رسیدگی', 'select', ['غذا', 'دارو', 'واکسن', 'دامپزشک', 'پیاده‌روی', 'نظافت', 'سایر']), field('date', 'تاریخ انجام', 'date'), field('due', 'یادآوری بعدی', 'date'), field('amount', 'هزینه', 'number', undefined, 'تومان'), field('notes', 'نام پت و جزئیات', 'textarea')], metric: 'amount', unit: 'تومان مراقبت' },
  { id: 'prayer', group: 'لایف‌استایل', title: 'نماز و دعا', icon: 'mdi-hands-pray', description: 'نمازها، دعاها و ذکرهای روزانه را ثبت و مرور کن.', fields: [field('category', 'نوع', 'select', ['نماز', 'دعا', 'ذکر', 'مطالعه']), field('status', 'وضعیت', 'select', ['انجام شد', 'در برنامه', 'قضا']), field('date', 'تاریخ', 'date'), field('notes', 'یادداشت شخصی', 'textarea')] },
  { id: 'quran', group: 'لایف‌استایل', title: 'حفظ قرآن', icon: 'mdi-book-open-page-variant-outline', description: 'سوره، آیه یا صفحه‌ی جدید و مرورهای قبلی حفظ را ثبت کن.', fields: [field('category', 'سوره / بخش'), field('amount', 'صفحه‌ی جدید', 'number'), field('secondary', 'صفحه‌ی مرورشده', 'number'), field('date', 'تاریخ تمرین', 'date'), field('notes', 'آیات دشوار یا نکته‌ها', 'textarea')], metric: 'amount', unit: 'صفحه‌ی حفظ' },
  { id: 'trips', group: 'لایف‌استایل', title: 'سفرها', icon: 'mdi-map-marker-path', description: 'مقصد، تاریخ، همراهان، بودجه و چک‌لیست هر سفر را برنامه‌ریزی کن.', fields: [field('person', 'همراهان'), field('date', 'شروع سفر', 'date'), field('due', 'پایان سفر', 'date'), field('amount', 'بودجه', 'number', undefined, 'تومان'), field('status', 'وضعیت', 'select', ['ایده', 'در حال برنامه‌ریزی', 'رزرو شده', 'انجام شد']), field('notes', 'چک‌لیست و جزئیات', 'textarea')], metric: 'amount', unit: 'تومان بودجه سفر' },
  { id: 'music', group: 'لایف‌استایل', title: 'موسیقی', icon: 'mdi-music-note-outline', description: 'آهنگ‌ها، آلبوم‌ها، هنرمندها و حال‌وهوای موسیقی را نگه دار.', fields: [field('person', 'هنرمند'), field('category', 'حال‌وهوا / ژانر'), field('date', 'تاریخ افزودن', 'date'), field('status', 'وضعیت', 'select', ['برای گوش‌دادن', 'در حال گوش‌دادن', 'علاقه‌مندی']), field('notes', 'لینک یا یادداشت', 'textarea')] },
  { id: 'mind', group: 'لایف‌استایل', title: 'تخلیه ذهن', icon: 'mdi-brain', description: 'ایده‌ها و نگرانی‌ها را سریع بیرون بریز و بعداً به آن‌ها دسته و اقدام بعدی بده.', fields: [field('category', 'دسته', 'select', ['ایده', 'نگرانی', 'کار', 'خرید', 'یادآوری', 'سایر']), field('status', 'وضعیت', 'select', ['خام', 'برای بررسی', 'تبدیل به کار', 'بایگانی']), field('date', 'تاریخ ثبت', 'date'), field('notes', 'متن کامل', 'textarea')] },
  { id: 'presence', group: 'لایف‌استایل', title: 'بودن در لحظه', icon: 'mdi-flower-tulip-outline', description: 'لحظه‌های آرام و تمرین‌های حضور ذهن را کوتاه ثبت کن.', fields: [field('category', 'تمرین', 'select', ['تنفس', 'مدیتیشن', 'طبیعت', 'قدردانی', 'بدون گوشی', 'سایر']), field('secondary', 'مدت', 'number', undefined, 'دقیقه'), field('amount', 'آرامش از ۱ تا ۵', 'number'), field('date', 'تاریخ', 'date'), field('notes', 'چه چیزی را متوجه شدی؟', 'textarea')], metric: 'secondary', unit: 'دقیقه حضور' },
  { id: 'privateStudents', group: 'تدریس', title: 'شاگردهای خصوصی', icon: 'mdi-account-school-outline', description: 'اطلاعات شاگرد، موضوع درس، جلسات، شهریه و پیگیری‌ها را مدیریت کن.', fields: [field('person', 'راه ارتباطی / سرپرست'), field('category', 'درس / پایه'), field('amount', 'شهریه هر جلسه', 'number', undefined, 'تومان'), field('secondary', 'جلسه‌های برگزارشده', 'number'), field('due', 'پیگیری بعدی', 'date'), field('status', 'وضعیت', 'select', ['فعال', 'نیازمند پیگیری', 'اتمام دوره', 'متوقف']), field('notes', 'یادداشت شاگرد', 'textarea')], metric: 'secondary', unit: 'جلسه برگزارشده' },
  { id: 'classes', group: 'تدریس', title: 'کلاس‌ها', icon: 'mdi-human-male-board', description: 'برنامه‌ی کلاس‌ها، شاگردان، تکلیف‌ها و زمان جلسه را یک‌جا ببین.', fields: [field('person', 'شاگرد / گروه'), field('category', 'درس'), field('date', 'تاریخ کلاس', 'date'), field('due', 'ساعت', 'time'), field('secondary', 'مدت', 'number', undefined, 'دقیقه'), field('status', 'وضعیت', 'select', ['برنامه‌ریزی‌شده', 'برگزار شد', 'لغو شد']), field('notes', 'موضوع و تکلیف', 'textarea')], metric: 'secondary', unit: 'دقیقه تدریس' },
  { id: 'leitner', group: 'درس و یادگیری', title: 'جعبه لایتنر کارتی', icon: 'mdi-cards-outline', description: 'فلش‌کارت بساز، پاسخ را پنهان کن و کارت‌ها را با جعبه‌های لایتنر مرور کن.', fields: [field('front', 'روی کارت / پرسش', 'textarea'), field('back', 'پشت کارت / پاسخ', 'textarea'), field('category', 'درس / جعبه'), field('due', 'مرور بعدی', 'date'), field('interval', 'فاصله‌ی مرور', 'number', undefined, 'روز'), field('notes', 'نکته', 'textarea')] },
  { id: 'spaced', group: 'درس و یادگیری', title: 'مرورهای فاصله‌دار', icon: 'mdi-calendar-sync-outline', description: 'مرور کارت‌ها بر اساس موعد انجام می‌شود؛ پاسخ آسان فاصله را بیشتر می‌کند و پاسخ دشوار کارت را زودتر برمی‌گرداند.', fields: [field('front', 'پرسش / واژه', 'textarea'), field('back', 'پاسخ / معنی', 'textarea'), field('category', 'درس'), field('due', 'مرور بعدی', 'date'), field('interval', 'فاصله‌ی فعلی', 'number', undefined, 'روز'), field('notes', 'یادداشت', 'textarea')] },
  { id: 'courses', group: 'درس و یادگیری', title: 'دوره‌های آموزشی', icon: 'mdi-play-box-multiple-outline', description: 'دوره‌های در حال گذراندن، درصد پیشرفت، مدرس و درس بعدی را نگه دار.', fields: [field('person', 'مدرس / پلتفرم'), field('category', 'موضوع'), field('amount', 'درصد پیشرفت', 'number', undefined, '٪'), field('date', 'شروع', 'date'), field('due', 'پایان هدف', 'date'), field('status', 'وضعیت', 'select', ['در صف', 'در حال یادگیری', 'تکمیل‌شده', 'متوقف']), field('notes', 'درس بعدی / لینک', 'textarea')], metric: 'amount', unit: 'درصد پیشرفت' },
  { id: 'student', group: 'درس و یادگیری', title: 'داشبورد دانشجو', icon: 'mdi-school', description: 'درس‌ها، نمره‌ها، مهلت پروژه‌ها و واحدهای هر ترم را دنبال کن.', fields: [field('person', 'استاد / هم‌گروهی'), field('category', 'درس / ترم'), field('amount', 'نمره یا پیشرفت', 'number'), field('secondary', 'واحد', 'number'), field('due', 'مهلت بعدی', 'date'), field('status', 'وضعیت', 'select', ['در حال انجام', 'تحویل شد', 'قبول', 'نیاز به پیگیری']), field('notes', 'تکلیف‌ها و نکته‌ها', 'textarea')], metric: 'amount', unit: 'نمره / پیشرفت' },
  { id: 'timeblocking', group: 'درس و یادگیری', title: 'تایم‌بلاکینگ', icon: 'mdi-calendar-clock-outline', description: 'کارهای مهم را به بازه‌های زمانی مشخص در تقویم روزانه متصل کن.', fields: [field('date', 'تاریخ', 'date'), field('category', 'شروع', 'time'), field('status', 'پایان', 'time'), field('person', 'دسته / پروژه'), field('secondary', 'مدت برنامه‌ریزی‌شده', 'number', undefined, 'دقیقه'), field('notes', 'قصد این بازه', 'textarea')], metric: 'secondary', unit: 'دقیقه برنامه‌ریزی‌شده' },
  { id: 'applications', group: 'درس و یادگیری', title: 'اپلای', icon: 'mdi-airplane-takeoff', description: 'دانشگاه‌ها، برنامه‌ها، مدارک، توصیه‌نامه و ددلاین اپلای را پیگیری کن.', fields: [field('person', 'استاد / تماس'), field('category', 'مقطع / رشته'), field('date', 'ددلاین', 'date'), field('amount', 'هزینه‌ی اپلیکیشن', 'number', undefined, 'تومان'), field('status', 'مرحله', 'select', ['در حال بررسی', 'مدارک ناقص', 'ارسال شد', 'مصاحبه', 'پذیرش', 'رد شد']), field('notes', 'مدارک و اقدام بعدی', 'textarea')], metric: 'amount', unit: 'هزینه‌ی اپلای' },
  { id: 'shifts', group: 'تخصصی', title: 'مدیریت شیفت‌ها', icon: 'mdi-calendar-clock', description: 'شیفت‌های کاری، محل خدمت، ساعت شروع و پایان و جابه‌جایی‌ها را ثبت کن.', fields: [field('person', 'همکار / محل خدمت'), field('category', 'نوع شیفت', 'select', ['صبح', 'عصر', 'شب', 'آن‌کال', 'سایر']), field('date', 'تاریخ شیفت', 'date'), field('due', 'ساعت شروع', 'time'), field('status', 'ساعت پایان', 'time'), field('notes', 'یادداشت / تعویض شیفت', 'textarea')] },
  { id: 'legal', group: 'تخصصی', title: 'موکل‌ها و پرونده‌های حقوقی', icon: 'mdi-scale-balance', description: 'موکل، شماره پرونده، اقدام بعدی و موعدها را محرمانه روی همین دستگاه نگه دار.', fields: [field('person', 'موکل'), field('category', 'شماره پرونده / مرجع'), field('date', 'تاریخ ثبت', 'date'), field('due', 'موعد بعدی', 'date'), field('status', 'مرحله پرونده', 'select', ['مشاوره', 'در جریان', 'جلسه دادگاه', 'منتظر رأی', 'بسته‌شده']), field('notes', 'یادداشت محرمانه', 'textarea')] },
  { id: 'residency', group: 'تخصصی', title: 'آزمون دستیاری', icon: 'mdi-stethoscope', description: 'مباحث آزمون، تعداد تست، درصد پاسخ و مرورهای برنامه‌ریزی‌شده را دنبال کن.', fields: [field('category', 'درس / مبحث'), field('amount', 'تعداد تست', 'number'), field('secondary', 'درصد پاسخ درست', 'number', undefined, '٪'), field('date', 'تاریخ مطالعه', 'date'), field('due', 'مرور بعدی', 'date'), field('status', 'تسلط', 'select', ['شروع نشده', 'در حال مطالعه', 'نیاز به مرور', 'مسلط']), field('notes', 'نکته‌های پرتکرار', 'textarea')], metric: 'amount', unit: 'تست حل‌شده' },
  { id: 'ux', group: 'تخصصی', title: 'استودیوی UI/UX', icon: 'mdi-draw', description: 'پروژه‌ی طراحی، مرحله‌ی کار، تحقیق کاربر، وایرفریم و لینک تحویل را پیگیری کن.', fields: [field('person', 'مشتری / تیم'), field('category', 'مرحله', 'select', ['تحقیق', 'معماری اطلاعات', 'وایرفریم', 'رابط بصری', 'پروتوتایپ', 'تحویل']), field('date', 'شروع', 'date'), field('due', 'تحویل', 'date'), field('status', 'وضعیت', 'select', ['در صف', 'در حال انجام', 'بازبینی', 'تکمیل‌شده']), field('notes', 'لینک فایل و تصمیم‌های طراحی', 'textarea')] },
  { id: 'writing', group: 'تخصصی', title: 'پروژه‌های نویسندگی', icon: 'mdi-typewriter', description: 'مقاله، کتاب یا سفارش محتوا را با تعداد کلمه، مشتری و مهلت تحویل مدیریت کن.', fields: [field('person', 'مشتری / ویراستار'), field('category', 'نوع نوشته'), field('amount', 'تعداد کلمه‌ی فعلی', 'number'), field('secondary', 'هدف کلمه', 'number'), field('date', 'شروع', 'date'), field('due', 'مهلت', 'date'), field('status', 'وضعیت', 'select', ['ایده', 'پیش‌نویس', 'ویرایش', 'بازبینی', 'تحویل‌شده']), field('notes', 'ساختار و اقدام بعدی', 'textarea')], metric: 'amount', unit: 'کلمه‌ی نوشته‌شده' },
]

const initialData: PlannerData = {
  tasks: [], goals: [], habits: [], library: [], transactions: [], accounts: [], debts: [], notes: [], reminders: [],
  settings: { darkMode: false, theme: 'emerald', streakCategory: 'سایر', xpMode: 'واقعی + بونوس', waterGoal: 2000, calorieGoal: 2000 },
  completedDates: [],
  freeDates: [],
  sleepByDate: {}, ratings: {}, dailyNote: '',
  weekJournal: '',
  monthJournal: '',
  workspaceRecords: [],
}

const sampleIds = {
  tasks: new Set(['t1', 't2', 't3', 't4', 't5', 't6']), goals: new Set(['g1']), habits: new Set(['h1', 'h2', 'h3', 'h4']),
  library: new Set(['l1', 'l2', 'l3']), transactions: new Set(['m1', 'm2', 'm3', 'm4', 'm5']),
  accounts: new Set(['a1', 'a2']), debts: new Set(['d1', 'd2']), notes: new Set(['n1', 'n2']),
  workspaceRecords: new Set(['w-water-1', 'w-water-2', 'w-cal-1', 'w-mood-1', 'w-sleep-1', 'w-ex-1', 'w-project-1', 'w-client-1', 'w-time-1', 'w-flash-1', 'w-flash-2', 'w-quran-1', 'w-wish-1']),
}
const storageKey = 'planner-local-data-v1'
const legacyStorageKey = 'yasiplann-local-planner-v1'
function cleanSavedData(saved: Partial<PlannerData>, fromLegacyStore = false): PlannerData {
  const clean = { ...initialData, ...saved, settings: { ...initialData.settings, ...saved.settings } } as PlannerData
  const validThemes: ThemeKey[] = ['emerald', 'ocean', 'sunset', 'lavender', 'midnight']
  if (!validThemes.includes(clean.settings.theme as ThemeKey)) {
    clean.settings.theme = 'emerald'
  }
  const storedSampleDates = [
    ...(saved.tasks ?? []).filter((record) => sampleIds.tasks.has(record.id)).flatMap((task) => task.doneDates),
    ...(saved.habits ?? []).filter((record) => sampleIds.habits.has(record.id)).flatMap((habit) => habit.doneDates),
  ]
  const hasStoredSamples = Object.entries(sampleIds).some(([collection, ids]) =>
    ((saved[collection as keyof typeof sampleIds] ?? []) as { id: string }[]).some((record) => ids.has(record.id)),
  )
  for (const collection of Object.keys(sampleIds) as (keyof typeof sampleIds)[]) {
    clean[collection] = (clean[collection] as { id: string }[]).filter((record) => !sampleIds[collection].has(record.id)) as never
  }
  clean.reminders = (clean.reminders ?? []).filter((item) => !['تولد سارا 🎂', 'گرفتن لباس‌ها از خشکشویی'].includes(item))

  const sampleDates = new Set([...storedSampleDates, keyToday, ...Array.from({ length: 6 }, (_, index) => dayKey(shiftDate(today, -(index + 1))))])
  const savedDays = [...new Set(clean.completedDates)].sort()
  if (fromLegacyStore || hasStoredSamples) {
    for (let start = 0; start <= savedDays.length - 7; start += 1) {
      const consecutiveWeek = savedDays.slice(start, start + 7)
      if (consecutiveWeek.every((date, index) => index === 0 || dayKey(shiftDate(new Date(`${consecutiveWeek[index - 1]}T12:00:00`), 1)) === date)) {
        consecutiveWeek.forEach((date) => sampleDates.add(date))
        break
      }
    }
  }
  const userMarkedDates = new Set([
    ...clean.tasks.flatMap((task) => task.doneDates),
    ...clean.habits.flatMap((habit) => habit.doneDates),
    ...clean.workspaceRecords.map((record) => record.date).filter(Boolean),
    ...Object.entries(clean.sleepByDate).filter(([date, bedtime]) => !sampleDates.has(date) || bedtime !== '۶:۳۰').map(([date]) => date),
    ...Object.entries(clean.ratings).filter(([date, rating]) => !sampleDates.has(date) || rating !== 4).map(([date]) => date),
  ])
  clean.completedDates = clean.completedDates.filter((date) => !sampleDates.has(date) || userMarkedDates.has(date))
  for (const [date, bedtime] of Object.entries(clean.sleepByDate)) if (sampleDates.has(date) && bedtime === '۶:۳۰') delete clean.sleepByDate[date]
  for (const [date, rating] of Object.entries(clean.ratings)) if (sampleDates.has(date) && rating === 4) delete clean.ratings[date]
  if (clean.dailyNote === 'امروز تمرکزم خیلی بهتر بود. تکنیک پومودورو واقعاً جواب می‌ده.') clean.dailyNote = ''
  return clean
}
function loadData(): PlannerData {
  try {
    const currentStore = localStorage.getItem(storageKey)
    const legacyStore = localStorage.getItem(legacyStorageKey)
    const stored = currentStore ?? legacyStore
    if (stored) {
      const saved = JSON.parse(stored) as Partial<PlannerData>
      const clean = cleanSavedData(saved, !currentStore && Boolean(legacyStore))
      try {
        localStorage.setItem(storageKey, JSON.stringify(clean))
        localStorage.removeItem(legacyStorageKey)
      } catch { /* Keep the cleaned in-memory data if browser storage is unavailable. */ }
      return clean
    }
  } catch { /* An invalid saved record falls back to an empty planner. */ }
  return JSON.parse(JSON.stringify(initialData)) as PlannerData
}

const data = reactive<PlannerData>(loadData())
watch(data, () => {
  try { localStorage.setItem(storageKey, JSON.stringify(data)) } catch { /* Browser storage can be disabled. */ }
}, { deep: true })

const coreNav: NavGroup[] = [
  { label: 'برنامه‌ریزی', icon: 'mdi-calendar-multiselect', items: [
    { key: 'dashboard', label: 'داشبورد', icon: 'mdi-view-dashboard-outline' }, { key: 'today', label: 'امروز', icon: 'mdi-calendar-today' },
    { key: 'week', label: 'هفته', icon: 'mdi-calendar-week-outline' }, { key: 'month', label: 'ماه', icon: 'mdi-calendar-month-outline' },
    { key: 'schedule', label: 'برنامه هفتگی', icon: 'mdi-table-large' },
  ] },
  { label: 'رشد و پیگیری', icon: 'mdi-chart-line', items: [
    { key: 'goals', label: 'اهداف', icon: 'mdi-target' }, { key: 'habits', label: 'عادت‌ها', icon: 'mdi-repeat' },
    { key: 'library', label: 'کتابخانه', icon: 'mdi-bookshelf' }, { key: 'roadmap', label: 'مسیر', icon: 'mdi-source-branch' },
  ] },
  { label: 'ابزارهای شخصی', icon: 'mdi-toolbox-outline', items: [
    { key: 'finance', label: 'مدیریت مالی عمومی', icon: 'mdi-wallet-outline' }, { key: 'notes', label: 'دفترچه', icon: 'mdi-notebook-outline' },
    { key: 'history', label: 'تاریخچه', icon: 'mdi-history' }, { key: 'stats', label: 'آمار', icon: 'mdi-chart-box-outline' },
    { key: 'settings', label: 'تنظیمات و پشتیبان', icon: 'mdi-cog-outline' },
  ] },
]
const groupIcons: Record<string, string> = { 'سلامتی': 'mdi-heart-pulse', 'پروژه و کسب‌وکار': 'mdi-briefcase-outline', 'مدیریت مالی': 'mdi-cash-multiple', 'لایف‌استایل': 'mdi-leaf', 'تدریس': 'mdi-human-male-board', 'درس و یادگیری': 'mdi-school-outline', 'تخصصی': 'mdi-flask-outline' }
const navGroups: NavGroup[] = [...coreNav, ...Array.from(new Set(workspaceModules.map((module) => module.group))).map((group) => ({
  label: group, icon: groupIcons[group] ?? 'mdi-apps',
  items: workspaceModules.filter((module) => module.group === group).map((module) => ({ key: 'workspace' as const, label: module.title, icon: module.icon, moduleId: module.id })),
}))]
const mobileQuickItems: NavItem[] = [
  { key: 'dashboard', label: 'خانه', icon: 'mdi-home-variant-outline' },
  { key: 'today', label: 'امروز', icon: 'mdi-calendar-today' },
  { key: 'week', label: 'هفته', icon: 'mdi-calendar-week-outline' },
  { key: 'goals', label: 'اهداف', icon: 'mdi-target' },
]

const isNative = computed(() => {
  try {
    if (typeof window !== 'undefined' && ((window as any).Capacitor?.isNativePlatform?.() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))) return true
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
})
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 400)
const isMobile = computed(() => isNative.value || windowWidth.value <= 992)
function onWindowResize() { windowWidth.value = window.innerWidth }

const mobileSearchOpen = ref(false)
const mobileSearchInput = ref<HTMLInputElement | null>(null)
function toggleMobileSearch() {
  mobileSearchOpen.value = !mobileSearchOpen.value
  if (mobileSearchOpen.value) {
    nextTick(() => {
      mobileSearchInput.value?.focus()
    })
  } else {
    searchQuery.value = ''
  }
}
const sectionFilterQuery = ref('')

const availableThemes: ThemeOption[] = [
  {
    key: 'emerald',
    name: 'زمردی',
    description: 'سبز طبیعت و طراوت (پیش‌فرض)',
    primary: '#2c8068',
    secondary: '#86d7b8',
    accent: '#bd9450',
    icon: 'mdi-leaf',
  },
  {
    key: 'ocean',
    name: 'اقیانوسی',
    description: 'آبی لاجوردی و دریایی آرام',
    primary: '#1d6fa5',
    secondary: '#7dd3fc',
    accent: '#d99a38',
    icon: 'mdi-water',
  },
  {
    key: 'sunset',
    name: 'غروب',
    description: 'نارنجی و کهربایی پرانرژی',
    primary: '#c85a2c',
    secondary: '#fdba74',
    accent: '#d9822b',
    icon: 'mdi-weather-sunset',
  },
  {
    key: 'lavender',
    name: 'یاسی',
    description: 'اسطوخودوس و ارغوانی لوکس',
    primary: '#7d4dbb',
    secondary: '#d8b4fe',
    accent: '#bfa14c',
    icon: 'mdi-flower-tulip-outline',
  },
  {
    key: 'midnight',
    name: 'نیمه‌شب',
    description: 'تیتانیوم مدرن و یاقوت کبود',
    primary: '#2563eb',
    secondary: '#79b8ff',
    accent: '#1e293b',
    icon: 'mdi-moon-waning-crescent',
  },
]

function setTheme(themeKey: ThemeKey) {
  data.settings.theme = themeKey
  notify(`تم «${availableThemes.find((t) => t.key === themeKey)?.name}» فعال شد.`)
}

function toggleDarkMode() {
  data.settings.darkMode = !data.settings.darkMode
}

const quickToolChips: NavItem[] = [
  { key: 'habits', label: 'عادت‌ها', icon: 'mdi-repeat' },
  { key: 'library', label: 'کتابخانه', icon: 'mdi-bookshelf' },
  { key: 'finance', label: 'مدیریت مالی', icon: 'mdi-wallet-outline' },
  { key: 'notes', label: 'یادداشت‌ها', icon: 'mdi-notebook-outline' },
  { key: 'workspace', label: 'کالری‌شماری', icon: 'mdi-food-apple-outline', moduleId: 'calories' },
  { key: 'workspace', label: 'آب مصرفی', icon: 'mdi-cup-water', moduleId: 'water' },
  { key: 'settings', label: 'تنظیمات', icon: 'mdi-cog-outline' },
]

const filteredNavGroups = computed(() => {
  const q = sectionFilterQuery.value.trim().toLocaleLowerCase('fa')
  if (!q) return navGroups
  return navGroups.map((group) => {
    const matchingItems = group.items.filter((item) =>
      item.label.toLocaleLowerCase('fa').includes(q) || group.label.toLocaleLowerCase('fa').includes(q)
    )
    return { ...group, items: matchingItems }
  }).filter((group) => group.items.length > 0)
})

const activeView = ref<ViewKey>('today')
const mobileSectionsOpen = ref(false)
const selectedModuleId = ref('calories')
const selectedDate = ref(new Date())
const selectedDateIso = computed({
  get: () => dayKey(selectedDate.value),
  set: (val: string) => {
    if (val) {
      selectedDate.value = new Date(`${val}T12:00:00`)
    }
  }
})
const dateToolbarPickerOpen = ref(false)
const searchQuery = ref('')
const toastMessage = ref('')
let toastTimer: number | undefined
const modalKind = ref<ModalKind>(null)
const editingId = ref<string | null>(null)
const form = reactive({ title: '', description: '', category: 'سایر', priority: 'medium' as Priority, repeat: 'daily' as Task['repeat'], minutes: 30, xp: 10, goalType: 'کوتاه‌مدت', target: '', deadline: '', type: 'کتاب' as LibraryItem['type'], amount: 0, kind: 'روزانه' as Note['kind'], body: '', person: '', due: '', direction: 'من بدهکارم' as Debt['direction'] })
const workspaceForm = reactive<WorkspaceRecord>(workspaceRecord('', 'calories', ''))
const ratingFilter = ref<'همه' | 'انجام‌شده' | 'انجام‌نشده'>('همه')
const monthTypeFilter = ref<'همه' | 'روتین' | 'کارها' | 'اهداف'>('همه')
const noteFilter = ref<'همه' | Note['kind']>('همه')
const transactionFilter = ref<'همه' | 'income' | 'expense'>('همه')
const runningTaskId = ref<string | null>(null)
const weekDaysFa = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
const showSearchResults = computed(() => searchQuery.value.trim().length > 0)
const selectedWorkspaceModule = computed(() => workspaceModules.find((module) => module.id === selectedModuleId.value) ?? workspaceModules[0])
const currentTitle = computed(() => activeView.value === 'workspace' ? selectedWorkspaceModule.value.title : coreNav.flatMap((group) => group.items).find((item) => item.key === activeView.value)?.label ?? 'امروز')
const currentSubtitle = computed(() => activeView.value === 'workspace' ? selectedWorkspaceModule.value.description : 'برنامه‌ریزی شخصی')
const currentWorkspaceRecords = computed(() => data.workspaceRecords.filter((item) => item.moduleId === selectedModuleId.value).sort((a, b) => (b.date || '').localeCompare(a.date || '')))
const todaysWorkspaceRecords = computed(() => currentWorkspaceRecords.value.filter((item) => item.date === dayKey(selectedDate.value)))
const workspaceMetricTotal = computed(() => {
  const module = selectedWorkspaceModule.value
  if (!module.metric) return currentWorkspaceRecords.value.length
  const records = ['weight', 'sizes', 'courses', 'savings'].includes(module.id) ? currentWorkspaceRecords.value.slice(0, module.id === 'sizes' ? 1 : currentWorkspaceRecords.value.length) : todaysWorkspaceRecords.value
  if (module.id === 'weight') return Number(currentWorkspaceRecords.value[0]?.amount ?? 0)
  if (module.id === 'sizes') return Number(currentWorkspaceRecords.value[0]?.amount ?? 0)
  return records.reduce((sum, item) => sum + Number(item[module.metric!] || 0), 0)
})
const workspaceTarget = computed(() => selectedModuleId.value === 'water' ? data.settings.waterGoal : selectedModuleId.value === 'calories' ? data.settings.calorieGoal : 0)
const workspaceProgress = computed(() => workspaceTarget.value ? Math.min(100, Math.round(workspaceMetricTotal.value / workspaceTarget.value * 100)) : 0)
const dueFlashcards = computed(() => data.workspaceRecords.filter((item) => ['leitner', 'spaced'].includes(item.moduleId) && (!item.due || item.due <= dayKey(selectedDate.value))))
const sessionReviewedCards = ref<string[]>([])
const revealedFlashcardId = ref<string | null>(null)
const nextFlashcard = computed(() => dueFlashcards.value.find((card) => card.moduleId === selectedModuleId.value && !sessionReviewedCards.value.includes(card.id)))
const filteredTasks = computed(() => {
  const q = searchQuery.value.trim().toLocaleLowerCase('fa')
  if (!q) return data.tasks
  return data.tasks.filter((task) => `${task.title} ${task.description} ${task.category}`.toLocaleLowerCase('fa').includes(q))
})
const filteredWorkspaceRecords = computed(() => {
  const q = searchQuery.value.trim().toLocaleLowerCase('fa')
  if (!q) return []
  return data.workspaceRecords.filter((record) => {
    const moduleName = workspaceModules.find((module) => module.id === record.moduleId)?.title ?? ''
    return `${record.title} ${record.detail} ${record.person} ${record.category} ${record.notes} ${moduleName}`.toLocaleLowerCase('fa').includes(q)
  })
})
const matchingTasks = computed(() => searchQuery.value.trim() ? filteredTasks.value : [])
const filteredGoals = computed(() => {
  const q = searchQuery.value.trim().toLocaleLowerCase('fa')
  if (!q) return []
  return data.goals.filter((goal) => `${goal.title} ${goal.type} ${goal.target}`.toLocaleLowerCase('fa').includes(q))
})
const filteredHabits = computed(() => {
  const q = searchQuery.value.trim().toLocaleLowerCase('fa')
  if (!q) return []
  return data.habits.filter((habit) => `${habit.title} ${habit.detail} ${habit.tag}`.toLocaleLowerCase('fa').includes(q))
})
const filteredNotes = computed(() => {
  const q = searchQuery.value.trim().toLocaleLowerCase('fa')
  if (!q) return []
  return data.notes.filter((note) => `${note.title} ${note.body} ${note.kind}`.toLocaleLowerCase('fa').includes(q))
})
const hasAnySearchResults = computed(() =>
  matchingTasks.value.length > 0 ||
  filteredGoals.value.length > 0 ||
  filteredHabits.value.length > 0 ||
  filteredNotes.value.length > 0 ||
  filteredWorkspaceRecords.value.length > 0
)
const visibleNotes = computed(() => noteFilter.value === 'همه' ? data.notes : data.notes.filter((note) => note.kind === noteFilter.value))
const monthTransactions = computed(() => data.transactions.filter((item) => item.date.includes(monthName.value)))
const visibleTransactions = computed(() => transactionFilter.value === 'همه' ? monthTransactions.value : monthTransactions.value.filter((item) => item.type === transactionFilter.value))
const dayTasks = computed(() => filteredTasks.value.filter((task) => task.repeat === 'daily' || task.repeat === 'weekly' || task.repeat === 'once'))
const doneCount = computed(() => dayTasks.value.filter((task) => isDone(task, selectedDate.value)).length)
const progress = computed(() => dayTasks.value.length ? Math.round(doneCount.value / dayTasks.value.length * 100) : 0)
const incomeTotal = computed(() => monthTransactions.value.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0))
const expenseTotal = computed(() => monthTransactions.value.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0))
const accountTotal = computed(() => data.accounts.reduce((sum, account) => sum + account.balance, 0))
const currentStreak = computed(() => {
  let cursor = data.completedDates.includes(keyToday) ? today : shiftDate(today, -1)
  let count = 0
  while (count < 365 && data.completedDates.includes(dayKey(cursor))) { count += 1; cursor = shiftDate(cursor, -1) }
  return count
})
const totalElapsed = computed(() => data.tasks.reduce((sum, task) => sum + Math.max(0, Number(task.elapsed) || 0), 0))
const totalXp = computed(() => data.tasks.reduce((sum, task) => sum + task.doneDates.length * task.xp, 0))
const activeDayCount = computed(() => new Set([
  ...data.completedDates,
  ...data.tasks.flatMap((task) => task.doneDates),
  ...data.habits.flatMap((habit) => habit.doneDates),
  ...Object.keys(data.sleepByDate), ...Object.keys(data.ratings),
  ...data.workspaceRecords.map((record) => record.date).filter(Boolean),
]).size)
const weeklyXp = computed(() => {
  const keys = new Set(weekDays.value.map(dayKey))
  return data.tasks.reduce((sum, task) => sum + task.doneDates.filter((date) => keys.has(date)).length * task.xp, 0)
})
const expenseBreakdown = computed(() => {
  const colors = ['green', 'amber', 'lilac', 'rose', 'mint']
  const amounts = new Map<string, number>()
  monthTransactions.value.filter((item) => item.type === 'expense').forEach((item) => amounts.set(item.category || 'سایر', (amounts.get(item.category || 'سایر') ?? 0) + item.amount))
  return [...amounts.entries()].sort((a, b) => b[1] - a[1]).map(([title, amount], index) => ({ title, amount, percent: expenseTotal.value ? Math.round(amount / expenseTotal.value * 100) : 0, color: colors[index % colors.length] }))
})
const financeChart = computed(() => {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth() - 5 + index, 1)
    const label = dateFormat(date, { month: 'long', year: 'numeric' })
    const transactions = data.transactions.filter((item) => item.date.includes(label))
    return { name: dateFormat(date, { month: 'short' }), income: transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0), expense: transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0) }
  })
  const maximum = Math.max(0, ...months.flatMap((month) => [month.income, month.expense]))
  return months.map((month) => ({ ...month, incomeHeight: maximum ? Math.max(month.income ? 8 : 0, month.income / maximum * 100) : 0, expenseHeight: maximum ? Math.max(month.expense ? 8 : 0, month.expense / maximum * 100) : 0 }))
})
const historyDates = computed(() => {
  const dates = new Set([
    ...data.completedDates, ...data.freeDates, ...Object.keys(data.sleepByDate), ...Object.keys(data.ratings),
    ...data.tasks.flatMap((task) => task.doneDates), ...data.habits.flatMap((habit) => habit.doneDates),
    ...data.workspaceRecords.map((record) => record.date).filter(Boolean),
  ])
  return [...dates].filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && key <= keyToday)
    .sort((a, b) => b.localeCompare(a)).slice(0, 14).map((key) => new Date(`${key}T12:00:00`))
})
function categoryTasks(category: string) { return data.tasks.filter((task) => task.category === category && task.elapsed > 0).sort((a, b) => b.elapsed - a.elapsed).slice(0, 12) }
function categoryElapsed(category: string) { return data.tasks.filter((task) => task.category === category).reduce((sum, task) => sum + Math.max(0, task.elapsed), 0) }
function formatDuration(minutes: number) { return `${fa(Math.floor(minutes / 60))}:${fa(Math.floor(minutes % 60)).padStart(2, '۰')}` }
function bestStreak(habit: Habit) {
  let current = 0
  let best = 0
  let previous = ''
  for (const date of [...new Set(habit.doneDates)].sort()) {
    current = previous && dayKey(shiftDate(new Date(`${previous}T12:00:00`), 1)) === date ? current + 1 : 1
    best = Math.max(best, current)
    previous = date
  }
  return best
}
const monthDays = computed(() => {
  const currentMonth = dateFormat(selectedDate.value, { month: 'long', year: 'numeric' })
  let first = new Date(selectedDate.value)
  let attempts = 0
  while (dateFormat(first, { day: 'numeric' }) !== '۱' && dateFormat(first, { month: 'long', year: 'numeric' }) === currentMonth && attempts < 35) {
    first = shiftDate(first, -1)
    attempts += 1
  }
  let monthLength = 0
  let cursor = new Date(first)
  while (dateFormat(cursor, { month: 'long', year: 'numeric' }) === currentMonth && monthLength < 32) {
    monthLength += 1
    cursor = shiftDate(cursor, 1)
  }
  const back = (first.getDay() + 1) % 7
  const start = shiftDate(first, -back)
  const count = Math.ceil((back + monthLength) / 7) * 7
  return Array.from({ length: count }, (_, index) => shiftDate(start, index))
})
const weekDays = computed(() => {
  const start = shiftDate(selectedDate.value, -((selectedDate.value.getDay() + 1) % 7))
  return Array.from({ length: 7 }, (_, index) => shiftDate(start, index))
})
const fa = (value: number) => new Intl.NumberFormat('fa-IR').format(value)
const dateFormat = (date: Date, options?: Intl.DateTimeFormatOptions) => {
  if (options?.weekday) {
    return formatJalaliDisplay(date, 'full')
  }
  if (options?.month && options?.year && !options?.day) {
    return formatJalaliDisplay(date, 'monthYear')
  }
  if (options?.day && options?.month && !options?.year) {
    return formatJalaliDisplay(date, 'short')
  }
  if (options?.year && !options?.month && !options?.day) {
    return toPersianDigits(parseDateToJalali(date).jy)
  }
  if (options?.day && !options?.month && !options?.year) {
    return formatJalaliDisplay(date, 'day')
  }
  return formatJalaliDisplay(date, 'dayMonthYear')
}
const fullDate = (date: Date) => formatJalaliDisplay(date, 'full')
const shortDate = (date: Date) => formatJalaliDisplay(date, 'short')
const monthName = computed(() => formatJalaliDisplay(selectedDate.value, 'monthYear'))
const dayNumber = (date: Date) => formatJalaliDisplay(date, 'day')
const dateKeyFor = (date: Date) => dayKey(date)
const isDone = (task: Task, date: Date) => task.doneDates.includes(dateKeyFor(date))
const habitDone = (habit: Habit, date: Date) => habit.doneDates.includes(dateKeyFor(date))
const formatMoney = (value: number) => `${fa(value)} تومان`
const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function notify(message: string) {
  toastMessage.value = message
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toastMessage.value = '' }, 3200)
}
function moveDate(amount: number) { selectedDate.value = shiftDate(selectedDate.value, amount) }
function goToToday() { selectedDate.value = new Date(); activeView.value = 'today' }
function setMonthTypeFilter(value: string) { monthTypeFilter.value = value as typeof monthTypeFilter.value }
function setNoteFilter(value: string) { noteFilter.value = value as typeof noteFilter.value }
function selectNav(item: NavItem) {
  if (item.moduleId) {
    selectedModuleId.value = item.moduleId
    sessionReviewedCards.value = []
    revealedFlashcardId.value = null
  }
  activeView.value = item.key
  document.querySelectorAll<HTMLDetailsElement>('.nav-dropdown[open]').forEach((dropdown) => { dropdown.open = false })
}
function selectMobileNav(item: NavItem) {
  if (item.key === 'today') goToToday()
  else selectNav(item)
  mobileSectionsOpen.value = false
  if (typeof document !== 'undefined') {
    (document.activeElement as HTMLElement)?.blur()
  }
}
function closeNavOnOutsideClick(event: PointerEvent) {
  const openDropdown = document.querySelector<HTMLDetailsElement>('.planner-nav .nav-dropdown[open]')
  if (openDropdown && event.target instanceof Node && openDropdown.contains(event.target)) return
  document.querySelectorAll<HTMLDetailsElement>('.planner-nav .nav-dropdown[open]').forEach((dropdown) => { dropdown.open = false })
}
onMounted(() => {
  document.addEventListener('pointerdown', closeNavOnOutsideClick)
  window.addEventListener('resize', onWindowResize)
  onWindowResize()
})
function activeNavGroup(group: NavGroup) { return group.items.some((item) => item.key === activeView.value && (!item.moduleId || item.moduleId === selectedModuleId.value)) }
function navGroupTitle(group: NavGroup) { return group.items.find((item) => item.key === activeView.value && (!item.moduleId || item.moduleId === selectedModuleId.value))?.label ?? group.label }
function openModal(kind: ModalKind, record?: Task | Goal | Habit | LibraryItem | Transaction | Note) {
  if (!kind) return
  editingId.value = record?.id ?? null
  Object.assign(form, { title: '', description: '', category: 'سایر', priority: 'medium', repeat: 'daily', minutes: 30, xp: 10, goalType: 'کوتاه‌مدت', target: '', deadline: '', type: 'کتاب', amount: 0, kind: 'روزانه', body: '', person: '', due: '', direction: 'من بدهکارم' })
  if (record && 'title' in record) Object.assign(form, record)
  if (record && 'steps' in record) { form.title = record.title; form.goalType = record.type; form.target = record.target; form.deadline = record.deadline }
  if (record && 'doneDates' in record && 'detail' in record) { form.title = record.title; form.description = record.detail }
  if (record && 'type' in record && 'amount' in record) { form.title = record.title; form.category = record.category; form.amount = record.amount }
  modalKind.value = kind
}
function openWorkspaceModal(moduleId = selectedModuleId.value, record?: WorkspaceRecord) {
  selectedModuleId.value = moduleId
  editingId.value = record?.id ?? null
  Object.assign(workspaceForm, workspaceRecord(record?.id ?? '', moduleId, '', { date: dayKey(selectedDate.value), due: ['leitner', 'spaced'].includes(moduleId) ? dayKey(selectedDate.value) : '' }), record ?? {})
  modalKind.value = 'workspace'
}
function closeModal() { modalKind.value = null; editingId.value = null }
function saveWorkspaceModal() {
  if (!workspaceForm.title.trim()) { notify('عنوان را وارد کن.'); return }
  const next = { ...workspaceForm, id: editingId.value ?? id(), moduleId: selectedModuleId.value, title: workspaceForm.title.trim() }
  const index = data.workspaceRecords.findIndex((record) => record.id === next.id)
  if (index >= 0) data.workspaceRecords[index] = next; else data.workspaceRecords.unshift(next)
  notify(editingId.value ? 'تغییرات ذخیره شد.' : 'مورد جدید ثبت شد.')
  closeModal()
}
function saveModal() {
  if (modalKind.value === 'workspace') { saveWorkspaceModal(); return }
  if (!form.title.trim() && !['income', 'expense'].includes(modalKind.value ?? '')) { notify('عنوان را وارد کن.'); return }
  if (modalKind.value === 'task') {
    const next: Task = { id: editingId.value ?? id(), title: form.title.trim(), description: form.description, category: form.category, minutes: Number(form.minutes) || 0, xp: Number(form.xp) || 0, priority: form.priority, repeat: form.repeat, doneDates: editingId.value ? data.tasks.find((task) => task.id === editingId.value)?.doneDates ?? [] : [], elapsed: editingId.value ? data.tasks.find((task) => task.id === editingId.value)?.elapsed ?? 0 : 0 }
    const index = data.tasks.findIndex((task) => task.id === next.id)
    if (index >= 0) data.tasks[index] = next; else data.tasks.unshift(next)
  } else if (modalKind.value === 'goal') {
    const next: Goal = { id: editingId.value ?? id(), title: form.title.trim(), type: form.goalType, target: form.target, deadline: form.deadline, steps: editingId.value ? data.goals.find((goal) => goal.id === editingId.value)?.steps ?? [] : [] }
    const index = data.goals.findIndex((goal) => goal.id === next.id)
    if (index >= 0) data.goals[index] = next; else data.goals.unshift(next)
  } else if (modalKind.value === 'habit') {
    const next: Habit = { id: editingId.value ?? id(), title: form.title.trim(), detail: form.description, tag: 'روزانه', doneDates: editingId.value ? data.habits.find((habit) => habit.id === editingId.value)?.doneDates ?? [] : [] }
    const index = data.habits.findIndex((habit) => habit.id === next.id)
    if (index >= 0) data.habits[index] = next; else data.habits.unshift(next)
  } else if (modalKind.value === 'library') {
    const next: LibraryItem = { id: editingId.value ?? id(), title: form.title.trim(), type: form.type, status: editingId.value ? data.library.find((item) => item.id === editingId.value)?.status ?? 'در حال انجام' : 'در صف', note: form.description }
    const index = data.library.findIndex((item) => item.id === next.id)
    if (index >= 0) data.library[index] = next; else data.library.unshift(next)
  } else if (modalKind.value === 'income' || modalKind.value === 'expense') {
    data.transactions.unshift({ id: editingId.value ?? id(), title: form.title.trim() || (modalKind.value === 'income' ? 'درآمد جدید' : 'خرج جدید'), category: form.category, amount: Number(form.amount) || 0, type: modalKind.value, date: dateFormat(selectedDate.value) })
  } else if (modalKind.value === 'account') {
    data.accounts.unshift({ id: id(), name: form.title.trim(), balance: Number(form.amount) || 0 })
  } else if (modalKind.value === 'debt') {
    data.debts.unshift({ id: id(), title: form.title.trim(), person: form.person.trim() || 'بدون نام', total: Number(form.amount) || 0, paid: 0, due: form.due.trim() || 'بدون مهلت', direction: form.direction })
  } else if (modalKind.value === 'note') {
    data.notes.unshift({ id: editingId.value ?? id(), title: form.title.trim() || `${form.kind} · ${dateFormat(selectedDate.value)}`, body: form.body || form.description, date: dateFormat(selectedDate.value), kind: form.kind })
  }
  notify(editingId.value ? 'تغییرات ذخیره شد.' : 'به پلنرت اضافه شد.')
  closeModal()
}
function toggleTask(task: Task, date = selectedDate.value) {
  const key = dateKeyFor(date)
  if (task.doneDates.includes(key)) task.doneDates = task.doneDates.filter((item) => item !== key)
  else task.doneDates.push(key)
}
let taskClock: number | undefined
function toggleTaskClock(task: Task) {
  if (runningTaskId.value === task.id) {
    if (taskClock) window.clearInterval(taskClock)
    runningTaskId.value = null
    notify('زمان‌سنج این کار متوقف شد.')
    return
  }
  if (taskClock) window.clearInterval(taskClock)
  runningTaskId.value = task.id
  taskClock = window.setInterval(() => { task.elapsed += 1 }, 60_000)
  notify(`زمان‌سنج «${task.title}» شروع شد.`)
}
function appendJournalPrompt(which: 'week' | 'month', prompt: string) {
  const property = which === 'week' ? 'weekJournal' : 'monthJournal'
  data[property] = `${data[property]}${data[property] ? '\n\n' : ''}${prompt}\n`
}
function toggleHabit(habit: Habit, date = selectedDate.value) {
  const key = dateKeyFor(date)
  if (habit.doneDates.includes(key)) habit.doneDates = habit.doneDates.filter((item) => item !== key)
  else habit.doneDates.push(key)
}
function toggleStep(goal: Goal, stepId: string) {
  const step = goal.steps.find((item) => item.id === stepId)
  if (step) step.done = !step.done
}
function removeRecord(collection: 'tasks' | 'goals' | 'habits' | 'library' | 'transactions' | 'notes' | 'accounts' | 'debts' | 'workspaceRecords', recordId: string) {
  const list = data[collection] as { id: string }[]
  const index = list.findIndex((item) => item.id === recordId)
  if (index >= 0) list.splice(index, 1)
  notify('مورد حذف شد.')
}
function addReminder() {
  const input = document.querySelector<HTMLInputElement>('#quick-reminder')
  if (!input?.value.trim()) return
  data.reminders.push(input.value.trim())
  input.value = ''
  notify('یادآوری اضافه شد.')
}
function markDay(kind: 'complete' | 'free') {
  const key = dateKeyFor(selectedDate.value)
  const collection = kind === 'complete' ? data.completedDates : data.freeDates
  if (!collection.includes(key)) collection.push(key)
  notify(kind === 'complete' ? 'روزت ثبت شد؛ خسته نباشی!' : 'این روز به‌عنوان روز آزاد ثبت شد.')
}
function registerDebtPayment(debt: Debt) {
  if (debt.paid >= debt.total) { notify('این بدهی تسویه شده است.'); return }
  debt.paid = Math.min(debt.total, debt.paid + 500000)
  notify(debt.paid >= debt.total ? 'بدهی تسویه شد.' : 'پرداخت ۵۰۰٬۰۰۰ تومانی ثبت شد.')
}
function addWater(amount: number) {
  data.workspaceRecords.unshift(workspaceRecord(id(), 'water', `${fa(amount)} میلی‌لیتر آب`, { amount, date: dayKey(selectedDate.value) }))
  notify(`${fa(amount)} میلی‌لیتر آب ثبت شد.`)
}
function logQuickMood(score: number) {
  const labels = ['', 'سخت', 'کم‌انرژی', 'معمولی', 'خوب', 'عالی']
  data.workspaceRecords.unshift(workspaceRecord(id(), 'mood', 'حال امروز', { amount: score, category: labels[score], date: dayKey(selectedDate.value) }))
  notify('حال امروزت ذخیره شد.')
}
function workspaceDateLabel(value: string) {
  if (!value) return ''
  try {
    return formatJalaliDisplay(value, 'full')
  } catch {
    const parsed = new Date(`${value}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? value : dateFormat(parsed, { day: 'numeric', month: 'short', year: 'numeric' })
  }
}
function revealFlashcard(card: WorkspaceRecord) { revealedFlashcardId.value = revealedFlashcardId.value === card.id ? null : card.id }
function reviewFlashcard(card: WorkspaceRecord, difficulty: 'again' | 'good' | 'easy') {
  const currentInterval = Math.max(1, Number(card.interval) || 1)
  const nextInterval = difficulty === 'again' ? 1 : difficulty === 'good' ? Math.min(60, currentInterval < 3 ? 3 : currentInterval * 2) : Math.min(90, Math.max(4, currentInterval * 3))
  card.interval = nextInterval
  card.secondary += 1
  card.date = dayKey(selectedDate.value)
  card.due = dayKey(shiftDate(selectedDate.value, nextInterval))
  sessionReviewedCards.value.push(card.id)
  revealedFlashcardId.value = null
  notify(`کارت برای ${fa(nextInterval)} روز دیگر زمان‌بندی شد.`)
}
function weekTasks(date: Date) { return data.tasks.filter((task) => task.repeat === 'daily' || task.doneDates.includes(dateKeyFor(date))) }
function taskProgress(task: Task) { return task.minutes ? Math.min(100, Math.round(task.elapsed / task.minutes * 100)) : 0 }
function toggleGoalStep(goal: Goal) { return `${goal.steps.filter((step) => step.done).length}/${goal.steps.length}` }
function habitRate(habit: Habit) {
  const recentDays = new Set(Array.from({ length: 30 }, (_, index) => dayKey(shiftDate(today, -index))))
  return Math.round(new Set(habit.doneDates.filter((date) => recentDays.has(date))).size / recentDays.size * 100)
}
function streak(habit: Habit) {
  let count = 0
  const startOffset = habit.doneDates.includes(keyToday) ? 0 : 1
  for (let offset = startOffset; offset < 365; offset += 1) {
    if (habit.doneDates.includes(dayKey(shiftDate(today, -offset)))) count += 1
    else break
  }
  return count
}
function toggleTheme() { data.settings.darkMode = !data.settings.darkMode }
function exportBackup() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = 'planner-backup.json'; link.click(); URL.revokeObjectURL(url)
  notify('فایل پشتیبان آماده شد.')
}
async function importBackup(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const incoming = JSON.parse(await file.text()) as Partial<PlannerData>
    Object.assign(data, cleanSavedData(incoming))
    notify('پشتیبان بازیابی شد.')
  } catch { notify('فایل JSON معتبر نیست.') }
  ;(event.target as HTMLInputElement).value = ''
}
const backupInput = ref<HTMLInputElement>()
function openBackup() { backupInput.value?.click() }
function filteredMonthTasks(date: Date) {
  let items = data.tasks.filter((task) => isDone(task, date) || task.repeat === 'daily')
  if (monthTypeFilter.value === 'روتین') items = items.filter((task) => task.repeat === 'daily')
  if (monthTypeFilter.value === 'کارها') items = items.filter((task) => task.repeat !== 'daily')
  if (ratingFilter.value === 'انجام‌شده') items = items.filter((task) => isDone(task, date))
  if (ratingFilter.value === 'انجام‌نشده') items = items.filter((task) => !isDone(task, date))
  return items.slice(0, 3)
}
const monthDayLabel = (date: Date) => weekDaysFa[(date.getDay() + 1) % 7]
const monthDayShort = (date: Date) => formatJalaliDisplay(date, 'day')
const modalTitle = computed(() => modalKind.value === 'workspace'
  ? `${editingId.value ? 'ویرایش' : 'ثبت'} · ${selectedWorkspaceModule.value.title}`
  : ({ task: editingId.value ? 'ویرایش کار' : 'کار جدید', goal: editingId.value ? 'ویرایش هدف' : 'هدف جدید', habit: editingId.value ? 'ویرایش عادت' : 'عادت جدید', library: 'افزودن به کتابخانه', income: 'ثبت درآمد', expense: 'ثبت خرج', note: 'یادداشت جدید', account: 'افزودن حساب', debt: 'ثبت بدهی یا طلب' }[modalKind.value ?? 'task']))

const pomoOpen = ref(false)
const pomoRunning = ref(false)
const pomoTotalSeconds = ref(25 * 60)
const pomoSeconds = ref(25 * 60)
const pomoMode = ref<'work' | 'shortBreak' | 'longBreak' | 'deep'>('work')
let pomoTimer: number | undefined

const pomoLabel = computed(() => {
  const m = Math.floor(pomoSeconds.value / 60)
  const s = pomoSeconds.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

function setPomoMode(mode: 'work' | 'shortBreak' | 'longBreak' | 'deep') {
  pomoMode.value = mode
  pomoRunning.value = false
  if (pomoTimer) window.clearInterval(pomoTimer)
  const mins = mode === 'work' ? 25 : mode === 'shortBreak' ? 5 : mode === 'longBreak' ? 15 : 50
  pomoTotalSeconds.value = mins * 60
  pomoSeconds.value = mins * 60
}

function resetPomo() {
  pomoRunning.value = false
  if (pomoTimer) window.clearInterval(pomoTimer)
  pomoSeconds.value = pomoTotalSeconds.value
}

function togglePomodoro() {
  pomoOpen.value = true
  pomoRunning.value = !pomoRunning.value
  if (pomoRunning.value) {
    pomoTimer = window.setInterval(() => {
      if (pomoSeconds.value > 0) {
        pomoSeconds.value -= 1
      } else {
        if (pomoTimer) window.clearInterval(pomoTimer)
        pomoRunning.value = false
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.setValueAtTime(587.33, ctx.currentTime)
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15)
          gain.gain.setValueAtTime(0.25, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
          osc.start()
          osc.stop(ctx.currentTime + 0.5)
        } catch {}
        notify(pomoMode.value === 'work' || pomoMode.value === 'deep' ? 'زمان تمرکز تمام شد؛ وقت استراحت است! 🎉' : 'زمان استراحت تمام شد؛ آماده شروع کار بعدی؟ ✨')
      }
    }, 1000)
  } else if (pomoTimer) {
    window.clearInterval(pomoTimer)
  }
}

function closePomodoro() {
  pomoOpen.value = false
}
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeNavOnOutsideClick)
  window.removeEventListener('resize', onWindowResize)
  if (toastTimer) window.clearTimeout(toastTimer)
  if (pomoTimer) window.clearInterval(pomoTimer)
  if (taskClock) window.clearInterval(taskClock)
})
</script>

<template>
  <div
    class="planner"
    :class="[
      'theme-' + (data.settings.theme || 'emerald'),
      {
        'is-dark': data.settings.darkMode,
        'is-mobile': isMobile,
        'is-native': isNative,
      }
    ]"
    @keydown.esc="mobileSectionsOpen = false"
  >
    <!-- Mobile Native App Bar -->
    <header class="mobile-top-bar" aria-label="سربرگ پلنر">
      <div class="mobile-top-start">
        <span class="mobile-logo-circle"><i class="mdi mdi-checkbox-marked-circle-auto-outline" /></span>
        <div class="mobile-top-titles">
          <h1 class="mobile-app-title">پلنر شخصی</h1>
          <span class="mobile-app-subtitle">{{ activeView === 'today' ? fullDate(selectedDate) : currentTitle }}</span>
        </div>
      </div>
      <div class="mobile-top-actions">
        <button class="mobile-header-btn" :class="{ active: mobileSearchOpen || searchQuery }" :title="mobileSearchOpen ? 'بستن جست‌وجو' : 'جست‌وجو'" @click="toggleMobileSearch">
          <i class="mdi" :class="mobileSearchOpen ? 'mdi-close' : 'mdi-magnify'" />
        </button>
        <button class="mobile-header-btn" :title="data.settings.darkMode ? 'تم روشن' : 'تم تیره'" @click="toggleDarkMode">
          <i class="mdi" :class="data.settings.darkMode ? 'mdi-white-balance-sunny' : 'mdi-moon-waning-crescent'" />
        </button>
        <button class="mobile-header-btn" title="تنظیمات" :class="{ active: activeView === 'settings' }" @click="activeView = 'settings'">
          <i class="mdi mdi-cog-outline" />
        </button>
      </div>
    </header>

    <!-- Mobile Search Tray -->
    <div v-if="mobileSearchOpen || (isMobile && showSearchResults)" class="mobile-search-tray">
      <label class="mobile-search-input">
        <i class="mdi mdi-magnify" />
        <input ref="mobileSearchInput" v-model="searchQuery" type="search" placeholder="جست‌وجو در پلنر (کارها، هدف‌ها، یادداشت‌ها...)" />
        <button v-if="searchQuery" type="button" class="search-clear-inline" title="پاک کردن" @click.stop="searchQuery = ''">
          <i class="mdi mdi-close" />
        </button>
      </label>
      <div v-if="showSearchResults" class="search-results mobile-search-dropdown">
        <div v-if="hasAnySearchResults" class="search-results-list">
          <!-- Tasks -->
          <button v-for="task in matchingTasks.slice(0, 4)" :key="'task-' + task.id" class="search-result-row" @click="activeView = 'today'; searchQuery = ''; mobileSearchOpen = false;">
            <span class="search-badge task"><i class="mdi mdi-checkbox-marked-circle-outline" /></span>
            <div class="search-info">
              <strong>{{ task.title }}</strong>
              <small>کار · {{ task.category || 'عمومی' }}</small>
            </div>
            <i class="mdi mdi-chevron-left arrow-icon" />
          </button>

          <!-- Goals -->
          <button v-for="goal in filteredGoals.slice(0, 3)" :key="'goal-' + goal.id" class="search-result-row" @click="activeView = 'goals'; searchQuery = ''; mobileSearchOpen = false;">
            <span class="search-badge goal"><i class="mdi mdi-target" /></span>
            <div class="search-info">
              <strong>{{ goal.title }}</strong>
              <small>هدف · {{ goal.type }}</small>
            </div>
            <i class="mdi mdi-chevron-left arrow-icon" />
          </button>

          <!-- Habits -->
          <button v-for="habit in filteredHabits.slice(0, 3)" :key="'habit-' + habit.id" class="search-result-row" @click="activeView = 'habits'; searchQuery = ''; mobileSearchOpen = false;">
            <span class="search-badge habit"><i class="mdi mdi-leaf-outline" /></span>
            <div class="search-info">
              <strong>{{ habit.title }}</strong>
              <small>عادت روزانه</small>
            </div>
            <i class="mdi mdi-chevron-left arrow-icon" />
          </button>

          <!-- Notes -->
          <button v-for="note in filteredNotes.slice(0, 3)" :key="'note-' + note.id" class="search-result-row" @click="activeView = 'notes'; searchQuery = ''; mobileSearchOpen = false;">
            <span class="search-badge note"><i class="mdi mdi-notebook-outline" /></span>
            <div class="search-info">
              <strong>{{ note.title }}</strong>
              <small>یادداشت · {{ note.kind }}</small>
            </div>
            <i class="mdi mdi-chevron-left arrow-icon" />
          </button>

          <!-- Workspace Records -->
          <button v-for="record in filteredWorkspaceRecords.slice(0, 4)" :key="'rec-' + record.id" class="search-result-row" @click="selectNav({ key: 'workspace', label: record.title, icon: 'mdi-apps', moduleId: record.moduleId }); searchQuery = ''; mobileSearchOpen = false;">
            <span class="search-badge workspace"><i class="mdi" :class="workspaceModules.find((m) => m.id === record.moduleId)?.icon ?? 'mdi-apps'" /></span>
            <div class="search-info">
              <strong>{{ record.title }}</strong>
              <small>{{ workspaceModules.find((m) => m.id === record.moduleId)?.title ?? 'فضای کار' }}</small>
            </div>
            <i class="mdi mdi-chevron-left arrow-icon" />
          </button>
        </div>

        <div v-else class="search-empty-state">
          <i class="mdi mdi-text-box-search-outline" />
          <p>موردی برای «{{ searchQuery }}» پیدا نشد.</p>
        </div>

        <button class="search-close" @click="searchQuery = ''; mobileSearchOpen = false;">بستن جست‌وجو</button>
      </div>
    </div>

    <!-- Desktop Welcome Panel & Search -->
    <header class="welcome-panel desktop-only">
      <h1>پلنر شخصی</h1>
      <p>برای روزهایی که می‌خواهی با آرامش، قدم بعدی را برداری.</p>
      <label class="global-search">
        <i class="mdi mdi-magnify" />
        <input v-model="searchQuery" type="search" placeholder="جست‌وجو بین کارها و هدف‌ها..." />
      </label>
      <div v-if="showSearchResults && !isMobile" class="search-results">
        <button v-for="task in filteredTasks.slice(0, 5)" :key="task.id" @click="activeView = 'today'; searchQuery = '';">
          <i class="mdi mdi-checkbox-marked-circle-outline" /><span>{{ task.title }}</span><small>{{ task.category }}</small>
        </button>
        <button v-for="record in filteredWorkspaceRecords.slice(0, 5)" :key="record.id" @click="selectNav({ key: 'workspace', label: record.title, icon: 'mdi-apps', moduleId: record.moduleId }); searchQuery = ''">
          <i class="mdi" :class="workspaceModules.find((module) => module.id === record.moduleId)?.icon ?? 'mdi-apps'" /><span>{{ record.title }}</span><small>{{ workspaceModules.find((module) => module.id === record.moduleId)?.title }}</small>
        </button>
        <p v-if="!filteredTasks.length && !filteredWorkspaceRecords.length">چیزی پیدا نشد.</p>
        <button class="search-close" @click="searchQuery = ''">بستن جست‌وجو</button>
      </div>
    </header>

    <!-- Desktop Dropdown Nav -->
    <nav class="planner-nav desktop-only" aria-label="بخش‌های پلنر">
      <details v-for="group in navGroups" :key="group.label" name="planner-nav-group" class="nav-dropdown">
        <summary class="nav-item" :class="{ active: activeNavGroup(group) }"><i class="mdi" :class="group.icon" /><span>{{ navGroupTitle(group) }}</span><i class="mdi mdi-chevron-down nav-chevron" /></summary>
        <div class="nav-menu"><button v-for="item in group.items" :key="item.moduleId ?? item.key" class="nav-menu-item" :class="{ active: activeView === item.key && (!item.moduleId || item.moduleId === selectedModuleId) }" @click="selectNav(item)"><i class="mdi" :class="item.icon" /><span>{{ item.label }}</span><i v-if="activeView === item.key && (!item.moduleId || item.moduleId === selectedModuleId)" class="mdi mdi-check nav-menu-check" /></button></div>
      </details>
    </nav>

    <main class="content-wrap">
      <div v-if="activeView === 'dashboard'" class="page-heading dashboard-heading">
        <div><span class="eyebrow">{{ fullDate(selectedDate) }}</span><h2>سلام، روزت بخیر <span>☀️</span></h2><p>یک قدم کوچک هم تو را به هدفت نزدیک‌تر می‌کند.</p></div>
        <button class="button-primary" @click="openModal('task')"><i class="mdi mdi-plus" /> کار جدید</button>
      </div>

      <div v-else-if="activeView === 'today' || activeView === 'week' || activeView === 'month'" class="page-heading">
        <div><span class="eyebrow">برنامه‌ریزی آرام‌تر، روزهای روشن‌تر</span><h2>{{ currentTitle }}</h2></div>
        <div class="heading-actions">
          <button v-if="activeView === 'today'" class="button-soft" @click="activeView = 'dashboard'"><i class="mdi mdi-view-dashboard-outline" /> داشبورد</button>
          <button v-if="activeView !== 'month'" class="button-primary" @click="openModal('task')"><i class="mdi mdi-plus" /> کار جدید</button>
          <button v-if="activeView === 'month'" class="button-primary" @click="goToToday"><i class="mdi mdi-calendar-today" /> امروز</button>
        </div>
      </div>
      <div v-else class="page-heading">
        <div><span class="eyebrow">{{ currentSubtitle }}</span><h2>{{ currentTitle }}</h2></div>
        <div class="heading-actions">
          <button v-if="activeView === 'goals'" class="button-primary" @click="openModal('goal')"><i class="mdi mdi-plus" /> هدف جدید</button>
          <button v-if="activeView === 'habits'" class="button-primary" @click="openModal('habit')"><i class="mdi mdi-plus" /> عادت جدید</button>
          <button v-if="activeView === 'library'" class="button-primary" @click="openModal('library')"><i class="mdi mdi-plus" /> افزودن</button>
          <button v-if="activeView === 'finance'" class="button-primary" @click="openModal('expense')"><i class="mdi mdi-plus" /> ثبت خرج</button>
          <button v-if="activeView === 'notes'" class="button-primary" @click="openModal('note')"><i class="mdi mdi-plus" /> یادداشت جدید</button>
          <button v-if="activeView === 'workspace'" class="button-primary" @click="openWorkspaceModal()"><i class="mdi mdi-plus" /> مورد جدید</button>
          <button v-if="activeView === 'history' || activeView === 'stats'" class="button-soft" @click="goToToday"><i class="mdi mdi-calendar-today" /> امروز</button>
        </div>
      </div>

      <section v-if="activeView === 'dashboard'" class="dashboard-view">
        <div class="metric-grid">
          <article class="metric-card"><span class="metric-icon mint"><i class="mdi mdi-check-circle-outline" /></span><div><small>کارهای امروز</small><strong>{{ fa(doneCount) }} <em>از {{ fa(dayTasks.length) }}</em></strong></div><div class="mini-progress"><span :style="{ width: `${progress}%` }" /></div></article>
          <article class="metric-card"><span class="metric-icon amber"><i class="mdi mdi-fire" /></span><div><small>استریک فعلی</small><strong>{{ fa(currentStreak) }} <em>روز</em></strong></div><small class="metric-note">روزهای ثبت‌شده</small></article>
          <article class="metric-card"><span class="metric-icon lilac"><i class="mdi mdi-clock-outline" /></span><div><small>زمان ثبت‌شده</small><strong>{{ formatDuration(totalElapsed) }} <em>ساعت</em></strong></div><small class="metric-note">بر اساس زمان‌سنج کارها</small></article>
          <article class="metric-card"><span class="metric-icon rose"><i class="mdi mdi-star-four-points-outline" /></span><div><small>امتیاز این هفته</small><strong>{{ fa(weeklyXp) }} <em>XP</em></strong></div><small class="metric-note">از کارهای انجام‌شده</small></article>
        </div>
        <div class="dashboard-grid">
          <article class="card today-card">
            <div class="card-heading"><div><span class="card-icon"><i class="mdi mdi-format-list-checks" /></span><div><h3>کارهای امروز</h3><p>{{ fa(doneCount) }} کار انجام شده از {{ fa(dayTasks.length) }} کار</p></div></div><button class="text-button" @click="activeView = 'today'">دیدن همه <i class="mdi mdi-chevron-left" /></button></div>
            <div class="task-list">
              <div v-for="task in dayTasks.slice(0, 5)" :key="task.id" class="task-row" :class="{ complete: isDone(task, selectedDate) }">
                <button class="check-button" :class="{ checked: isDone(task, selectedDate) }" :aria-pressed="isDone(task, selectedDate)" :aria-label="`تغییر وضعیت ${task.title}`" @click="toggleTask(task)" />
                <div class="task-main"><div class="task-title-line"><strong>{{ task.title }}</strong><span v-if="task.priority === 'important'" class="priority-tag">مهم</span></div><small>{{ task.category }} · {{ fa(task.minutes) }} دقیقه · {{ fa(task.xp) }} XP</small></div>
                <button class="icon-button" :title="runningTaskId === task.id ? 'توقف زمان‌سنج' : 'شروع زمان‌سنج'" @click="toggleTaskClock(task)"><i class="mdi" :class="runningTaskId === task.id ? 'mdi-pause' : 'mdi-play-outline'" /></button><button class="icon-button" title="ویرایش" @click="openModal('task', task)"><i class="mdi mdi-pencil-outline" /></button>
              </div>
              <p v-if="!dayTasks.length" class="empty-state">هنوز کاری ثبت نکرده‌ای. از «افزودن کار جدید» شروع کن.</p>
            </div>
            <button class="add-dashed" @click="openModal('task')"><i class="mdi mdi-plus" /> افزودن کار جدید</button>
          </article>
          <article class="card focus-card">
            <div class="card-heading"><div><span class="card-icon amber"><i class="mdi mdi-target" /></span><div><h3>هدفت را زنده نگه دار</h3><p>یک قدم کوچک برای امروز انتخاب کن</p></div></div></div>
            <div class="focus-goal" v-if="data.goals[0]"><div class="goal-badge"><i class="mdi mdi-trophy-outline" /></div><div><small>{{ data.goals[0].type }}</small><strong>{{ data.goals[0].title }}</strong><span>{{ data.goals[0].target }}</span></div></div>
            <div v-if="data.goals[0]" class="progress-track"><span :style="{ width: `${Math.round(data.goals[0].steps.filter((step) => step.done).length / Math.max(1, data.goals[0].steps.length) * 100)}%` }" /></div>
            <div class="progress-caption"><span v-if="data.goals[0]">{{ toggleGoalStep(data.goals[0]) }} مرحله</span><span v-else class="muted">هنوز هدفی ثبت نشده است.</span><button class="text-button" @click="activeView = 'goals'">{{ data.goals.length ? 'جزئیات' : 'ثبت هدف' }} <i class="mdi mdi-chevron-left" /></button></div>
            <div class="quote-box"><i class="mdi mdi-format-quote-open" /><span>قرار نیست همه‌چیز را یک‌باره تغییر بدهی.</span></div>
          </article>
          <article class="card habit-card-small">
            <div class="card-heading"><div><span class="card-icon green"><i class="mdi mdi-repeat" /></span><div><h3>عادت‌های امروز</h3><p>تداوم از کمال مهم‌تر است.</p></div></div><button class="text-button" @click="activeView = 'habits'">همه <i class="mdi mdi-chevron-left" /></button></div>
            <div v-for="habit in data.habits.slice(0, 3)" :key="habit.id" class="habit-line"><button class="check-button" :class="{ checked: habitDone(habit, selectedDate) }" :aria-pressed="habitDone(habit, selectedDate)" :aria-label="`تغییر وضعیت عادت ${habit.title}`" @click="toggleHabit(habit)" /><span>{{ habit.title }}</span><small>{{ fa(streak(habit)) }} روز</small></div>
            <p v-if="!data.habits.length" class="empty-state">هنوز عادتی ثبت نکرده‌ای.</p>
          </article>
          <article class="card reminder-card-small">
            <div class="card-heading"><div><span class="card-icon rose"><i class="mdi mdi-bell-outline" /></span><div><h3>یادم باشه</h3><p>چیزهای کوچکی که نباید فراموش شوند.</p></div></div></div>
            <div v-for="(reminder, index) in data.reminders" :key="reminder" class="reminder-line"><i class="mdi mdi-circle-small" /><span>{{ reminder }}</span><button class="icon-button" title="حذف" @click="data.reminders.splice(index, 1)"><i class="mdi mdi-close" /></button></div>
            <p v-if="!data.reminders.length" class="empty-state">یادآوری‌ای ثبت نشده است.</p>
            <div class="inline-add"><input id="quick-reminder" placeholder="یادآوری جدید..." @keydown.enter="addReminder" /><button class="icon-button add-mini" @click="addReminder"><i class="mdi mdi-plus" /></button></div>
          </article>
        </div>
      </section>

      <section v-else-if="activeView === 'today'" class="today-view">
        <article class="card date-toolbar">
          <button class="icon-button" aria-label="روز قبل" @click="moveDate(-1)"><i class="mdi mdi-chevron-right" /></button>
          <button class="date-display" aria-label="انتخاب تاریخ در تقویم شمسی" title="کلیک برای انتخاب تاریخ از تقویم شمسی" @click="dateToolbarPickerOpen = true">
            <i class="mdi mdi-calendar-month-outline" />
            <span>{{ fullDate(selectedDate) }}</span>
          </button>
          <button class="icon-button" aria-label="روز بعد" @click="moveDate(1)"><i class="mdi mdi-chevron-left" /></button>
          <button class="button-soft compact" @click="goToToday">امروز</button>
          <PersianDatePicker v-model="selectedDateIso" v-model:open="dateToolbarPickerOpen" hide-input />
        </article>
        <div class="today-top-grid">
          <article class="card sleep-card"><div class="card-heading"><div><span class="card-icon lilac"><i class="mdi mdi-sleep" /></span><div><h3>ساعت خواب شب قبل</h3><p>استراحت خوب، شروع بهتر</p></div></div></div><label class="sleep-input"><i class="mdi mdi-clock-outline" /><input v-model="data.sleepByDate[dateKeyFor(selectedDate)]" type="time" aria-label="ساعت خواب" /></label></article>
          <article class="card rating-card"><div class="card-heading"><div><span class="card-icon amber"><i class="mdi mdi-star-outline" /></span><div><h3>ارزیابی روز</h3><p>امروز چه حسی داشتی؟</p></div></div></div><div class="star-rating"><button v-for="star in 5" :key="star" :class="{ selected: star <= (data.ratings[dateKeyFor(selectedDate)] ?? 0) }" :aria-label="`${fa(star)} ستاره`" @click="data.ratings[dateKeyFor(selectedDate)] = star">★</button></div></article>
        </div>
        <article class="card reminders-card">
          <div class="card-heading"><div><span class="card-icon rose"><i class="mdi mdi-bell-ring-outline" /></span><div><h3>یادم باشه</h3><p>یادآوری‌های ثبت‌شده را اینجا دنبال کن.</p></div></div><span class="soft-count">{{ fa(data.reminders.length) }} یادآوری</span></div>
          <div v-if="data.reminders.length" class="reminder-list"><div v-for="(reminder, index) in data.reminders" :key="reminder" class="reminder-item"><i class="mdi mdi-bell-outline" /><span>{{ reminder }}</span><button class="button-soft compact" @click="data.reminders.splice(index, 1)">انجام شد</button></div></div><div v-else class="empty-line">یادآوری‌ای نداری؛ می‌توانی یک مورد اضافه کنی.</div>
          <div class="inline-add"><input id="quick-reminder" placeholder="مثلاً تماس با مامان، ساعت ۶ عصر" @keydown.enter="addReminder" /><button class="icon-button add-mini" @click="addReminder"><i class="mdi mdi-plus" /></button></div>
        </article>
        <article class="card tasks-card">
          <div class="card-heading"><div><span class="card-icon mint"><i class="mdi mdi-format-list-checks" /></span><div><h3>کارهای امروز</h3><p>{{ fa(doneCount) }} از {{ fa(dayTasks.length) }} کار · {{ fa(progress) }}٪ پیشرفت</p></div></div><div class="heading-actions"><button class="button-soft compact" @click="activeView = 'week'">نمای هفته</button><button class="button-primary compact" @click="openModal('task')"><i class="mdi mdi-plus" /> کار جدید</button></div></div>
          <div class="progress-track task-progress"><span :style="{ width: `${progress}%` }" /></div>
          <div class="task-list">
            <div v-for="task in dayTasks" :key="task.id" class="task-row large" :class="{ complete: isDone(task, selectedDate) }">
              <button class="check-button" :class="{ checked: isDone(task, selectedDate) }" :aria-pressed="isDone(task, selectedDate)" :aria-label="`تغییر وضعیت ${task.title}`" @click="toggleTask(task)" />
              <div class="task-main"><div class="task-title-line"><strong>{{ task.title }}</strong><span v-if="task.priority === 'important'" class="priority-tag">مهم</span><span v-if="task.priority === 'low'" class="low-tag">کم</span></div><small><span>{{ task.category }}</span><span>·</span><span>{{ fa(task.minutes) }} دقیقه</span><span>·</span><span>{{ fa(task.xp) }} XP</span><span v-if="task.reminder">· {{ task.reminder }}</span></small><div v-if="task.elapsed > 0" class="task-time-progress"><span :style="{ width: `${taskProgress(task)}%` }" /><small>{{ fa(task.elapsed) }} از {{ fa(task.minutes) }} دقیقه</small></div></div>
              <button class="icon-button" :title="runningTaskId === task.id ? 'توقف زمان‌سنج' : 'شروع زمان‌سنج'" @click="toggleTaskClock(task)"><i class="mdi" :class="runningTaskId === task.id ? 'mdi-pause' : 'mdi-play-outline'" /></button><button class="icon-button" title="ویرایش" @click="openModal('task', task)"><i class="mdi mdi-pencil-outline" /></button><button class="icon-button danger-hover" title="حذف" @click="removeRecord('tasks', task.id)"><i class="mdi mdi-trash-can-outline" /></button>
            </div>
          </div>
          <button class="add-dashed" @click="openModal('task')"><i class="mdi mdi-plus" /> افزودن کار جدید</button>
        </article>
        <article class="card daily-note-card"><div class="card-heading"><div><span class="card-icon lilac"><i class="mdi mdi-notebook-edit-outline" /></span><div><h3>یادداشت روزانه</h3><p>هر چیزی که می‌خواهی برای خودت نگه داری.</p></div></div><button class="text-button" @click="activeView = 'notes'">دفترچه‌ی من <i class="mdi mdi-chevron-left" /></button></div><textarea v-model="data.dailyNote" rows="3" placeholder="امروز چه چیزی در ذهنت می‌گذرد؟" /></article>
        <div class="day-actions"><button class="button-primary" @click="markDay('complete')"><i class="mdi mdi-check-circle-outline" /> روز رو ببند</button><button class="button-soft" @click="markDay('free')"><i class="mdi mdi-weather-sunny" /> روز آزاد</button></div>
      </section>

      <section v-else-if="activeView === 'week'" class="week-view">
        <article class="card date-toolbar"><button class="icon-button" @click="moveDate(-7)"><i class="mdi mdi-chevron-right" /></button><div class="date-display"><i class="mdi mdi-calendar-week-outline" /><span>{{ shortDate(weekDays[0]) }} تا {{ shortDate(weekDays[6]) }} · {{ dateFormat(weekDays[0], { year: 'numeric' }) }}</span></div><button class="icon-button" @click="moveDate(7)"><i class="mdi mdi-chevron-left" /></button><button class="button-soft compact" @click="goToToday">این هفته</button></article>
        <div class="week-grid"><article v-for="(date, index) in weekDays" :key="date.toISOString()" class="card week-day" :class="{ 'is-current': dateKeyFor(date) === keyToday }"><button class="week-day-title" @click="selectedDate = date; activeView = 'today'"><span>{{ weekDaysFa[index] }}</span><strong>{{ dayNumber(date) }}</strong></button><div class="week-day-tasks"><button v-for="task in weekTasks(date).slice(0, 4)" :key="task.id" class="week-task" :class="{ done: isDone(task, date) }" :aria-pressed="isDone(task, date)" @click="toggleTask(task, date)"><span class="week-task-check" aria-hidden="true" /><span class="week-task-title">{{ task.title }}</span></button><span v-if="!weekTasks(date).length" class="muted">برنامه‌ای نیست</span></div><button class="week-add" @click="selectedDate = date; openModal('task')"><i class="mdi mdi-plus" /> افزودن</button></article></div>
        <div class="two-column-grid"><article class="card"><div class="card-heading"><div><span class="card-icon amber"><i class="mdi mdi-target" /></span><div><h3>هدف‌های این هفته</h3><p>از هدف ماهانه‌ات یک قدم انتخاب کن.</p></div></div><button class="text-button" @click="activeView = 'goals'">همه اهداف</button></div><div v-for="goal in data.goals" :key="goal.id" class="simple-list-row"><i class="mdi mdi-flag-outline" /><span>{{ goal.title }}</span><small>{{ toggleGoalStep(goal) }} مرحله</small></div></article><article class="card"><div class="card-heading"><div><span class="card-icon lilac"><i class="mdi mdi-notebook-outline" /></span><div><h3>ژورنال پایان هفته</h3><p>دستاوردها، درس‌ها و حس‌وحالت.</p></div></div></div><textarea v-model="data.weekJournal" class="journal-input" rows="3" placeholder="این هفته چطور بود؟" /><div class="prompt-row"><button @click="appendJournalPrompt('week', 'مهم‌ترین دستاوردم این هفته:')">+ مهم‌ترین دستاوردم</button><button @click="appendJournalPrompt('week', 'چیزی که یاد گرفتم:')">+ چیزی که یاد گرفتم</button><button @click="appendJournalPrompt('week', 'هفته‌ی بعد بهترش می‌کنم:')">+ هفته‌ی بعد</button></div></article></div>
      </section>

      <section v-else-if="activeView === 'month'" class="month-view">
        <article class="card date-toolbar">
          <button class="icon-button" @click="moveDate(-30)"><i class="mdi mdi-chevron-right" /></button>
          <button class="date-display" aria-label="انتخاب تاریخ در تقویم شمسی" title="کلیک برای انتخاب ماه و تاریخ شمسی" @click="dateToolbarPickerOpen = true">
            <i class="mdi mdi-calendar-month-outline" />
            <span>{{ monthName }}</span>
          </button>
          <button class="icon-button" @click="moveDate(30)"><i class="mdi mdi-chevron-left" /></button>
          <button class="button-soft compact" @click="goToToday">این ماه</button>
        </article>
        <div class="filter-bar card"><div class="filter-group"><button v-for="filter in ['همه', 'روتین', 'کارها', 'اهداف']" :key="filter" :class="{ selected: monthTypeFilter === filter }" @click="setMonthTypeFilter(filter)">{{ filter }}</button></div><div class="filter-group"><button v-for="filter in ['همه', 'انجام‌شده', 'انجام‌نشده']" :key="filter" :class="{ selected: ratingFilter === filter }" @click="ratingFilter = filter as typeof ratingFilter">{{ filter }}</button></div></div>
        <article class="card month-card"><div class="month-grid"><span v-for="day in weekDaysFa" :key="day" class="month-weekday">{{ day }}</span><button v-for="date in monthDays" :key="date.toISOString()" class="month-cell" :class="{ faded: dateFormat(date, { month: 'long', year: 'numeric' }) !== monthName, 'is-current': dateKeyFor(date) === keyToday, 'is-selected': dateKeyFor(date) === dateKeyFor(selectedDate) }" @click="selectedDate = date; activeView = 'today'"><span class="month-date">{{ monthDayShort(date) }}</span><i v-if="data.completedDates.includes(dateKeyFor(date))" class="mdi mdi-check-circle-outline day-mark" /><small v-for="task in filteredMonthTasks(date).slice(0, 2)" :key="task.id" class="month-task" :class="{ 'task-done': isDone(task, date) }">{{ task.title }}</small><small v-if="filteredMonthTasks(date).length > 2" class="more-tasks">+{{ fa(filteredMonthTasks(date).length - 2) }} مورد دیگر</small></button></div></article>
        <div class="stats-strip"><article class="card"><span>کارهای انجام‌شده</span><strong>{{ fa(doneCount) }} / {{ fa(dayTasks.length) }}</strong></article><article class="card"><span>هدف‌های فعال</span><strong>{{ fa(data.goals.length) }}</strong></article><article class="card"><span>روزهای فعال</span><strong>{{ fa(activeDayCount) }} روز</strong></article></div>
        <article class="card journal-month-card"><div class="card-heading"><div><span class="card-icon lilac"><i class="mdi mdi-notebook-edit-outline" /></span><div><h3>جمع‌بندی ماه</h3><p>دستاوردها، اتفاق‌های مهم و درس‌هایی که گرفتی.</p></div></div></div><textarea v-model="data.monthJournal" class="journal-input" rows="3" placeholder="این ماه چطور گذشت؟" /><div class="prompt-row"><button @click="appendJournalPrompt('month', 'بهترین اتفاق این ماه:')">+ بهترین اتفاق</button><button @click="appendJournalPrompt('month', 'مهم‌ترین دستاوردم:')">+ مهم‌ترین دستاورد</button><button @click="appendJournalPrompt('month', 'ماه بعد می‌خواهم:')">+ ماه بعد</button></div></article>
      </section>

      <section v-else-if="activeView === 'goals'" class="goals-view">
        <div class="section-intro card"><div class="intro-icon amber"><i class="mdi mdi-target" /></div><div><h3>قدم‌های کوچک، هدف‌های بزرگ</h3><p>هدف‌های بلندمدت و کوتاه‌مدتت را بنویس و آن‌ها را به مرحله‌های کوچک‌تر بشکن.</p></div><span class="soft-count">{{ fa(data.goals.length) }} هدف فعال</span></div>
        <article v-for="goal in data.goals" :key="goal.id" class="card goal-card"><div class="goal-card-head"><div class="goal-emblem"><i class="mdi mdi-trophy-outline" /></div><div class="goal-title"><span class="goal-type">{{ goal.type }} · {{ goal.target || 'هدف شخصی' }}</span><h3>{{ goal.title }}</h3><small><i class="mdi mdi-calendar-clock-outline" /> مهلت {{ goal.deadline || 'بدون تاریخ' }}</small></div><div class="goal-actions"><button class="icon-button" title="ویرایش" @click="openModal('goal', goal)"><i class="mdi mdi-pencil-outline" /></button><button class="icon-button danger-hover" title="حذف" @click="removeRecord('goals', goal.id)"><i class="mdi mdi-trash-can-outline" /></button></div></div><div class="goal-progress-line"><div class="progress-track"><span :style="{ width: `${Math.round(goal.steps.filter((step) => step.done).length / Math.max(1, goal.steps.length) * 100)}%` }" /></div><small>{{ toggleGoalStep(goal) }} مرحله · {{ Math.round(goal.steps.filter((step) => step.done).length / Math.max(1, goal.steps.length) * 100) }}٪</small></div><div class="goal-steps"><label v-for="step in goal.steps" :key="step.id" class="goal-step" :class="{ done: step.done }"><input type="checkbox" :checked="step.done" @change="toggleStep(goal, step.id)" /><span>{{ step.title }}</span><small v-if="step.done">انجام شد</small></label><button class="add-dashed compact-dashed" @click="goal.steps.push({ id: id(), title: 'مرحله‌ی جدید', done: false })"><i class="mdi mdi-plus" /> مرحله‌ی جدید</button></div></article>
        <p v-if="!data.goals.length" class="card empty-state">هنوز هدفی ثبت نکرده‌ای.</p>
      </section>

      <section v-else-if="activeView === 'habits'" class="habits-view">
        <div class="section-intro card"><div class="intro-icon green"><i class="mdi mdi-repeat" /></div><div><h3>تداوم، نه بی‌نقص بودن</h3><p>عادت‌ها را برای روزهای گذشته هم تیک بزن و روندت را با خودت مقایسه کن.</p></div><span class="soft-count">{{ fa(data.habits.length) }} عادت</span></div>
        <div class="habit-grid"><article v-for="habit in data.habits" :key="habit.id" class="card habit-card"><div class="habit-card-top"><span class="habit-symbol"><i class="mdi mdi-leaf-outline" /></span><div class="habit-tools"><button class="icon-button" title="ویرایش" @click="openModal('habit', habit)"><i class="mdi mdi-pencil-outline" /></button><button class="icon-button danger-hover" title="حذف" @click="removeRecord('habits', habit.id)"><i class="mdi mdi-trash-can-outline" /></button></div></div><h3>{{ habit.title }}</h3><p>{{ habit.detail || 'عادت کوچک امروزت' }}</p><div class="streak-metrics"><div><strong>{{ fa(streak(habit)) }}</strong><small>استریک فعلی</small></div><div><strong>{{ fa(bestStreak(habit)) }}</strong><small>بهترین</small></div><div><strong>{{ fa(habitRate(habit)) }}٪</strong><small>۳۰ روز گذشته</small></div></div><div class="habit-week"><button v-for="(date, index) in weekDays" :key="date.toISOString()" :class="{ checked: habitDone(habit, date) }" :title="`${weekDaysFa[index]} ${shortDate(date)}`" @click="toggleHabit(habit, date)"><i v-if="habitDone(habit, date)" class="mdi mdi-check" /><span v-else>{{ weekDaysFa[index].slice(0, 1) }}</span></button></div><div class="habit-footer"><span>{{ habit.tag }}</span><span>{{ fa(habit.doneDates.length) }} روز ثبت‌شده</span></div></article><button class="card add-habit-card" @click="openModal('habit')"><i class="mdi mdi-plus-circle-outline" /><strong>عادت تازه</strong><span>چیزی کوچک که هر روز برایت مهم است</span></button></div>
      </section>

      <section v-else-if="activeView === 'library'" class="library-view">
        <div class="section-intro card"><div class="intro-icon lilac"><i class="mdi mdi-bookshelf" /></div><div><h3>چیزهایی برای دیدن، شنیدن و خواندن</h3><p>کتاب‌ها، پادکست‌ها و فیلم‌هایی که می‌خواهی تجربه کنی.</p></div><span class="soft-count">{{ fa(data.library.length) }} مورد</span></div>
        <div class="library-grid"><article v-for="item in data.library" :key="item.id" class="card library-item"><div class="library-cover" :class="item.type === 'کتاب' ? 'cover-book' : item.type === 'پادکست' ? 'cover-podcast' : 'cover-movie'"><i class="mdi" :class="item.type === 'کتاب' ? 'mdi-book-open-page-variant-outline' : item.type === 'پادکست' ? 'mdi-headphones' : 'mdi-movie-open-outline'" /></div><div class="library-content"><span class="library-kind">{{ item.type }} <span>·</span> {{ item.status }}</span><h3>{{ item.title }}</h3><p>{{ item.note || 'برای این مورد یک یادداشت کوتاه ثبت کن.' }}</p><div v-if="item.rating" class="library-rating">★★★★★</div><div class="library-footer"><button class="button-soft compact" @click="item.status = item.status === 'تمام شد' ? 'در حال انجام' : 'تمام شد'"><i class="mdi mdi-check" /> {{ item.status === 'تمام شد' ? 'تمام شد' : 'در حال انجام' }}</button><span><button class="icon-button" title="ویرایش" @click="openModal('library', item)"><i class="mdi mdi-pencil-outline" /></button><button class="icon-button danger-hover" title="حذف" @click="removeRecord('library', item.id)"><i class="mdi mdi-trash-can-outline" /></button></span></div></div></article><button class="card add-library-card" @click="openModal('library')"><i class="mdi mdi-plus-circle-outline" /><strong>افزودن به کتابخانه</strong><span>چیزی را که دوست داری نگه دار</span></button></div>
      </section>

      <section v-else-if="activeView === 'roadmap'" class="roadmap-view">
        <div class="section-intro card"><div class="intro-icon amber"><i class="mdi mdi-source-branch" /></div><div><h3>نقشه‌ی راه</h3><p>هدف‌هایت را به چند مرحله‌ی قابل‌انجام تقسیم کن.</p></div><button class="button-primary compact" @click="openModal('goal')"><i class="mdi mdi-plus" /> هدف جدید</button></div>
        <div v-if="data.goals.length" class="roadmap-line"><article v-for="(goal, index) in data.goals" :key="goal.id" class="card phase-card"><div class="phase-index" :class="{ done: goal.steps.length > 0 && goal.steps.every((step) => step.done) }">{{ fa(index + 1) }}</div><div><span class="eyebrow">{{ goal.type }}</span><h3>{{ goal.title }}</h3><p>{{ goal.target || (goal.deadline ? `مهلت: ${goal.deadline}` : `${fa(goal.steps.length)} مرحله`) }}</p><button class="text-button" @click="openModal('goal', goal)">ویرایش هدف <i class="mdi mdi-chevron-left" /></button></div><span class="phase-state" :class="{ done: goal.steps.length > 0 && goal.steps.every((step) => step.done) }">{{ goal.steps.length > 0 && goal.steps.every((step) => step.done) ? 'تکمیل‌شده' : 'در حال انجام' }}</span></article></div>
        <p v-else class="card empty-state">هنوز هدفی برای نمایش در نقشه‌ی راه ثبت نکرده‌ای.</p>
      </section>

      <section v-else-if="activeView === 'schedule'" class="schedule-view"><div class="section-intro card"><div class="intro-icon mint"><i class="mdi mdi-table-large" /></div><div><h3>برنامه‌ی هفتگی</h3><p>برای هر روز، زمان‌های مهمت را کنار هم ببین.</p></div><button class="button-primary compact" @click="openModal('task')"><i class="mdi mdi-plus" /> افزودن کار</button></div><article class="card empty-state">برای برنامه‌ریزی، از بخش «امروز» کارهایت را اضافه کن.</article></section>

      <section v-else-if="activeView === 'history'" class="history-view"><div class="section-intro card"><div class="intro-icon lilac"><i class="mdi mdi-history" /></div><div><h3>روزهایی که گذشتند</h3><p>مرور کارها، خواب و ارزیابی روزانه.</p></div></div><article class="card history-card"><div v-for="(date, index) in historyDates" :key="date.toISOString()" class="history-row"><div class="history-date"><span class="history-dot" :class="{ active: data.completedDates.includes(dateKeyFor(date)) }" /><div><strong>{{ fullDate(date) }}</strong><small>{{ index === 0 ? 'آخرین ثبت' : `${fa(index)} ثبت قبل` }}</small></div></div><div class="history-stats"><span><i class="mdi mdi-check-circle-outline" /> {{ fa(data.tasks.filter((task) => isDone(task, date)).length) }} کار</span><span><i class="mdi mdi-sleep" /> {{ data.sleepByDate[dateKeyFor(date)] || '—' }}</span><span v-if="data.ratings[dateKeyFor(date)]" class="history-stars">{{ '★'.repeat(data.ratings[dateKeyFor(date)]) }}<em>{{ '☆'.repeat(5 - data.ratings[dateKeyFor(date)]) }}</em></span><span v-else class="muted">بدون ارزیابی</span></div><button class="icon-button" title="دیدن روز" @click="selectedDate = date; activeView = 'today'"><i class="mdi mdi-chevron-left" /></button></div><p v-if="!historyDates.length" class="empty-state">هنوز سابقه‌ای برای نمایش ثبت نشده است.</p></article></section>

      <section v-else-if="activeView === 'finance'" class="finance-view">
        <div class="finance-month">
          <button class="icon-button" @click="moveDate(-30)"><i class="mdi mdi-chevron-right" /></button>
          <h3 style="cursor: pointer;" title="کلیک برای انتخاب ماه شمسی" @click="dateToolbarPickerOpen = true">{{ monthName }}</h3>
          <button class="icon-button" @click="moveDate(30)"><i class="mdi mdi-chevron-left" /></button>
        </div>
        <div class="finance-metrics"><article class="card finance-total"><span class="metric-icon green"><i class="mdi mdi-bank-outline" /></span><small>حساب‌ها · مجموع</small><strong>{{ formatMoney(accountTotal) }}</strong><button class="text-button" @click="openModal('account')">مدیریت حساب‌ها</button></article><article class="card finance-total"><span class="metric-icon mint"><i class="mdi mdi-trending-up" /></span><small>درآمد این ماه</small><strong>{{ formatMoney(incomeTotal) }}</strong><span class="change-positive">درآمد ثبت‌شده</span></article><article class="card finance-total"><span class="metric-icon rose"><i class="mdi mdi-trending-down" /></span><small>خرج این ماه</small><strong>{{ formatMoney(expenseTotal) }}</strong><span class="muted">خرج‌های ثبت‌شده</span></article><article class="card finance-total"><span class="metric-icon amber"><i class="mdi mdi-wallet-outline" /></span><small>مانده این ماه</small><strong>{{ formatMoney(incomeTotal - expenseTotal) }}</strong><span class="muted">درآمد منهای خرج</span></article></div>
        <div class="finance-actions"><button class="button-primary" @click="openModal('income')"><i class="mdi mdi-plus" /> ثبت درآمد</button><button class="button-soft" @click="openModal('expense')"><i class="mdi mdi-minus" /> ثبت خرج</button><button class="button-soft" @click="notify('انتقال بین حساب‌ها را در نسخه‌ی کامل اضافه می‌کنیم.')"><i class="mdi mdi-swap-horizontal" /> انتقال</button></div>
        <div class="two-column-grid">
          <article class="card"><div class="card-heading"><div><span class="card-icon mint"><i class="mdi mdi-chart-donut" /></span><div><h3>خرج بر اساس دسته</h3><p>تقسیم خرج‌ها در این ماه</p></div></div></div><div v-if="expenseBreakdown.length" class="category-bars"><div v-for="item in expenseBreakdown" :key="item.title" class="category-bar"><div><span>{{ item.title }}</span><small>{{ formatMoney(item.amount) }}</small></div><div class="progress-track"><span :class="item.color" :style="{ width: `${item.percent}%` }" /></div></div></div><p v-else class="empty-state">برای این ماه خرجی ثبت نشده است.</p></article>
          <article class="card"><div class="card-heading"><div><span class="card-icon amber"><i class="mdi mdi-chart-timeline-variant" /></span><div><h3>روند شش‌ماهه</h3><p>درآمد و خرج ماهانه</p></div></div></div><div v-if="financeChart.some((month) => month.income || month.expense)" class="finance-chart"><div v-for="month in financeChart" :key="month.name" class="chart-month"><div class="chart-bars"><span class="bar-income" :style="{ height: `${month.incomeHeight}%` }" /><span class="bar-expense" :style="{ height: `${month.expenseHeight}%` }" /></div><small>{{ month.name }}</small></div></div><p v-else class="empty-state">با ثبت تراکنش‌ها، روند ماهانه اینجا نمایش داده می‌شود.</p><div v-if="financeChart.some((month) => month.income || month.expense)" class="chart-legend"><span><i class="legend-income" /> درآمد</span><span><i class="legend-expense" /> خرج</span></div></article>
        </div>
        <div class="two-column-grid finance-details-grid">
          <article class="card"><div class="card-heading"><div><span class="card-icon green"><i class="mdi mdi-bank-outline" /></span><div><h3>حساب‌های من</h3><p>موجودی حساب‌ها</p></div></div><button class="button-soft compact" @click="openModal('account')"><i class="mdi mdi-plus" /> حساب جدید</button></div><div v-for="account in data.accounts" :key="account.id" class="account-row"><span class="account-avatar"><i class="mdi mdi-wallet-outline" /></span><strong>{{ account.name }}</strong><b>{{ formatMoney(account.balance) }}</b><button class="icon-button danger-hover" title="حذف حساب" @click="removeRecord('accounts', account.id)"><i class="mdi mdi-trash-can-outline" /></button></div><p v-if="!data.accounts.length" class="empty-state">هنوز حسابی ثبت نکرده‌ای.</p></article>
          <article class="card"><div class="card-heading"><div><span class="card-icon amber"><i class="mdi mdi-handshake-outline" /></span><div><h3>بدهی‌ها و طلب‌ها</h3><p>مبلغ باقی‌مانده و موعد هر مورد</p></div></div><button class="button-soft compact" @click="openModal('debt')"><i class="mdi mdi-plus" /> ثبت مورد</button></div><div v-for="debt in data.debts" :key="debt.id" class="debt-row"><div class="debt-main"><div><strong>{{ debt.title }}</strong><small>{{ debt.person }} · {{ debt.direction }} · {{ debt.due }}</small></div><b>{{ formatMoney(Math.max(0, debt.total - debt.paid)) }}</b></div><div class="progress-track"><span class="green" :style="{ width: `${debt.total ? Math.min(100, debt.paid / debt.total * 100) : 0}%` }" /></div><div class="debt-actions"><small>پرداخت‌شده: {{ formatMoney(debt.paid) }} از {{ formatMoney(debt.total) }}</small><button v-if="debt.paid < debt.total" class="text-button" @click="registerDebtPayment(debt)">ثبت پرداخت</button><span v-else class="change-positive">تسویه شد</span><button class="icon-button danger-hover" title="حذف" @click="removeRecord('debts', debt.id)"><i class="mdi mdi-trash-can-outline" /></button></div></div><p v-if="!data.debts.length" class="empty-state">هنوز موردی ثبت نشده است.</p></article>
        </div>
        <article class="card transactions-card"><div class="card-heading"><div><span class="card-icon lilac"><i class="mdi mdi-swap-horizontal" /></span><div><h3>تراکنش‌های این ماه</h3><p>{{ fa(monthTransactions.length) }} تراکنش</p></div></div><div class="filter-group"><button :class="{ selected: transactionFilter === 'همه' }" @click="transactionFilter = 'همه'">همه</button><button :class="{ selected: transactionFilter === 'income' }" @click="transactionFilter = 'income'">درآمد</button><button :class="{ selected: transactionFilter === 'expense' }" @click="transactionFilter = 'expense'">خرج</button></div></div><div v-for="tx in visibleTransactions" :key="tx.id" class="transaction-row"><span class="transaction-symbol" :class="tx.type"><i class="mdi" :class="tx.type === 'income' ? 'mdi-arrow-bottom-left' : 'mdi-arrow-top-right'" /></span><div><strong>{{ tx.title }}</strong><small>{{ tx.category }} · {{ tx.date }}</small></div><b :class="tx.type">{{ tx.type === 'income' ? '+' : '−' }}{{ formatMoney(tx.amount) }}</b><button class="icon-button danger-hover" title="حذف" @click="removeRecord('transactions', tx.id)"><i class="mdi mdi-trash-can-outline" /></button></div><p v-if="!visibleTransactions.length" class="empty-state">تراکنشی برای این ماه و فیلتر انتخاب‌شده ثبت نشده است.</p></article>
      </section>

      <section v-else-if="activeView === 'notes'" class="notes-view"><div class="section-intro card"><div class="intro-icon lilac"><i class="mdi mdi-notebook-outline" /></div><div><h3>یادداشت روزانه، ژورنال هفته و جمع‌بندی ماه</h3><p>نوشته‌هایت را یک‌جا نگه دار و هر وقت خواستی برگرد و بخوان.</p></div><div class="filter-group"><button v-for="kind in ['همه', 'روزانه', 'هفتگی', 'ماهانه']" :key="kind" @click="setNoteFilter(kind)" :class="{ selected: noteFilter === kind }">{{ kind }}</button></div></div><article v-for="note in visibleNotes" :key="note.id" class="card note-card"><div class="note-card-head"><span class="card-icon lilac"><i class="mdi mdi-notebook-edit-outline" /></span><span class="note-kind">{{ note.kind }}</span><time>{{ note.date }}</time><span class="note-spacer" /><button class="icon-button" title="ویرایش" @click="openModal('note', note)"><i class="mdi mdi-pencil-outline" /></button><button class="icon-button danger-hover" title="حذف" @click="removeRecord('notes', note.id)"><i class="mdi mdi-trash-can-outline" /></button></div><h3>{{ note.title }}</h3><p>{{ note.body || 'هنوز نوشته‌ای ثبت نشده.' }}</p></article><p v-if="!visibleNotes.length" class="card empty-state">یادداشتی ثبت نشده است.</p></section>

      <section v-else-if="activeView === 'stats'" class="stats-view">
        <div class="metric-grid"><article class="metric-card"><span class="metric-icon mint"><i class="mdi mdi-calendar-check-outline" /></span><div><small>روزهای فعال</small><strong>{{ fa(activeDayCount) }} <em>روز</em></strong></div></article><article class="metric-card"><span class="metric-icon lilac"><i class="mdi mdi-clock-outline" /></span><div><small>زمان ثبت‌شده</small><strong>{{ formatDuration(totalElapsed) }} <em>ساعت</em></strong></div></article><article class="metric-card"><span class="metric-icon amber"><i class="mdi mdi-star-four-points-outline" /></span><div><small>XP کل</small><strong>{{ fa(totalXp) }} <em>XP</em></strong></div></article><article class="metric-card"><span class="metric-icon rose"><i class="mdi mdi-star-outline" /></span><div><small>میانگین ارزیابی</small><strong>{{ Object.values(data.ratings).length ? fa(Object.values(data.ratings).reduce((sum, rating) => sum + rating, 0) / Object.values(data.ratings).length) : '—' }} <em>از ۵</em></strong></div></article></div>
        <div class="two-column-grid"><article v-for="category in categories" :key="category" class="card stat-category"><div class="card-heading"><div><span class="card-icon mint"><i class="mdi mdi-chart-box-outline" /></span><div><h3>زمان ثبت‌شده · {{ category }}</h3><p>بر اساس زمان‌سنج کارها</p></div></div></div><div class="stat-summary"><strong>{{ formatDuration(categoryElapsed(category)) }}</strong><span>مجموع زمان</span></div><div v-if="categoryTasks(category).length" class="stats-bars"><span v-for="task in categoryTasks(category)" :key="task.id" :title="task.title" :style="{ height: `${Math.max(8, task.elapsed / categoryTasks(category)[0].elapsed * 100)}%` }" /></div><p v-else class="empty-state">زمانی برای این دسته ثبت نشده است.</p></article></div>
      </section>

      <section v-else-if="activeView === 'settings'" class="settings-view">
        <article class="card settings-card">
          <div class="card-heading">
            <div>
              <span class="card-icon lilac"><i class="mdi mdi-palette-outline" /></span>
              <div>
                <h3>ظاهر و تم پلنر</h3>
                <p>انتخاب تم و حالت رنگی متناسب با سلیقه شما</p>
              </div>
            </div>
          </div>
          <div class="setting-row">
            <div><strong>حالت رنگی</strong><small>روشن یا تیره</small></div>
            <div class="segmented">
              <button :class="{ selected: !data.settings.darkMode }" @click="data.settings.darkMode = false"><i class="mdi mdi-white-balance-sunny" /> روشن</button>
              <button :class="{ selected: data.settings.darkMode }" @click="data.settings.darkMode = true"><i class="mdi mdi-moon-waning-crescent" /> تیره</button>
            </div>
          </div>

          <!-- 5 Rich Color Themes -->
          <div class="theme-selection-block">
            <div class="theme-block-head">
              <strong>پالت‌های رنگی برنامه</strong>
              <small>یکی از ۵ تم زیر را انتخاب کنید تا حال‌وهوای پلنر تغییر کند</small>
            </div>
            <div class="theme-grid">
              <button
                v-for="item in availableThemes"
                :key="item.key"
                type="button"
                class="theme-card"
                :class="{ active: (data.settings.theme || 'emerald') === item.key }"
                @click="setTheme(item.key)"
              >
                <div class="theme-swatch">
                  <span class="swatch-bubble main" :style="{ background: item.primary }" />
                  <span class="swatch-bubble secondary" :style="{ background: item.secondary }" />
                  <span class="swatch-bubble accent" :style="{ background: item.accent }" />
                </div>
                <div class="theme-info">
                  <strong class="theme-title">
                    <i class="mdi" :class="item.icon" />
                    {{ item.name }}
                  </strong>
                  <span class="theme-desc">{{ item.description }}</span>
                </div>
                <i class="mdi theme-active-badge" :class="(data.settings.theme || 'emerald') === item.key ? 'mdi-check-circle' : 'mdi-circle-outline'" />
              </button>
            </div>
          </div>
        </article>

        <article class="card settings-card">
          <div class="card-heading">
            <div>
              <span class="card-icon mint"><i class="mdi mdi-shape-outline" /></span>
              <div>
                <h3>دسته‌بندی‌ها</h3>
                <p>کارها و آمار را مطابق سلیقه‌ات دسته‌بندی کن.</p>
              </div>
            </div>
            <button class="button-soft compact" @click="notify('دسته‌ی جدید آماده‌ی اضافه شدن است.')"><i class="mdi mdi-plus" /> دسته جدید</button>
          </div>
          <div v-for="(category, index) in categories" :key="category" class="category-setting">
            <span class="category-dot" :class="`dot-${index % 5}`" />
            <strong>{{ category }}</strong>
            <span class="note-spacer" />
            <button class="icon-button" title="نمایش در آمار" @click="data.settings.streakCategory = category"><i class="mdi mdi-chart-box-outline" /></button>
          </div>
        </article>

        <article class="card settings-card">
          <div class="card-heading">
            <div>
              <span class="card-icon amber"><i class="mdi mdi-star-four-points-outline" /></span>
              <div>
                <h3>تنظیمات XP</h3>
                <p>میزان امتیازی که از هر کار می‌گیری.</p>
              </div>
            </div>
          </div>
          <div class="setting-row">
            <div><strong>حالت محاسبه XP</strong><small>روش محاسبه‌ی امتیازها</small></div>
            <select v-model="data.settings.xpMode">
              <option>واقعی + بونوس</option>
              <option>سختگیر</option>
              <option>ساده — XP کامل اگه تیک خورده</option>
            </select>
          </div>
        </article>

        <article class="card settings-card">
          <div class="card-heading">
            <div>
              <span class="card-icon green"><i class="mdi mdi-database-arrow-down-outline" /></span>
              <div>
                <h3>پشتیبان‌گیری</h3>
                <p>یک نسخه از اطلاعاتت روی دستگاهت بگیر یا بازیابی کن.</p>
              </div>
            </div>
          </div>
          <div class="backup-actions">
            <button class="button-primary" @click="exportBackup"><i class="mdi mdi-download-outline" /> خروجی JSON</button>
            <button class="button-soft" @click="openBackup"><i class="mdi mdi-upload-outline" /> بازیابی JSON</button>
            <input ref="backupInput" class="hidden-input" type="file" accept="application/json,.json" @change="importBackup" />
          </div>
        </article>
      </section>

      <section v-else-if="activeView === 'workspace'" class="workspace-view">
        <div class="section-intro card"><span class="workspace-intro-icon"><i class="mdi" :class="selectedWorkspaceModule.icon" /></span><div><h3>{{ selectedWorkspaceModule.title }}</h3><p>{{ selectedWorkspaceModule.description }}</p></div><span class="soft-count">{{ fa(currentWorkspaceRecords.length) }} مورد ثبت‌شده</span></div>
        <div class="workspace-summary-grid"><article class="card workspace-summary"><span class="metric-icon mint"><i class="mdi mdi-chart-box-outline" /></span><div><small>{{ selectedWorkspaceModule.metric ? `مجموع ${selectedWorkspaceModule.unit}` : 'موردهای ثبت‌شده' }}</small><strong>{{ fa(workspaceMetricTotal) }} <em>{{ selectedWorkspaceModule.metric ? selectedWorkspaceModule.unit : 'مورد' }}</em></strong></div><div v-if="workspaceTarget" class="workspace-goal"><div class="progress-track"><span class="green" :style="{ width: `${workspaceProgress}%` }" /></div><small>{{ fa(workspaceMetricTotal) }} از {{ fa(workspaceTarget) }} · {{ fa(workspaceProgress) }}٪</small></div></article><article class="card workspace-summary"><span class="metric-icon amber"><i class="mdi mdi-calendar-clock-outline" /></span><div><small>موعدهای نزدیک</small><strong>{{ fa(currentWorkspaceRecords.filter((item) => item.due).length) }} <em>مورد</em></strong></div><small class="muted">برای مرور و پیگیری</small></article><label v-if="selectedModuleId === 'water'" class="card goal-setting"><span><i class="mdi mdi-cup-water" /> هدف آب روزانه</span><div><input v-model.number="data.settings.waterGoal" type="number" min="250" step="250" /><small>میلی‌لیتر</small></div></label><label v-if="selectedModuleId === 'calories'" class="card goal-setting"><span><i class="mdi mdi-food-apple-outline" /> هدف کالری روزانه</span><div><input v-model.number="data.settings.calorieGoal" type="number" min="500" step="100" /><small>کیلوکالری</small></div></label></div>
        <article v-if="selectedModuleId === 'water'" class="card health-quick-panel"><div class="card-heading"><div><span class="card-icon mint"><i class="mdi mdi-water-outline" /></span><div><h3>ثبت سریع آب</h3><p>یک میانبر بزن تا به مجموع امروز اضافه شود.</p></div></div></div><div class="quick-choice-row"><button class="button-soft" @click="addWater(250)"><i class="mdi mdi-cup-outline" /> یک لیوان · ۲۵۰</button><button class="button-soft" @click="addWater(330)"><i class="mdi mdi-bottle-soda-outline" /> بطری کوچک · ۳۳۰</button><button class="button-soft" @click="addWater(500)"><i class="mdi mdi-bottle-soda-classic-outline" /> بطری · ۵۰۰</button><button class="button-primary" @click="openWorkspaceModal('water')"><i class="mdi mdi-plus" /> مقدار دلخواه</button></div></article>
        <article v-if="selectedModuleId === 'mood'" class="card health-quick-panel"><div class="card-heading"><div><span class="card-icon lilac"><i class="mdi mdi-emoticon-happy-outline" /></span><div><h3>ثبت حال امروز</h3><p>بدون قضاوت، فقط حال الان را ثبت کن.</p></div></div></div><div class="mood-choices"><button v-for="score in [1, 2, 3, 4, 5]" :key="score" class="mood-choice" @click="logQuickMood(score)"><span>{{ ['😣', '😕', '😐', '🙂', '😊'][score - 1] }}</span><small>{{ ['سخت', 'کم‌انرژی', 'معمولی', 'خوب', 'عالی'][score - 1] }}</small></button></div></article>
        <article v-if="selectedModuleId === 'leitner' || selectedModuleId === 'spaced'" class="card flashcard-review"><div class="card-heading"><div><span class="card-icon lilac"><i class="mdi mdi-cards-outline" /></span><div><h3>مرور امروز</h3><p>{{ fa(dueFlashcards.filter((card) => card.moduleId === selectedModuleId).length) }} کارت موعددار</p></div></div></div><div v-if="nextFlashcard" class="flashcard-face"><small>{{ nextFlashcard.category || selectedWorkspaceModule.title }}</small><h3>{{ nextFlashcard.front || nextFlashcard.title }}</h3><div v-if="revealedFlashcardId === nextFlashcard.id" class="flashcard-answer"><span>پاسخ</span><p>{{ nextFlashcard.back }}</p></div><button v-else class="button-soft" @click="revealFlashcard(nextFlashcard)"><i class="mdi mdi-eye-outline" /> دیدن پاسخ</button><div v-if="revealedFlashcardId === nextFlashcard.id" class="review-actions"><button class="review-again" @click="reviewFlashcard(nextFlashcard, 'again')">دوباره · فردا</button><button class="review-good" @click="reviewFlashcard(nextFlashcard, 'good')">بلدم · فاصله بیشتر</button><button class="review-easy" @click="reviewFlashcard(nextFlashcard, 'easy')">آسان بود</button></div></div><div v-else class="flashcard-empty"><i class="mdi mdi-check-decagram-outline" /><strong>مرور امروز تمام شد</strong><p>کارت تازه بساز یا به روز دیگری برگرد.</p></div></article>
        <article class="card workspace-record-list"><div class="card-heading"><div><span class="card-icon green"><i class="mdi" :class="selectedWorkspaceModule.icon" /></span><div><h3>{{ selectedWorkspaceModule.title }}</h3><p>برای تغییر هر مورد از دکمه‌ی ویرایش استفاده کن.</p></div></div><button class="button-soft compact" @click="openWorkspaceModal()"><i class="mdi mdi-plus" /> ثبت مورد</button></div><div v-if="currentWorkspaceRecords.length" class="workspace-record-grid"><article v-for="record in currentWorkspaceRecords" :key="record.id" class="workspace-record"><div class="workspace-record-head"><span class="workspace-record-dot"><i class="mdi" :class="selectedWorkspaceModule.icon" /></span><div><span v-if="record.category" class="record-category">{{ record.category }}</span><h4>{{ record.title }}</h4></div><span v-if="record.status" class="record-status">{{ record.status }}</span></div><div v-if="selectedModuleId === 'leitner' || selectedModuleId === 'spaced'" class="workspace-flashcard-details"><p><b>پرسش:</b> {{ record.front }}</p><details v-if="record.back"><summary>نمایش پاسخ</summary><p>{{ record.back }}</p></details><small>مرور بعدی: {{ workspaceDateLabel(record.due) }} · فاصله {{ fa(record.interval) }} روز · {{ fa(record.secondary) }} مرور</small></div><div v-else class="workspace-record-content"><p v-if="record.person"><i class="mdi mdi-account-outline" /> {{ record.person }}</p><p v-if="record.date"><i class="mdi mdi-calendar-outline" /> {{ workspaceDateLabel(record.date) }}<span v-if="record.due"> · موعد {{ workspaceDateLabel(record.due) }}</span></p><p v-if="record.amount"><i class="mdi mdi-counter" /> {{ fa(record.amount) }} <span>{{ selectedWorkspaceModule.metric === 'amount' ? selectedWorkspaceModule.unit : '' }}</span></p><p v-if="record.secondary"><i class="mdi mdi-chart-line" /> {{ fa(record.secondary) }} <span>{{ selectedWorkspaceModule.metric === 'secondary' ? selectedWorkspaceModule.unit : '' }}</span></p><p v-if="record.category && !['leitner', 'spaced'].includes(record.moduleId)"><i class="mdi mdi-tag-outline" /> {{ record.category }}</p><p v-if="record.notes" class="record-note">{{ record.notes }}</p></div><div class="workspace-record-actions"><button class="text-button" @click="openWorkspaceModal(selectedModuleId, record)"><i class="mdi mdi-pencil-outline" /> ویرایش</button><button class="icon-button danger-hover" title="حذف" @click="removeRecord('workspaceRecords', record.id)"><i class="mdi mdi-trash-can-outline" /></button></div></article></div><p v-else class="empty-state">هنوز موردی ثبت نکرده‌ای. از «ثبت مورد» شروع کن.</p></article>
      </section>
    </main>

    <!-- Mobile Bottom Navigation Bar -->
    <nav class="mobile-bottom-nav" aria-label="میانبرهای پلنر">
      <button
        v-for="item in mobileQuickItems"
        :key="item.key"
        class="mobile-nav-item"
        :class="{ active: activeView === item.key && !mobileSectionsOpen }"
        :aria-current="activeView === item.key && !mobileSectionsOpen ? 'page' : undefined"
        @click="selectMobileNav(item)"
      >
        <span class="mobile-nav-icon-wrap">
          <i class="mdi" :class="item.icon" aria-hidden="true" />
        </span>
        <span>{{ item.label }}</span>
      </button>
      <button
        class="mobile-nav-item"
        :class="{ active: mobileSectionsOpen || !mobileQuickItems.some((item) => item.key === activeView) }"
        :aria-expanded="mobileSectionsOpen"
        aria-controls="mobile-sections-sheet"
        @click="mobileSectionsOpen = !mobileSectionsOpen; (document.activeElement as HTMLElement)?.blur()"
      >
        <span class="mobile-nav-icon-wrap">
          <i class="mdi mdi-apps" aria-hidden="true" />
        </span>
        <span>بخش‌ها</span>
      </button>
    </nav>

    <!-- Mobile Full Sections Bottom Sheet -->
    <div v-if="mobileSectionsOpen" class="mobile-menu-backdrop" @click.self="mobileSectionsOpen = false">
      <section id="mobile-sections-sheet" class="mobile-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-sections-title">
        <div class="mobile-menu-grabber" aria-hidden="true" />
        <header class="mobile-menu-sheet-head">
          <div><small>همهٔ امکانات و ماژول‌ها</small><h2 id="mobile-sections-title">بخش‌های پلنر</h2></div>
          <div class="sheet-head-actions">
            <button class="sheet-theme-btn" :title="data.settings.darkMode ? 'تم روشن' : 'تم تیره'" @click="toggleDarkMode">
              <i class="mdi" :class="data.settings.darkMode ? 'mdi-white-balance-sunny' : 'mdi-moon-waning-crescent'" />
              <span>{{ data.settings.darkMode ? 'روشن' : 'تیره' }}</span>
            </button>
            <button class="icon-button" aria-label="بستن منوی بخش‌ها" @click="mobileSectionsOpen = false"><i class="mdi mdi-close" /></button>
          </div>
        </header>

        <!-- Quick filter inside sheet -->
        <div class="sheet-search-wrap">
          <i class="mdi mdi-magnify" />
          <input v-model="sectionFilterQuery" type="search" placeholder="جست‌وجوی بخش‌ها..." />
          <button v-if="sectionFilterQuery" class="sheet-clear-btn" @click="sectionFilterQuery = ''"><i class="mdi mdi-close-circle" /></button>
        </div>

        <!-- Quick Tool Chips -->
        <div class="sheet-quick-chips">
          <button v-for="chip in quickToolChips" :key="chip.moduleId ?? chip.key" class="sheet-chip" :class="{ active: activeView === chip.key && (!chip.moduleId || chip.moduleId === selectedModuleId) }" @click="selectMobileNav(chip)">
            <i class="mdi" :class="chip.icon" />
            <span>{{ chip.label }}</span>
          </button>
        </div>

        <!-- Grouped Accordions with Count Badge -->
        <div class="mobile-menu-groups">
          <details v-for="group in filteredNavGroups" :key="group.label" :open="activeNavGroup(group) || Boolean(sectionFilterQuery)" name="mobile-nav-sections" class="mobile-menu-group">
            <summary :class="{ active: activeNavGroup(group) }">
              <i class="mdi group-icon" :class="group.icon" aria-hidden="true" />
              <span>{{ group.label }}</span>
              <span class="group-count">{{ group.items.length }} مورد</span>
              <i class="mdi mdi-chevron-down group-chevron" aria-hidden="true" />
            </summary>
            <div class="mobile-menu-list">
              <button v-for="item in group.items" :key="item.moduleId ?? item.key" class="mobile-menu-item" :class="{ active: activeView === item.key && (!item.moduleId || item.moduleId === selectedModuleId) }" @click="selectMobileNav(item)">
                <i class="mdi" :class="item.icon" aria-hidden="true" /><span>{{ item.label }}</span><i v-if="activeView === item.key && (!item.moduleId || item.moduleId === selectedModuleId)" class="mdi mdi-check menu-item-check" aria-hidden="true" />
              </button>
            </div>
          </details>
        </div>
      </section>
    </div>

    <button class="pomodoro-fab" aria-label="تایمر پومودورو" @click="pomoOpen = true"><i class="mdi mdi-timer-sand" /></button>
    <div v-if="toastMessage" class="toast-message"><i class="mdi mdi-check-circle-outline" /> {{ toastMessage }}</div>

    <div v-if="modalKind" class="modal-backdrop" @click.self="closeModal" @keydown.esc="closeModal">
      <form class="modal-card" @submit.prevent="saveModal">
        <div class="modal-header"><div><span class="modal-kicker">پلنر شخصی</span><h2>{{ modalTitle }}</h2></div><button type="button" class="icon-button" aria-label="بستن" @click="closeModal"><i class="mdi mdi-close" /></button></div>
        <label v-if="modalKind !== 'income' && modalKind !== 'expense' && modalKind !== 'workspace'" class="form-field"><span>{{ modalKind === 'note' ? 'عنوان یادداشت' : 'عنوان' }}</span><input v-model="form.title" autofocus :placeholder="modalKind === 'goal' ? 'مثلاً یادگیری زبان انگلیسی' : 'عنوان را بنویس...'" /></label>
        <label v-if="modalKind === 'task' || modalKind === 'habit' || modalKind === 'library'" class="form-field"><span>توضیحات</span><textarea v-model="form.description" rows="2" placeholder="چیزی که دوست داری یادت بماند..." /></label>
        <div v-if="modalKind === 'task'" class="form-grid"><label class="form-field"><span>دسته‌بندی</span><select v-model="form.category"><option v-for="category in categories" :key="category">{{ category }}</option></select></label><label class="form-field"><span>اولویت</span><select v-model="form.priority"><option value="none">بدون اولویت</option><option value="important">مهم</option><option value="medium">متوسط</option><option value="low">کم</option></select></label><label class="form-field"><span>تکرار</span><select v-model="form.repeat"><option value="daily">هر روز</option><option value="weekly">هفتگی</option><option value="once">فقط یک‌بار</option></select></label><label class="form-field"><span>زمان · دقیقه</span><input v-model.number="form.minutes" min="0" type="number" /></label><label class="form-field"><span>XP</span><input v-model.number="form.xp" min="0" type="number" /></label></div>
        <div v-if="modalKind === 'goal'" class="form-grid"><label class="form-field"><span>مدت هدف</span><select v-model="form.goalType"><option>کوتاه‌مدت</option><option>بلندمدت</option><option>ماهانه</option></select></label><label class="form-field"><span>نتیجه‌ی دلخواه</span><input v-model="form.target" placeholder="مثلاً نمره‌ی ۷" /></label><label class="form-field full-field"><span>مهلت (تقویم شمسی)</span><PersianDatePicker v-model="form.deadline" format="shamsi" placeholder="انتخاب تاریخ مهلت..." /></label></div>
        <label v-if="modalKind === 'library'" class="form-field"><span>نوع</span><select v-model="form.type"><option>کتاب</option><option>پادکست</option><option>فیلم</option></select></label>
        <div v-if="modalKind === 'income' || modalKind === 'expense'" class="form-grid"><label class="form-field"><span>عنوان</span><input v-model="form.title" placeholder="مثلاً حقوق یا خرید خانه" /></label><label class="form-field"><span>مبلغ · تومان</span><input v-model.number="form.amount" min="0" type="number" /></label><label class="form-field full-field"><span>دسته‌بندی</span><select v-model="form.category"><option v-for="category in ['حقوق', 'اجاره', 'خوراک', 'حمل‌ونقل', 'تفریح', ...categories]" :key="category">{{ category }}</option></select></label></div>
        <div v-if="modalKind === 'account'" class="form-grid"><label class="form-field"><span>نام حساب</span><input v-model="form.title" placeholder="مثلاً حساب اصلی" /></label><label class="form-field"><span>موجودی فعلی · تومان</span><input v-model.number="form.amount" min="0" type="number" /></label></div>
        <div v-if="modalKind === 'debt'" class="form-grid"><label class="form-field"><span>عنوان</span><input v-model="form.title" placeholder="مثلاً قرض ماشین" /></label><label class="form-field"><span>مبلغ کل · تومان</span><input v-model.number="form.amount" min="0" type="number" /></label><label class="form-field"><span>نام شخص</span><input v-model="form.person" placeholder="نام یا یادداشت" /></label><label class="form-field"><span>وضعیت</span><select v-model="form.direction"><option>من بدهکارم</option><option>من طلب دارم</option></select></label><label class="form-field full-field"><span>موعد (تقویم شمسی)</span><PersianDatePicker v-model="form.due" format="shamsi" placeholder="انتخاب تاریخ موعد..." /></label></div>
        <template v-if="modalKind === 'workspace'"><label class="form-field"><span>عنوان / نام</span><input v-model="workspaceForm.title" autofocus placeholder="عنوان این مورد را بنویس..." /></label><div class="form-grid"><label v-for="item in selectedWorkspaceModule.fields" :key="item.key" class="form-field" :class="{ 'full-field': item.type === 'textarea' || item.type === 'date' }"><span>{{ item.label }} <small v-if="item.unit">· {{ item.unit }}</small></span><textarea v-if="item.type === 'textarea'" v-model="workspaceForm[item.key]" rows="3" /><select v-else-if="item.type === 'select'" v-model="workspaceForm[item.key]"><option value="">انتخاب کن</option><option v-for="option in item.options" :key="option" :value="option">{{ option }}</option></select><input v-else-if="item.type === 'number'" v-model.number="workspaceForm[item.key]" type="number" min="0" step="any" /><PersianDatePicker v-else-if="item.type === 'date'" v-model="workspaceForm[item.key]" :placeholder="`انتخاب ${item.label}...`" /><input v-else v-model="workspaceForm[item.key]" :type="item.type" /></label></div></template>
        <div v-if="modalKind === 'note'" class="form-grid"><label class="form-field"><span>نوع نوشته</span><select v-model="form.kind"><option>روزانه</option><option>هفتگی</option><option>ماهانه</option></select></label><label class="form-field full-field"><span>متن</span><textarea v-model="form.body" rows="5" placeholder="هر چیزی که می‌خواهی برای خودت ثبت کنی..." /></label></div>
        <div class="modal-actions"><button type="button" class="button-soft" @click="closeModal">انصراف</button><button class="button-primary" type="submit"><i class="mdi mdi-check" /> ذخیره</button></div>
      </form>
    </div>
    <!-- Pomodoro Floating Dialog -->
    <div v-if="pomoOpen" class="modal-backdrop pomo-backdrop" @click.self="closePomodoro" @keydown.esc="closePomodoro">
      <section class="modal-card pomo-modal" role="dialog" aria-modal="true" aria-labelledby="pomo-title">
        <div class="modal-header">
          <div>
            <span class="modal-kicker"><i class="mdi mdi-fire" /> تمرکز عمیق، نتیجه عالی</span>
            <h2 id="pomo-title">تایمر پومودورو</h2>
          </div>
          <button type="button" class="icon-button" aria-label="بستن" @click="closePomodoro"><i class="mdi mdi-close" /></button>
        </div>

        <div class="pomo-presets">
          <button type="button" class="pomo-preset-btn" :class="{ active: pomoMode === 'work' }" @click="setPomoMode('work')">۲۵ دقیقه کار</button>
          <button type="button" class="pomo-preset-btn" :class="{ active: pomoMode === 'shortBreak' }" @click="setPomoMode('shortBreak')">۵ دقیقه استراحت</button>
          <button type="button" class="pomo-preset-btn" :class="{ active: pomoMode === 'longBreak' }" @click="setPomoMode('longBreak')">۱۵ دقیقه بلند</button>
          <button type="button" class="pomo-preset-btn" :class="{ active: pomoMode === 'deep' }" @click="setPomoMode('deep')">۵۰ دقیقه عمیق</button>
        </div>

        <div class="pomo-clock-wrap">
          <div class="pomo-dial" :class="{ 'is-running': pomoRunning }">
            <svg class="pomo-svg" viewBox="0 0 160 160">
              <circle class="pomo-svg-bg" cx="80" cy="80" r="70" />
              <circle
                class="pomo-svg-progress"
                cx="80"
                cy="80"
                r="70"
                :style="{
                  strokeDasharray: 440,
                  strokeDashoffset: 440 - (440 * (pomoTotalSeconds - pomoSeconds)) / Math.max(1, pomoTotalSeconds)
                }"
              />
            </svg>
            <div class="pomo-dial-content">
              <i class="mdi mdi-timer-sand" :class="{ 'is-ticking': pomoRunning }" />
              <strong class="pomo-digits">{{ pomoLabel }}</strong>
              <small class="pomo-sub">{{ pomoRunning ? 'در حال اجرا...' : 'آماده تمرکز' }}</small>
            </div>
          </div>
        </div>

        <div class="pomo-actions">
          <button type="button" class="pomo-reset-btn" @click="resetPomo">
            <i class="mdi mdi-restart" /> شروع دوباره
          </button>
          <button type="button" class="pomo-toggle-btn" @click="togglePomodoro">
            <i class="mdi" :class="pomoRunning ? 'mdi-pause' : 'mdi-play'" />
            <span>{{ pomoRunning ? 'مکث' : 'شروع تمرکز' }}</span>
          </button>
        </div>
      </section>
    </div>
    <footer class="planner-footer"><span>پلنر شخصی</span></footer>
  </div>
</template>
