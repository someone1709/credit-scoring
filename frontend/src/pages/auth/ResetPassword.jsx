import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { FormAlert, PasswordChecklist, PasswordField, SubmitButton } from '@/components/auth/AuthFields';
import { resetPasswordSchema } from '@/lib/authSchemas';
import { applyServerErrors } from '@/lib/formErrors';
import { authService } from '@/services/auth';

export default function ResetPassword() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get('token');
    const [serverError, setServerError] = useState(null);
    const { register, handleSubmit, setError, watch, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: { password: '', confirmPassword: '' },
    });

    const onSubmit = async ({ password }) => {
        setServerError(null);
        try {
            await authService.resetPassword(token ?? '', password);
            navigate('/login', { replace: true, state: { notice: 'Your password has been changed. Sign in with your new password.' } });
        } catch (error) {
            setServerError(applyServerErrors(error, setError, { password: 'password' }));
        }
    };

    const requestNewLink = <Link to="/forgot-password" className="text-emerald-400 hover:text-emerald-300 font-medium">Request a new link</Link>;

    if (!token) {
        return (
            <AuthLayout title="This link isn't valid" footer={requestNewLink}>
                <FormAlert>The reset link is incomplete. Please request a new one.</FormAlert>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Choose a new password" footer={requestNewLink}>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="glass-card p-5 sm:p-6 space-y-4">
                {serverError && <FormAlert>{serverError}</FormAlert>}
                <PasswordField label="New password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
                <PasswordChecklist value={watch('password')} />
                <PasswordField label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
                <SubmitButton busy={isSubmitting} busyLabel="Saving...">Set New Password</SubmitButton>
            </form>
        </AuthLayout>
    );
}
