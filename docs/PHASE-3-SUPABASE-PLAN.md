# Phase 3: Supabase Backend Integration Plan

**Status:** 📚 ARCHIVED - Implementation Completed  
**Frontend:** ✅ Complete (Phase 2)  
**Backend:** ✅ Production Ready (Phase 3)  
**Date:** 2025-01-20 (Archived)

---

## 🚨 **IMPORTANT NOTICE**

**This document is now ARCHIVED.** Phase 3 implementation has been completed successfully. 

**For current system documentation, see:**
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Authoritative database schema
- [RLS_POLICIES.md](./RLS_POLICIES.md) - Current RLS policies
- [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md) - Current system architecture

---

## 🎯 **Phase 3 Overview**

✅ **COMPLETED**: Successfully transformed the Artemo AI Dashboard from a frontend-only application into a fully functional, production-ready platform using Supabase as our backend infrastructure.

**Key Achievements:**
- ✅ Complete backend integration with Supabase
- ✅ Fully dynamic tool and category system (no hardcoded data)
- ✅ Claude-first AI integration with OpenAI fallback
- ✅ Production-ready authentication and security
- ✅ Comprehensive error handling and monitoring

**Note:** The implementation details below represent the original plan. For current implementation details, refer to the actual codebase and updated documentation files.
## 🏗️ **Supabase Architecture**

### **Core Services We'll Use:**
- **Database**: PostgreSQL for all data storage
- **Authentication**: Built-in auth with email/password
- **Storage**: File uploads for knowledge base documents
- **Edge Functions**: Serverless functions for AI API calls
- **Real-time**: Live updates for admin changes
- **Row Level Security**: Data protection and user isolation

---

## 📋 **Phase 3 Implementation Steps**

### **Step 1: Database Schema & Authentication** 🗄️

**1.1 Database Schema Design**
```sql
-- Users (handled by Supabase Auth)
-- Additional user profile data
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tools
CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  primary_model TEXT NOT NULL,
  fallback_models TEXT[] DEFAULT '{}',
  prompt_instructions TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool Questions
CREATE TABLE tool_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('input', 'textarea', 'select')),
  placeholder TEXT,
  required BOOLEAN DEFAULT true,
  order_index INTEGER NOT NULL,
  options TEXT[], -- for select type
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat History
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tool_id UUID REFERENCES tools(id),
  project_id UUID REFERENCES projects(id),
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Base Files
CREATE TABLE knowledge_base_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tool_id UUID REFERENCES tools(id),
  chat_session_id UUID REFERENCES chat_sessions(id),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**1.2 Row Level Security (RLS)**
```sql
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- Categories and tools are public for reading, admin-only for writing
CREATE POLICY "Anyone can view active categories" ON categories FOR SELECT USING (active = true);
CREATE POLICY "Admins can manage categories" ON categories FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Projects are user-specific
CREATE POLICY "Users can manage own projects" ON projects FOR ALL USING (auth.uid() = user_id);

-- Chat sessions are user-specific
CREATE POLICY "Users can manage own chats" ON chat_sessions FOR ALL USING (auth.uid() = user_id);
```

**1.3 Authentication Setup**
- Configure Supabase Auth with email/password
- Set up user registration flow
- Implement admin role management
- Create protected routes

### **Step 2: API Layer & Data Services** 🔌

**2.1 Replace Mock API Service**
```typescript
// services/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// services/api.ts - Real implementation
export class SupabaseApiService {
  // Tools API
  async getTools(): Promise<ToolsApiResponse> {
    const { data, error } = await supabase
      .from('tools')
      .select(`
        *,
        category:categories(*),
        questions:tool_questions(*)
      `)
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as DynamicTool[] }
  }

  async createTool(tool: Omit<DynamicTool, 'id'>): Promise<ApiResponse<DynamicTool>> {
    // Implementation for creating tools
  }

  // Categories API
  async getCategories(): Promise<CategoriesApiResponse> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true })

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  }

  // Chat API with AI integration
  async sendChatMessage(toolId: string, messages: Message[], knowledgeBase?: string): Promise<ApiResponse<string>> {
    // Call Supabase Edge Function for AI processing
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: { toolId, messages, knowledgeBase }
    })

    if (error) return { success: false, error: error.message }
    return { success: true, data: data.response }
  }
}
```

**2.2 Authentication Service**
```typescript
// services/auth.ts
export class AuthService {
  async signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    })
    
    if (error) throw error
    return data
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error
    return data
  }

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }

  async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) throw error
    return data
  }
}
```

### **Step 3: AI Integration via Edge Functions** 🤖

**3.1 Create AI Chat Edge Function**
```typescript
// supabase/functions/ai-chat/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { toolId, messages, knowledgeBase } = await req.json()
    
    // Get tool configuration from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: tool } = await supabase
      .from('tools')
      .select('*')
      .eq('id', toolId)
      .single()

    if (!tool) {
      throw new Error('Tool not found')
    }

    // Call appropriate AI API based on tool configuration
    let aiResponse: string
    
    switch (tool.primary_model) {
      case 'Claude':
        aiResponse = await callAnthropic(tool, messages, knowledgeBase)
        break
      case 'ChatGPT':
      case 'OpenAI':
        aiResponse = await callOpenAI(tool, messages, knowledgeBase)
        break
      default:
        // Default to Claude (primary), fallback to OpenAI
        try {
          aiResponse = await callAnthropic(tool, messages, knowledgeBase)
        } catch (error) {
          aiResponse = await callOpenAI(tool, messages, knowledgeBase)
        }
    }

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function callOpenAI(tool: any, messages: any[], knowledgeBase?: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: tool.prompt_instructions },
        ...messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
        ...(knowledgeBase ? [{ role: 'system', content: `Knowledge Base: ${knowledgeBase}` }] : [])
      ],
    }),
  })

  const data = await response.json()
  return data.choices[0].message.content
}

