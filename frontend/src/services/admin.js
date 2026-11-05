// The lender approval routes. They use a key rather than a signed-in account, so they get their own
// client: a wrong key must never trigger the session refresh that the main client does on a 401.

import axios from 'axios';
import { http, toApiError } from '@/services/http';

const client = axios.create({ baseURL: http.defaults.baseURL, timeout: 15000 });

function toLender(dto) {
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

export async function listLendersAsAdmin(key) {
    try {
        const response = await client.get('/admin/lenders', { headers: { 'X-Admin-Key': key } });
        return response.data.map(toLender);
    } catch (error) {
        throw toApiError(error);
    }
}

export async function decideLender(key, lenderId, decision) {
    try {
        const response = await client.post(`/admin/lenders/${lenderId}/${decision}`, undefined, { headers: { 'X-Admin-Key': key } });
        return toLender(response.data);
    } catch (error) {
        throw toApiError(error);
    }
}
