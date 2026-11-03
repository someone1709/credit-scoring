import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { FormAlert, SubmitButton, TextField } from '@/components/auth/AuthFields';
import { useAuth } from '@/context/useAuth';
import { forgotPasswordSchema, type ForgotPasswordForm } from '@/lib/authSchemas';
import { applyServerErrors } from '@/lib/formErrors';
import { authService } from '@/services/auth';

export default function ForgotPassword() {
    const { isMockMode } = useAuth();
    const [serverError, setServerError] = useState<string | null>(null);
    const [sent, setSent] = useState<{ email: string; simulatedToken: string | null } | null>(null);
    const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ForgotPasswordForm>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: { email: '' },
    });

    const onSubmit = async ({ email }: ForgotPasswordForm) => {
        setServerError(null);
        try {
            const { simulatedResetToken } = await authService.requestPasswordReset(email);
            setSent({ email, simulatedToken: simulatedResetToken });
        } catch (error) {
            setServerError(applyServerErrors(error, setError, { email: 'email' }));
        }
    };

    const backToSignIn = <Link to="/login" className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium"><ArrowLeft size={14} /> Back to sign in</Link>;

    if (sent) {
        return (
            <AuthLayout title="Check your email" footer={backToSignIn}>
                <div className="glass-card p-5 sm:p-6 space-y-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <MailCheck size={22} className="text-emerald-400" />
                    </div>
                    {/* The same message whether or not the account exists, so accounts can't be discovered. */}
                    <p className="text-sm text-slate-300">
                        If <span className="font-medium text-white break-all">{sent.email}</span> belongs to an account, a link to reset the password is on its way.
                    </p>
                    {isMockMode && (
                        <div className="px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400 space-y-2">
                            <p>⚠ Simulated: this prototype can't send email, so no message was sent.</p>
                            {sent.simulatedToken
                                ? <Link to={`/reset-password?token=${sent.simulatedToken}`} className="block font-semibold underline underline-offset-2">Open the simulated reset link</Link>
                                : <p>No reset link is available for this address. Demo accounts have no password.</p>}
                        </div>
                    )}
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send you a reset link." footer={backToSignIn}>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="glass-card p-5 sm:p-6 space-y-4">
                {serverError && <FormAlert>{serverError}</FormAlert>}
                <TextField label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
                <SubmitButton busy={isSubmitting} busyLabel="Sending...">Send Reset Link</SubmitButton>
            </form>
        </AuthLayout>
    );
}
