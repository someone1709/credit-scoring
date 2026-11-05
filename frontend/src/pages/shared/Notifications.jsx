import { useAuth } from '@/context/useAuth';
import { useApp } from '@/context/useApp';
import { Card, EmptyState } from '@/components/shared/UI';
import { Bell, CheckCheck } from 'lucide-react';
import clsx from 'clsx';

const typeColor = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
};

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Notifications() {
    const { user } = useAuth();
    const { getNotificationsByUser, markNotificationRead, markAllNotificationsRead } = useApp();
    if (!user) return null;

    const userId = user.profile.id;
    const notifications = getNotificationsByUser(userId);
    const unread = notifications.filter(n => !n.read).length;

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Notifications</h1>
                    <p className="text-slate-500 mt-1 text-sm">{unread > 0 ? `${unread} unread` : 'All caught up'}</p>
                </div>
                {unread > 0 && (
                    <button
                        onClick={() => markAllNotificationsRead(userId)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#1c2333] hover:bg-[#212842] border border-[#30363d] text-slate-400 hover:text-white rounded-lg text-sm transition-colors"
                    >
                        <CheckCheck size={14} /> Mark all read
                    </button>
                )}
            </div>

            {notifications.length === 0 ? (
                <EmptyState icon={<Bell size={40} />} title="No notifications" description={user.role === 'lender' ? "You'll see new applications and offer updates here." : "You'll see loan updates and offers here."} />
            ) : (
                <Card className="p-0 overflow-hidden">
                    {notifications.map((n) => (
                        <button
                            key={n.id}
                            onClick={() => markNotificationRead(n.id)}
                            className={clsx(
                                'w-full text-left flex items-start gap-4 px-5 py-4 border-b border-[#30363d] last:border-0 hover:bg-white/[0.02] transition-colors',
                                !n.read && 'bg-blue-500/[0.03]'
                            )}
                        >
                            <div className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5', typeColor[n.type])} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <p className={clsx('text-sm font-semibold', n.read ? 'text-slate-400' : 'text-white')}>{n.title}</p>
                                    <span className="text-xs text-slate-600 whitespace-nowrap flex-shrink-0">{formatDate(n.createdAt)}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">{n.message}</p>
                            </div>
                            {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />}
                        </button>
                    ))}
                </Card>
            )}
        </div>
    );
}
