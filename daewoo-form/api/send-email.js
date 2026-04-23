// Vercel Serverless Function
// POST /api/send-email
// body: { pdfBase64: string, applicantName: string }

export default async function handler(req, res) {
  // CORS (같은 도메인에서만 오지만 안전하게)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pdfBase64, applicantName } = req.body || {};

    if (!pdfBase64) {
      return res.status(400).json({ error: 'PDF 데이터가 없습니다' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const TO_EMAIL = process.env.TO_EMAIL;
    const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

    if (!RESEND_API_KEY || !TO_EMAIL) {
      return res.status(500).json({
        error: '서버 환경변수가 설정되지 않았습니다 (RESEND_API_KEY, TO_EMAIL)'
      });
    }

    const safeName = (applicantName || '지원자').replace(/[^\w가-힣\s]/g, '').trim() || '지원자';
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const filename = `입학원서_${safeName}_${dateStr}.pdf`;

    const emailPayload = {
      from: `대우능력개발원 입학원서 <${FROM_EMAIL}>`,
      to: [TO_EMAIL],
      subject: `[입학원서] ${safeName} - ${dateStr}`,
      html: `
        <div style="font-family: 'Malgun Gothic', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #111; border-bottom: 2px solid #111; padding-bottom: 10px;">📄 새 입학원서 접수</h2>
          <p style="color: #333; line-height: 1.8;">
            새로운 입학원서가 제출되었습니다.<br>
            <strong>지원자명:</strong> ${safeName}<br>
            <strong>접수일시:</strong> ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
          </p>
          <p style="color: #666; font-size: 13px; margin-top: 20px;">
            첨부된 PDF 파일을 확인해 주세요.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: filename,
          content: pdfBase64
        }
      ]
    };

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error('Resend error:', resendData);
      return res.status(500).json({
        error: '이메일 전송 실패',
        detail: resendData
      });
    }

    return res.status(200).json({
      success: true,
      messageId: resendData.id
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({
      error: '서버 오류',
      detail: err.message
    });
  }
}
