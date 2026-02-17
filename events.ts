import { EventEmitter } from 'events';

class AppEventEmitter extends EventEmitter {}
export const eventEmitter = new AppEventEmitter();

// Event Types
export const EVENTS = {
  BOOKING: {
    CREATED: 'booking.created',
    STATUS_UPDATED: 'booking.status.updated',
  },
};

// Event Listeners (Example)
eventEmitter.on(EVENTS.BOOKING.CREATED, (booking) => {
  console.log(`[Event] Booking Created: ${booking.bookingRef}`);
  // In a real app, this could trigger email, SMS, or other background tasks
});

eventEmitter.on(EVENTS.BOOKING.STATUS_UPDATED, ({ booking, status }) => {
  console.log(`[Event] Booking Status Updated: ${booking.bookingRef} -> ${status}`);
});
