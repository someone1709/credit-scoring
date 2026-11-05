import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isProfileComplete, useBeneficiary } from '@/context/useAuth';
import { useApp } from '@/context/useApp';
import { ActionError, Card, DemoDisclaimer } from '@/components/shared/UI';
import { dtiPercent, expenseRatioPercent, monthlySurplus } from '@/lib/finance';
import { ChevronRight, ChevronLeft, CheckCircle, Loader2, UserCheck } from 'lucide-react';

const REQUIRED_MESSAGE = 'This field is required';
const SANITY_LIMIT = 100000000; // ₹10 crore: catches typing mistakes, not a lending rule

const amount = (positiveMessage) => z
    .number({ error: REQUIRED_MESSAGE })
    .positive(positiveMessage)
    .max(SANITY_LIMIT, 'Please check this amount');

const schema = z.object({
    loan_amount: amount('Amount must be greater than 0'),
    loan_purpose: z.enum(['Education', 'Medical', 'Business', 'Personal', 'Home Improvement', 'Agriculture', 'Other']),
    tenure_months: z.number().int().positive(),
    monthly_income: amount('Monthly income must be greater than 0'),
    monthly_expenses: z.number({ error: REQUIRED_MESSAGE }).min(0, 'Cannot be negative').max(SANITY_LIMIT, 'Please check this amount'),
    existing_emi: z.number({ error: REQUIRED_MESSAGE }).min(0, 'Cannot be negative').max(SANITY_LIMIT, 'Please check this amount'),
    // No default on purpose: the applicant states this, so "none" is never assumed for them.
    repayment_history: z.enum(['good', 'average', 'poor', 'none'], { error: 'Select your repayment history' }),
    electricity_usage: z.number().min(0, 'Cannot be negative').nullable(),
    lender_ids: z.array(z.string()).min(1, 'Choose at least one lender'),
    consent: z.boolean().refine(value => value, 'Your consent is needed to share this application'),
});

const STEPS = ['Loan Details', 'Financial Info', 'Review & Submit'];

const emptyToNumber = (value) => (value === '' || value === null || value === undefined ? NaN : Number(value));
const emptyToNull = (value) => (value === '' || value === null || value === undefined ? null : Number(value));

