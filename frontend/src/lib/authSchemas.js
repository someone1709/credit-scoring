import { z } from 'zod';

const email = z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address');
const phone = z.string().trim().regex(/^\+?[0-9][0-9\s-]{8,14}$/, 'Enter a valid phone number');

export const newPassword = z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(72, 'Use 72 characters or fewer')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/[0-9]/, 'Include at least one number');

function withMatchingPasswords(schema) {
    return schema.refine(data => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    });
}

const accountFields = {
    email,
    phone,
    password: newPassword,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    acceptedNotice: z.literal(true, { error: 'Please confirm you understand this' }),
};

export const loginSchema = z.object({
    email,
    password: z.string().min(1, 'Enter your password'),
    remember: z.boolean(),
});

export const beneficiaryRegisterSchema = withMatchingPasswords(z.object({
    ...accountFields,
    name: z.string().trim().min(2, 'Enter your full name').max(80, 'Use 80 characters or fewer'),
}));

export const lenderRegisterSchema = withMatchingPasswords(z.object({
    ...accountFields,
    institutionName: z.string().trim().min(2, 'Enter the institution name').max(100, 'Use 100 characters or fewer'),
    contactPerson: z.string().trim().min(2, 'Enter a contact person').max(80, 'Use 80 characters or fewer'),
    licenseNumber: z.string().trim().min(3, 'Enter the license number').max(40, 'Use 40 characters or fewer'),
}));

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = withMatchingPasswords(z.object({
    password: newPassword,
    confirmPassword: z.string().min(1, 'Confirm your password'),
}));

export const changePasswordSchema = withMatchingPasswords(z.object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: newPassword,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
}));

