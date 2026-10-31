import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function Shell() {
    const [collapsed, setCollapsed] = useState(false);
    return (
        <div className="flex h-screen overflow-hidden bg-[#0d1117]">
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Topbar />
                <main className="flex-1 overflow-y-auto p-6 gradient-bg">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
