import clsx from 'clsx';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
}

export function Card({ children, className, hover = false }: CardProps) {
    return (
        <div className={clsx(
            'glass-card p-5',
            hover && 'hover:border-slate-600 hover:bg-[#1e2637] transition-colors cursor-pointer',
            className
        )}>
            {children}
        </div>
    );
}

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sz = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
    return (
        <div className={clsx('animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500', sz)} />
    );
}

export function EmptyState({ icon, title, description, action }: {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            {icon && <div className="text-slate-600 mb-1">{icon}</div>}
            <h3 className="text-slate-300 font-semibold">{title}</h3>
            {description && <p className="text-slate-500 text-sm max-w-sm">{description}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

export function SectionHeader({ title, subtitle, action }: {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between mb-5">
            <div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
                {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            {action && <div>{action}</div>}
        </div>
    );
}

export function StatCard({ label, value, sub, icon, color = 'emerald' }: {
    label: string;
    value: string | number;
    sub?: string;
    icon: React.ReactNode;
    color?: 'emerald' | 'blue' | 'amber' | 'red' | 'purple';
}) {
    const colorMap = {
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        red: 'bg-red-500/10 text-red-400 border-red-500/20',
        purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    };
    const subColorMap = {
        emerald: 'text-emerald-400',
        blue: 'text-blue-400',
        amber: 'text-amber-400',
        red: 'text-red-400',
        purple: 'text-purple-400',
    };

    return (
        <Card className="flex items-center gap-4">
            <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0', colorMap[color])}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
                {sub && <p className={clsx('text-xs font-medium', subColorMap[color])}>{sub}</p>}
            </div>
        </Card>
    );
}

export function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-[#30363d] last:border-0">
            <span className="text-slate-500 text-sm">{label}</span>
            <span className={clsx('text-slate-200 text-sm font-medium', mono && 'font-mono')}>{value}</span>
        </div>
    );
}

export function DemoDisclaimer({ className }: { className?: string }) {
    return (
        <div className={clsx('flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg', className)}>
            <span className="text-amber-400 text-xs mt-0.5">⚠</span>
            <p className="text-amber-400 text-xs">
                <strong>Academic prototype.</strong> All data is synthetic. Scores and decisions are illustrative only and are NOT financial advice or lending decisions.
            </p>
        </div>
    );
}
