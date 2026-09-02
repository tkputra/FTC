/**
 * FTC Automated Court Booking Bot (Google Calendar Appointments)
 * Target URL: https://calendar.app.google/iueH4Lnt6qsCgVmZ6
 */

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xdrsowoekbqalkonezcw.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5486NL5JTIMKrmB-hxNv_Q_eF1bx5qa';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TARGET_URL = 'https://calendar.app.google/iueH4Lnt6qsCgVmZ6';

// Target Preferences
const DEFAULT_FIRST_NAME = 'Tri';
const DEFAULT_LAST_NAME = 'Putra';
const DEFAULT_EMAIL_PREFIX = 'tri.kartika.putra';
const DEFAULT_EMAIL_DOMAIN = 'gmail.com';
const DEFAULT_ADDRESS = 'Fortune spring Blok D2 - J05';
const DEFAULT_PHONE = '08111819112';

// Allowed Days: Mon - Thu only (Exclude Fri, Sat, Sun)
const IGNORED_DAYS = ['fri', 'sat', 'sun', 'jumat', 'sabtu', 'minggu', 'friday', 'saturday', 'sunday', 'jum', 'sab', 'min'];

// Target Hours (Normalized)
// 6:00am, 7:00am, 8:00am, 9:00am, 4:00pm, 5:00pm, 6:00pm
const TARGET_HOURS_PATTERNS = [
  /^0?6:00\s*(am)?$/i,
  /^0?7:00\s*(am)?$/i,
  /^0?8:00\s*(am)?$/i,
  /^0?9:00\s*(am)?$/i,
  /^0?4:00\s*(pm)?$/i,
  /^0?5:00\s*(pm)?$/i,
  /^0?6:00\s*(pm)?$/i,
  /^16:00$/,
  /^17:00$/,
  /^18:00$/
];

function isTargetTime(timeStr) {
  const clean = timeStr.trim().toLowerCase().replace(/\s+/g, '');
  return TARGET_HOURS_PATTERNS.some(p => p.test(clean) || clean.includes('6:00am') || clean.includes('7:00am') || clean.includes('8:00am') || clean.includes('9:00am') || clean.includes('4:00pm') || clean.includes('5:00pm') || clean.includes('6:00pm'));
}

function isIgnoredDay(dayStr) {
  const clean = dayStr.trim().toLowerCase();
  return IGNORED_DAYS.some(d => clean.includes(d));
}

