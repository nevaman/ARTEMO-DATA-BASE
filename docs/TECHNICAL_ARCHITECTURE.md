# Artemo AI Dashboard - Technical Architecture

**Status:** Approved  
**Last Updated:** 2025-01-20  
**Author:** Technical Documentation Team  

## 🏗️ Technology Stack

### **Frontend Architecture**
- **React 19**: Latest React with concurrent features and improved performance
- **TypeScript**: Full type safety throughout the application
- **Vite**: Lightning-fast development server and optimized production builds
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **React Markdown**: Rich text rendering for AI-generated content

### **Backend Infrastructure**
- **Supabase**: Complete backend-as-a-service platform
- **PostgreSQL**: Robust relational database with advanced features
- **Edge Functions**: Serverless functions for AI processing (Deno runtime)
- **Supabase Storage**: Secure file storage for knowledge base documents
- **Row Level Security**: Database-level security policies

### **AI Integration**
- **Claude (Anthropic)**: Primary AI model (claude-3-sonnet-20240229)
- **OpenAI GPT-4o-mini**: Secondary AI model with automatic fallback support
- **Edge Function Processing**: Serverless AI API calls with intelligent failover

### **State Management**
- **Zustand**: Lightweight state management for authentication
- **React Hooks**: Custom hooks for data fetching and management
- **Local Storage**: Persistent client-side preferences and settings

## 🗄️ Database Schema

### **Core Tables**

#### **Authentication & Users**
```sql
-- user_profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  organization TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Dynamic Tool System**
```sql
-- categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- tools
CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  primary_model TEXT NOT NULL,
  fallback_models TEXT[] DEFAULT '{}',
  prompt_instructions TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- tool_questions
CREATE TABLE tool_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('input', 'textarea', 'select')),
  placeholder TEXT,
  required BOOLEAN DEFAULT false,
  question_order INTEGER NOT NULL,
  options TEXT[], -- For select type questions
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **User Data & Content**
```sql
-- projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- chat_sessions
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools(id),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  session_data JSONB, -- Store messages and session state
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- knowledge_base_files
CREATE TABLE knowledge_base_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Row Level Security Policies**

#### **User Data Protection**
```sql
-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users manage own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own chats" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own files" ON knowledge_base_files
  FOR ALL USING (auth.uid() = user_id);
```

#### **Admin-Controlled Content**
```sql
-- Public read access, admin-only write access
CREATE POLICY "Anyone can view active categories" ON categories
  FOR SELECT USING (active = true);

CREATE POLICY "Admins manage categories" ON categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Anyone can view active tools" ON tools
  FOR SELECT USING (active = true);

CREATE POLICY "Admins manage tools" ON tools
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

## 🔌 API Architecture

### **Service Layer Architecture**
The API layer is organized into focused services with clear separation of concerns:

- **AppApiService**: User-facing operations (tools, projects, chat, files)
- **AdminApiService**: Administrative operations (user management, analytics)
- **AuthService**: Authentication with session stability management
- **StorageService**: File upload and text extraction
- **VectorSearchService**: AI-powered tool recommendations

**For detailed API documentation:** [API_SERVICES.md](./API_SERVICES.md)

## 🤖 AI Integration Architecture

### **AI Processing Pipeline**
1. **Tool Configuration**: Dynamic AI settings from database
2. **Context Building**: Knowledge base + client profile integration
3. **Model Selection**: Primary model with automatic fallback
4. **Response Generation**: Intelligent content creation
5. **Analytics Tracking**: Usage monitoring and optimization

### **Vector Search System**
- **Tool Embeddings**: Semantic understanding of tool capabilities
- **Query Processing**: User intent analysis and matching
- **Recommendation Engine**: AI-powered tool suggestions
- **Token Optimization**: 10-50% reduction in AI API costs

**For detailed AI integration:** [AI_INTEGRATION.md](./AI_INTEGRATION.md)

## 🔄 Data Flow Architecture

### **User Interaction Flow**
```
User Action → React Component → Custom Hook → API Service → Supabase → Database
     ↓                                                           ↓
Response ← Component Update ← State Update ← API Response ← Query Result
```

### **Admin Tool Creation Flow**
```
Admin Creates Tool → AdminTools Component → API Service → Database
                                                    ↓
Tool Available → Users See Tool → Tool Selection → AI Edge Function
                                                          ↓
AI Response → Chat Interface → Save to Database → User Project/History
```

### **Authentication Flow**
```
User Login → AuthService → Supabase Auth → Profile Fetch → Session Stability → Global State
                                                     ↓
Protected Routes → Role Checking → Session Monitoring → Admin Panel Access (if admin)
```

## 🛠️ Development & Build Process

### **Development Environment**
```bash
# Local Development
npm run dev              # Start Vite development server
```

### **Production Build**
```bash
# Build Process
npm run build           # Create production build
npm run preview         # Preview production build locally

# Environment Variables
VITE_SUPABASE_URL=production_url
VITE_SUPABASE_ANON_KEY=production_key
OPENAI_API_KEY=production_openai_key
ANTHROPIC_API_KEY=production_anthropic_key
```

### **Deployment Architecture**
- **Frontend**: Deployed to Bolt Hosting with environment variables
- **Backend**: Supabase cloud infrastructure
- **Edge Functions**: Auto-deployed to Supabase Edge Runtime
- **Database**: PostgreSQL on Supabase cloud
- **Storage**: Supabase Storage for knowledge base files

## 🔒 Security Implementation

### **Authentication Security**
- **JWT Tokens**: Secure session management via Supabase Auth
- **Role-Based Access**: Granular permissions with database-level enforcement
- **Session Stability**: Advanced refresh handling to prevent UI flickering
- **Timeout Protection**: Prevents infinite refresh loops

### **Data Security**
- **Row Level Security**: 47 policies across 11 tables for complete data isolation
- **API Security**: Protected endpoints with authentication middleware
- **File Security**: Secure upload with validation and virus scanning
- **Audit Trail**: Complete logging of administrative actions

### **Infrastructure Security**
- **HTTPS Only**: All communications encrypted in transit
- **Environment Variables**: Secure handling of API keys and secrets
- **Database Encryption**: Data encrypted at rest in Supabase

## 📊 Performance & Monitoring

### **Performance Optimization**
- **Code Splitting**: Lazy loading of admin components
- **Bundle Optimization**: Vite-powered build optimization
- **Session Stability**: Prevents redundant API calls during auth refresh
- **Vector Search**: Optimized tool recommendations with token savings
- **Edge Computing**: AI processing at edge locations for reduced latency

### **Monitoring & Analytics**
- **Error Tracking**: Comprehensive error boundary implementation
- **Usage Analytics**: Tool and feature usage tracking
- **Auth Stability**: Session refresh monitoring and logging
- **AI Performance**: Model usage and fallback tracking

---

**For detailed documentation:**
- [Database Schema](./DATABASE_SCHEMA.md)
- [RLS Policies](./RLS_POLICIES.md)
- [API Services](./API_SERVICES.md)
- [AI Integration](./AI_INTEGRATION.md)

This architecture ensures Artemo AI Dashboard is scalable, secure, and maintainable while providing excellent performance for both users and administrators.