function FormField({ label, htmlFor, error, children, hint }) {
    return (
        <div>
            <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
            {children}
            {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </div>
    );
}

const inputCls = 'w-full px-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/70 transition-colors';
const selectCls = inputCls + ' cursor-pointer';

export default function ApplyForLoan() {
    const beneficiary = useBeneficiary();
    const { submitApplication, listLenders } = useApp();
    const navigate = useNavigate();
    const [lenders, setLenders] = useState([]);
    const [lendersError, setLendersError] = useState(null);
    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [newAppId, setNewAppId] = useState('');
    const [submitError, setSubmitError] = useState(null);

    const { register, handleSubmit, watch, reset, formState: { errors }, trigger } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            tenure_months: 12,
            loan_purpose: 'Personal',
            existing_emi: 0,
            electricity_usage: null,
            lender_ids: [],
            consent: false,
        },
        mode: 'onChange',
    });

    useEffect(() => {
        listLenders()
            .then(setLenders)
            .catch((e) => setLendersError(e instanceof Error ? e.message : 'The list of lenders could not be loaded.'));
    }, [listLenders]);

    const values = watch();

    const nextStep = async () => {
        let fields = [];
        if (step === 0) fields = ['loan_amount', 'loan_purpose', 'tenure_months'];
        if (step === 1) fields = ['monthly_income', 'monthly_expenses', 'existing_emi', 'repayment_history', 'electricity_usage'];
        const ok = await trigger(fields);
        if (ok) setStep(s => s + 1);
    };

    const onSubmit = async (data) => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            const { lender_ids: lenderIds, consent: _consent, ...financials } = data;
            const app = await submitApplication(beneficiary, financials, lenderIds);
            setNewAppId(app.id);
            setSubmitted(true);
        } catch (e) {
            setSubmitError(e instanceof Error ? e.message : 'Your application could not be submitted. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Enter in a field should move forward, not submit a half-finished application.
    const handleFormSubmit = (e) => {
        if (step < STEPS.length - 1) {
            e.preventDefault();
            void nextStep();
            return;
        }
        void handleSubmit(onSubmit)(e);
    };

    const income = Number.isFinite(values.monthly_income) ? values.monthly_income : 0;
    const expenses = Number.isFinite(values.monthly_expenses) ? values.monthly_expenses : 0;
    const emi = Number.isFinite(values.existing_emi) ? values.existing_emi : 0;
    const dti = dtiPercent(emi, income);
    const expenseRatio = expenseRatioPercent(expenses, income);
    const surplus = monthlySurplus(income, expenses, emi);

    if (!isProfileComplete(beneficiary)) {
        return (
            <div className="max-w-lg mx-auto mt-16 text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                    <UserCheck size={36} className="text-emerald-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Complete your profile first</h1>
                <p className="text-slate-400 mt-2">Lenders need your occupation and location to review an application. It only takes a minute.</p>
                <Link to="/beneficiary/profile" className="inline-block mt-6 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors">
                    Complete Profile
                </Link>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="max-w-lg mx-auto mt-16 text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                    <CheckCircle size={40} className="text-emerald-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Application Submitted!</h1>
                <p className="text-slate-400 mt-2">Your loan application <span className="text-emerald-400 font-mono">#{newAppId}</span> was shared with the lenders you chose. Uploading supporting documents can help them review it.</p>
                <DemoDisclaimer className="mt-4 text-left" />
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                    <button onClick={() => navigate('/beneficiary/documents')} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors">
                        Upload Documents
                    </button>
                    <button onClick={() => navigate(`/beneficiary/applications/${newAppId}`)} className="px-5 py-2.5 bg-[#1c2333] hover:bg-[#212842] text-slate-300 rounded-lg text-sm font-semibold border border-[#30363d] transition-colors">
                        View Application
                    </button>
                    <button onClick={() => { reset(); setSubmitted(false); setStep(0); }} className="px-5 py-2.5 bg-[#1c2333] hover:bg-[#212842] text-slate-300 rounded-lg text-sm font-semibold border border-[#30363d] transition-colors">
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
                <p className="text-slate-500 mt-1">Fill in your details to get started. Fields marked optional can be left blank.</p>
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

            <form onSubmit={handleFormSubmit} noValidate>
                <Card>
                    {/* Step 1: Loan Details */}
                    {step === 0 && (
                        <div className="space-y-4">
                            <h2 className="text-base font-semibold text-white mb-4">Loan Details</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField label="Requested Loan Amount (₹)" htmlFor="loan_amount" error={errors.loan_amount?.message}>
                                    <input id="loan_amount" type="number" min="1" {...register('loan_amount', { setValueAs: emptyToNumber })} placeholder="e.g. 50000" className={inputCls} />
                                </FormField>
                                <FormField label="Loan Purpose" htmlFor="loan_purpose" error={errors.loan_purpose?.message}>
                                    <select id="loan_purpose" {...register('loan_purpose')} className={selectCls}>
                                        {['Education', 'Medical', 'Business', 'Personal', 'Home Improvement', 'Agriculture', 'Other'].map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </FormField>
                                <FormField label="Repayment Tenure (months)" htmlFor="tenure_months" error={errors.tenure_months?.message} hint="Choose 6, 12, 18, 24, 36, or 48 months">
                                    <select id="tenure_months" {...register('tenure_months', { setValueAs: emptyToNumber })} className={selectCls}>
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
                                <FormField label="Monthly Income (₹)" htmlFor="monthly_income" error={errors.monthly_income?.message}>
                                    <input id="monthly_income" type="number" min="1" {...register('monthly_income', { setValueAs: emptyToNumber })} placeholder="e.g. 30000" className={inputCls} />
                                </FormField>
                                <FormField label="Monthly Expenses (₹)" htmlFor="monthly_expenses" error={errors.monthly_expenses?.message}>
                                    <input id="monthly_expenses" type="number" min="0" {...register('monthly_expenses', { setValueAs: emptyToNumber })} placeholder="e.g. 12000" className={inputCls} />
                                </FormField>
                                <FormField label="Existing EMI (₹)" htmlFor="existing_emi" error={errors.existing_emi?.message} hint="Enter 0 if none">
                                    <input id="existing_emi" type="number" min="0" {...register('existing_emi', { setValueAs: emptyToNumber })} placeholder="0" className={inputCls} />
                                </FormField>
                                <FormField label="Repayment History" htmlFor="repayment_history" error={errors.repayment_history?.message} hint="First-time borrower? Choose None. It is not treated as poor history.">
                                    <select id="repayment_history" {...register('repayment_history', { setValueAs: v => (v === '' ? undefined : v) })} defaultValue="" className={selectCls}>
                                        <option value="" disabled>Select...</option>
                                        <option value="good">Good</option>
                                        <option value="average">Average</option>
                                        <option value="poor">Poor</option>
                                        <option value="none">None (first-time borrower)</option>
                                    </select>
                                </FormField>
                                <FormField label="Electricity Usage (units/month, optional)" htmlFor="electricity_usage" error={errors.electricity_usage?.message} hint="Alternative indicator. It doesn't affect your score.">
                                    <input id="electricity_usage" type="number" min="0" {...register('electricity_usage', { setValueAs: emptyToNull })} placeholder="e.g. 120" className={inputCls} />
                                </FormField>
                            </div>

                            {/* Live financial indicators */}
                            {income > 0 && (
                                <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 grid grid-cols-3 gap-4 mt-2">
                                    <div className="text-center">
                                        <p className="text-slate-500 text-xs">DTI Ratio</p>
                                        <p className={`text-lg font-bold mt-0.5 ${dti > 40 ? 'text-red-400' : dti > 25 ? 'text-amber-400' : 'text-emerald-400'}`}>{dti.toFixed(1)}%</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-slate-500 text-xs">Monthly Surplus</p>
                                        <p className={`text-lg font-bold mt-0.5 ${surplus < 2000 ? 'text-red-400' : 'text-emerald-400'}`}>
                                            ₹{surplus.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-slate-500 text-xs">Expense Ratio</p>
                                        <p className="text-lg font-bold mt-0.5 text-slate-300">{expenseRatio.toFixed(1)}%</p>
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
                                    { label: 'Monthly Income', value: `₹${income.toLocaleString('en-IN')}` },
                                    { label: 'Monthly Expenses', value: `₹${expenses.toLocaleString('en-IN')}` },
                                    { label: 'Existing EMI', value: `₹${emi.toLocaleString('en-IN')}` },
                                    { label: 'Repayment History', value: values.repayment_history === 'none' ? 'None (first-time borrower)' : <span className="capitalize">{values.repayment_history}</span> },
                                    { label: 'Electricity Usage', value: values.electricity_usage != null ? `${values.electricity_usage} units/month` : 'Not provided' },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex justify-between items-center gap-2 p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
                                        <span className="text-slate-500 text-sm">{label}</span>
                                        <span className="text-white text-sm font-medium text-right">{value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Who gets access: nothing is shared without this choice and consent */}
                            <fieldset className="pt-2">
                                <legend className="text-sm font-semibold text-white">Share with lenders</legend>
                                <p className="text-xs text-slate-500 mt-0.5 mb-3">Only the lenders you choose can open this application.</p>
                                <ActionError message={lendersError} className="mb-3" />
                                {!lendersError && lenders.length === 0 && <p className="text-sm text-slate-500 mb-3">No lenders have been approved yet.</p>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {lenders.map(lender => (
                                        <label key={lender.id} className="flex items-center gap-3 p-3 bg-[#0d1117] rounded-lg border border-[#30363d] hover:border-slate-500 cursor-pointer transition-colors">
                                            <input type="checkbox" value={lender.id} {...register('lender_ids')} className="w-4 h-4 flex-shrink-0 accent-emerald-500" />
                                            <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: lender.logoColor }}>
                                                {lender.logoInitials}
                                            </span>
                                            <span className="text-sm text-slate-200 min-w-0 truncate">{lender.name}</span>
                                        </label>
                                    ))}
                                </div>
                                {errors.lender_ids?.message && <p className="mt-1 text-xs text-red-400">{errors.lender_ids.message}</p>}
                            </fieldset>

                            <div>
                                <label className="flex items-start gap-2.5 text-sm text-slate-300 cursor-pointer">
                                    <input type="checkbox" {...register('consent')} className="mt-0.5 w-4 h-4 flex-shrink-0 accent-emerald-500" />
                                    <span>I consent to sharing this application, my financial details, any documents I upload, and my occupation and location with the lenders selected above. My email, phone number and address are not shared, unless they appear in a document I upload.</span>
                                </label>
                                {errors.consent?.message && <p className="mt-1 text-xs text-red-400">{errors.consent.message}</p>}
                            </div>

                            <ActionError message={submitError} />
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
