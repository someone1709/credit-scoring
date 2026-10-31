import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import { Card, DemoDisclaimer } from '@/components/shared/UI';
import { ChevronRight, ChevronLeft, CheckCircle, Loader2 } from 'lucide-react';
import type { LoanApplicationFormData } from '@/types';

const numField = () => z.number().positive('Amount must be greater than 0');
const numMin0 = () => z.number().min(0);

const schema = z.object({
    loan_amount: numField(),
    loan_purpose: z.enum(['Education', 'Medical', 'Business', 'Personal', 'Home Improvement', 'Agriculture', 'Other'] as const),
    tenure_months: z.number().int().positive(),
    monthly_income: numField(),
    monthly_expenses: numMin0(),
    existing_emi: numMin0(),
    repayment_history: z.enum(['good', 'average', 'poor', 'none'] as const),
    electricity_usage: z.number().min(0).nullable().optional(),
});

type FormData = z.infer<typeof schema>;

const STEPS = ['Loan Details', 'Financial Info', 'Review & Submit'];

function FormField({ label, error, children, hint }: {
    label: string;
    error?: string;
    children: React.ReactNode;
    hint?: string;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
            {children}
            {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </div>
    );
}

const inputCls = 'w-full px-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/70 transition-colors';
const selectCls = inputCls + ' cursor-pointer';

export default function ApplyForLoan() {
    const { beneficiary } = useRole();
    const { submitApplication } = useApp();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [newAppId, setNewAppId] = useState('');

    const { register, handleSubmit, watch, formState: { errors }, trigger } = useForm<FormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(schema) as any,
        defaultValues: {
            tenure_months: 12,
            repayment_history: 'none',
            loan_purpose: 'Personal',
        },
        mode: 'onChange',
    });

    const values = watch();

    const nextStep = async () => {
        let fields: (keyof FormData)[] = [];
        if (step === 0) fields = ['loan_amount', 'loan_purpose', 'tenure_months'];
        if (step === 1) fields = ['monthly_income', 'monthly_expenses', 'existing_emi', 'repayment_history'];
        const ok = await trigger(fields);
        if (ok) setStep(s => s + 1);
    };

    const onSubmit = async (data: FormData) => {
        setSubmitting(true);
        await new Promise(r => setTimeout(r, 1200));
        const app = submitApplication(beneficiary.id, beneficiary.name, data as LoanApplicationFormData);
        setNewAppId(app.id);
        setSubmitted(true);
        setSubmitting(false);
    };

    const dti = values.monthly_income
        ? ((values.existing_emi || 0) / values.monthly_income * 100).toFixed(1)
        : '—';
    const surplus = values.monthly_income
        ? values.monthly_income - (values.monthly_expenses || 0) - (values.existing_emi || 0)
        : null;

    if (submitted) {
        return (
            <div className="max-w-lg mx-auto mt-16 text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                    <CheckCircle size={40} className="text-emerald-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Application Submitted!</h1>
                <p className="text-slate-400 mt-2">Your loan application <span className="text-emerald-400 font-mono">#{newAppId}</span> has been submitted. Lenders will review it shortly.</p>
                <DemoDisclaimer className="mt-4 text-left" />
                <div className="flex gap-3 justify-center mt-6">
                    <button onClick={() => navigate('/beneficiary/applications')} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors">
                        View My Applications
                    </button>
                    <button onClick={() => { setSubmitted(false); setStep(0); }} className="px-5 py-2.5 bg-[#1c2333] hover:bg-[#212842] text-slate-300 rounded-lg text-sm font-semibold border border-[#30363d] transition-colors">
                        Apply Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Apply for a Loan</h1>
                <p className="text-slate-500 mt-1">Fill in your details to get started. All fields marked are required.</p>
            </div>

            <DemoDisclaimer />

            {/* Progress */}
            <div className="flex items-center gap-2">
                {STEPS.map((s, i) => (
                    <div key={s} className="flex items-center gap-2 flex-1">
                        <div className={`flex items-center gap-2 ${i <= step ? 'text-emerald-400' : 'text-slate-600'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400' : 'bg-[#30363d] text-slate-500'}`}>
                                {i < step ? <CheckCircle size={14} /> : i + 1}
                            </div>
                            <span className="text-xs font-medium hidden sm:block">{s}</span>
                        </div>
                        {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-emerald-500' : 'bg-[#30363d]'}`} />}
                    </div>
                ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                <Card>
                    {/* Step 1: Loan Details */}
                    {step === 0 && (
                        <div className="space-y-4">
                            <h2 className="text-base font-semibold text-white mb-4">Loan Details</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField label="Requested Loan Amount (₹)" error={errors.loan_amount?.message}>
                                    <input type="number" {...register('loan_amount', { valueAsNumber: true })} placeholder="e.g. 50000" className={inputCls} />
                                </FormField>
                                <FormField label="Loan Purpose" error={errors.loan_purpose?.message}>
                                    <select {...register('loan_purpose')} className={selectCls}>
                                        {['Education', 'Medical', 'Business', 'Personal', 'Home Improvement', 'Agriculture', 'Other'].map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </FormField>
                                <FormField label="Repayment Tenure (months)" error={errors.tenure_months?.message} hint="Choose 6, 12, 18, 24, 36, or 48 months">
                                    <select {...register('tenure_months', { valueAsNumber: true })} className={selectCls}>
                                        {[6, 12, 18, 24, 36, 48].map(t => <option key={t} value={t}>{t} months</option>)}
                                    </select>
                                </FormField>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Financial Info */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <h2 className="text-base font-semibold text-white mb-4">Financial Information</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField label="Monthly Income (₹)" error={errors.monthly_income?.message}>
                                    <input type="number" {...register('monthly_income', { valueAsNumber: true })} placeholder="e.g. 30000" className={inputCls} />
                                </FormField>
                                <FormField label="Monthly Expenses (₹)" error={errors.monthly_expenses?.message}>
                                    <input type="number" {...register('monthly_expenses', { valueAsNumber: true })} placeholder="e.g. 12000" className={inputCls} />
                                </FormField>
                                <FormField label="Existing EMI (₹)" error={errors.existing_emi?.message} hint="Enter 0 if none">
                                    <input type="number" {...register('existing_emi', { valueAsNumber: true })} placeholder="0" className={inputCls} />
                                </FormField>
                                <FormField label="Repayment History" error={errors.repayment_history?.message} hint="Select 'none' if you are a first-time borrower">
                                    <select {...register('repayment_history')} className={selectCls}>
                                        <option value="good">Good</option>
                                        <option value="average">Average</option>
                                        <option value="poor">Poor</option>
                                        <option value="none">None (first-time borrower)</option>
                                    </select>
                                </FormField>
                                <FormField label="Electricity Usage (units/month)" error={errors.electricity_usage?.message} hint="Optional — alternative financial indicator">
                                    <input type="number" {...register('electricity_usage', { valueAsNumber: true, setValueAs: v => v === '' || isNaN(v) ? null : v })} placeholder="e.g. 120 (optional)" className={inputCls} />
                                </FormField>
                            </div>

                            {/* Live financial indicators */}
                            {values.monthly_income > 0 && (
                                <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 grid grid-cols-3 gap-4 mt-2">
                                    <div className="text-center">
                                        <p className="text-slate-500 text-xs">DTI Ratio</p>
                                        <p className={`text-lg font-bold mt-0.5 ${parseFloat(dti) > 40 ? 'text-red-400' : parseFloat(dti) > 25 ? 'text-amber-400' : 'text-emerald-400'}`}>{dti}%</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-slate-500 text-xs">Monthly Surplus</p>
                                        <p className={`text-lg font-bold mt-0.5 ${(surplus || 0) < 2000 ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {surplus !== null ? `₹${surplus.toLocaleString('en-IN')}` : '—'}
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-slate-500 text-xs">Expense Ratio</p>
                                        <p className="text-lg font-bold mt-0.5 text-slate-300">
                                            {values.monthly_income ? `${((values.monthly_expenses || 0) / values.monthly_income * 100).toFixed(1)}%` : '—'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Review */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <h2 className="text-base font-semibold text-white mb-4">Review Your Application</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { label: 'Loan Amount', value: `₹${(values.loan_amount || 0).toLocaleString('en-IN')}` },
                                    { label: 'Purpose', value: values.loan_purpose },
                                    { label: 'Tenure', value: `${values.tenure_months} months` },
                                    { label: 'Monthly Income', value: `₹${(values.monthly_income || 0).toLocaleString('en-IN')}` },
                                    { label: 'Monthly Expenses', value: `₹${(values.monthly_expenses || 0).toLocaleString('en-IN')}` },
                                    { label: 'Existing EMI', value: `₹${(values.existing_emi || 0).toLocaleString('en-IN')}` },
                                    { label: 'Repayment History', value: values.repayment_history === 'none' ? 'None (first-time borrower)' : values.repayment_history },
                                    { label: 'Electricity Usage', value: values.electricity_usage != null ? `${values.electricity_usage} units/month` : 'Not provided' },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex justify-between items-center p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
                                        <span className="text-slate-500 text-sm">{label}</span>
                                        <span className="text-white text-sm font-medium">{value}</span>
                                    </div>
                                ))}
                            </div>
                            <DemoDisclaimer />
                        </div>
                    )}
                </Card>

                {/* Navigation */}
                <div className="flex justify-between mt-4">
                    <button
                        type="button"
                        onClick={() => setStep(s => s - 1)}
                        disabled={step === 0}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#1c2333] hover:bg-[#212842] disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 rounded-lg text-sm font-medium border border-[#30363d] transition-colors"
                    >
                        <ChevronLeft size={16} /> Previous
                    </button>
                    {step < STEPS.length - 1 ? (
                        <button
                            type="button"
                            onClick={nextStep}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                            Next Step <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                            {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : 'Submit Application'}
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}
