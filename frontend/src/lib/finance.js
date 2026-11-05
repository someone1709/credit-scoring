// Financial indicators from Master Brief §5.2, plus EMI maths for loan offers.

export function dtiPercent(existingEmi, monthlyIncome) {
    return monthlyIncome > 0 ? (existingEmi / monthlyIncome) * 100 : 0;
}

export function expenseRatioPercent(monthlyExpenses, monthlyIncome) {
    return monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 0;
}

export function monthlySurplus(monthlyIncome, monthlyExpenses, existingEmi) {
    return monthlyIncome - monthlyExpenses - existingEmi;
}

/** Equated monthly instalment. A 0% rate is valid and simply divides the principal evenly. */
export function calculateEmi(amount, annualRatePercent, tenureMonths) {
    if (amount <= 0 || tenureMonths <= 0) return 0;
    const monthlyRate = annualRatePercent / 12 / 100;
    if (monthlyRate === 0) return Math.round(amount / tenureMonths);
    return Math.round((amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -tenureMonths)));
}

export function totalRepayable(amount, annualRatePercent, tenureMonths) {
    return calculateEmi(amount, annualRatePercent, tenureMonths) * tenureMonths;
}

/** Reducing-balance schedule. The final instalment absorbs rounding so the balance ends at exactly 0. */
export function repaymentSchedule(amount, annualRatePercent, tenureMonths) {
    const emi = calculateEmi(amount, annualRatePercent, tenureMonths);
    const monthlyRate = annualRatePercent / 12 / 100;
    const rows = [];
    let balance = amount;
    for (let instalment = 1; instalment <= tenureMonths; instalment++) {
        const interest = Math.round(balance * monthlyRate);
        const isLast = instalment === tenureMonths;
        const principal = isLast ? balance : Math.min(balance, emi - interest);
        balance -= principal;
        rows.push({ instalment, emi: principal + interest, principal, interest, balance });
    }
    return rows;
}
