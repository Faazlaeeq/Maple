import { google } from 'googleapis';
import { addDays, format, parseISO, startOfDay, endOfDay } from 'date-fns';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

/**
 * Initialize Google Calendar client.
 * Returns null if credentials are not configured.
 */
function getCalendarClient(calendarId: string) {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey || !calendarId) {
    return null;
  }

  // Handle line breaks in private key if they aren't parsed correctly
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES
  });

  return {
    calendar: google.calendar({ version: 'v3', auth }),
    calendarId,
    auth
  };
}

/**
 * Checks available slots for a specific date string (YYYY-MM-DD).
 * For simplicity, we assume office hours are 9 AM to 5 PM, in 1-hour slots.
 * We fetch existing events and remove those slots from our available list.
 */
export async function getAvailableSlots(dateStr: string, calendarId: string): Promise<string[]> {
  const client = getCalendarClient(calendarId);
  
  // Return dummy data if not configured (useful for development)
  if (!client) {
    console.log(`[Calendar Mock] Checking availability for ${dateStr}`);
    return ['09:00', '10:00', '13:00', '14:00'];
  }

  try {
    // Explicitly authorize to catch credential errors early
    await client.auth.authorize();

    const targetDate = parseISO(dateStr);
    if (isNaN(targetDate.getTime())) {
      throw new Error(`Invalid date format provided: "${dateStr}". You must provide a valid YYYY-MM-DD date string.`);
    }
    const timeMin = startOfDay(targetDate).toISOString();
    const timeMax = endOfDay(targetDate).toISOString();

    const response = await client.calendar.events.list({
      calendarId: client.calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    
    // Create standard slots (9AM to 4PM)
    const allSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    
    // Find booked slots
    const bookedSlots = events.map(event => {
      if (!event.start?.dateTime) return null;
      // Extract HH:mm
      return format(parseISO(event.start.dateTime), 'HH:mm');
    }).filter(Boolean) as string[];

    // Return slots that are NOT booked
    return allSlots.filter(slot => !bookedSlots.includes(slot));
    
  } catch (error: any) {
    console.error('[Calendar] Error fetching availability:', error);
    throw new Error(`Calendar API Error: ${error.message || 'Failed to fetch availability'}`);
  }
}

/**
 * Creates a calendar event for the booking and returns a Booking ID.
 */
export async function bookAppointment(dateStr: string, timeStr: string, patientName: string, phone: string, calendarId: string): Promise<{ eventId: string; bookingId: string }> {
  const client = getCalendarClient(calendarId);
  const bookingId = `MFD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  if (!client) {
    console.log(`[Calendar Mock] Booking created for ${patientName} on ${dateStr} at ${timeStr}. ID: ${bookingId}`);
    return { eventId: 'mock-event-id', bookingId };
  }

  try {
    await client.auth.authorize();

    // Construct start and end DateTimes (assuming 1-hour appointments)
    // E.g. dateStr: '2026-07-10', timeStr: '14:00'
    const startDateTime = `${dateStr}T${timeStr}:00+05:00`; // PKT Timezone
    const endHour = parseInt(timeStr.split(':')[0]) + 1;
    const endDateTime = `${dateStr}T${endHour.toString().padStart(2, '0')}:00:00+05:00`;

    const event = {
      summary: `Patient Appointment: ${patientName}`,
      description: `Phone: ${phone}\nBooking ID: ${bookingId}`,
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Karachi',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Karachi',
      },
    };

    const response = await client.calendar.events.insert({
      calendarId: client.calendarId,
      requestBody: event,
    });

    return {
      eventId: response.data.id || 'unknown',
      bookingId
    };

  } catch (error) {
    console.error('[Calendar] Error creating booking:', error);
    throw new Error('Failed to create booking on Google Calendar.');
  }
}

/**
 * Cancels an appointment given the Google Calendar Event ID.
 */
export async function cancelAppointment(eventId: string, calendarId: string): Promise<boolean> {
  const client = getCalendarClient(calendarId);

  if (!client) {
    console.log(`[Calendar Mock] Canceled event: ${eventId}`);
    return true;
  }

  try {
    await client.auth.authorize();

    await client.calendar.events.delete({
      calendarId: client.calendarId,
      eventId,
    });
    return true;
  } catch (error) {
    console.error(`[Calendar] Error canceling event ${eventId}:`, error);
    return false;
  }
}
