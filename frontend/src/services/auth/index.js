import { API_MODE } from '@/services/http';
import { httpAuthService } from './http';
import { mockAuthService } from './mock';

/** Screens use this and never know which implementation is behind it. */
export const authService = API_MODE === 'live' ? httpAuthService : mockAuthService;
