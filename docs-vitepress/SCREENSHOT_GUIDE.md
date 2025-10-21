---
title: Screenshot Guide for Contributors
description: Standards and conventions for documentation screenshots
---

# Screenshot Guide for Contributors

This guide ensures all screenshots in Artemo documentation are consistent, professional, and helpful.

---

## Screenshot Standards

### Naming Convention

Use this format: `[section]-[feature]-[view].png`

**Examples**:
- `getting-started-dashboard-main.png`
- `admin-tool-creation-step1.png`
- `tools-knowledge-base-upload.png`
- `workspaces-project-detail-view.png`

### File Organization

```
docs-vitepress/public/images/
├── getting-started/
│   ├── dashboard-main.png
│   ├── first-login-welcome.png
│   └── quick-start-tool-selection.png
├── admin/
│   ├── tool-creation-step1.png
│   ├── tool-creation-step2.png
│   ├── tool-creation-step3.png
│   └── user-management-invite.png
├── tools/
│   ├── launchpad-search.png
│   ├── knowledge-base-upload.png
│   └── chat-interface-questions.png
├── workspaces/
│   ├── project-create-modal.png
│   ├── project-list-view.png
│   └── client-profile-editor.png
└── integrations/
    ├── ghl-connect.png
    └── api-settings.png
```

---

## Technical Requirements

### Image Specifications

- **Format**: PNG (preferred) or JPEG
- **Resolution**: 2x resolution for retina displays
- **Maximum Width**: 1920px
- **Optimal Width**: 1200px - 1600px
- **File Size**: < 500KB (compress if needed)

### Browser and Device

**Desktop Screenshots**:
- **Browser**: Latest Chrome or Firefox
- **Window Size**: 1440px x 900px (standard laptop)
- **Zoom**: 100%

**Mobile Screenshots** (if needed):
- **Device**: iPhone 13/14 size (390 x 844)
- **Format**: Device frame included (optional)

---

## Content Guidelines

### What to Capture

**Full Feature Views**:
- Show enough context to orient users
- Include relevant navigation elements
- Capture the complete workflow step

**UI State**:
- Use realistic, professional data
- Show the feature in active use
- Include hover states where relevant

### What to Avoid

- ❌ Real customer data (use demo data only)
- ❌ Personal information (names, emails, phone numbers)
- ❌ Browser bookmarks or personal browser extensions
- ❌ Multiple browser tabs (close extras)
- ❌ Desktop icons or personal files in view
- ❌ System notifications or popups

---

## Demo Data Standards

### User Names
Use these fictional personas:
- Alex Martinez (Marketing Manager)
- Jordan Chen (Content Creator)
- Taylor Smith (Agency Owner)
- Morgan Davis (Business Coach)

### Company Names
- Acme Digital Agency
- Peak Performance Coaching
- GreenLeaf Consulting
- Bright Future Marketing

### Email Addresses
- demo@artemo.ai
- alex@example.com
- jordan@example.com

### Content Examples
Use polished, professional example content:
- **Good**: "Create compelling email campaigns that convert prospects into loyal customers"
- **Avoid**: "test test test" or "asdf testing"

---

## Annotation Guidelines

### When to Annotate

Add annotations to highlight:
- Click targets (buttons, links)
- Key information areas
- Sequential steps (1, 2, 3)
- Important notices or warnings

### Annotation Style

**Colors** (match Artemo brand):
- **Primary Highlight**: #008F6B (Artemo green)
- **Secondary**: #00B386 (lighter green)
- **Warning**: #EF4444 (red for errors/warnings)
- **Info**: #3B82F6 (blue for information)

**Shapes**:
- **Rectangles**: Highlight regions
- **Circles**: Click targets, specific elements
- **Arrows**: Show direction or flow
- **Numbers**: Sequential steps

**Text**:
- **Font**: Inter (same as Artemo UI)
- **Size**: 14-16px
- **Color**: White text on colored background
- **Style**: Keep minimal, clear, and concise

### Annotation Tools

Recommended tools:
- **Snagit** (Windows/Mac) - Professional annotations
- **Skitch** (Mac) - Quick annotations
- **Figma** (Web) - Design-quality annotations
- **Markup** (Mac native) - Simple annotations

---

## Screenshot Workflow

<ol class="step-guide">
<li>

### Prepare the UI

