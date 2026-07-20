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
export async function getAvailableSlots(dateStr: string, calendarId: string, timezone: string = 'UTC'): Promise<string[]> {
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
      timeZone: timezone,
    });

    const events = response.data.items || [];
    
    // Create standard slots (9AM to 4PM)
    const allSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    
    // Find booked slots
    const bookedSlots = events.map(event => {
      // Use event.start.dateTime which will be returned in the requested timezone
      if (!event.start?.dateTime) return null;
      // The string comes back like '2026-07-14T10:00:00-05:00'
      // We can just extract the HH:mm from the ISO string directly
      const timePart = event.start.dateTime.split('T')[1];
      if (timePart) {
        return timePart.substring(0, 5); // '10:00'
      }
      return null;
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
export async function bookAppointment(dateStr: string, timeStr: string, patientName: string, phone: string, calendarId: string, timezone: string = 'UTC'): Promise<{ eventId: string; bookingId: string }> {
  const client = getCalendarClient(calendarId);
  const bookingId = `MFD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  if (!client) {
    console.log(`[Calendar Mock] Booking created for ${patientName} on ${dateStr} at ${timeStr}. ID: ${bookingId}`);
    return { eventId: 'mock-event-id', bookingId };
  }

  try {
    await client.auth.authorize();

    // We omit the offset so Google uses the timeZone parameter to interpret the local time
    const startDateTime = `${dateStr}T${timeStr}:00`; 
    const endHour = parseInt(timeStr.split(':')[0]) + 1;
    const endDateTime = `${dateStr}T${endHour.toString().padStart(2, '0')}:00:00`;

    const event = {
      summary: `Patient Appointment: ${patientName}`,
      description: `Phone: ${phone}\nBooking ID: ${bookingId}`,
      start: {
        dateTime: startDateTime,
        timeZone: timezone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: timezone,
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
 * Details returned after a successful cancellation.
 */
export interface CancelledEventDetails {
  bookingId: string;
  patientName: string;
  phone: string;
  date: string;   // e.g. "2026-07-22"
  time: string;    // e.g. "14:00"
}

/**
 * Cancels an appointment given the human-readable Booking ID (e.g. MFD-UJWJW).
 * Searches calendar events to find the one whose description contains the booking ID,
 * then deletes that event. Returns event details for notification emails.
 */
export async function cancelAppointment(bookingId: string, calendarId: string): Promise<CancelledEventDetails> {
  const client = getCalendarClient(calendarId);

  if (!client) {
    console.log(`[Calendar Mock] Canceled booking: ${bookingId}`);
    return { bookingId, patientName: 'Patient', phone: '', date: 'N/A', time: 'N/A' };
  }

  try {
    await client.auth.authorize();

    // Search events in the next 90 days for one matching this booking ID
    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days ahead

    const response = await client.calendar.events.list({
      calendarId: client.calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      q: bookingId, // Search query — looks in summary + description
    });

    const events = response.data.items || [];
    const matchingEvent = events.find(
      (event: any) =>
        (event.description && event.description.includes(bookingId)) ||
        (event.summary && event.summary.includes(bookingId))
    );

    if (!matchingEvent || !matchingEvent.id) {
      throw new Error(`No appointment found with Booking ID: ${bookingId}. Please double-check the ID and try again.`);
    }

    // Extract details from the event before deleting
    const summary = matchingEvent.summary || '';
    const description = matchingEvent.description || '';
    const patientName = summary.replace('Patient Appointment: ', '').trim() || 'Patient';
    const phoneMatch = description.match(/Phone:\s*(.+)/);
    const phone = phoneMatch ? phoneMatch[1].trim() : '';
    const startDt = matchingEvent.start?.dateTime || matchingEvent.start?.date || '';
    const eventDate = startDt ? startDt.substring(0, 10) : 'N/A';
    const eventTime = startDt && startDt.includes('T') ? startDt.substring(11, 16) : 'N/A';

    // Delete the actual Google Calendar event
    await client.calendar.events.delete({
      calendarId: client.calendarId,
      eventId: matchingEvent.id,
    });

    console.log(`[Calendar] Successfully canceled booking ${bookingId} (event: ${matchingEvent.id})`);
    return { bookingId, patientName, phone, date: eventDate, time: eventTime };
  } catch (error: any) {
    console.error(`[Calendar] Error canceling booking ${bookingId}:`, error);
    throw new Error(error.message || `Failed to cancel booking ${bookingId}.`);
  }
}
