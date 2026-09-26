## 2024-05-15 - Replace native title attributes with Tooltip components for icon-only buttons
**Learning:** Native `title` attributes on icon-only buttons can be slow to appear, inconsistent across browsers, and generally provide a poor UX, especially for assistive tech or keyboard users who expect immediate feedback.
**Action:** Use a robust Tooltip component (like Radix UI's `Tooltip`) to wrap icon-only buttons, ensuring clear, accessible, and fast feedback for users interacting with these elements.
## 2024-03-24 - Dynamic Button Loading States
**Learning:** Replacing static icons with animated spinners during asynchronous operations (e.g., checkout, test payment) significantly improves perceived performance and provides clear feedback to the user that the system is processing their request.
**Action:** Always prefer dynamic loading indicators (`<Loader2 className="spin" />`) over static text changes or static icons when a button triggers an async action that might take longer than a few milliseconds.
