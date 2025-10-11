import React, { useState, useEffect } from 'react';
import { SupabaseApiService } from '../services/supabaseApi';
import { BoxIcon, UsersIcon, SettingsIcon, ActivityIcon, ChevronDownIcon, TrendingUpIcon, AlertTriangleIcon, CheckCircleIcon } from './Icons';

interface DashboardMetrics {
  aiGenerations24h: number;
  dailyActiveUsers: number;
  newSignups24h: number;
  aiSuccessRate: number;
  totalUsers: number;
  activeTools: number;
  totalCategories: number;
}

interface AIUsageMetrics {
  hourlyPattern: number[];
  totalTokensUsed: number;
  costEstimate: number;
  fallbackRate: number;
}

interface UserEngagementMetrics {
  dauTrend: number[];
  retention7day: number;
  signupSources: Array<{ source: string; count: number }>;
}

interface SystemHealthMetrics {
  aiSuccessRateTrend: number[];
  criticalAlerts: Array<{
    id: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    timestamp: string;
  }>;
  modelFailures: Array<{
    toolName: string;
    failureCount: number;
    primaryModel: string;
  }>;
}

interface AdminActivityLog {
  toolActions: Array<{
    action: string;
    toolName: string;
    adminName: string;
    timestamp: string;
  }>;
  adminLogins: Array<{
    adminName: string;
    timestamp: string;
    ipAddress?: string;
  }>;
  systemChanges: Array<{
    change: string;
    details: string;
    timestamp: string;
  }>;
}

