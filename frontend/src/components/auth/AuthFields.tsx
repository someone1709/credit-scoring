import { useId, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { AlertCircle, CheckCircle, Eye, EyeOff, Landmark, Loader2, User } from 'lucide-react';
import clsx from 'clsx';
import type { UserRole } from '@/types';

const inputCls = 'w-full px-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/70 transition-colors';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    hint?: string;
    ref?: Ref<HTMLInputElement>;
}

export function TextField({ label, error, hint, id, className, ...props }: TextFieldProps) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
        <div className={className}>
            <label htmlFor={fieldId} className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
            <input
                id={fieldId}
                aria-invalid={error ? true : undefined}
                aria-describedby={error || hint ? `${fieldId}-help` : undefined}
                className={clsx(inputCls, error && 'border-red-500/60')}
                {...props}
            />
            {(error || hint) && (
                <p id={`${fieldId}-help`} className={clsx('mt-1 text-xs', error ? 'text-red-400' : 'text-slate-500')}>{error ?? hint}</p>
            )}
        </div>
    );
}

export function PasswordField({ label, error, hint, id, className, ...props }: TextFieldProps) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const [visible, setVisible] = useState(false);
    return (
        <div className={className}>
            <label htmlFor={fieldId} className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
            <div className="relative">
                <input
                    id={fieldId}
                    type={visible ? 'text' : 'password'}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error || hint ? `${fieldId}-help` : undefined}
                    className={clsx(inputCls, 'pr-10', error && 'border-red-500/60')}
                    {...props}
                />
                <button
                    type="button"
                    onClick={() => setVisible(v => !v)}
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    aria-pressed={visible}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-slate-500 hover:text-slate-300 transition-colors"
                >
                    {visible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
            </div>
            {(error || hint) && (
                <p id={`${fieldId}-help`} className={clsx('mt-1 text-xs', error ? 'text-red-400' : 'text-slate-500')}>{error ?? hint}</p>
            )}
        </div>
    );
}

const PASSWORD_RULES = [
    { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
    { label: 'A letter', test: (value: string) => /[A-Za-z]/.test(value) },
    { label: 'A number', test: (value: string) => /[0-9]/.test(value) },
];

export function PasswordChecklist({ value }: { value: string }) {
    return (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 -mt-1">
            {PASSWORD_RULES.map(({ label, test }) => {
                const met = test(value);
                return (
                    <li key={label} className={clsx('flex items-center gap-1.5 text-xs', met ? 'text-emerald-400' : 'text-slate-500')}>
                        <CheckCircle size={11} className={met ? 'opacity-100' : 'opacity-40'} />
                        {label}
                        <span className="sr-only">{met ? ' (met)' : ' (not met yet)'}</span>
                    </li>
                );
            })}
        </ul>
    );
}

export function CheckboxField({ label, error, ref, className, ...props }: {
    label: ReactNode;
    error?: string;
    ref?: Ref<HTMLInputElement>;
} & InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className={className}>
            <label className="flex items-start gap-2.5 text-sm text-slate-400 cursor-pointer">
                <input ref={ref} type="checkbox" className="mt-0.5 w-4 h-4 flex-shrink-0 accent-emerald-500 cursor-pointer" {...props} />
                <span>{label}</span>
            </label>
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </div>
    );
}

export function SubmitButton({ busy, busyLabel, children, className }: {
    busy: boolean;
    busyLabel: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <button
            type="submit"
            disabled={busy}
            className={clsx(
                'w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors',
                className,
            )}
        >
            {busy ? <><Loader2 size={16} className="animate-spin" /> {busyLabel}</> : children}
        </button>
    );
}

export function FormAlert({ tone = 'error', children }: { tone?: 'error' | 'success'; children: ReactNode }) {
    const isError = tone === 'error';
    return (
        <div
            role={isError ? 'alert' : 'status'}
            className={clsx(
                'flex items-start gap-2 px-3 py-2.5 rounded-lg border text-sm',
                isError ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
            )}
        >
            {isError ? <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> : <CheckCircle size={15} className="mt-0.5 flex-shrink-0" />}
            <span>{children}</span>
        </div>
    );
}

export function RoleTabs({ value, onChange }: { value: UserRole; onChange: (role: UserRole) => void }) {
    const tabs: { role: UserRole; label: string; icon: typeof User }[] = [
        { role: 'beneficiary', label: 'Beneficiary', icon: User },
        { role: 'lender', label: 'Lender', icon: Landmark },
    ];
    return (
        <div role="group" aria-label="Account type" className="grid grid-cols-2 gap-1 p-1 bg-[#0d1117] border border-[#30363d] rounded-lg">
            {tabs.map(({ role, label, icon: Icon }) => {
                const active = value === role;
                return (
                    <button
                        key={role}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(role)}
                        className={clsx(
                            'flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
                            active && role === 'beneficiary' && 'bg-emerald-500/15 text-emerald-400',
                            active && role === 'lender' && 'bg-blue-500/15 text-blue-400',
                            !active && 'text-slate-400 hover:text-white',
                        )}
                    >
                        <Icon size={15} /> {label}
                    </button>
                );
            })}
        </div>
    );
}
