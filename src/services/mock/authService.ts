import { AuthService } from '../contracts';
import { DemoUser } from '../../types/user';
import { demoUser } from '../../data/mockUsers';
import { demoConfig } from '../../data/mockConfig';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class MockAuthService implements AuthService {
  async login(email: string): Promise<DemoUser> {
    await delay(demoConfig.simulatedLatencyMs);
    return {
      ...demoUser,
      email: email.trim().toLowerCase(),
    };
  }

  async register(name: string, email: string, phone: string): Promise<DemoUser> {
    await delay(demoConfig.simulatedLatencyMs);
    return {
      id: `USR-DEMO-${Date.now().toString().slice(-4)}`,
      fullname: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      isDemo: true,
    };
  }
}

export const mockAuthService = new MockAuthService();