const SparklineChart: React.FC<{ 
  data: number[]; 
  className?: string; 
  color?: string;
  height?: number;
}> = ({ 
  data, 
  className = "w-full h-8", 
  color = "stroke-primary-accent",
  height = 32
}) => {
  if (!data || data.length === 0) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        points={points}
        className={color}
      />
    </svg>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  trend?: number[];
  trendColor?: string;
  subtitle?: string;
  onClick?: () => void;
  alertLevel?: 'normal' | 'warning' | 'critical';
}> = ({ 
  title, 
  value, 
  icon: Icon, 
  iconColor, 
  trend, 
  trendColor = "text-primary-accent", 
  subtitle, 
  onClick,
  alertLevel = 'normal'
}) => {
  const borderColor = alertLevel === 'critical' ? 'border-red-500' : 
                     alertLevel === 'warning' ? 'border-yellow-500' : 
                     'border-light-border dark:border-dark-border';
  
  return (
    <div 
      className={`bg-light-bg-component dark:bg-dark-bg-component border-2 ${borderColor} rounded-lg p-6 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page hover:shadow-lg' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex-grow">
          <p className="text-sm font-medium text-light-text-tertiary dark:text-dark-text-tertiary mb-1">
            {title}
          </p>
          <p className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-2 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        <Icon className={`w-10 h-10 ${iconColor} flex-shrink-0`} />
      </div>
      {trend && trend.length > 0 && (
        <div className="mt-3">
          <SparklineChart data={trend} color={trendColor} height={24} />
        </div>
      )}
    </div>
  );
};

const AlertBanner: React.FC<{ alerts: SystemHealthMetrics['criticalAlerts'] }> = ({ alerts }) => {
  if (!alerts || alerts.length === 0) return null;

  const criticalAlerts = alerts.filter(a => a.type === 'error');
  const warnings = alerts.filter(a => a.type === 'warning');

  return (
    <div className="mb-6 space-y-2">
      {criticalAlerts.map(alert => (
        <div key={alert.id} className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg shadow-sm">
          <AlertTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <div className="flex-grow">
            <p className="font-semibold text-red-800 dark:text-red-200">{alert.message}</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {new Date(alert.timestamp).toLocaleString()}
            </p>
          </div>
          <button className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200">
            <span className="text-xs font-medium">INVESTIGATE</span>
          </button>
        </div>
      ))}
      {warnings.map(alert => (
        <div key={alert.id} className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded-r-lg shadow-sm">
          <AlertTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <div className="flex-grow">
            <p className="font-semibold text-yellow-800 dark:text-yellow-200">{alert.message}</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              {new Date(alert.timestamp).toLocaleString()}
            </p>
          </div>
          <button className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200">
            <span className="text-xs font-medium">REVIEW</span>
          </button>
        </div>
      ))}
    </div>
  );
};

const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  onToggle?: (isExpanded: boolean) => void;
}> = ({ title, icon, children, defaultExpanded = false, onToggle }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    if (onToggle) {
      onToggle(newState);
    }
  };

  return (
    <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg overflow-hidden shadow-sm">
      <button
        onClick={handleToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="font-serif text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
            {title}
          </h3>
        </div>
        <ChevronDownIcon className={`w-5 h-5 text-light-text-tertiary dark:text-dark-text-tertiary transition-transform duration-200 ${
          isExpanded ? 'rotate-180' : ''
        }`} />
      </button>
      {isExpanded && (
        <div className="border-t border-light-border dark:border-dark-border">
          {children}
        </div>
      )}
    </div>
  );
};

export const AdminDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Data states for each section
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>({
    aiGenerations24h: 0,
    dailyActiveUsers: 0,
    newSignups24h: 0,
    aiSuccessRate: 0,
    totalUsers: 0,
    activeTools: 0,
    totalCategories: 0,
  });

  const [aiUsageMetrics, setAiUsageMetrics] = useState<AIUsageMetrics>({
    hourlyPattern: [],
    totalTokensUsed: 0,
    costEstimate: 0,
    fallbackRate: 0,
  });

  const [userEngagementMetrics, setUserEngagementMetrics] = useState<UserEngagementMetrics>({
    dauTrend: [],
    retention7day: 0,
    signupSources: [],
  });

  const [systemHealthMetrics, setSystemHealthMetrics] = useState<SystemHealthMetrics>({
    aiSuccessRateTrend: [],
    criticalAlerts: [],
    modelFailures: [],
  });

  const [adminActivityLog, setAdminActivityLog] = useState<AdminActivityLog>({
    toolActions: [],
    adminLogins: [],
    systemChanges: [],
  });

  const [loadedSections, setLoadedSections] = useState<Set<string>>(new Set());

  const api = SupabaseApiService.getInstance();

  // Fetch core dashboard metrics (always loaded)
  const fetchDashboardMetrics = async () => {
    try {
      const response = await api.getDashboardAnalytics(timeRange);
      if (response.success && response.data) {
        setDashboardMetrics({
          aiGenerations24h: response.data.ai_generations_24h || 0,
          dailyActiveUsers: response.data.daily_active_users || 0,
          newSignups24h: response.data.new_signups_24h || 0,
          aiSuccessRate: response.data.ai_success_rate || 100,
          totalUsers: response.data.total_users || 0,
          activeTools: response.data.active_tools || 0,
          totalCategories: response.data.total_categories || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error);
    }
  };

  // Fetch AI usage metrics (lazy loaded)
  const fetchAIUsageMetrics = async () => {
    if (loadedSections.has('ai-usage')) return;
    
    try {
      const response = await api.getAIUsageMetrics(timeRange);
      if (response.success && response.data) {
        setAiUsageMetrics({
          hourlyPattern: response.data.hourly_pattern || [],
          totalTokensUsed: response.data.total_tokens_used || 0,
          costEstimate: response.data.cost_estimate || 0,
          fallbackRate: response.data.fallback_rate || 0,
        });
        setLoadedSections(prev => new Set([...prev, 'ai-usage']));
      }
    } catch (error) {
      console.error('Failed to fetch AI usage metrics:', error);
    }
  };

  // Fetch user engagement metrics (lazy loaded)
  const fetchUserEngagementMetrics = async () => {
    if (loadedSections.has('user-engagement')) return;
    
    try {
      const response = await api.getUserEngagementMetrics(timeRange);
      if (response.success && response.data) {
        setUserEngagementMetrics({
          dauTrend: response.data.dau_trend || [],
          retention7day: response.data.retention_7day || 0,
          signupSources: response.data.signup_sources || [],
        });
        setLoadedSections(prev => new Set([...prev, 'user-engagement']));
      }
    } catch (error) {
      console.error('Failed to fetch user engagement metrics:', error);
    }
  };

  // Fetch system health metrics (lazy loaded)
  const fetchSystemHealthMetrics = async () => {
    if (loadedSections.has('system-health')) return;
    
    try {
      const response = await api.getSystemHealthMetrics();
      if (response.success && response.data) {
        setSystemHealthMetrics({
          aiSuccessRateTrend: response.data.ai_success_rate_trend || [],
          criticalAlerts: response.data.critical_alerts || [],
          modelFailures: response.data.model_failures || [],
        });
        setLoadedSections(prev => new Set([...prev, 'system-health']));
      }
    } catch (error) {
      console.error('Failed to fetch system health metrics:', error);
    }
  };

  // Fetch admin activity log (lazy loaded)
  const fetchAdminActivityLog = async () => {
    if (loadedSections.has('admin-activity')) return;
    
    try {
      const response = await api.getAdminActivityLog(20);
      if (response.success && response.data) {
        setAdminActivityLog({
          toolActions: response.data.tool_actions || [],
          adminLogins: response.data.admin_logins || [],
          systemChanges: response.data.system_changes || [],
        });
        setLoadedSections(prev => new Set([...prev, 'admin-activity']));
      }
    } catch (error) {
      console.error('Failed to fetch admin activity log:', error);
    }
  };

  // Initial load and auto-refresh setup
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        await fetchDashboardMetrics();
        await fetchSystemHealthMetrics(); // Load alerts immediately
        setLastRefresh(new Date());
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error('Dashboard loading error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [timeRange]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(async () => {
      await fetchDashboardMetrics();
      if (loadedSections.has('system-health')) {
        await fetchSystemHealthMetrics();
      }
      setLastRefresh(new Date());
    }, 60000); // Refresh every 60 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, loadedSections, timeRange]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await fetchDashboardMetrics();
      
      // Refresh loaded sections
      if (loadedSections.has('ai-usage')) {
        setLoadedSections(prev => {
          const newSet = new Set(prev);
          newSet.delete('ai-usage');
          return newSet;
        });
        await fetchAIUsageMetrics();
      }
      
      if (loadedSections.has('user-engagement')) {
        setLoadedSections(prev => {
          const newSet = new Set(prev);
          newSet.delete('user-engagement');
          return newSet;
        });
        await fetchUserEngagementMetrics();
      }
      
      if (loadedSections.has('system-health')) {
        setLoadedSections(prev => {
          const newSet = new Set(prev);
          newSet.delete('system-health');
          return newSet;
        });
        await fetchSystemHealthMetrics();
      }
      
      if (loadedSections.has('admin-activity')) {
        setLoadedSections(prev => {
          const newSet = new Set(prev);
          newSet.delete('admin-activity');
          return newSet;
        });
        await fetchAdminActivityLog();
      }
      
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to refresh dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleSectionToggle = (sectionName: string, isExpanded: boolean) => {
    if (isExpanded) {
      switch (sectionName) {
        case 'ai-usage':
          fetchAIUsageMetrics();
          break;
        case 'user-engagement':
          fetchUserEngagementMetrics();
          break;
        case 'system-health':
          fetchSystemHealthMetrics();
          break;
        case 'admin-activity':
          fetchAdminActivityLog();
          break;
      }
    }
  };

  if (loading && !dashboardMetrics.aiGenerations24h) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-accent mx-auto mb-4"></div>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Loading strategic dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header with Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Strategic Command Center
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Real-time insights for data-driven business decisions
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 text-primary-accent focus:ring-primary-accent border-gray-300 rounded"
              />
              <span className="text-light-text-secondary dark:text-dark-text-secondary">Auto-refresh</span>
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-text-on-accent"></div>
              ) : (
                <ActivityIcon className="w-4 h-4" />
              )}
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <div className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
              Updated: {lastRefresh.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">Error: {error}</p>
          <button 
            onClick={handleRefresh}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Critical Alerts Banner */}
      <AlertBanner alerts={systemHealthMetrics.criticalAlerts} />

      {/* Section 1: AI Operations & Cost Intelligence */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
          <TrendingUpIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          AI Operations Overview
        </h2>
        <MetricCard
          title="AI Generations (24h)"
          value={dashboardMetrics.aiGenerations24h.toLocaleString()}
          icon={TrendingUpIcon}
          iconColor="text-blue-600 dark:text-blue-400"
          trend={aiUsageMetrics.hourlyPattern}
          trendColor="text-blue-500"
          subtitle={`${aiUsageMetrics.totalTokensUsed.toLocaleString()} total interactions`}
          onClick={() => handleSectionToggle('ai-usage', true)}
        />
      </div>

      {/* Section 2: User Growth & Engagement Analytics */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
          <UsersIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
          User Growth & Engagement Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Daily Active Users"
            value={dashboardMetrics.dailyActiveUsers}
            icon={UsersIcon}
            iconColor="text-green-600 dark:text-green-400"
            trend={userEngagementMetrics.dauTrend}
            trendColor="text-green-500"
            subtitle="Click for engagement breakdown"
            onClick={() => handleSectionToggle('user-engagement', true)}
          />
          <MetricCard
            title="New Signups (24h)"
            value={dashboardMetrics.newSignups24h}
            icon={UsersIcon}
            iconColor="text-purple-600 dark:text-purple-400"
            subtitle={userEngagementMetrics.signupSources.length > 0 ? 
              userEngagementMetrics.signupSources.map(s => `${s.source}: ${s.count}`).join(' • ') : 
              'No recent signups'
            }
          />
          <MetricCard
            title="7-Day Retention"
            value={`${userEngagementMetrics.retention7day}%`}
            icon={ActivityIcon}
            iconColor="text-orange-600 dark:text-orange-400"
            alertLevel={userEngagementMetrics.retention7day < 50 ? 'critical' : userEngagementMetrics.retention7day < 70 ? 'warning' : 'normal'}
            subtitle="User retention rate"
          />
        </div>
      </div>

      {/* Section 3: AI Performance & Critical Alerts */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
          AI Performance & Service Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="AI Success Rate"
            value={`${dashboardMetrics.aiSuccessRate}%`}
            icon={CheckCircleIcon}
            iconColor={dashboardMetrics.aiSuccessRate >= 95 ? "text-green-600 dark:text-green-400" : 
                      dashboardMetrics.aiSuccessRate >= 90 ? "text-yellow-600 dark:text-yellow-400" : 
                      "text-red-600 dark:text-red-400"}
            trend={systemHealthMetrics.aiSuccessRateTrend}
            trendColor={dashboardMetrics.aiSuccessRate >= 95 ? "text-green-500" : 
                       dashboardMetrics.aiSuccessRate >= 90 ? "text-yellow-500" : 
                       "text-red-500"}
            subtitle="24-hour performance trend"
            alertLevel={dashboardMetrics.aiSuccessRate < 90 ? 'critical' : dashboardMetrics.aiSuccessRate < 95 ? 'warning' : 'normal'}
          />
          <MetricCard
            title="Model Fallback Rate"
            value={`${aiUsageMetrics.fallbackRate.toFixed(1)}%`}
            icon={AlertTriangleIcon}
            iconColor={aiUsageMetrics.fallbackRate <= 5 ? "text-green-600 dark:text-green-400" : 
                      aiUsageMetrics.fallbackRate <= 10 ? "text-yellow-600 dark:text-yellow-400" : 
                      "text-red-600 dark:text-red-400"}
            subtitle={aiUsageMetrics.fallbackRate > 10 ? "⚠️ Above threshold" : "Within normal range"}
            alertLevel={aiUsageMetrics.fallbackRate > 10 ? 'critical' : aiUsageMetrics.fallbackRate > 5 ? 'warning' : 'normal'}
          />
        </div>
      </div>

      {/* Section 4: Platform Inventory Overview */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
          <BoxIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          Platform Inventory Overview
        </h2>
        <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <p className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                {dashboardMetrics.totalUsers.toLocaleString()}
              </p>
              <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                Total Users
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                +{dashboardMetrics.newSignups24h} today
              </p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                {dashboardMetrics.activeTools}
              </p>
              <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                Active AI Tools
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Operational
              </p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                {dashboardMetrics.totalCategories}
              </p>
              <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                Tool Categories
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Organized
              </p>
            </div>
          </div>
          <div className="mt-6 text-center">
            <p className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
              {(dashboardMetrics as any).total_interactions?.toLocaleString() || '0'}
            </p>
            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
              Total AI Interactions
            </p>
          </div>
        </div>
      </div>

      {/* Section 5: Administrative Activity Monitor */}
      <CollapsibleSection
        title="Administrative Activity Monitor"
        icon={<ActivityIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
        defaultExpanded={false}
        onToggle={(isExpanded) => handleSectionToggle('admin-activity', isExpanded)}
      >
        <div className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tool Management Actions */}
            <div>
              <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-3 flex items-center gap-2">
                <BoxIcon className="w-4 h-4 text-blue-600" />
                Recent Tool Actions
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {adminActivityLog.toolActions.length > 0 ? (
                  adminActivityLog.toolActions.map((action, index) => (
                    <div key={index} className="p-3 bg-light-bg-sidebar dark:bg-dark-bg-page rounded-md border-l-2 border-blue-500">
                      <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                        {action.action}
                      </p>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {action.toolName}
                      </p>
                      <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                        by {action.adminName} • {action.timestamp}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary italic">
                    No recent tool actions
                  </p>
                )}
              </div>
            </div>

            {/* Admin Login History */}
            <div>
              <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-3 flex items-center gap-2">
                <UsersIcon className="w-4 h-4 text-green-600" />
                Admin Login History
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {adminActivityLog.adminLogins.length > 0 ? (
                  adminActivityLog.adminLogins.map((login, index) => (
                    <div key={index} className="p-3 bg-light-bg-sidebar dark:bg-dark-bg-page rounded-md border-l-2 border-green-500">
                      <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                        {login.adminName}
                      </p>
                      <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                        {login.timestamp}
                      </p>
                      {login.ipAddress && (
                        <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                          IP: {login.ipAddress}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary italic">
                    No recent admin logins
                  </p>
                )}
              </div>
            </div>

            {/* System Changes */}
            <div>
              <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-3 flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-purple-600" />
                 System Changes
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {adminActivityLog.systemChanges.length > 0 ? (
                  adminActivityLog.systemChanges.map((change, index) => (
                    <div key={index} className="p-3 bg-light-bg-sidebar dark:bg-dark-bg-page rounded-md border-l-2 border-purple-500">
                      <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                        {change.change}
                      </p>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {change.details}
                      </p>
                      <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                        {change.timestamp}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary italic">
                    No recent system changes
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
};