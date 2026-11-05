import { useState } from 'react';
import clsx from 'clsx';

export function Card({ children, className, hover = false }) {
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

export function Spinner({ size = 'md' }) {
    const sz = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
    return (
        <div className={clsx('animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500', sz)} />
    );
}

export function EmptyState({ icon, title, description, action }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            {icon && <div className="text-slate-600 mb-1">{icon}</div>}
            <h3 className="text-slate-300 font-semibold">{title}</h3>
            {description && <p className="text-slate-500 text-sm max-w-sm">{description}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

export function SectionHeader({ title, subtitle, action }) {
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

export function StatCard({ label, value, sub, icon, color = 'emerald' }) {
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

export function InfoRow({ label, value, mono = false }) {
    return (
        <div className="flex justify-between items-center gap-3 py-2 border-b border-[#30363d] last:border-0">
            <span className="text-slate-500 text-sm">{label}</span>
            <span className={clsx('text-slate-200 text-sm font-medium text-right', mono && 'font-mono')}>{value}</span>
        </div>
    );
}

export function DemoDisclaimer({ className }) {
    return (
        <div className={clsx('flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg', className)}>
            <span className="text-amber-400 text-xs mt-0.5">⚠</span>
            <p className="text-amber-400 text-xs">
                <strong>Academic prototype.</strong> All data is synthetic. Scores and decisions are illustrative only and are NOT financial advice or lending decisions.
            </p>
        </div>
    );
}

/** Says plainly where a score came from. A trained model and fixed rules deserve different caveats. */
export function AssessmentNote({ method, audience }) {
    const source = method === 'SHAP'
        ? 'Estimated by a model trained on synthetic data and not validated on real borrowers.'
        : 'Illustrative rule-based result, not a trained model.';
    const decision = audience === 'lender'
        ? 'This supports your judgement, and the decision is yours.'
        : "It isn't a lending decision. Lenders make their own decisions.";
    return <p className="text-xs text-slate-600 mt-3">{source} {decision}</p>;
}

/** For something that can't be undone: asks once more, right where the button was. */
export function ConfirmButton({ label, question, confirmLabel, disabled = false, onConfirm }) {
    const [asking, setAsking] = useState(false);
    const [working, setWorking] = useState(false);

    if (!asking) {
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={() => setAsking(true)}
                className="px-3 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
            >
                {label}
            </button>
        );
    }

    const confirm = async () => {
        setWorking(true);
        try {
            await onConfirm();
        } finally {
            setWorking(false);
            setAsking(false);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-300">{question}</span>
            <button
                type="button"
                disabled={working}
                onClick={() => void confirm()}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
            >
                {working ? 'Working...' : confirmLabel}
            </button>
            <button
                type="button"
                disabled={working}
                onClick={() => setAsking(false)}
                className="px-3 py-1.5 border border-[#30363d] text-slate-400 hover:text-white rounded-lg transition-colors"
            >
                Cancel
            </button>
        </div>
    );
}

/** Shown when a page's action fails, such as accepting an offer that has just expired. */
export function ActionError({ message, className }) {
    if (!message) return null;
    return (
        <div role="alert" className={clsx('px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400', className)}>
            {message}
        </div>
    );
}
