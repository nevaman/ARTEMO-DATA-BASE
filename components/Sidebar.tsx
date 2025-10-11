import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
// Correcting assumed paths based on build errors
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { AuthService } from '../services/auth';
import { useCategories } from '../hooks/useCategories';
import { ChatActionMenu } from './ChatActionMenu';
import type { Project, DynamicTool, ChatHistoryItem } from '../types';
import { useTools } from '../hooks/useTools';
import {
    ArtemoFullLogo, PlusIcon, SearchIcon, DashboardIcon, BoxIcon, HistoryIcon,
    UsersIcon, EditIcon, MessageSquareIcon, MailIcon, FileTextIcon,
    MicIcon, ActivityIcon, BellIcon, SettingsIcon, HelpCircleIcon, LogOutIcon, FolderIcon,
    StarIcon, ChevronDownIcon, TrashIcon, UserPlusIcon, MoreHorizontalIcon, BriefcaseIcon
} from './Icons';

interface SidebarProps {
    projects: Project[];
    chatHistory: ChatHistoryItem[];
    onInitiateToolActivation: (tool: DynamicTool) => void;
}

const ChatSearchButton: React.FC = () => {
    const { openChatSearch } = useUIStore();

    return (
        <div className="relative my-4">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-tertiary dark:text-dark-text-tertiary" />
            <button
                onClick={openChatSearch}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-sm border border-light-border dark:border-dark-border bg-light-bg-component dark:bg-dark-bg-component text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page focus:ring-2 focus:ring-primary-accent focus:outline-none text-left transition-colors"
            >
                Search conversations...
            </button>
        </div>
    );
};

const NavLink: React.FC<{
    to: string;
    icon: React.ReactNode;
    label: string;
}> = ({ to, icon, label }) => {
    const location = useLocation();
    const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

    return (
        <Link
            to={to}
            className={`flex items-center gap-3 px-2.5 py-2 rounded-sm text-sm font-medium transition-colors ${isActive
                    ? 'bg-light-bg-page dark:bg-dark-bg-page text-light-text-primary dark:text-dark-text-primary'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-page dark:hover:bg-dark-bg-page hover:text-light-text-primary dark:hover:text-dark-text-primary'
                }`}
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
};

const UserMenu: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { profile } = useAuthStore();
    const authService = AuthService.getInstance();
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await authService.signOut();
            // The auth state change will be handled by the AuthWrapper
        } catch (error) {
            console.error('Logout failed:', error);
            // In a real app, use a notification system instead of alert
        } finally {
            setIsLoggingOut(false);
            setIsOpen(false);
        }
    };

    const handleSettings = () => {
        navigate('/settings');
        setIsOpen(false);
    };

    const handleGetHelp = () => {
        window.open('https://www.skool.com/artemo-user-group-3561', '_blank');
        setIsOpen(false);
    };

    const getInitials = (name: string | null) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getFirstName = (fullName: string | null) => {
        if (!fullName) return 'User';
        return fullName.split(' ')[0];
    };
    return (
        <div className="relative" ref={menuRef}>
            <div
                className={`absolute bottom-full left-0 w-full mb-2 p-2 bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-md shadow-lg transition-all duration-200 ${isOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-2'}`}
            >
                <button onClick={handleSettings} className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-sidebar hover:text-light-text-primary dark:hover:text-dark-text-primary text-left">
                    <SettingsIcon className="w-4 h-4" />Settings
                </button>
                <button onClick={handleGetHelp} className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-sidebar hover:text-light-text-primary dark:hover:text-dark-text-primary text-left">
                    <HelpCircleIcon className="w-4 h-4" />Get Help
                </button>
                <div className="h-px bg-light-border dark:bg-dark-border my-2"></div>
                <button onClick={handleLogout} disabled={isLoggingOut} className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-sidebar hover:text-light-text-primary dark:hover:text-dark-text-primary text-left disabled:opacity-50">
                    <LogOutIcon className="w-4 h-4" />
                    {isLoggingOut ? 'Logging out...' : 'Log Out'}
                </button>
            </div>
            <div
                className="flex items-center gap-3 cursor-pointer border-t border-light-border dark:border-dark-border -mx-4 px-4 pt-4"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="w-8 h-8 rounded-full bg-primary-accent flex items-center justify-center font-semibold text-text-on-accent">
                    {getInitials(profile?.full_name)}
                </div>
                <div className="flex-grow">
                    <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                        {getFirstName(profile?.full_name)}'s Workspace
                    </p>
                </div>
            </div>
        </div>
    );
};

const CollapsibleSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    headerAction?: React.ReactNode;
}> = ({ title, icon, children, headerAction }) => {
    const [isOpen, setIsOpen] = useState(true); // Default to open
    return (
        <div>
            <div className="flex items-center justify-between w-full px-2.5 py-2 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-page dark:hover:bg-dark-bg-page hover:text-light-text-primary dark:hover:text-dark-text-primary rounded-sm">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-3 flex-grow text-left"
                >
                    {icon}
                    <span>{title}</span>
                    <ChevronDownIcon className={`w-4 h-4 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {headerAction && (
                    <div className="ml-2">
                        {headerAction}
                    </div>
                )}
            </div>
            {isOpen && <div className="pl-4 pt-2 pb-1 space-y-1">{children}</div>}
        </div>
    );
};

const ActionMenu: React.FC<{
    onRename: () => void;
    onDelete: () => void;
}> = ({ onRename, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsOpen(!isOpen); }} className="p-1 rounded-full text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-light-bg-page dark:hover:bg-dark-bg-page">
                <MoreHorizontalIcon className="w-4 h-4" />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-md shadow-lg z-10 py-1">
                    <button onClick={(e) => { e.stopPropagation(); onRename(); setIsOpen(false); }} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page">
                        <EditIcon className="w-3.5 h-3.5" /> Rename
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); setIsOpen(false); }} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-500 hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page">
                        <TrashIcon className="w-3.5 h-3.5" /> Delete
                    </button>
                </div>
            )}
        </div>
    );
};


export const Sidebar: React.FC<SidebarProps> = ({
    projects, chatHistory, onInitiateToolActivation
}) => {
    const {
        isSidebarOpen,
        favoriteTools,
        recentTools,
        openModal,
        setItemToRename
    } = useUIStore();
    const { tools } = useTools();
    const navigate = useNavigate();

    const navItems = [
        { to: '/', icon: <DashboardIcon className="w-4 h-4" />, label: 'Dashboard' },
        { to: '/tools', icon: <BoxIcon className="w-4 h-4" />, label: 'All Tools' },
        { to: '/profiles', icon: <BriefcaseIcon className="w-4 h-4" />, label: 'Profiles' },
        { to: '/projects', icon: <FolderIcon className="w-4 h-4" />, label: 'All Projects' },
        { to: '/history', icon: <HistoryIcon className="w-4 h-4" />, label: 'History' },
    ];

    const favToolsData = favoriteTools.map(id => tools.find(t => t.id === id)).filter(Boolean) as DynamicTool[];
    const recentToolsData = recentTools.map(id => tools.find(t => t.id === id)).filter(Boolean) as DynamicTool[];

    return (
        <aside className={`fixed lg:relative top-0 left-0 h-full w-[280px] bg-light-bg-sidebar dark:bg-dark-bg-sidebar border-r border-light-border dark:border-dark-border flex flex-col p-4 z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
            <div className="flex-grow overflow-y-auto pr-1">
                <Link to="/" className="flex items-center p-2 mb-6">
                    <ArtemoFullLogo className="h-8" />
                </Link>

                <button onClick={openModal} className="flex items-center justify-center gap-2 w-full p-2.5 mb-4 rounded-sm border-none text-sm font-medium cursor-pointer bg-primary-accent text-text-on-accent hover:opacity-85 transition-opacity">
                    <PlusIcon className="w-4 h-4" />
                    <span>New Project</span>
                </button>

                <ChatSearchButton />

                <nav className="flex flex-col gap-1">
                    {navItems.map(item => <NavLink key={item.to} {...item} />)}
                </nav>

                <div className="my-2 space-y-1">
                    <CollapsibleSection title="Favorite Tools" icon={<StarIcon className="w-4 h-4 text-yellow-500" />}>
                        {favToolsData.length > 0 ? favToolsData.map(tool => (
                             <a href="#" key={tool.id} onClick={e => { e.preventDefault(); onInitiateToolActivation(tool); }} className="block truncate text-sm text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary p-1 rounded-sm">{tool.title}</a>
                        )) : <span className="block text-sm text-light-text-tertiary dark:text-dark-text-tertiary p-1">No favorite tools yet.</span>}
                    </CollapsibleSection>
                    <CollapsibleSection title="Recent Tools" icon={<HistoryIcon className="w-4 h-4" />}>
                         {recentToolsData.length > 0 ? recentToolsData.map(tool => (
                             <a href="#" key={tool.id} onClick={e => { e.preventDefault(); onInitiateToolActivation(tool); }} className="block truncate text-sm text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary p-1 rounded-sm">{tool.title}</a>
                        )) : <span className="block text-sm text-light-text-tertiary dark:text-dark-text-tertiary p-1">No recent tools.</span>}
                    </CollapsibleSection>
                    <CollapsibleSection
                        title="Recent History"
                        icon={<FolderIcon className="w-4 h-4" />}
                    >
                         {chatHistory.length > 0 ? chatHistory.slice(0, 10).map(item => (
                             <div key={item.id} className="group relative text-sm text-light-text-tertiary dark:text-dark-text-tertiary p-1.5 rounded-sm hover:bg-light-bg-page dark:hover:bg-dark-bg-page cursor-pointer">
                                 <div onClick={() => navigate(`/chat/${item.id}`)}>
                                 <p className="font-medium text-light-text-secondary dark:text-dark-text-secondary truncate pr-6">{item.toolTitle}</p>
                                 <p className="truncate italic">"{item.messages.find(m => m.sender === 'user')?.text || '...'}"</p>
                                 <p className="opacity-70">{new Date(item.timestamp).toLocaleDateString()}</p>
                                 {item.projectName && (
                                     <p className="text-xs text-primary-accent">📁 {item.projectName}</p>
                                 )}
                                 </div>
                                 <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <ChatActionMenu
                                         chatItem={item}
                                         onRename={() => setItemToRename({ id: item.id, name: item.toolTitle, type: 'chat' })}
                                         onDelete={() => {/* Handle in component */}}
                                         onAddToProject={(projectId) => {
                                             console.log('Add chat to project:', item.id, projectId);
                                         }}
                                     />
                                 </div>
                             </div>
                        )) : <span className="block text-sm text-light-text-tertiary dark:text-dark-text-tertiary p-1">No chat history.</span>}
                    </CollapsibleSection>
                </div>


                <div className="h-px bg-light-border dark:bg-dark-border my-2"></div>


                <div className="mt-4 flex flex-col gap-1">
                    {projects.map((project) => (
                        <div key={project.id} className="group flex items-center justify-between text-sm font-medium rounded-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-page dark:hover:bg-dark-bg-page hover:text-light-text-primary dark:hover:text-dark-text-primary">
                            <Link to={`/projects/${project.id}`} className="flex-grow flex items-center gap-3 px-2.5 py-2 text-left">
                                <div
                                    className="w-4 h-4 rounded-sm flex items-center justify-center"
                                    style={{ backgroundColor: project.color }}
                                >
                                    <FolderIcon className="w-3 h-3 text-white" />
                                </div>
                                <span className="truncate">{project.name}</span>
                            </Link>
                            <div className="pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <ActionMenu
                                   onRename={() => setItemToRename({ id: project.id, name: project.name, type: 'project' })}
                                   onDelete={() => {/* Handle in component */}}
                               />
                            </div>
                        </div>
                    ))}
                </div>

            </div>
            <footer className="flex-shrink-0">
    <div className="flex flex-col gap-1 mb-4">
        <a
            href="https://www.skool.com/artemo-user-group-3561"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-2.5 py-2 rounded-sm text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-page dark:hover:bg-dark-bg-page hover:text-light-text-primary dark:hover:text-dark-text-primary"
        >
            <UsersIcon className="w-4 h-4" />
            <span>
                Join our{' '}
                <span className="text-primary-accent hover:underline">
                    community
                </span>
            </span>
        </a>
    </div>
    <UserMenu />
</footer>
        </aside>
    );
};
