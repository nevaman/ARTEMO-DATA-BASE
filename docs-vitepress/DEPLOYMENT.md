---
title: Deployment Guide
description: Deploy Artemo documentation to Netlify or Vercel
---

# Deployment Guide

Deploy the Artemo AI documentation site to production using Netlify or Vercel. Both platforms offer excellent performance, automatic SSL, and GitHub integration.

---

## Prerequisites

- ✅ GitHub repository with docs source code
- ✅ Account on Netlify or Vercel
- ✅ VitePress build configured (`npm run docs:build`)
- ✅ Completed documentation content

---

## Option 1: Deploy to Netlify

### Step 1: Connect Repository

1. Log into [Netlify](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **"Deploy with GitHub"**
4. Authorize Netlify to access your repositories
5. Select your docs repository

### Step 2: Configure Build Settings

Enter these settings:

**Build Command**:
```bash
npm run docs:build
```

**Publish Directory**:
```
docs-vitepress/.vitepress/dist
```

**Node Version** (optional, in Environment Variables):
- Key: `NODE_VERSION`
- Value: `18` or `20`

### Step 3: Environment Variables (if needed)

If your docs use any API calls or dynamic data:

1. Go to **Site settings** → **Environment variables**
2. Add required variables
3. Save changes

### Step 4: Deploy

1. Click **"Deploy site"**
2. Wait for build to complete (usually 2-3 minutes)
3. Your site will be live at `[random-name].netlify.app`

### Step 5: Custom Domain (Optional)

1. Go to **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Enter your domain (e.g., `docs.artemo.ai`)
4. Follow DNS configuration instructions
5. Wait for SSL certificate (automatic, 5-10 minutes)

---

## Option 2: Deploy to Vercel

### Step 1: Connect Repository

1. Log into [Vercel](https://vercel.com)
2. Click **"Add New Project"**
3. Choose **"Import Git Repository"**
4. Select your GitHub repository
5. Click **"Import"**

### Step 2: Configure Project

Vercel auto-detects VitePress in most cases. Verify these settings:

**Framework Preset**: `Other` (or `VitePress` if available)

**Build Command**:
```bash
npm run docs:build
```

**Output Directory**:
```
docs-vitepress/.vitepress/dist
```

**Install Command** (usually auto-detected):
```bash
npm install
```

### Step 3: Environment Variables (if needed)

1. In project settings, go to **Environment Variables**
2. Add any required variables
3. Choose environments (Production, Preview, Development)
4. Save

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for build (usually 1-2 minutes)
3. Your site will be live at `[project-name].vercel.app`

### Step 5: Custom Domain (Optional)

1. Go to project **Settings** → **Domains**
2. Click **"Add"**
3. Enter your domain (e.g., `docs.artemo.ai`)
4. Follow DNS configuration steps
5. SSL is automatic

---

## package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "docs:dev": "vitepress dev docs-vitepress",
    "docs:build": "vitepress build docs-vitepress",
    "docs:preview": "vitepress preview docs-vitepress"
  }
}
```

---

## GitHub Actions (Optional)

Automate builds and deployments with GitHub Actions.

### Create Workflow File

Create `.github/workflows/deploy-docs.yml`:

```yaml
name: Deploy Documentation

on:
  push:
    branches:
      - main
    paths:
      - 'docs-vitepress/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Build Documentation
        run: npm run docs:build

      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v2
        with:
          publish-dir: './docs-vitepress/.vitepress/dist'
          production-branch: main
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: "Deploy from GitHub Actions"
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

### Setup Secrets

Add these secrets to your GitHub repository:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add `NETLIFY_AUTH_TOKEN` (from Netlify account settings)
3. Add `NETLIFY_SITE_ID` (from Netlify site settings)

---

## Build Optimization

### 1. Caching Dependencies

**Netlify**:
- Automatically caches `node_modules`
- Configure in `netlify.toml`:

```toml
[build]
  command = "npm run docs:build"
  publish = "docs-vitepress/.vitepress/dist"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-caching"
```

**Vercel**:
- Automatically caches dependencies
- No configuration needed

### 2. Optimize Images