async function getBookingSettings() {
  try {
    const { data, error } = await supabase
      .from('court_booking_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) {
      console.log('Using default booking settings.');
      return {
        email_prefix: DEFAULT_EMAIL_PREFIX,
        email_domain: DEFAULT_EMAIL_DOMAIN,
        current_email_index: 2,
        first_name: DEFAULT_FIRST_NAME,
        last_name: DEFAULT_LAST_NAME,
        address: DEFAULT_ADDRESS,
        phone: DEFAULT_PHONE,
        is_active: true
      };
    }
    return data;
  } catch (err) {
    console.warn('Could not fetch settings from Supabase, using defaults:', err.message);
    return {
      email_prefix: DEFAULT_EMAIL_PREFIX,
      email_domain: DEFAULT_EMAIL_DOMAIN,
      current_email_index: 2,
      first_name: DEFAULT_FIRST_NAME,
      last_name: DEFAULT_LAST_NAME,
      address: DEFAULT_ADDRESS,
      phone: DEFAULT_PHONE,
      is_active: true
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

async function recordSuccessfulBooking(date, time, dayName, email, settings) {
  try {
    // 1. Insert into booked_courts
    const { error: insertError } = await supabase
      .from('booked_courts')
      .insert([{
        booking_date: date,
        booking_time: time,
        day_name: dayName,
        booked_email: email,
        first_name: settings.first_name,
        last_name: settings.last_name,
        phone: settings.phone,
        status: 'confirmed',
        notes: `Auto-booked via Bot on ${new Date().toLocaleString('id-ID')}`
      }]);

    if (insertError) console.error('Error recording booking:', insertError.message);

    // 2. Increment email index in settings
    const nextIndex = (settings.current_email_index || 2) + 1;
    await supabase
      .from('court_booking_settings')
      .update({
        current_email_index: nextIndex,
        last_check_at: new Date().toISOString(),
        last_check_status: 'booked',
        last_check_message: `Berhasil booking ${dayName || ''} ${date} jam ${time} menggunakan ${email}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    console.log(`[SUCCESS] Booking recorded! Next email index is: +${nextIndex}`);
  } catch (err) {
    console.error('Failed to record successful booking:', err.message);
  }
}

async function runAutoBooking() {
  console.log(`[START] FTC Court Auto-Booking Bot @ ${new Date().toISOString()}`);
  
  const settings = await getBookingSettings();
  if (settings.is_active === false) {
    console.log('[INFO] Auto-booking is currently disabled in settings. Skipping.');
    return;
  }

  const currentEmail = `${settings.email_prefix}+${settings.current_email_index || 2}@${settings.email_domain}`;
  console.log(`[INFO] Current booking target email: ${currentEmail}`);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
      viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();
    console.log(`[NAVIGATE] Opening ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait a bit for calendar slots to hydrate
    await page.waitForTimeout(3000);

    // Find all day columns/headers and slot buttons
    // In Google Calendar Appointment scheduling:
    // Days are displayed as columns with date headers and slot buttons inside
    const dayColumns = await page.$$('[role="region"], [data-date], div:has(button)');
    console.log(`[INFO] Scanning calendar days and slots...`);

    // We can also search directly for button elements with time format
    const allButtons = await page.$$('button');
    let candidateSlot = null;
    let candidateDate = '';
    let candidateTime = '';
    let candidateDay = '';

    // Evaluate in page context to accurately pair days and time buttons
    const slotsData = await page.evaluate(() => {
      const results = [];
      
      // Look for day headers or column containers
      // Google Calendar appointment schedule uses standard flex grid
      const buttons = Array.from(document.querySelectorAll('button'));
      
      buttons.forEach(btn => {
        const text = btn.innerText.trim();
        // Check if text looks like a time: e.g. "12:00pm", "9:00am", "6:00am"
        if (/(am|pm|\d{1,2}:\d{2})/i.test(text) && !/feedback|cancel|book|close/i.test(text)) {
          // Find surrounding parent/day header
          let parent = btn.parentElement;
          let dayHeader = '';
          for (let i = 0; i < 6 && parent; i++) {
            const headerEl = parent.querySelector('h2, h3, [role="heading"], [aria-label*="day" i], [aria-label*="hari" i]');
            if (headerEl && headerEl.innerText.trim()) {
              dayHeader = headerEl.innerText.trim();
              break;
            }
            parent = parent.parentElement;
          }
          
          results.push({
            timeText: text,
            dayHeader: dayHeader,
            ariaLabel: btn.getAttribute('aria-label') || ''
          });
        }
      });
      return results;
    });

    console.log(`[INFO] Found ${slotsData.length} slot buttons on page:`, slotsData.map(s => `${s.timeText} (${s.dayHeader || s.ariaLabel})`));

    // Find first valid slot matching criteria
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
      const msg = `Pengecekan selesai pada ${new Date().toLocaleTimeString('id-ID')}. Belum ada slot target (6-9am, 4-6pm Sen-Kam) yang tersedia.`;
      console.log(`[NO_SLOT] ${msg}`);
      await updateCheckStatus('no_slots', msg);
      return;
    }

    // Click candidate slot to open modal
    console.log(`[ACTION] Clicking slot button: ${candidateTime}...`);
    await candidateSlot.click();
    await page.waitForTimeout(2000);

    // Fill form inputs in modal
    console.log(`[ACTION] Filling booking form with email: ${currentEmail}...`);

    // 1. First Name
    const firstNameInput = page.locator('input[aria-label*="First name" i], input[placeholder*="First" i], input[name*="firstName" i]').first();
    if (await firstNameInput.count() > 0) {
      await firstNameInput.fill(settings.first_name || DEFAULT_FIRST_NAME);
    } else {
      // Fallback: first text input inside modal
      const firstInput = page.locator('input[type="text"]').first();
      await firstInput.fill(settings.first_name || DEFAULT_FIRST_NAME);
    }

    // 2. Last Name
    const lastNameInput = page.locator('input[aria-label*="Last name" i], input[placeholder*="Last" i], input[name*="lastName" i]').first();
    if (await lastNameInput.count() > 0) {
      await lastNameInput.fill(settings.last_name || DEFAULT_LAST_NAME);
    } else {
      const secondInput = page.locator('input[type="text"]').nth(1);
      await secondInput.fill(settings.last_name || DEFAULT_LAST_NAME);
    }

    // 3. Email Address
    const emailInput = page.locator('input[type="email"], input[aria-label*="Email" i]').first();
    if (await emailInput.count() > 0) {
      await emailInput.fill(currentEmail);
    }

    // 4. Custom field: Alamat Fortune dengan no Blok
    const addressInput = page.locator('input[aria-label*="Alamat" i], input[placeholder*="Alamat" i], input[aria-label*="Fortune" i]').first();
    if (await addressInput.count() > 0) {
      await addressInput.fill(settings.address || DEFAULT_ADDRESS);
    } else {
      // Look for remaining text inputs
      const allTextInputs = await page.locator('input[type="text"]').all();
      if (allTextInputs.length >= 3) {
        await allTextInputs[2].fill(settings.address || DEFAULT_ADDRESS);
      }
    }

    // 5. Custom field: Nomor Whatsapp Aktif
    const phoneInput = page.locator('input[aria-label*="Whatsapp" i], input[aria-label*="Nomor" i], input[type="tel"]').first();
    if (await phoneInput.count() > 0) {
      await phoneInput.fill(settings.phone || DEFAULT_PHONE);
    } else {
      const allTextInputs = await page.locator('input[type="text"]').all();
      if (allTextInputs.length >= 4) {
        await allTextInputs[3].fill(settings.phone || DEFAULT_PHONE);
      }
    }

    await page.waitForTimeout(1000);

    // Click "Book" button
    console.log('[ACTION] Clicking "Book" button...');
    const bookButton = page.locator('button:has-text("Book"), button:has-text("Pesan"), button:has-text("Jadwalkan")').first();
    await bookButton.click();

    // Wait for confirmation screen ("Booking confirmed" or checkmark)
    console.log('[WAIT] Waiting for booking confirmation...');
    await page.waitForSelector('text=/Booking confirmed|Pemesanan dikonfirmasi|Email sent to/i', { timeout: 15000 });

    console.log('[CONFIRMED] Booking confirmed successfully by Google Calendar!');

    // Record to database
    await recordSuccessfulBooking(candidateDate, candidateTime, candidateDay, currentEmail, settings);

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
