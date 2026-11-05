import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isProfileComplete, useAuth, useBeneficiary } from '@/context/useAuth';
import { useApp } from '@/context/useApp';
import { ChangePasswordCard } from '@/components/auth/ChangePasswordCard';
import { FormAlert } from '@/components/auth/AuthFields';
import { Card, DemoDisclaimer } from '@/components/shared/UI';
import { applyServerErrors } from '@/lib/formErrors';
import { CheckCircle, Edit3, Loader2, User } from 'lucide-react';

const schema = z.object({
    name: z.string().trim().min(2, 'Enter your full name'),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z.string().trim().regex(/^\+?[0-9][0-9\s-]{8,14}$/, 'Enter a valid phone number'),
    age: z.number({ error: 'Enter a valid age' }).int('Enter a valid age').min(1, 'Enter a valid age').max(120, 'Enter a valid age').nullable(),
    occupation: z.string().trim().min(2, 'Enter your occupation'),
    address: z.string().trim().min(5, 'Enter your address'),
    city: z.string().trim().min(2, 'Enter your city'),
    state: z.string().trim().min(2, 'Enter your state'),
    pincode: z.string().trim().regex(/^\d{6}$/, 'Must be 6 digits'),
});

const inputCls = 'w-full px-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/70 transition-colors';

const FIELDS = [
    { name: 'name', label: 'Full Name', autoComplete: 'name' },
    { name: 'email', label: 'Email Address', autoComplete: 'email' },
    { name: 'phone', label: 'Phone Number', autoComplete: 'tel' },
    { name: 'occupation', label: 'Occupation', autoComplete: 'organization-title' },
    { name: 'address', label: 'Address', autoComplete: 'street-address', full: true },
    { name: 'city', label: 'City', autoComplete: 'address-level2' },
    { name: 'state', label: 'State', autoComplete: 'address-level1' },
    { name: 'pincode', label: 'Pincode', autoComplete: 'postal-code' },
];

export default function Profile() {
    const beneficiary = useBeneficiary();
    const { updateBeneficiaryProfile } = useAuth();
    const { syncApplicantProfile } = useApp();
    const location = useLocation();
    const welcome = location.state?.welcome === true;
    const complete = isProfileComplete(beneficiary);

    const [saved, setSaved] = useState(false);
    // A new account lands here to fill the profile in, so start ready to type.
    const [editing, setEditing] = useState(!complete);
    const [serverError, setServerError] = useState(null);

    const profileValues = () => ({
        name: beneficiary.name,
        email: beneficiary.email,
        phone: beneficiary.phone,
        age: beneficiary.age,
        occupation: beneficiary.occupation,
        address: beneficiary.address,
        city: beneficiary.city,
        state: beneficiary.state,
        pincode: beneficiary.pincode,
    });

    const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(schema),
        defaultValues: profileValues(),
    });

    const onSubmit = async (data) => {
        setServerError(null);
        try {
            const updated = await updateBeneficiaryProfile(data);
            if (updated.role === 'beneficiary') {
                await syncApplicantProfile(updated.profile);
                reset({ ...data, email: updated.profile.email });
            }
            setSaved(true);
            setEditing(false);
            setTimeout(() => setSaved(false), 4000);
        } catch (error) {
            setServerError(applyServerErrors(error, setError, { name: 'name', email: 'email', phone: 'phone', pincode: 'pincode' }));
        }
    };

    const initials = beneficiary.name.split(/\s+/).filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const location_ = [beneficiary.city, beneficiary.state].filter(Boolean).join(', ');

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Profile</h1>
                <button
                    onClick={() => {
                        if (editing) { reset(profileValues()); setServerError(null); }
                        setEditing(e => !e);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1c2333] hover:bg-[#212842] border border-[#30363d] text-slate-300 rounded-lg text-sm transition-colors"
                >
                    <Edit3 size={14} /> {editing ? 'Cancel' : 'Edit Profile'}
                </button>
            </div>

            <DemoDisclaimer />

            {welcome && !complete && (
                <FormAlert tone="success">Your account is ready. Complete your profile below so you can apply for a loan.</FormAlert>
            )}
            {saved && <FormAlert tone="success">Your profile has been saved.</FormAlert>}

            {/* Avatar card */}
            <Card className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
                    {initials}
                </div>
                <div className="min-w-0">
                    <h2 className="text-xl font-bold text-white truncate">{beneficiary.name}</h2>
                    {beneficiary.occupation && <p className="text-slate-500 text-sm">{beneficiary.occupation}</p>}
                    {location_ && <p className="text-slate-500 text-sm">{location_}</p>}
                    <p className={`flex items-center gap-1 text-xs mt-2 ${complete ? 'text-emerald-400' : 'text-amber-400'}`}>
                        <CheckCircle size={11} /> {complete ? 'Profile complete' : 'Profile incomplete'}
                    </p>
                </div>
            </Card>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <Card>
                    <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2"><User size={16} /> Personal Details</h2>
                    {serverError && <div className="mb-4"><FormAlert>{serverError}</FormAlert></div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {FIELDS.map(({ name, label, autoComplete, full }) => (
                            <div key={name} className={full ? 'sm:col-span-2' : ''}>
                                <label htmlFor={`profile-${name}`} className="block text-sm font-medium text-slate-400 mb-1.5">{label}</label>
                                <input
                                    id={`profile-${name}`}
                                    autoComplete={autoComplete}
                                    {...register(name)}
                                    disabled={!editing}
                                    aria-invalid={errors[name] ? true : undefined}
                                    className={`${inputCls} ${!editing ? 'opacity-60 cursor-not-allowed' : ''}`}
                                />
                                {errors[name] && (
                                    <p className="text-xs text-red-400 mt-1">{errors[name]?.message}</p>
                                )}
                            </div>
                        ))}
                        <div>
                            <label htmlFor="profile-age" className="block text-sm font-medium text-slate-400 mb-1.5">Age (optional)</label>
                            <input
                                id="profile-age"
                                type="number"
                                min="1"
                                {...register('age', { setValueAs: v => (v === '' || v === null ? null : Number(v)) })}
                                disabled={!editing}
                                className={`${inputCls} ${!editing ? 'opacity-60 cursor-not-allowed' : ''}`}
                            />
                            {errors.age && <p className="text-xs text-red-400 mt-1">{errors.age.message}</p>}
                        </div>
                    </div>

                    {editing && (
                        <div className="flex items-center gap-3 mt-5">
                            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors">
                                {isSubmitting && <Loader2 size={15} className="animate-spin" />} Save Changes
                            </button>
                        </div>
                    )}
                </Card>
            </form>

            <ChangePasswordCard />

            {/* Beneficiary ID */}
            <Card>
                <h2 className="text-base font-bold text-white mb-3">Account Information</h2>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-sm">Beneficiary ID</span>
                        <span className="font-mono text-sm text-slate-300">{beneficiary.id}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-sm">Account Type</span>
                        <span className="text-slate-300 text-sm">Beneficiary</span>
                    </div>
                </div>
            </Card>
        </div>
    );
}
