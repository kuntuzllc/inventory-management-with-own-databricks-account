import type { AuthClaims } from '../../types/domain.js';
import { dashboardRepository } from './dashboard.repository.js';

export class DashboardService {
  async getSummary(auth: AuthClaims) {
    return dashboardRepository.getSummary(auth.connection, auth.sub);
  }
}

export const dashboardService = new DashboardService();
