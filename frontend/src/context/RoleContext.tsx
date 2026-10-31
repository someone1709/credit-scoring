import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserRole, BeneficiaryProfile, LenderProfile } from '@/types';
import { MOCK_BENEFICIARIES, MOCK_LENDERS } from '@/data/mockData';

interface RoleContextValue {
    role: UserRole;
    beneficiary: BeneficiaryProfile;
    lender: LenderProfile;
    switchRole: (role: UserRole) => void;
    switchBeneficiary: (id: string) => void;
    switchLender: (id: string) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
    const [role, setRole] = useState<UserRole>(() => {
        return (localStorage.getItem('bscore_role') as UserRole) || 'beneficiary';
    });
    const [beneficiaryId, setBeneficiaryId] = useState(() => {
        return localStorage.getItem('bscore_beneficiary_id') || 'BEN001';
    });
    const [lenderId, setLenderId] = useState(() => {
        return localStorage.getItem('bscore_lender_id') || 'LENDER001';
    });

    const beneficiary = MOCK_BENEFICIARIES.find(b => b.id === beneficiaryId) || MOCK_BENEFICIARIES[0];
    const lender = MOCK_LENDERS.find(l => l.id === lenderId) || MOCK_LENDERS[0];

    const switchRole = useCallback((newRole: UserRole) => {
        setRole(newRole);
        localStorage.setItem('bscore_role', newRole);
    }, []);

    const switchBeneficiary = useCallback((id: string) => {
        setBeneficiaryId(id);
        localStorage.setItem('bscore_beneficiary_id', id);
    }, []);

    const switchLender = useCallback((id: string) => {
        setLenderId(id);
        localStorage.setItem('bscore_lender_id', id);
    }, []);

    useEffect(() => {
        localStorage.setItem('bscore_role', role);
    }, [role]);

    return (
        <RoleContext.Provider value={{ role, beneficiary, lender, switchRole, switchBeneficiary, switchLender }}>
            {children}
        </RoleContext.Provider>
    );
}

export function useRole() {
    const ctx = useContext(RoleContext);
    if (!ctx) throw new Error('useRole must be used within RoleProvider');
    return ctx;
}
