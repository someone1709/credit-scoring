import type { AppDataService } from '@/types/appService';
import { API_MODE } from '@/services/http';
import { httpAppService } from './http';
import { mockAppService } from './mock';

/** Screens use this and never know which implementation is behind it. */
export const appService: AppDataService = API_MODE === 'live' ? httpAppService : mockAppService;
