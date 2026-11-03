import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { UserRole } from '@/types';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { CheckboxField, FormAlert, PasswordChecklist, PasswordField, RoleTabs, SubmitButton, TextField } from '@/components/auth/AuthFields';
import { useAuth } from '@/context/useAuth';
import {
    beneficiaryRegisterSchema,
    lenderRegisterSchema,
    type BeneficiaryRegisterForm as BeneficiaryValues,
    type LenderRegisterForm as LenderValues,
} from '@/lib/authSchemas';
import { applyServerErrors } from '@/lib/formErrors';

const NOTICE = 'I understand BeneScore is an academic prototype: no real loans are issued and no real money moves.';

function SharedFields({ fields, errors, passwordValue }: {
    fields: {
        email: UseFormRegisterReturn;
        phone: UseFormRegisterReturn;
        password: UseFormRegisterReturn;
        confirmPassword: UseFormRegisterReturn;
        acceptedNotice: UseFormRegisterReturn;
    };
    errors: Partial<Record<'email' | 'phone' | 'password' | 'confirmPassword' | 'acceptedNotice', { message?: string }>>;
    passwordValue: string;
}) {
    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...fields.email} />
                <TextField label="Phone number" type="tel" autoComplete="tel" placeholder="+91 98765 43210" error={errors.phone?.message} {...fields.phone} />
                <PasswordField label="Password" autoComplete="new-password" error={errors.password?.message} {...fields.password} />
                <PasswordField label="Confirm password" autoComplete="new-password" error={errors.confirmPassword?.message} {...fields.confirmPassword} />
            </div>
            <PasswordChecklist value={passwordValue} />
            <CheckboxField label={NOTICE} error={errors.acceptedNotice?.message} {...fields.acceptedNotice} />
        </>
    );
}

// Both forms understand these names, in the API's spelling and the form's.
const SHARED_FIELD_NAMES = { email: 'email', phone: 'phone', password: 'password' } as const;

function BeneficiaryForm() {
    const { register: signUp } = useAuth();
    const [serverError, setServerError] = useState<string | null>(null);
    const { register, handleSubmit, setError, watch, formState: { errors, isSubmitting } } = useForm<BeneficiaryValues>({
        resolver: zodResolver(beneficiaryRegisterSchema),
        defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '' },
    });

    const onSubmit = async (data: BeneficiaryValues) => {
        setServerError(null);
        try {
            await signUp({ role: 'beneficiary', name: data.name, email: data.email, phone: data.phone, password: data.password });
        } catch (error) {
            setServerError(applyServerErrors(error, setError, { ...SHARED_FIELD_NAMES, name: 'name' }));
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {serverError && <FormAlert>{serverError}</FormAlert>}
            <TextField label="Full name" autoComplete="name" placeholder="As it should appear on your application" error={errors.name?.message} {...register('name')} />
            <SharedFields
                errors={errors}
                passwordValue={watch('password')}
                fields={{
                    email: register('email'),
                    phone: register('phone'),
                    password: register('password'),
                    confirmPassword: register('confirmPassword'),
                    acceptedNotice: register('acceptedNotice'),
                }}
            />
            <SubmitButton busy={isSubmitting} busyLabel="Creating account...">Create Beneficiary Account</SubmitButton>
        </form>
    );
}

function LenderForm() {
    const { register: signUp } = useAuth();
    const [serverError, setServerError] = useState<string | null>(null);
    const { register, handleSubmit, setError, watch, formState: { errors, isSubmitting } } = useForm<LenderValues>({
        resolver: zodResolver(lenderRegisterSchema),
        defaultValues: { institutionName: '', contactPerson: '', licenseNumber: '', email: '', phone: '', password: '', confirmPassword: '' },
    });

    const onSubmit = async (data: LenderValues) => {
        setServerError(null);
        try {
            await signUp({
                role: 'lender',
                institutionName: data.institutionName,
                contactPerson: data.contactPerson,
                licenseNumber: data.licenseNumber,
                email: data.email,
                phone: data.phone,
                password: data.password,
            });
        } catch (error) {
            setServerError(applyServerErrors(error, setError, {
                ...SHARED_FIELD_NAMES,
                institution_name: 'institutionName',
                contact_person: 'contactPerson',
                license_number: 'licenseNumber',
            }));
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {serverError && <FormAlert>{serverError}</FormAlert>}
            <TextField label="Institution name" autoComplete="organization" placeholder="e.g. Unity Bank" error={errors.institutionName?.message} {...register('institutionName')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField label="Contact person" autoComplete="name" error={errors.contactPerson?.message} {...register('contactPerson')} />
                <TextField label="License number" hint="Not verified in this prototype" error={errors.licenseNumber?.message} {...register('licenseNumber')} />
            </div>
            <SharedFields
                errors={errors}
                passwordValue={watch('password')}
                fields={{
                    email: register('email'),
                    phone: register('phone'),
                    password: register('password'),
                    confirmPassword: register('confirmPassword'),
                    acceptedNotice: register('acceptedNotice'),
                }}
            />
            <SubmitButton busy={isSubmitting} busyLabel="Creating account...">Create Lender Account</SubmitButton>
        </form>
    );
}

export default function Register() {
    const [params, setParams] = useSearchParams();
    const role: UserRole = params.get('role') === 'lender' ? 'lender' : 'beneficiary';

    return (
        <AuthLayout
            title="Create your account"
            subtitle={role === 'lender' ? 'Review shared applications and make your own lending decisions.' : 'Apply once and compare offers from independent lenders.'}
            footer={<>Already have an account? <Link to={`/login?role=${role}`} className="text-emerald-400 hover:text-emerald-300 font-medium">Sign in</Link></>}
        >
            <div className="glass-card p-5 sm:p-6 space-y-5">
                <RoleTabs value={role} onChange={next => setParams({ role: next }, { replace: true })} />
                {role === 'lender' ? <LenderForm /> : <BeneficiaryForm />}
            </div>
        </AuthLayout>
    );
}
