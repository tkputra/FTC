/**
 * FTC Automated Court Booking Bot (Google Calendar Appointments)
 * Target URL: https://calendar.app.google/iueH4Lnt6qsCgVmZ6
 * Multi-Person Round-Robin Support (Clean Direct Email, Multi-Slot Booking)
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
const DEFAULT_EMAIL = 'tri.kartika.putra@gmail.com';
const DEFAULT_ADDRESS = 'Fortune spring Blok D2 - J05';
const DEFAULT_PHONE = '08111819112';

// Allowed Days: Mon - Thu only (Exclude Fri, Sat, Sun)
const IGNORED_DAYS = ['fri', 'sat', 'sun', 'jumat', 'sabtu', 'minggu', 'friday', 'saturday', 'sunday', 'jum', 'sab', 'min'];

// Target Hours (Standard 8 Slots: 6am, 7am, 8am, 9am, 4pm, 5pm, 6pm, 7pm)
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

function getAccountEmail(account) {
  if (account.email && account.email.includes('@')) {
    return account.email.trim();
  }
  if (account.email_prefix) {
    if (account.email_prefix.includes('@')) return account.email_prefix.trim();
    return `${account.email_prefix.trim()}@${account.email_domain || 'gmail.com'}`;
  }
  return DEFAULT_EMAIL;
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
        email: DEFAULT_EMAIL,
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
      email: DEFAULT_EMAIL,
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
        notes: `Auto-booked via Bot for ${account.first_name} ${account.last_name} (${email}) on ${new Date().toLocaleString('id-ID')}`
      }]);

    if (insertError) console.error('Error recording booking:', insertError.message);

    // 2. Update total_bookings and last_booked_at in booking_accounts
    const newTotal = (account.total_bookings || 0) + 1;

    if (account.id) {
      await supabase
        .from('booking_accounts')
        .update({
          total_bookings: newTotal,
          last_booked_at: new Date().toISOString()
        })
        .eq('id', account.id);

      console.log(`[ACCOUNT_UPDATED] ${account.first_name} ${account.last_name} (${email}) total bookings: ${newTotal}`);
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

    console.log(`[SUCCESS] Booking successfully recorded & round-robin rotation shifted to next person!`);
  } catch (err) {
    console.error('Failed to record successful booking:', err.message);
  }
}

/**
 * Books a single candidate slot
 */
async function bookSingleSlot(page, slotBtn, candidateTime, candidateDate, candidateDay, account) {
  const currentEmail = getAccountEmail(account);
  console.log(`[ACTION] Booking slot ${candidateTime} for ${account.first_name} ${account.last_name} (${currentEmail})...`);

  // Click candidate slot to open modal
  await slotBtn.click();
  await page.waitForTimeout(2000);

  // Extract accurate full date and time from the modal dialog header
  const modalHeaderInfo = await page.evaluate(() => {
    const allElements = Array.from(document.querySelectorAll('div, span, p, h2, h3'));
    for (const el of allElements) {
      const txt = (el.innerText || '').trim();
      if (txt.includes('·') && (txt.includes('–') || txt.includes('-')) && /\d/.test(txt)) {
        return txt; // e.g. "Senin, 7 September · 09:00 – 10:00"
      }
    }
    return '';
  });

  let exactDate = candidateDate;
  let exactTime = candidateTime;
  let exactDay = candidateDay;

  if (modalHeaderInfo && modalHeaderInfo.includes('·')) {
    const [dPart, tPart] = modalHeaderInfo.split('·').map(s => s.trim());
    exactDate = dPart.includes('2026') ? dPart : `${dPart} 2026`;
    exactTime = tPart;
    if (dPart.includes(',')) {
      exactDay = dPart.split(',')[0].trim();
    }
  }

  // 1. First Name
  const firstNameInput = page.locator('input[type="text"]:visible').first();
  await firstNameInput.click();
  await firstNameInput.pressSequentially(account.first_name || DEFAULT_FIRST_NAME, { delay: 35 });

  // 2. Last Name
  const lastNameInput = page.locator('input[type="text"]:visible').nth(1);
  await lastNameInput.click();
  await lastNameInput.pressSequentially(account.last_name || DEFAULT_LAST_NAME, { delay: 35 });

  // 3. Email Address
  const emailInput = page.locator('input[type="email"]:visible').first();
  await emailInput.click();
  await emailInput.pressSequentially(currentEmail, { delay: 35 });

  // 4. Address
  const addressInput = page.locator('textarea:visible').first();
  await addressInput.click();
  await addressInput.pressSequentially(account.address || DEFAULT_ADDRESS, { delay: 35 });

  // 5. WhatsApp Phone
  const phoneInput = page.locator('textarea:visible').nth(1);
  await phoneInput.click();
  await phoneInput.pressSequentially(account.phone || DEFAULT_PHONE, { delay: 35 });

  await page.waitForTimeout(1000);

  // Click "Reservasi" / "Book"
  console.log('[ACTION] Clicking "Reservasi" button...');
  const bookButton = page.locator('button:has-text("Reservasi"), button:has-text("Book"), button:has-text("Pesan")').first();
  await bookButton.click();

  // Wait for confirmation
  console.log('[WAIT] Waiting for booking confirmation...');
  const confirmBtn = page.locator('button:has-text("Tutup"), button:has-text("Close")').first();
  await confirmBtn.waitFor({ state: 'visible', timeout: 20000 });

  console.log(`[CONFIRMED] Slot ${exactDate} (${exactTime}) confirmed for ${account.first_name} ${account.last_name}!`);

  // Record to database and shift round-robin turn
  await recordSuccessfulBooking(exactDate, exactTime, exactDay, currentEmail, account);

  // Close modal to return to calendar
  const closeBtn = page.locator('button:has-text("Tutup"), button:has-text("Close")').first();
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
    await page.waitForTimeout(2000);
  }
}

