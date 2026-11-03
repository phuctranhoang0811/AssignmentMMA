// Real addresses from the restaurant's official site; demo pickup points only, no commercial affiliation.
export const mockStores = [
  { id: 'demo-le-thanh-ton', name: "Demo • Pizza 4P’s Lê Thánh Tôn",
    address: '8/15 Lê Thánh Tôn, Bến Nghé, Quận 1, Thành phố Hồ Chí Minh, Việt Nam',
    sourceUrl: 'https://pizza4ps.com/vn/location/931/' },
  { id: 'demo-ben-thanh', name: "Demo • Pizza 4P’s Bến Thành",
    address: '8 Thủ Khoa Huân, Phường Bến Thành, Quận 1, Thành phố Hồ Chí Minh, Việt Nam',
    sourceUrl: 'https://pizza4ps.com/vn/career_findjobs_post/?job_id=49705' },
  { id: 'demo-saigon-centre', name: "Demo • Pizza 4P’s Saigon Centre",
    address: 'Tầng 6, TTTM Saigon Centre, 65 Lê Lợi, Bến Nghé, Quận 1, Thành phố Hồ Chí Minh, Việt Nam',
    sourceUrl: 'https://pizza4ps.com/vn/career_findjobs_post/?job_id=49705' },
] as const;