1. Log into Artemo with demo account
2. Navigate to the feature
3. Populate with demo data (see standards above)
4. Set browser window to standard size (1440x900)
5. Close unnecessary browser tabs
6. Clear any notifications

</li>
<li>

### Capture the Screenshot

1. Use native screenshot tool or Snagit
2. Capture full feature view with context
3. Review for personal/sensitive info
4. Save in appropriate format

</li>
<li>

### Edit and Annotate

1. Crop to remove unnecessary chrome
2. Add annotations if needed (see style guide)
3. Compress image if > 500KB
4. Verify quality and clarity

</li>
<li>

### Name and Organize

1. Name following convention: `[section]-[feature]-[view].png`
2. Save to correct folder in `/public/images/`
3. Update documentation markdown file
4. Test image displays correctly

</li>
</ol>

---

## Screenshot Types

### Overview Screenshots
Show the complete feature or page.

**Purpose**: Orient users, show big picture
**Size**: Full viewport (1440x900)
**Annotations**: Minimal, label key areas only

### Detail Screenshots
Zoom in on specific UI elements.

**Purpose**: Show precise location or interaction
**Size**: Cropped to relevant area
**Annotations**: Highlight specific elements

### Process Screenshots
Show sequential steps in a workflow.

**Purpose**: Guide users through multi-step tasks
**Size**: Varies per step
**Annotations**: Number each step (1, 2, 3...)

### Comparison Screenshots
Side-by-side or before/after views.

**Purpose**: Show differences or options
**Size**: Split view or paired images
**Annotations**: Label each side clearly

---

## Mobile Screenshots

### When Needed
Include mobile screenshots for:
- Features with mobile-specific UI
- Responsive design variations
- Mobile-first workflows

### Capturing Mobile Views

**Option 1: Browser DevTools**
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device: iPhone 13/14 (390 x 844)
4. Capture screenshot

**Option 2: Real Device**
1. Use actual iPhone or Android device
2. Capture screenshot natively
3. Transfer to computer
4. Crop and annotate as needed

---

## Quality Checklist

Before adding screenshots to documentation:

- [ ] Correct resolution (1200-1920px wide)
- [ ] File size < 500KB
- [ ] No personal or sensitive data
- [ ] Demo data looks professional
- [ ] Proper naming convention followed
- [ ] Saved in correct folder
- [ ] Annotations follow style guide
- [ ] Image displays correctly in docs
- [ ] Alt text added to markdown

---

## Example Screenshots

### Good Examples

✅ **Clean UI with Context**
- Shows full feature view
- Professional demo data
- No personal information
- Clear annotations

✅ **Focused Detail Shot**
- Zoomed to relevant area
- Highlighted key element
- Professional appearance

### Bad Examples

❌ **Too Much Context**
- Includes irrelevant browser chrome
- Personal bookmarks visible
- Desktop clutter in view

❌ **Poor Quality**
- Blurry or pixelated
- Wrong size or aspect ratio
- Compressed artifacts visible

❌ **Unprofessional Content**
- "Test test test" placeholder text
- Personal data visible
- Messy or incomplete UI state

---

## Screenshot Request Process

Can't capture a screenshot yourself? Request one:

1. **Create an issue** in the docs repository
2. **Label it**: `screenshot-needed`
3. **Describe**: Which page, what feature, what angle
4. **Provide context**: Why it's needed, special requirements
5. **Tag**: Assign to docs team member

---

## Tools and Resources

### Screenshot Tools
- **Snagit** (Paid, powerful): https://www.techsmith.com/screen-capture.html
- **ShareX** (Free, Windows): https://getsharex.com/
- **Skitch** (Free, Mac): https://evernote.com/products/skitch
- **Lightshot** (Free, cross-platform): https://app.prntscr.com/

### Image Compression
- **TinyPNG**: https://tinypng.com/
- **ImageOptim** (Mac): https://imageoptim.com/
- **Squoosh** (Web): https://squoosh.app/

### Annotation Tools
- **Snagit**: Built-in annotations
- **Figma**: Design-quality annotations
- **Canva**: Simple annotations
- **Markup** (Mac native): System tool

---

## Update Schedule

Screenshots should be updated when:
- UI design changes significantly
- Feature functionality changes
- New features are added
- Screenshots become outdated (annually at minimum)

---

*Consistent, professional screenshots make documentation clear and trustworthy.*

*Last updated: January 2025*
