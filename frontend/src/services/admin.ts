// The lender approval routes. They use a key rather than a signed-in account, so they get their own
// client: a wrong key must never trigger the session refresh that the main client does on a 401.

import axios from 'axios';
import type { ApprovalStatus } from '@/types';
import { http, toApiError } from '@/services/http';

export interface AdminLender {
    id: string;
    institutionName: string;
    contactPerson: string;
    email: string;
    phone: string;
    licenseNumber: string;
    emailVerified: boolean;
    approvalStatus: ApprovalStatus;
    registeredAt: string;
}

interface AdminLenderDto {
    id: string;
    institution_name: string;
    contact_person: string;
    email: string;
    phone: string;
    license_number: string;
    email_verified: boolean;
    approval_status: ApprovalStatus;
    registered_at: string;
}

const client = axios.create({ baseURL: http.defaults.baseURL, timeout: 15000 });

function toLender(dto: AdminLenderDto): AdminLender {
    return {
        id: dto.id,
        institutionName: dto.institution_name,
        contactPerson: dto.contact_person,
        email: dto.email,
        phone: dto.phone,
        licenseNumber: dto.license_number,
        emailVerified: dto.email_verified,
        approvalStatus: dto.approval_status,
        registeredAt: dto.registered_at,
    };
}

export async function listLendersAsAdmin(key: string): Promise<AdminLender[]> {
    try {
        const response = await client.get<AdminLenderDto[]>('/admin/lenders', { headers: { 'X-Admin-Key': key } });
        return response.data.map(toLender);
    } catch (error) {
        throw toApiError(error);
    }
}

export async function decideLender(key: string, lenderId: string, decision: 'approve' | 'reject'): Promise<AdminLender> {
    try {
        const response = await client.post<AdminLenderDto>(`/admin/lenders/${lenderId}/${decision}`, undefined, { headers: { 'X-Admin-Key': key } });
        return toLender(response.data);
    } catch (error) {
        throw toApiError(error);
    }
}
