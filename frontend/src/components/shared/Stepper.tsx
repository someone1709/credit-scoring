import type { DisbursementStep } from '@/types';
import { CheckCircle, Circle, Clock, XCircle } from 'lucide-react';
import clsx from 'clsx';

interface ApplicationStepperProps {
    steps: { label: string; date?: string | null; status: 'completed' | 'current' | 'pending' }[];
    variant?: 'horizontal' | 'vertical';
}

const APPLICATION_WORKFLOW_STEPS = [
    { label: 'Application Submitted', key: 'submitted' },
    { label: 'Documents Verification', key: 'docs' },
    { label: 'Credit Assessment', key: 'assessment' },
    { label: 'Under Lender Review', key: 'lender' },
    { label: 'Final Decision', key: 'decision' },
];

export function ApplicationWorkflowStepper({ currentStep, dates, rejected = false }: {
    currentStep: number; // 0-indexed; past the last step means every step is done
    dates?: Record<number, string>;
    rejected?: boolean;  // every lender rejected, so the final decision is shown as a rejection
}) {
    const lastStep = APPLICATION_WORKFLOW_STEPS.length - 1;
    return (
        <div className="flex items-start w-full overflow-x-auto pb-1">
            {APPLICATION_WORKFLOW_STEPS.map((step, i) => {
                const status = i < currentStep ? 'completed' : i === currentStep ? 'current' : 'pending';
                const isRejectedStep = rejected && i === lastStep;
                return (
                    <div key={step.key} className="flex flex-1 min-w-[84px] flex-col items-center relative">
                        {/* Connector line */}
                        {i < APPLICATION_WORKFLOW_STEPS.length - 1 && (
                            <div className="absolute top-3.5 left-1/2 w-full h-0.5 z-0"
                                style={{ background: status === 'completed' ? '#10b981' : '#30363d' }} />
                        )}
                        {/* Icon */}
                        <div className={clsx(
                            'w-7 h-7 rounded-full flex items-center justify-center z-10 transition-all',
                            isRejectedStep && 'bg-red-500',
                            !isRejectedStep && status === 'completed' && 'bg-emerald-500',
                            status === 'current' && 'bg-blue-500 ring-2 ring-blue-400/30',
                            status === 'pending' && 'bg-[#30363d]',
                        )}>
                            {isRejectedStep
                                ? <XCircle size={14} className="text-white" />
                                : status === 'completed'
                                    ? <CheckCircle size={14} className="text-white" />
                                    : status === 'current'
                                        ? <Clock size={14} className="text-white" />
                                        : <Circle size={14} className="text-slate-500" />
                            }
                        </div>
                        {/* Label */}
                        <div className="mt-2 text-center px-1">
                            <p className={clsx('text-xs font-medium', status === 'pending' ? 'text-slate-500' : 'text-slate-200')}>
                                {step.label}
                            </p>
                            {isRejectedStep && <p className="text-xs text-red-400 mt-0.5">Rejected</p>}
                            {dates?.[i] && <p className="text-xs text-slate-500 mt-0.5">{dates[i]}</p>}
                            {status === 'current' && <p className="text-xs text-blue-400 mt-0.5">Current Step</p>}
                            {status === 'pending' && <p className="text-xs text-slate-600 mt-0.5">Pending</p>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function DisbursementStepper({ steps }: { steps: DisbursementStep[] }) {
    return (
        <div className="flex flex-col gap-0">
            {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                        <div className={clsx(
                            'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                            step.status === 'completed' && 'bg-emerald-500',
                            step.status === 'current' && 'bg-blue-500 ring-2 ring-blue-400/30',
                            step.status === 'pending' && 'bg-[#30363d]',
                        )}>
                            {step.status === 'completed'
                                ? <CheckCircle size={14} className="text-white" />
                                : step.status === 'current'
                                    ? <Clock size={14} className="text-white" />
                                    : <Circle size={14} className="text-slate-500" />
                            }
                        </div>
                        {i < steps.length - 1 && (
                            <div className={clsx('w-0.5 h-8 mt-1', step.status === 'completed' ? 'bg-emerald-500/50' : 'bg-[#30363d]')} />
                        )}
                    </div>
                    <div className="pt-1 pb-6">
                        <p className={clsx('text-sm font-medium', step.status === 'pending' ? 'text-slate-500' : 'text-slate-200')}>
                            {step.label}
                        </p>
                        {step.date && <p className="text-xs text-slate-500">{step.date}</p>}
                        {step.status === 'current' && <p className="text-xs text-blue-400">In progress</p>}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function GenericStepper({ steps, variant = 'horizontal' }: ApplicationStepperProps) {
    if (variant === 'vertical') {
        return (
            <div className="flex flex-col gap-0">
                {steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                            <div className={clsx(
                                'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                                step.status === 'completed' && 'bg-emerald-500',
                                step.status === 'current' && 'bg-blue-500 ring-2 ring-blue-400/30',
                                step.status === 'pending' && 'bg-[#30363d]',
                            )}>
                                {step.status === 'completed' ? <CheckCircle size={14} className="text-white" /> :
                                    step.status === 'current' ? <Clock size={14} className="text-white" /> :
                                        <Circle size={14} className="text-slate-500" />}
                            </div>
                            {i < steps.length - 1 && (
                                <div className={clsx('w-0.5 h-8 mt-1', step.status === 'completed' ? 'bg-emerald-500/50' : 'bg-[#30363d]')} />
                            )}
                        </div>
                        <div className="pt-1 pb-6">
                            <p className={clsx('text-sm font-medium', step.status === 'pending' ? 'text-slate-500' : 'text-slate-200')}>{step.label}</p>
                            {step.date && <p className="text-xs text-slate-500">{step.date}</p>}
                        </div>
                    </div>
                ))}
            </div>
        );
    }
    return null;
}
