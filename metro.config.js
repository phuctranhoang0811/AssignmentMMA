const { getDefaultConfig } = require('expo/metro-config');
const nodemailer = require('nodemailer');

const config = getDefaultConfig(__dirname);

// Hỗ trợ Firebase CJS modules
config.resolver.sourceExts.push('cjs');

// Cấu hình nodemailer gửi mail OTP qua Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'luanhuynh296@gmail.com',
    pass: 'qiccxrtcgyhmfxqr',
  },
});

const prevEnhanceMiddleware = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware, server) => {
    const parentMiddleware = prevEnhanceMiddleware
      ? prevEnhanceMiddleware(metroMiddleware, server)
      : metroMiddleware;

    return (req, res, next) => {
      // Cho phép Cross-Origin Requests từ Web và Mobile
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.url && req.url.includes('/api/send-otp')) {
        if (req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, message: 'OTP Email Service is active and ready.' }));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });

          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const { email, otp } = data;

              if (!email || !otp) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Thiếu email hoặc mã OTP' }));
                return;
              }

              console.log(`[OTP Service] Đang gửi mã OTP ${otp} đến email: ${email}`);

              await transporter.sendMail({
                from: '"Pizza FPT" <luanhuynh296@gmail.com>',
                to: email,
                subject: `[Pizza FPT] Mã xác thực đăng ký tài khoản của bạn: ${otp}`,
                html: `
                  <div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #fed7aa; border-radius: 12px; background: #ffffff;">
                    <div style="text-align: center; margin-bottom: 20px;">
                      <h1 style="color: #CF4226; margin: 0; font-size: 26px; font-weight: 800;">🍕 Pizza FPT</h1>
                      <p style="color: #666; font-size: 14px; margin-top: 4px;">Xác thực tài khoản người dùng</p>
                    </div>
                    <p style="color: #333; font-size: 15px;">Xin chào,</p>
                    <p style="color: #555; font-size: 14px; line-height: 1.5;">Bạn đang thực hiện đăng ký tài khoản tại <strong>Pizza FPT</strong>. Vui lòng nhập mã OTP gồm 4 chữ số dưới đây để tiếp tục:</p>
                    <div style="background: #fff4f0; border: 1.5px dashed #CF4226; border-radius: 10px; padding: 18px; text-align: center; margin: 24px 0;">
                      <span style="font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #CF4226; padding-left: 12px;">${otp}</span>
                    </div>
                    <p style="color: #888; font-size: 13px; line-height: 1.4;">Mã xác thực có hiệu lực trong vòng <strong>5 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai để bảo vệ thông tin tài khoản.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                    <p style="color: #aaa; font-size: 12px; text-align: center;">Đội ngũ hỗ trợ Pizza FPT • Dự án Assignment MMA</p>
                  </div>
                `,
              });

              console.log(`[OTP Service] Đã gửi thành công OTP đến ${email}`);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Đã gửi mã OTP thành công' }));
            } catch (error) {
              console.error('[OTP Service] Lỗi khi gửi mail:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: error.message || 'Lỗi server khi gửi mail' }));
            }
          });
          return;
        }
      }

      return parentMiddleware(req, res, next);
    };
  },
};

module.exports = config;
