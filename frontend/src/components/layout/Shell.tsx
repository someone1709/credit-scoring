import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function Shell() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
    const { pathname } = useLocation();
    // The phone menu closes by itself once the page changes.
    const mobileOpen = mobileMenuPath === pathname;

    return (
        <div className="flex h-screen overflow-hidden bg-[#0d1117]">
            <Sidebar
                collapsed={collapsed}
                onToggle={() => setCollapsed(v => !v)}
                mobileOpen={mobileOpen}
                onCloseMobile={() => setMobileMenuPath(null)}
            />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Topbar onOpenMenu={() => setMobileMenuPath(pathname)} />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 gradient-bg">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