// Similar functions for Claude, Grok, Gemini...
```

**3.2 File Upload Edge Function**
```typescript
// supabase/functions/upload-knowledge-base/index.ts
serve(async (req) => {
  // Handle file uploads to Supabase Storage
  // Process different file types (PDF, DOCX, TXT, MD)
  // Extract text content for AI processing
  // Store file metadata in knowledge_base_files table
})
```

### **Step 4: File Storage & Knowledge Base** 📁

**4.1 Supabase Storage Setup**
```typescript
// Create storage buckets
const { data, error } = await supabase.storage.createBucket('knowledge-base', {
  public: false,
  fileSizeLimit: 10485760, // 10MB
  allowedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]
})
```

**4.2 File Upload Service**
```typescript
// services/fileUpload.ts
export class FileUploadService {
  async uploadKnowledgeBaseFile(file: File, userId: string, toolId?: string): Promise<string> {
    const fileName = `${userId}/${Date.now()}-${file.name}`
    
    const { data, error } = await supabase.storage
      .from('knowledge-base')
      .upload(fileName, file)

    if (error) throw error

    // Store file metadata
    await supabase.from('knowledge_base_files').insert({
      user_id: userId,
      tool_id: toolId,
      filename: file.name,
      file_path: data.path,
      file_size: file.size,
      mime_type: file.type
    })

    return data.path
  }

  async getFileContent(filePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('knowledge-base')
      .download(filePath)

    if (error) throw error

    // Process file based on type and extract text
    return await this.extractTextFromFile(data)
  }

  private async extractTextFromFile(file: Blob): Promise<string> {
    // Implementation for different file types
    // PDF: Use PDF.js 
    // DOCX: Use mammoth.js
    // TXT/MD: Direct text extraction
  }
}
```

### **Step 5: Real-time Updates & Admin Features** ⚡

**5.1 Real-time Subscriptions**
```typescript
// hooks/useRealtimeTools.ts
export const useRealtimeTools = () => {
  const [tools, setTools] = useState<DynamicTool[]>([])

  useEffect(() => {
    // Subscribe to tools changes
    const subscription = supabase
      .channel('tools-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tools' },
        (payload) => {
          // Update tools in real-time
          handleToolsChange(payload)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { tools }
}
```

**5.2 Admin Analytics**
```typescript
// services/analytics.ts
export class AnalyticsService {
  async getUsageStats(): Promise<UsageStats> {
    const { data, error } = await supabase.rpc('get_usage_stats')
    if (error) throw error
    return data
  }

  async getToolPerformance(): Promise<ToolPerformance[]> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('tool_id, count(*)')
      .group('tool_id')
    
    if (error) throw error
    return data
  }
}
```

### **Step 6: Production Deployment & Security** 🚀

**6.1 Environment Configuration**
```bash
# .env.production
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key

# Supabase Edge Functions Environment
ANTHROPIC_API_KEY=your-anthropic-key  # Primary Model
OPENAI_API_KEY=your-openai-key        # Fallback Model
```

**6.2 Security Implementation**
- Row Level Security policies
- API rate limiting
- File upload validation
- Input sanitization
- CORS configuration
- Environment variable security

**6.3 Performance Optimization**
- Database indexing
- Query optimization
- Caching strategies
- CDN for static assets
- Image optimization

---

## 🎯 **Implementation Timeline**

### **Week 1: Foundation** ✅ COMPLETED
- ✅ Database schema design and migration
- ✅ Authentication setup  
- ✅ Basic API service replacement
- ✅ Removed all hardcoded data

### **Week 2: Core Features** ✅ COMPLETED
- ✅ Tools and categories CRUD (fully dynamic)
- ✅ User management
- ✅ Project system
- ✅ Admin panel functionality

### **Week 3: AI Integration** ✅ COMPLETED
- ✅ Edge functions for Claude (primary) and OpenAI (fallback)
- ✅ Chat system with real AI responses
- ✅ Knowledge base file processing
- ✅ Intelligent model fallback logic

### **Week 4: Advanced Features** ✅ COMPLETED
- ✅ Error handling and monitoring
- ✅ File upload system
- ✅ Storage service implementation
- ✅ Authentication store with Zustand

### **Week 5: Production Ready** ✅ COMPLETED
- ✅ Security hardening with RLS
- ✅ Performance optimization
- ✅ Documentation consolidation
- ✅ Full dynamic functionality validation

---

## 🔧 **Technical Requirements**

### **Supabase Setup:**
1. Create new Supabase project
2. Configure authentication providers
3. Set up storage buckets
4. Deploy edge functions
5. Configure environment variables

### **AI API Keys Required:**
- Anthropic API key (Claude) - **Primary Model**
- OpenAI API key (GPT-4) - **Fallback Model**

### **Development Tools:**
- Supabase CLI for local development
- Database migration tools
- Edge function testing
- File processing libraries

---

## 🎉 **Expected Outcomes**

After Phase 3 completion:

✅ **Fully Functional Backend**: Complete Supabase integration  
✅ **Real AI Responses**: Actual AI model integration  
✅ **User Authentication**: Secure login/registration  
✅ **File Processing**: Knowledge base document handling  
✅ **Admin Management**: Full administrative control  
✅ **Real-time Updates**: Live system updates  
✅ **Production Ready**: Scalable, secure, performant  

The Artemo AI Dashboard will be a complete, production-ready SaaS platform ready for real users and revenue generation! 🚀

---

**Ready to begin Phase 3 implementation with Supabase!** 🎯