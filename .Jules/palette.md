## 2024-05-15 - Replace native title attributes with Tooltip components for icon-only buttons
**Learning:** Native `title` attributes on icon-only buttons can be slow to appear, inconsistent across browsers, and generally provide a poor UX, especially for assistive tech or keyboard users who expect immediate feedback.
**Action:** Use a robust Tooltip component (like Radix UI's `Tooltip`) to wrap icon-only buttons, ensuring clear, accessible, and fast feedback for users interacting with these elements.
## 2024-03-24 - Dynamic Button Loading States
**Learning:** Replacing static icons with animated spinners during asynchronous operations (e.g., checkout, test payment) significantly improves perceived performance and provides clear feedback to the user that the system is processing their request.
**Action:** Always prefer dynamic loading indicators (`<Loader2 className="spin" />`) over static text changes or static icons when a button triggers an async action that might take longer than a few milliseconds.

## 2024-03-24 - Systemic UI Quality Improvements
**Learning:** Adding baseline CSS transitions, global focus-visible rings, actionable Empty states, and proper skeleton loader animations dramatically shifts a product from "functional" to "professional." Setting these as systemic defaults early prevents fragmented UX debt.
**Action:** When auditing applications, prefer to solve accessibility/visual feedback at the systemic CSS level (`:focus-visible`, global `.skeleton`) or by enforcing strict typing on generic UI components (e.g. making `href` mandatory in Empty states).
