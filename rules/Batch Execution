## **3. Efficient Batch Execution Protocol **

### **3.1 Batch Execution Strategy**
- AI tackles a **batch of 2–5 subtasks** at once (or all under a single parent task, if complexity allows).
- At the end of each batch, AI posts:
    - Updated checklist (with `[x]` for each completed subtask)
    - Code snippets and key explanations for each subtask
    - A clear batch summary of what changed

### **3.2 User Approval and Review**
- **AI must pause for explicit user review** after each batch.
- User reviews the full batch. If happy, reply “go” or “yes” for the next batch.
- If something is wrong, user gives feedback and the AI:
    - **Only retries/fixes failed subtasks**
    - Posts an updated checklist and summary for the fix

### **3.3 Batch QA and Savepoints**
- After finishing all subtasks under a parent task, AI:
    - Prompts user to run all relevant tests (or does so if possible)
    - If all tests pass, AI recommends creating a **savepoint/commit/export** before next batch
    - Marks the parent task `[x]` and summarizes what was achieved

### **3.4 Batching Guidelines**
- **Batch risky/complex tasks separately** (don’t group “scary” changes)
- For routine CRUD or UI, batch more subtasks at once
- Always let the user decide batch size (“do the next 3 tasks,” “batch this parent task,” etc.)
- Never proceed without explicit approval after each batch

---

- When all tasks are `[x]`, AI outputs small report:
    - Full summary of what was built, including any created/modified files.
    - Summary of success metrics, edge cases handled, and any remaining open questions.
    - Final “next steps” 

