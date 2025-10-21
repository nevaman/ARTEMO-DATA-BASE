---
title: Contributing to Artemo Documentation
description: Guidelines for contributing to Artemo AI documentation
---

# Contributing to Artemo Documentation

Thank you for your interest in improving Artemo AI documentation! This guide will help you contribute effectively.

---

## Quick Links

- 📖 [Documentation Site](#)
- 🐛 [Report an Issue](#)
- 💡 [Suggest an Improvement](#)
- 📸 [Screenshot Guide](./SCREENSHOT_GUIDE.md)
- 🚀 [Deployment Guide](./DEPLOYMENT.md)

---

## Ways to Contribute

### 1. Report Issues

Found something wrong or confusing?

**Types of issues**:
- Typos or grammatical errors
- Outdated information
- Broken links or images
- Confusing explanations
- Missing documentation

**How to report**:
1. Check if issue already exists
2. Create new issue with clear description
3. Include page URL and section
4. Suggest a fix if possible

### 2. Improve Existing Pages

Help make documentation clearer:

**What to improve**:
- Clarify confusing sections
- Add missing details
- Update outdated screenshots
- Improve examples
- Fix formatting issues

**How to contribute**:
1. Find the page in `/docs-vitepress/`
2. Make your changes
3. Test locally
4. Submit pull request

### 3. Write New Content

Add missing documentation:

**High-priority pages**:
- Advanced features
- Integration guides
- Troubleshooting scenarios
- Video tutorials
- Use case examples

**How to contribute**:
1. Discuss in issue first (avoid duplicate work)
2. Use page template (`_TEMPLATE.md`)
3. Follow voice and tone guidelines
4. Include screenshots (follow screenshot guide)
5. Submit pull request

### 4. Add Screenshots

Visual guides help users tremendously:

**What's needed**:
- Feature overviews
- Step-by-step guides
- Error states and troubleshooting
- Mobile views

**How to contribute**:
1. Read [Screenshot Guide](./SCREENSHOT_GUIDE.md)
2. Capture screenshots following standards
3. Add annotations if helpful
4. Place in correct `/public/images/` folder
5. Update markdown file
6. Submit pull request

---

## Getting Started

### Prerequisites

- Git installed
- Node.js 18+ installed
- npm or yarn
- GitHub account
- Text editor (VS Code recommended)

### Setup Local Environment

<ol class="step-guide">
<li>

### Fork and Clone

```bash
# Fork repository on GitHub first, then:
git clone https://github.com/YOUR-USERNAME/artemo-docs.git
cd artemo-docs
```

</li>
<li>

### Install Dependencies

```bash
npm install
```

</li>
<li>

### Run Development Server

```bash
npm run docs:dev
```

Opens at `http://localhost:5173`

</li>
<li>

### Make Changes

Edit files in `/docs-vitepress/`

Changes reflect immediately (hot reload)

</li>
<li>

### Test Build

```bash
npm run docs:build
npm run docs:preview
```

Verify everything works correctly

</li>
</ol>

---

## Contribution Workflow

### 1. Create a Branch

```bash
git checkout -b feature/improve-quick-start
```

**Branch naming**:
- `feature/` - New content or features
- `fix/` - Bug fixes, typos
- `update/` - Update existing content
- `screenshot/` - Adding or updating images

**Examples**:
- `feature/add-api-docs`
- `fix/broken-links-in-admin-guide`
- `update/tool-creation-process`
- `screenshot/getting-started-pages`

### 2. Make Changes

Edit markdown files in `/docs-vitepress/`

**File structure**:
```
docs-vitepress/
├── .vitepress/
│   ├── config.ts          # Site configuration
│   └── theme/             # Custom theme
├── getting-started/       # Getting started guides
├── workspaces/            # Workspace docs
├── tools/                 # Tool documentation
├── admin/                 # Admin guides
├── faq/                   # FAQ and troubleshooting
├── public/                # Static assets
│   └── images/            # Screenshots
└── index.md               # Homepage
```

### 3. Follow Guidelines

See sections below for:
- Voice and tone
- Formatting standards
- Screenshot requirements
- Link conventions

### 4. Test Locally

```bash
# Development server
npm run docs:dev

# Production build
npm run docs:build
npm run docs:preview
```

**Checklist**:
- [ ] Page renders correctly
- [ ] All links work
- [ ] Images load
- [ ] Mobile view looks good
- [ ] Search finds your content

### 5. Commit Changes

```bash
git add .
git commit -m "feat: add API integration guide"
```

**Commit message format**:
```
<type>: <description>

[optional body]
```

**Types**:
- `feat` - New content or feature
- `fix` - Bug fix or correction
- `docs` - Documentation meta changes
- `style` - Formatting, no content change
- `refactor` - Restructure without changing meaning
- `screenshot` - Add or update images

**Examples**:
```
feat: add GoHighLevel integration guide
fix: correct broken links in admin section
screenshot: add tool creation workflow images
docs: update contributing guidelines
```

### 6. Push and Create PR

```bash
git push origin feature/improve-quick-start
```

Then:
1. Go to GitHub
2. Click "Compare & pull request"
3. Fill out PR template
4. Submit for review

---

## Writing Guidelines

### Voice and Tone

**Friendly but Professional**
- Write like you're helping a colleague
- Be encouraging and supportive
- Avoid corporate jargon

**Clear and Concise**
- Use simple words over complex ones
- Short sentences (15-20 words ideal)
- One idea per paragraph

**Action-Oriented**
- Use active voice: "Click the button" not "The button should be clicked"
- Start with verbs: "Create", "Edit", "Configure"
- Focus on what users should do

**Non-Technical**
- Assume no technical background
- Explain jargon when necessary
- Use analogies for complex concepts

### Example Comparisons

❌ **Too Technical**:
```
Instantiate a new project entity by invoking the creation modal
via the primary navigation affordance.
```

✅ **Just Right**:
```
Create a new project by clicking "New Project" in the sidebar.
```

---

❌ **Too Casual**:
```
Just hit that button and boom! You're good to go, fam.
```

✅ **Just Right**:
```
Click the button to get started. You're all set!
```

---

### Formatting Standards

#### Headings

```markdown
# Page Title (H1) - One per page

## Main Sections (H2)

### Subsections (H3)

#### Minor Sections (H4) - Use sparingly
```

#### Lists

**Unordered** (when order doesn't matter):
```markdown
- First item
- Second item
- Third item
```

**Ordered** (for sequential steps):
```markdown
1. First step
2. Second step
3. Third step
```

**Step-by-step** (use custom class):
```markdown
<ol class="step-guide">
<li>

### Step Title

Description and details

</li>
<li>

### Next Step

More details

</li>
</ol>
```

#### Links

**Internal links** (relative):
```markdown
[Link text](/path/to/page)
```

**External links** (full URL):
```markdown
[Link text](https://example.com)
```

**Link to sections**:
```markdown
[Jump to section](#section-heading)
```

#### Images

```markdown
<div class="screenshot-placeholder">
📸 Screenshot: Description of what should be shown
Location: /images/section/filename.png
</div>
```

Or if image exists:
```markdown
![Alt text](/images/section/filename.png)
```

#### Code Blocks

**Inline code**:
```markdown
Use the `npm install` command
```

**Code blocks**:
````markdown
```bash
npm install
npm run dev
```
````

#### Callouts

```markdown
::: tip Pro Tip
Helpful advanced information
:::

::: warning Be Careful
Important warning or caution
:::

::: danger Critical
Critical information users must know
:::

::: details Advanced Topic
Collapsible advanced information
:::
```

#### Tables

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |
```

---

## Screenshot Requirements

See full [Screenshot Guide](./SCREENSHOT_GUIDE.md)

**Quick checklist**:
- [ ] Follow naming convention: `[section]-[feature]-[view].png`
- [ ] Use demo data only (no real customer info)
- [ ] Size: 1200-1600px wide, < 500KB
- [ ] Save in correct `/public/images/` folder
- [ ] Add helpful annotations if needed
- [ ] Update markdown to reference image

---

## Pull Request Process

### PR Template

When creating PR, include:

```markdown
## Description
[What does this PR do?]

## Type of Change
- [ ] New content
- [ ] Fix/correction
- [ ] Update existing content
- [ ] Screenshots
- [ ] Documentation meta

## Checklist
- [ ] Followed writing guidelines
- [ ] Tested locally
- [ ] Screenshots added (if applicable)
- [ ] Links work
- [ ] No typos or errors
- [ ] Mobile responsive

## Related Issues
Closes #123
```

### Review Process

1. **Automated Checks**: Build must pass
2. **Reviewer Assigned**: Usually within 24 hours
3. **Feedback**: Address any requested changes
4. **Approval**: Once approved, will be merged
5. **Deploy**: Automatically deployed to production

### After Merge

- Branch will be deleted automatically
- Changes live within minutes
- You'll be credited as contributor

---

## Style Guide Reference

### Capitalization

**Page Titles**: Title Case
- ✅ "Getting Started with Artemo"
- ❌ "Getting started with artemo"

**Headings**: Sentence case
- ✅ "Create your first project"
- ❌ "Create Your First Project"

**UI Elements**: Match exactly
- ✅ "Click **New Project**"
- If button says "New Project", write it that way

### Terminology

Use consistent terms:

| Use This | Not This |
|----------|----------|
| Tool | Application, App |
| Dashboard | Homepage, Main Page |
| Admin | Administrator |
| User | Member, Person |
| Project | Workspace (unless specifically about workspaces) |
| Chat | Conversation, Thread |
| Knowledge Base | KB, Knowledge Files |

### Voice Examples

**Encouraging**:
- ✅ "Great! You've created your first project."
- ❌ "Project created successfully."

**Helpful**:
- ✅ "Can't find the setting? Check the Admin panel."
- ❌ "Setting located in Admin panel."

**Clear**:
- ✅ "This takes about 2 minutes."
- ❌ "This may take some time."

---

## Questions?

### Getting Help

- 💬 **Questions**: Open discussion in GitHub
- 🐛 **Bug Reports**: Create issue
- 💡 **Suggestions**: Create feature request
- 📧 **Direct Contact**: docs@artemo.ai

### Resources

- [VitePress Documentation](https://vitepress.dev/)
- [Markdown Guide](https://www.markdownguide.org/)
- [Writing Style Guide](https://developers.google.com/style)

---

## Recognition

Contributors are:
- Listed in CONTRIBUTORS.md
- Credited in release notes
- Thanked publicly in community

Thank you for making Artemo documentation better! 🎉

---

*Last updated: January 2025*
