# Artemo AI Documentation

Complete user documentation for Artemo AI Dashboard - built with VitePress.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run docs:dev

# Build for production
npm run docs:build

# Preview production build
npm run docs:preview
```

## 📁 Project Structure

```
docs-vitepress/
├── .vitepress/
│   ├── config.ts              # Site configuration
│   └── theme/                 # Custom theme
│       ├── index.ts
│       └── custom.css         # Artemo brand styling
├── getting-started/           # Getting started guides
├── workspaces/                # Workspace & project docs
├── tools/                     # AI tools documentation
├── admin/                     # Admin panel guides
├── integrations/              # Integration guides
├── content/                   # Content management
├── faq/                       # FAQ & troubleshooting
├── public/                    # Static assets
│   └── images/                # Screenshots & images
├── _TEMPLATE.md               # Page template
├── CONTRIBUTING.md            # Contribution guidelines
├── SCREENSHOT_GUIDE.md        # Screenshot standards
├── DEPLOYMENT.md              # Deployment guide
├── glossary.md                # Terminology
└── index.md                   # Homepage
```

## 🎨 Brand & Design

The documentation follows Artemo's production UI design system:

- **Primary Color**: #008F6B (Artemo green)
- **Typography**: Inter (body), Merriweather (headings)
- **Tone**: Professional, friendly, empowering
- **Audience**: Non-technical users (marketers, coaches, creators)

## 📝 Content Guidelines

### Writing Style

- **Voice**: Friendly but professional
- **Clarity**: Simple language, short sentences
- **Action-Oriented**: Use active voice and verbs
- **Non-Technical**: Explain jargon, use analogies

### Page Structure

Every documentation page follows a standard template:

1. **Overview** - What, why, who
2. **Navigation Path** - Where to find it
3. **Step-by-Step Guide** - Numbered actions with screenshots
4. **Tips & Best Practices** - Pro tips and common use cases
5. **Troubleshooting** - Common issues and solutions
6. **Related Resources** - Links to related pages
7. **FAQ** - Page-specific questions

See `_TEMPLATE.md` for the complete structure.

## 📸 Screenshots

All screenshots follow strict standards for consistency:

- **Format**: PNG, < 500KB
- **Size**: 1200-1600px wide
- **Naming**: `[section]-[feature]-[view].png`
- **Location**: `/public/images/[section]/`
- **Data**: Demo data only, no real customer info

See `SCREENSHOT_GUIDE.md` for complete standards.

## 🤝 Contributing

We welcome contributions! Please read:

1. **[CONTRIBUTING.md](./CONTRIBUTING.md)** - How to contribute
2. **[SCREENSHOT_GUIDE.md](./SCREENSHOT_GUIDE.md)** - Screenshot standards
3. **[_TEMPLATE.md](./_TEMPLATE.md)** - Page template

### Quick Contribution Steps

1. Fork the repository
2. Create a branch (`feature/add-api-docs`)
3. Make your changes
4. Test locally (`npm run docs:dev`)
5. Commit with clear message
6. Submit pull request

## 🚀 Deployment

Documentation auto-deploys to production on merge to `main`.

**Supported Platforms**:
- Netlify (recommended)
- Vercel

See `DEPLOYMENT.md` for detailed deployment instructions.

## 📚 Documentation Sections

### For Users

- **[Getting Started](./getting-started/)** - First steps with Artemo
- **[Tools](./tools/)** - Using AI tools effectively
- **[Workspaces & Projects](./workspaces/)** - Organization & collaboration
- **[Integrations](./integrations/)** - Connect external services
- **[Content Operations](./content/)** - Managing content & assets
- **[FAQ](./faq/)** - Common questions & troubleshooting

### For Administrators

- **[Admin Guide](./admin/)** - Platform administration
  - Tool creation
  - User management
  - Analytics & reporting
  - System configuration

## 🔧 Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Local Development

```bash
# Clone repository
git clone https://github.com/artemo-ai/docs.git
cd docs

# Install dependencies
npm install

# Start dev server (with hot reload)
npm run docs:dev
# → http://localhost:5173

# Build production version
npm run docs:build

# Preview production build
npm run docs:preview
# → http://localhost:4173
```

### Testing

Before submitting PR:

- [ ] Build completes without errors
- [ ] All links work
- [ ] Images load correctly
- [ ] Mobile responsive
- [ ] Search works
- [ ] No spelling/grammar errors

## 📦 Dependencies

### Core

- **VitePress**: Static site generator
- **Vue 3**: Framework (VitePress requirement)

### Dev Dependencies

See `package.json` for complete list.

## 🎯 Content Status

### ✅ Completed

- Site configuration & theme
- Homepage & navigation
- Getting Started section
- Tool documentation
- Admin guide (Tool Creation)
- Contributing guidelines
- Screenshot standards
- Deployment guide
- Glossary

### 🚧 In Progress

- Workspaces documentation
- Integration guides
- Advanced tool features
- Video tutorials

### 📋 Planned

- API documentation
- Release notes
- Case studies
- Interactive demos

## 📞 Support

### For Documentation Issues

- 🐛 **Report Bug**: Create GitHub issue
- 💡 **Suggest Improvement**: Create feature request
- 📧 **Contact**: docs@artemo.ai

### For Product Support

- 📖 **User Docs**: [docs.artemo.ai](#)
- 💬 **Community**: [community.artemo.ai](#)
- 📧 **Support**: hello@artemo.ai

## 📄 License

Copyright © 2025 Artemo AI. All rights reserved.

---

## Project Metadata

- **Framework**: VitePress 1.x
- **Node Version**: 18+
- **Build Time**: ~30 seconds
- **Deploy Time**: <2 minutes
- **Status**: ✅ Production Ready

---

*Built with intelligence, designed for creators.*

**Last Updated**: January 2025
