import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { Card } from '@/components/shared/UI';
import { useAuth } from '@/context/useAuth';
import { changePasswordSchema, type ChangePasswordForm } from '@/lib/authSchemas';
import { applyServerErrors } from '@/lib/formErrors';
import { authService } from '@/services/auth';
import { FormAlert, PasswordField, SubmitButton } from './AuthFields';

export function ChangePasswordCard() {
    const { user } = useAuth();
    const [serverError, setServerError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<ChangePasswordForm>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
    });

    const onSubmit = async (data: ChangePasswordForm) => {
        setServerError(null);
        setSaved(false);
        try {
            await authService.changePassword(data.currentPassword, data.password);
            reset();
            setSaved(true);
        } catch (error) {
            setServerError(applyServerErrors(error, setError, { current_password: 'currentPassword', currentPassword: 'currentPassword', new_password: 'password' }));
        }
    };

    return (
        <Card>
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2"><KeyRound size={16} /> Password</h2>
            {user?.isDemo ? (
                <p className="text-sm text-slate-500">Demo accounts sign in without a password, so there is nothing to change. Create an account to set one.</p>
            ) : (
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                    {serverError && <FormAlert>{serverError}</FormAlert>}
                    {saved && <FormAlert tone="success">Your password has been changed.</FormAlert>}
                    <PasswordField label="Current password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <PasswordField label="New password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
                        <PasswordField label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
                    </div>
                    <SubmitButton busy={isSubmitting} busyLabel="Changing..." className="sm:w-auto">Change Password</SubmitButton>
                </form>
            )}
        </Card>
    );
}