async function runAutoBooking() {
  console.log(`[START] FTC Court Auto-Booking Bot (Multi-Person Round-Robin) @ ${new Date().toISOString()}`);
  
  const masterSettings = await getMasterSettings();
  if (masterSettings.is_active === false) {
    console.log('[INFO] Auto-booking is currently disabled in master settings. Skipping.');
    return;
  }

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

    // Stealth: Remove webdriver flag
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    console.log(`[NAVIGATE] Opening ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    let bookedCount = 0;
    const maxBookingsPerRun = 5; // Allow booking multiple available target slots in one run

    while (bookedCount < maxBookingsPerRun) {
      const allButtons = await page.$$('button');
      let candidateSlot = null;
      let candidateDate = '';
      let candidateTime = '';
      let candidateDay = '';

      console.log(`[INFO] Scanning calendar days and slots...`);

      for (let i = 0; i < allButtons.length; i++) {
        const btn = allButtons[i];
        const text = (await btn.innerText()).trim();
        const ariaLabel = (await btn.getAttribute('aria-label')) || '';
        const combinedInfo = `${text} ${ariaLabel}`;

        if (isTargetTime(text) || isTargetTime(ariaLabel)) {
          if (!isIgnoredDay(combinedInfo)) {
            console.log(`[MATCH] Found target slot: "${text}" (${ariaLabel})`);
            candidateSlot = btn;
            candidateTime = text;
            candidateDate = ariaLabel || text;
            break;
          }
        }
      }

      if (!candidateSlot) {
        if (bookedCount === 0) {
          const msg = `Pengecekan selesai pada ${new Date().toLocaleTimeString('id-ID')}. Belum ada slot target yang tersedia.`;
          console.log(`[NO_SLOT] ${msg}`);
          await updateCheckStatus('no_slots', msg);
        }
        break; // No more slots available in this run
      }

      // Fetch the next person in line for this booking!
      const account = await getNextBookingAccount();
      console.log(`[ROBIN_TURN] Booking slot ${candidateTime} for: ${account.first_name} ${account.last_name} (${getAccountEmail(account)})`);

      // Execute booking for this slot
      await bookSingleSlot(page, candidateSlot, candidateTime, candidateDate, candidateDay, account);
      bookedCount++;

      // Wait 3s before checking if there are more slots to book in this run
      await page.waitForTimeout(3000);
      await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
    }

    console.log(`[FINISH] Total slots booked in this run: ${bookedCount}`);

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