Before deploying, compress images:
- Use TinyPNG or ImageOptim
- Target < 500KB per image
- Serve in WebP format when possible

### 3. Enable Compression

Both platforms enable gzip/brotli automatically.

---

## Preview Deployments

### Netlify Deploy Previews

- Automatic for every pull request
- Unique URL for each preview
- Comment posted in PR with preview link

Enable in **Site settings** → **Build & deploy** → **Deploy previews**

### Vercel Preview Deployments

- Automatic for all branches and PRs
- Unique URL per deployment
- Comment with preview link in PR

No configuration needed, works out of the box.

---

## Custom Configuration Files

### netlify.toml

Create in repository root:

```toml
[build]
  command = "npm run docs:build"
  publish = "docs-vitepress/.vitepress/dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### vercel.json

Create in repository root:

```json
{
  "buildCommand": "npm run docs:build",
  "outputDirectory": "docs-vitepress/.vitepress/dist",
  "framework": null,
  "installCommand": "npm install",
  "devCommand": "npm run docs:dev",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

---

## Monitoring and Analytics

### Add Analytics

**Google Analytics**:
```ts
// .vitepress/config.ts
export default {
  head: [
    [
      'script',
      { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX' }
    ],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-XXXXXXXX');`
    ]
  ]
}
```

**Plausible Analytics** (privacy-friendly):
```ts
head: [
  [
    'script',
    { defer: '', 'data-domain': 'docs.artemo.ai', src: 'https://plausible.io/js/script.js' }
  ]
]
```

### Monitor Performance

**Netlify**:
- Built-in analytics available (paid feature)
- Access in site dashboard

**Vercel**:
- Built-in speed insights (free)
- Real-time performance monitoring
- Enable in project settings

---

## Troubleshooting

### Build Fails: "command not found"

**Cause**: Build command incorrect or scripts missing

**Solution**:
1. Verify `package.json` has `docs:build` script
2. Check build command in platform settings
3. Ensure all dependencies are in `package.json`

---

### Build Fails: "Cannot find module"

**Cause**: Missing dependencies

**Solution**:
```bash
npm install --save-dev vitepress
```

Commit updated `package.json` and `package-lock.json`

---

### 404 on Page Navigation

**Cause**: SPA routing not configured

**Solution**:

**Netlify**: Add `_redirects` file in `public/`:
```
/*    /index.html   200
```

**Vercel**: Add to `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/:path*", "destination": "/index.html" }
  ]
}
```

---

### Images Not Loading

**Cause**: Incorrect image paths

**Solution**:
- Images must be in `/docs-vitepress/public/`
- Reference as `/images/filename.png` (not `./images/`)
- Check file names match exactly (case-sensitive)

---

### Slow Build Times

**Cause**: Large dependencies or images

**Solution**:
1. Enable caching (automatic on both platforms)
2. Compress images before committing
3. Use `npm ci` instead of `npm install` in build command
4. Remove unused dependencies

---

## Rollback Strategy

### Netlify Rollback

1. Go to **Deploys**
2. Find previous successful deploy
3. Click three dots → **"Publish deploy"**
4. Confirm - instant rollback

### Vercel Rollback

1. Go to **Deployments**
2. Find previous production deployment
3. Click three dots → **"Promote to Production"**
4. Confirm - instant rollback

---

## Security

### Content Security Policy

Add to `netlify.toml` or `vercel.json`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

### HTTPS Only

Both platforms enforce HTTPS automatically. No configuration needed.

---

## Post-Deployment Checklist

- [ ] Site loads correctly at production URL
- [ ] All navigation links work
- [ ] Images load properly
- [ ] Search functionality works
- [ ] Mobile responsive design verified
- [ ] SSL certificate active (HTTPS)
- [ ] Custom domain configured (if applicable)
- [ ] Analytics tracking verified
- [ ] 404 page displays correctly
- [ ] Performance metrics acceptable

---

## Continuous Deployment

With GitHub integration:

1. **Push to `main` branch** → Automatic production deployment
2. **Push to other branch** → Automatic preview deployment
3. **Open pull request** → Preview comment added to PR

No manual deployment needed!

---

*Deploy with confidence - both platforms make it simple and reliable.*

*Last updated: January 2025*
