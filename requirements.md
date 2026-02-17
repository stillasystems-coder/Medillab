## Packages
recharts | Analytics charts for the dashboard
framer-motion | Smooth page transitions and UI animations
date-fns | Date formatting for bookings and timelines
clsx | Utility for conditional classes
tailwind-merge | Utility for merging tailwind classes

## Notes
Authentication uses cookie-based sessions (credentials: "include")
File uploads via FormData to /api/bookings/:id/result
Dashboard requires admin role for full analytics view
Status workflow: BOOKED -> ARRIVED -> SAMPLE_COLLECTED -> IN_PROCESS -> COMPLETED -> DELIVERED
