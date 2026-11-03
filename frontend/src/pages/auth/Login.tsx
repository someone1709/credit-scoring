import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight, Loader2 } from 'lucide-react';
import type { UserRole } from '@/types';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { CheckboxField, FormAlert, PasswordField, RoleTabs, SubmitButton, TextField } from '@/components/auth/AuthFields';
import { useAuth } from '@/context/useAuth';
import { loginSchema, type LoginForm } from '@/lib/authSchemas';
import { applyServerErrors } from '@/lib/formErrors';
import { toApiError } from '@/services/http';

export default function Login() {
    const { login, demoLogin, demoAccounts, clearSessionEnded } = useAuth();
    const location = useLocation();
    const [params, setParams] = useSearchParams();
    const role: UserRole = params.get('role') === 'lender' ? 'lender' : 'beneficiary';
    const state = location.state as { from?: string; notice?: string } | null;

    useEffect(clearSessionEnded, [clearSessionEnded]);

    const [serverError, setServerError] = useState<string | null>(null);
    const [demoBusyId, setDemoBusyId] = useState<string | null>(null);

    const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '', remember: false },
    });

    const onSubmit = async (data: LoginForm) => {
        setServerError(null);
        try {
            // Signing in re-renders the route guard, which takes it from here.
            await login(data);
        } catch (error) {
            setServerError(applyServerErrors(error, setError, { email: 'email', password: 'password' }));
        }
    };

    const onDemo = async (accountId: string) => {
        setServerError(null);
        setDemoBusyId(accountId);
        try {
            await demoLogin(accountId);
        } catch (error) {
            setServerError(toApiError(error).message);
            setDemoBusyId(null);
        }
    };

    const roleDemoAccounts = demoAccounts.filter(account => account.role === role);

    return (
        <AuthLayout
            title="Welcome back"
            subtitle={role === 'lender' ? 'Sign in to review the applications shared with you.' : 'Sign in to track your applications and offers.'}
            footer={<>New to BeneScore? <Link to={`/register?role=${role}`} className="text-emerald-400 hover:text-emerald-300 font-medium">Create an account</Link></>}
        >
            <div className="glass-card p-5 sm:p-6 space-y-5">
                <RoleTabs value={role} onChange={next => setParams({ role: next }, { replace: true, state })} />

                {state?.notice && <FormAlert tone="success">{state.notice}</FormAlert>}
                {serverError && <FormAlert>{serverError}</FormAlert>}

                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                    <TextField label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
                    <PasswordField label="Password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
                    <div className="flex items-center justify-between gap-3">
                        <CheckboxField label="Keep me signed in" {...register('remember')} />
                        <Link to="/forgot-password" className="text-sm text-emerald-400 hover:text-emerald-300 flex-shrink-0">Forgot password?</Link>
                    </div>
                    <SubmitButton busy={isSubmitting} busyLabel="Signing in...">Sign In</SubmitButton>
                </form>
            </div>

            {roleDemoAccounts.length > 0 && (
                <section aria-labelledby="demo-access" className="mt-5">
                    <h2 id="demo-access" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Demo access · no password needed</h2>
                    <ul className="mt-2 space-y-2">
                        {roleDemoAccounts.map(account => (
                            <li key={account.id}>
                                <button
                                    type="button"
                                    onClick={() => onDemo(account.id)}
                                    disabled={demoBusyId !== null}
                                    className="group w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-[#161b22] hover:bg-[#1c2333] border border-[#30363d] hover:border-slate-500 rounded-lg text-left transition-colors disabled:opacity-60"
                                >
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium text-white truncate">{account.name}</span>
                                        <span className="block text-xs text-slate-500 truncate">{account.detail}</span>
                                    </span>
                                    {demoBusyId === account.id
                                        ? <Loader2 size={16} className="animate-spin text-slate-400 flex-shrink-0" />
                                        : <ChevronRight size={16} className="text-slate-500 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </AuthLayout>
    );
}
