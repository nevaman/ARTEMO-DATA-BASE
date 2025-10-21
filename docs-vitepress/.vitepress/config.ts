import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Artemo AI Documentation',
  description: 'Complete guide to using Artemo AI Dashboard - your intelligent copywriting companion',

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@400;700&display=swap', rel: 'stylesheet' }],
  ],

  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'Artemo AI Docs',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Tools', link: '/tools/' },
      { text: 'Admin Guide', link: '/admin/' },
      {
        text: 'Resources',
        items: [
          { text: 'FAQ', link: '/faq/' },
          { text: 'Glossary', link: '/glossary' },
          { text: 'Release Notes', link: '/release-notes' },
        ]
      }
    ],

    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Welcome to Artemo', link: '/getting-started/' },
            { text: 'First Login & Tour', link: '/getting-started/first-login' },
            { text: 'Quick Start Guide', link: '/getting-started/quick-start' },
            { text: 'Understanding the Dashboard', link: '/getting-started/dashboard-overview' },
          ]
        }
      ],

      '/workspaces/': [
        {
          text: 'Workspaces & Projects',
          items: [
            { text: 'Overview', link: '/workspaces/' },
            { text: 'Creating a Project', link: '/workspaces/create-project' },
            { text: 'Managing Projects', link: '/workspaces/manage-projects' },
            { text: 'Client Profiles', link: '/workspaces/client-profiles' },
            { text: 'Organizing Your Work', link: '/workspaces/organization' },
            { text: 'Team Collaboration', link: '/workspaces/collaboration' },
          ]
        }
      ],

      '/tools/': [
        {
          text: 'AI Tools & Workflows',
          items: [
            { text: 'Tool Overview', link: '/tools/' },
            { text: 'Using the Tool Launchpad', link: '/tools/launchpad' },
            { text: 'Pro Tools', link: '/tools/pro-tools' },
            { text: 'Tool Categories', link: '/tools/categories' },
            { text: 'Question Sequences', link: '/tools/question-sequences' },
            { text: 'Knowledge Base Integration', link: '/tools/knowledge-base' },
            { text: 'Templates & Recipes', link: '/tools/templates' },
          ]
        }
      ],

      '/integrations/': [
        {
          text: 'Client CRM & Integrations',
          items: [
            { text: 'Overview', link: '/integrations/' },
            { text: 'GoHighLevel Integration', link: '/integrations/gohighlevel' },
            { text: 'Sync Pipelines', link: '/integrations/sync-pipelines' },
            { text: 'Automations', link: '/integrations/automations' },
            { text: 'API Access', link: '/integrations/api' },
          ]
        }
      ],

      '/content/': [
        {
          text: 'Content Operations',
          items: [
            { text: 'Overview', link: '/content/' },
            { text: 'Managing Assets', link: '/content/assets' },
            { text: 'Knowledge Base', link: '/content/knowledge-base' },
            { text: 'Chat History', link: '/content/chat-history' },
            { text: 'Version Control', link: '/content/version-control' },
            { text: 'Export & Sharing', link: '/content/export' },
          ]
        }
      ],

      '/admin/': [
        {
          text: 'Admin & Settings',
          items: [
            { text: 'Admin Dashboard', link: '/admin/' },
            { text: 'Tool Creation', link: '/admin/tool-creation' },
            { text: 'Category Management', link: '/admin/categories' },
            { text: 'User Management', link: '/admin/users' },
            { text: 'User Roles', link: '/admin/roles' },
            { text: 'Announcements', link: '/admin/announcements' },
            { text: 'Analytics', link: '/admin/analytics' },
            { text: 'Billing', link: '/admin/billing' },
            { text: 'Security Settings', link: '/admin/security' },
          ]
        }
      ],

      '/faq/': [
        {
          text: 'FAQ & Troubleshooting',
          items: [
            { text: 'Frequently Asked Questions', link: '/faq/' },
            { text: 'Troubleshooting', link: '/faq/troubleshooting' },
            { text: 'Contact Support', link: '/faq/support' },
          ]
        }
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/artemo-ai' }
    ],

    footer: {
      message: 'Built with intelligence, designed for creators',
      copyright: 'Copyright © 2025 Artemo AI'
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: 'Search',
            buttonAriaLabel: 'Search documentation'
          },
          modal: {
            noResultsText: 'No results for',
            resetButtonTitle: 'Clear search',
            footer: {
              selectText: 'to select',
              navigateText: 'to navigate',
              closeText: 'to close'
            }
          }
        }
      }
    },

    editLink: {
      pattern: 'https://github.com/artemo-ai/docs/edit/main/docs/:path',
      text: 'Suggest changes to this page'
    },

    lastUpdated: {
      text: 'Last updated',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short'
      }
    }
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    lineNumbers: true
  }
})
