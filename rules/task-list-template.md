## **2. Task List Generation **

### **2.1 Generate Parent Tasks (High-Level Plan)**
- AI analyzes the approved PRD.
- **AI outputs only the main (parent) tasks** as a checklist, each as a one-line description.
    - *Example:*
        - [ ] 1. Implement backend API endpoint
        - [ ] 2. Build frontend reset form
        - [ ] 3. Connect API to frontend
        - [ ] 4. Add tests
        - [ ] 5. QA & deployment

### **2.2 Token-Efficient Review & Approval**
- AI presents the parent tasks and immediately proceeds to break them into detailed subtasks (unless user interrupts to edit).
- **User can request corrections to the parent task list at any point during subtask breakdown—feedback window remains open.**

### **2.3 Generate Subtasks (Detailed Plan)**
- AI breaks down each parent task into detailed, atomic subtasks in a single batch (unless otherwise instructed).
    - Each subtask should be:
        - One unit of work, doable without further decomposition.
        - Explicit: include file/component to be created/modified, and what will be tested.
    - *Example:*
        - [ ] 1.1 Create `/api/reset-password` endpoint
        - [ ] 1.2 Implement email verification logic
        - [ ] 1.3 Handle error states
        - [ ] 2.1 Build password reset form (React component)
        - [ ] 2.2 Add form validation

### **2.4 Identify Affected Files/Components**
- **AI outputs a “Relevant Files” table** listing each file/component to be created or changed, with a one-line description.
    - *Example:*
        | File/Component                      | Description   |
        | ----------------------------------- | ------------- |
        | `/api/reset-password.js`            | API endpoint  |
        | `/components/ResetPasswordForm.jsx` | Frontend form |
        | `/tests/reset-password.test.js`     | Unit tests    |
- **Task markdown files must be named:**
    - `/tasks/YYYYMMDD-HHMM-feature-keyword-tasks.md`
    - Example: `/tasks/20251013-1105-password-reset-tasks.md`
- **If `/tasks` folder does not exist, create it before writing any new task or PRD files.**
- If IDE does not allow file creation, keep everything in a single main `.md` doc for the entire flow.

### **2.5 Final Task List Output**
- All parent tasks and subtasks are presented in an in-line markdown checklist, either in `/tasks/YYYYMMDD-HHMM-feature-keyword-tasks.md` or in the main doc (if online IDE does not allow separate files).
- **User reviews/checks for missing items.** Feedback is handled in batch to reduce interruptions and token burn.
