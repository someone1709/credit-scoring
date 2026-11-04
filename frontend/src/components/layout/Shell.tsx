import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useApp } from '@/context/useApp';
import { Card, Spinner } from '@/components/shared/UI';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function Shell() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
    const { pathname } = useLocation();
    const { loading, loadError, retryLoad } = useApp();
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
                    {loadError ? (
                        <Card className="max-w-md mx-auto mt-16 text-center">
                            <h1 className="text-base font-bold text-white">We couldn't load your data</h1>
                            <p className="text-sm text-slate-400 mt-1">{loadError}</p>
                            <button onClick={retryLoad} className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors">
                                Try Again
                            </button>
                        </Card>
                    ) : loading ? (
                        <div role="status" aria-label="Loading" className="flex justify-center py-16"><Spinner size="lg" /></div>
                    ) : (
                        <Outlet />
                    )}
                </main>
            </div>
        </div>
    );
}
