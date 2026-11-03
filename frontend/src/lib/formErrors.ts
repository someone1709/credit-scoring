import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toApiError } from '@/services/http';

/**
 * Puts a server's field errors (Master Brief §6.7) on the matching inputs and returns the
 * message for anything left over, to show above the form. `fieldNames` maps the API's
 * snake_case names onto the form's names.
 */
export function applyServerErrors<T extends FieldValues>(
    error: unknown,
    setError: UseFormSetError<T>,
    fieldNames: Record<string, Path<T>>,
): string | null {
    const apiError = toApiError(error);
    let allPlaced = apiError.details.length > 0;
    for (const { field, issue } of apiError.details) {
        const name = fieldNames[field];
        if (name) setError(name, { type: 'server', message: issue });
        else allPlaced = false;
    }
    return allPlaced ? null : apiError.message;
}
