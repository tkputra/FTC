/**
 * FTC Automated Court Booking Bot (Google Calendar Appointments)
 * Target URL: https://calendar.app.google/iueH4Lnt6qsCgVmZ6
 * Multi-Person Round-Robin Support
 */

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

// Supabase Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xdrsowoekbqalkonezcw.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5486NL5JTIMKrmB-hxNv_Q_eF1bx5qa';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TARGET_URL = 'https://calendar.app.google/iueH4Lnt6qsCgVmZ6';

// Fallback Preferences
const DEFAULT_FIRST_NAME = 'Tri';
const DEFAULT_LAST_NAME = 'Putra';
const DEFAULT_EMAIL_PREFIX = 'tri.kartika.putra';
const DEFAULT_EMAIL_DOMAIN = 'gmail.com';
const DEFAULT_ADDRESS = 'Fortune spring Blok D2 - J05';
const DEFAULT_PHONE = '08111819112';

// Allowed Days: Mon - Thu only (Exclude Fri, Sat, Sun)
const IGNORED_DAYS = ['fri', 'sat', 'sun', 'jumat', 'sabtu', 'minggu', 'friday', 'saturday', 'sunday', 'jum', 'sab', 'min'];

// Target Hours (Exact Match Only: 6am, 7am, 8am, 9am, 4pm, 5pm, 6pm, 7pm)
const VALID_HOURS = [
  '06:00', '6:00', '6:00am', '06:00am',
  '07:00', '7:00', '7:00am', '07:00am',
  '08:00', '8:00', '8:00am', '08:00am',
  '09:00', '9:00', '9:00am', '09:00am',
  '16:00', '4:00pm', '04:00pm',
  '17:00', '5:00pm', '05:00pm',
  '18:00', '6:00pm', '06:00pm',
  '19:00', '7:00pm', '07:00pm'
];

function isTargetTime(timeStr) {
  const clean = timeStr.trim().toLowerCase().replace(/\s+/g, '');
  return VALID_HOURS.some(v => clean === v || clean.startsWith(v + '–') || clean.startsWith(v + '-'));
}

function isIgnoredDay(dayStr) {
  const clean = dayStr.trim().toLowerCase();
  return IGNORED_DAYS.some(d => clean.includes(d));
}

async function getMasterSettings() {
  try {
    const { data } = await supabase
      .from('court_booking_settings')
      .select('*')
      .eq('id', 1)
      .single();

    return data || { is_active: true };
  } catch (err) {
    return { is_active: true };
  }
}

/**
 * Gets the next booking account in round-robin order.
 * Priority: is_active = true, ORDER BY last_booked_at ASC NULLS FIRST
 */
async function getNextBookingAccount() {
  try {
    const { data, error } = await supabase
      .from('booking_accounts')
      .select('*')
      .eq('is_active', true)
      .order('last_booked_at', { ascending: true, nullsFirst: true })
      .limit(1);

    if (error || !data || data.length === 0) {
      console.log('No active booking accounts in booking_accounts table. Using default fallback.');
      return {
        id: null,
        first_name: DEFAULT_FIRST_NAME,
        last_name: DEFAULT_LAST_NAME,
        email_prefix: DEFAULT_EMAIL_PREFIX,
        email_domain: DEFAULT_EMAIL_DOMAIN,
        current_email_index: 4,
        address: DEFAULT_ADDRESS,
        phone: DEFAULT_PHONE
      };
    }

    return data[0];
  } catch (err) {
    console.warn('Could not fetch account from booking_accounts, using default:', err.message);
    return {
      id: null,
      first_name: DEFAULT_FIRST_NAME,
      last_name: DEFAULT_LAST_NAME,
      email_prefix: DEFAULT_EMAIL_PREFIX,
      email_domain: DEFAULT_EMAIL_DOMAIN,
      current_email_index: 4,
      address: DEFAULT_ADDRESS,
      phone: DEFAULT_PHONE
    };
  }
}

