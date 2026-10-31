import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRole } from '@/context/RoleContext';
import { Card, DemoDisclaimer } from '@/components/shared/UI';
import { CheckCircle, Edit3, User } from 'lucide-react';

const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(10),
    occupation: z.string().min(2),
    address: z.string().min(5),
    city: z.string().min(2),
    state: z.string().min(2),
    pincode: z.string().length(6, 'Must be 6 digits'),
});
type FormData = z.infer<typeof schema>;

const inputCls = 'w-full px-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/70 transition-colors';

export default function Profile() {
    const { beneficiary } = useRole();
    const [saved, setSaved] = useState(false);
    const [editing, setEditing] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: beneficiary.name,
            email: beneficiary.email,
            phone: beneficiary.phone,
            occupation: beneficiary.occupation,
            address: beneficiary.address,
            city: beneficiary.city,
            state: beneficiary.state,
            pincode: beneficiary.pincode,
        },
    });

    const onSubmit = async (_data: FormData) => {
        await new Promise(r => setTimeout(r, 600));
        setSaved(true);
        setEditing(false);
        setTimeout(() => setSaved(false), 3000);
    };

    const initials = beneficiary.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Profile</h1>
                <button
                    onClick={() => setEditing(e => !e)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1c2333] hover:bg-[#212842] border border-[#30363d] text-slate-300 rounded-lg text-sm transition-colors"
                >
                    <Edit3 size={14} /> {editing ? 'Cancel' : 'Edit Profile'}
                </button>
            </div>

            <DemoDisclaimer />

            {/* Avatar card */}
            <Card className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
                    {initials}
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">{beneficiary.name}</h2>
                    <p className="text-slate-500 text-sm">{beneficiary.occupation}</p>
                    <p className="text-slate-500 text-sm">{beneficiary.city}, {beneficiary.state}</p>
                    <div className="flex items-center gap-3 mt-2">
                        <span className={`flex items-center gap-1 text-xs ${beneficiary.aadharLinked ? 'text-emerald-400' : 'text-slate-500'}`}>
                            <CheckCircle size={11} /> Aadhaar {beneficiary.aadharLinked ? 'Linked' : 'Not Linked'}
                        </span>
                        <span className={`flex items-center gap-1 text-xs ${beneficiary.panLinked ? 'text-emerald-400' : 'text-slate-500'}`}>
                            <CheckCircle size={11} /> PAN {beneficiary.panLinked ? 'Linked' : 'Not Linked'}
                        </span>
                    </div>
                </div>
            </Card>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)}>
                <Card>
                    <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2"><User size={16} /> Personal Details</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { name: 'name', label: 'Full Name' },
                            { name: 'email', label: 'Email Address' },
                            { name: 'phone', label: 'Phone Number' },
                            { name: 'occupation', label: 'Occupation' },
                            { name: 'address', label: 'Address', full: true },
                            { name: 'city', label: 'City' },
                            { name: 'state', label: 'State' },
                            { name: 'pincode', label: 'Pincode' },
                        ].map(({ name, label, full }) => (
                            <div key={name} className={full ? 'sm:col-span-2' : ''}>
                                <label className="block text-sm font-medium text-slate-400 mb-1.5">{label}</label>
                                <input
                                    {...register(name as keyof FormData)}
                                    disabled={!editing}
                                    className={`${inputCls} ${!editing ? 'opacity-60 cursor-not-allowed' : ''}`}
                                />
                                {errors[name as keyof FormData] && (
                                    <p className="text-xs text-red-400 mt-1">{errors[name as keyof FormData]?.message}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {editing && (
                        <div className="flex items-center gap-3 mt-5">
                            <button type="submit" className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors">
                                Save Changes
                            </button>
                            {saved && (
                                <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
                                    <CheckCircle size={14} /> Saved!
                                </span>
                            )}
                        </div>
                    )}
                </Card>
            </form>

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
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-sm">Age</span>
                        <span className="text-slate-300 text-sm">{beneficiary.age} years</span>
                    </div>
                </div>
            </Card>
        </div>
    );
}
