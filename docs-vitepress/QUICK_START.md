# Quick Start - Artemo Documentation

## Get Up and Running in 5 Minutes

### 1. Install Dependencies

```bash
# From project root
npm install
```

This will install VitePress and all required dependencies.

### 2. Start Development Server

```bash
npm run docs:dev
```

Opens at `http://localhost:5173`

**What you'll see**:
- Full documentation site with Artemo branding
- Navigation and search working
- All pages accessible
- Hot reload on file changes

### 3. Make Changes

Edit any markdown file in `/docs-vitepress/`:
- Changes appear instantly (hot reload)
- No build step needed during development

### 4. Add Content

Use the template:
1. Copy `_TEMPLATE.md`
2. Place in appropriate folder
3. Fill in sections
4. Add to sidebar in `.vitepress/config.ts`

### 5. Add Screenshots

Follow `SCREENSHOT_GUIDE.md`:
1. Capture at 1200-1600px width
2. Use demo data only
3. Name: `[section]-[feature]-[view].png`
4. Save in `/public/images/[section]/`
5. Reference in markdown

### 6. Build for Production

```bash
# Test production build
npm run docs:build

# Preview build
npm run docs:preview
```

### 7. Deploy

Follow `DEPLOYMENT.md` for:
- Netlify (recommended)
- Vercel
- GitHub Actions

---

## File Structure

```
docs-vitepress/
├── .vitepress/
│   ├── config.ts          # Site configuration
│   └── theme/             # Artemo branding
├── getting-started/       # Tutorial pages
├── tools/                 # Tool documentation
├── admin/                 # Admin guides
├── [other sections]/      # More docs
├── public/images/         # Screenshots
└── index.md               # Homepage
```

---

## Key Commands

| Command | Purpose |
|---------|---------|
| `npm run docs:dev` | Start development server |
| `npm run docs:build` | Build for production |
| `npm run docs:preview` | Preview production build |

---

## Resources

- 📖 **Full README**: `README.md`
- ✍️ **Template**: `_TEMPLATE.md`
- 📸 **Screenshot Guide**: `SCREENSHOT_GUIDE.md`
- 🚀 **Deployment**: `DEPLOYMENT.md`
- 🤝 **Contributing**: `CONTRIBUTING.md`

---

**You're ready to build amazing documentation!**