async function updateCheckStatus(status, message) {
  try {
    await supabase
      .from('court_booking_settings')
      .update({
        last_check_at: new Date().toISOString(),
        last_check_status: status,
        last_check_message: message,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);
  } catch (err) {
    console.error('Failed to update status in Supabase:', err.message);
  }
}

async function recordSuccessfulBooking(date, time, dayName, email, account) {
  try {
    // 1. Insert into booked_courts
    const { error: insertError } = await supabase
      .from('booked_courts')
      .insert([{
        booking_date: date,
        booking_time: time,
        day_name: dayName,
        booked_email: email,
        first_name: account.first_name,
        last_name: account.last_name,
        phone: account.phone,
        status: 'confirmed',
        notes: `Auto-booked via Bot for ${account.first_name} ${account.last_name} on ${new Date().toLocaleString('id-ID')}`
      }]);

    if (insertError) console.error('Error recording booking:', insertError.message);

    // 2. Increment account's email index & update last_booked_at in booking_accounts
    const nextIndex = (account.current_email_index || 1) + 1;
    const newTotal = (account.total_bookings || 0) + 1;

    if (account.id) {
      await supabase
        .from('booking_accounts')
        .update({
          current_email_index: nextIndex,
          total_bookings: newTotal,
          last_booked_at: new Date().toISOString()
        })
        .eq('id', account.id);

      console.log(`[ACCOUNT_UPDATED] ${account.first_name} ${account.last_name} next index: +${nextIndex}, total bookings: ${newTotal}`);
    }

    // 3. Update master settings log
    await supabase
      .from('court_booking_settings')
      .update({
        last_check_at: new Date().toISOString(),
        last_check_status: 'booked',
        last_check_message: `Berhasil booking ${dayName || ''} ${date} (${time}) atas nama ${account.first_name} ${account.last_name} (${email})`,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    console.log(`[SUCCESS] Booking successfully recorded & round-robin rotation shifted!`);
  } catch (err) {
    console.error('Failed to record successful booking:', err.message);
  }
}

async function runAutoBooking() {
  console.log(`[START] FTC Court Auto-Booking Bot (Multi-Person) @ ${new Date().toISOString()}`);
  
  const masterSettings = await getMasterSettings();
  if (masterSettings.is_active === false) {
    console.log('[INFO] Auto-booking is currently disabled in master settings. Skipping.');
    return;
  }

  // Get current round-robin account
  const account = await getNextBookingAccount();
  const currentEmail = `${account.email_prefix}+${account.current_email_index || 1}@${account.email_domain || 'gmail.com'}`;
  
  console.log(`[ROBIN_TURN] Next in line: ${account.first_name} ${account.last_name} (${currentEmail})`);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ],
      ignoreDefaultArgs: ['--enable-automation']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
      viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();

    // Stealth: Remove webdriver flag to bypass invisible reCAPTCHA
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    console.log(`[NAVIGATE] Opening ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const allButtons = await page.$$('button');
    let candidateSlot = null;
    let candidateDate = '';
    let candidateTime = '';
    let candidateDay = '';

    console.log(`[INFO] Scanning calendar days and slots...`);

    // Find first valid slot matching target hours (6-9am, 4-7pm) on Mon-Thu
    for (let i = 0; i < allButtons.length; i++) {
      const btn = allButtons[i];
      const text = (await btn.innerText()).trim();
      const ariaLabel = (await btn.getAttribute('aria-label')) || '';
      const combinedInfo = `${text} ${ariaLabel}`;

      if (isTargetTime(text) || isTargetTime(ariaLabel)) {
        // Check day: Must NOT be Friday, Saturday, Sunday
        if (!isIgnoredDay(combinedInfo)) {
          console.log(`[MATCH] Found target slot: "${text}" (${ariaLabel})`);
          candidateSlot = btn;
          candidateTime = text;
          candidateDate = ariaLabel || text;
          break;
        } else {
          console.log(`[IGNORE] Slot "${text}" is on weekend/Friday (${combinedInfo}). Skipping.`);
        }
      }
    }

    if (!candidateSlot) {
      const msg = `Pengecekan selesai pada ${new Date().toLocaleTimeString('id-ID')}. Belum ada slot target (06-09 AM, 04-07 PM Sen-Kam) yang tersedia.`;
      console.log(`[NO_SLOT] ${msg}`);
      await updateCheckStatus('no_slots', msg);
      return;
    }

    // Click candidate slot to open modal
    console.log(`[ACTION] Clicking slot button: ${candidateTime}...`);
    await candidateSlot.click();
    await page.waitForTimeout(2000);

    // Fill form inputs in modal with realistic human-like typing
    console.log(`[ACTION] Filling booking form for ${account.first_name} ${account.last_name} with email: ${currentEmail}...`);

    // 1. First Name (First visible text input)
    const firstNameInput = page.locator('input[type="text"]:visible').first();
    await firstNameInput.click();
    await firstNameInput.pressSequentially(account.first_name || DEFAULT_FIRST_NAME, { delay: 40 });

    // 2. Last Name (Second visible text input)
    const lastNameInput = page.locator('input[type="text"]:visible').nth(1);
    await lastNameInput.click();
    await lastNameInput.pressSequentially(account.last_name || DEFAULT_LAST_NAME, { delay: 40 });

    // 3. Email Address
    const emailInput = page.locator('input[type="email"]:visible').first();
    await emailInput.click();
    await emailInput.pressSequentially(currentEmail, { delay: 40 });

    // 4. Custom field: Alamat Fortune dengan no Blok (First visible textarea)
    const addressInput = page.locator('textarea:visible').first();
    await addressInput.click();
    await addressInput.pressSequentially(account.address || DEFAULT_ADDRESS, { delay: 40 });

    // 5. Custom field: Nomor Whatsapp Aktif (Second visible textarea)
    const phoneInput = page.locator('textarea:visible').nth(1);
    await phoneInput.click();
    await phoneInput.pressSequentially(account.phone || DEFAULT_PHONE, { delay: 40 });

    await page.waitForTimeout(1000);

    // Click "Reservasi" / "Book" button
    console.log('[ACTION] Clicking "Reservasi" / "Book" button...');
    const bookButton = page.locator('button:has-text("Reservasi"), button:has-text("Book"), button:has-text("Pesan"), button:has-text("Jadwalkan")').first();
    await bookButton.click();

    // Wait for confirmation screen
    console.log('[WAIT] Waiting for booking confirmation...');
    await page.waitForSelector('button:has-text("Tutup"), button:has-text("Close"), text=/Perlu melakukan perubahan|Need to change|Batalkan janji temu/i', { timeout: 20000 });

    console.log('[CONFIRMED] Booking confirmed successfully by Google Calendar!');

    // Record to database and rotate account
    await recordSuccessfulBooking(candidateDate, candidateTime, candidateDay, currentEmail, account);

  } catch (err) {
    console.error('[ERROR] Automation error during execution:', err);
    await updateCheckStatus('error', `Error: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log(`[DONE] Finished auto-booking run.`);
  }
}

// Execute if run directly
if (require.main === module) {
  runAutoBooking();
}

module.exports = { runAutoBooking };
