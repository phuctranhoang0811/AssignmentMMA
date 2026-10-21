import { DemoUser, UserAddress } from '../types/user';

export const demoUser: DemoUser = {
  id: 'USR-DEMO-001',
  fullname: 'Nguyễn Minh Anh',
  email: 'demo@pizzatime.local',
  phone: '0900000001',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  isDemo: true,
};

export const defaultAddresses: UserAddress[] = [
  {
    id: 'ADDR-001',
    label: 'Nhà riêng',
    recipientName: 'Nguyễn Minh Anh',
    phone: '0900000001',
    address: 'Số 45 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    isDefault: true,
  },
  {
    id: 'ADDR-002',
    label: 'Văn phòng',
    recipientName: 'Nguyễn Minh Anh',
    phone: '0900000001',
    address: 'Tầng 12 Tòa nhà Bitexco, Số 2 Hải Triều, Quận 1, TP. Hồ Chí Minh',
    isDefault: false,
  },
];
