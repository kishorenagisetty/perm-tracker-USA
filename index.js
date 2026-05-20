const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

const EMAIL_TO = 'kishorekumarn24@gmail.com';
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_PASS = process.env.EMAIL_PASS;

async function scrapeImmilane() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  });
  const page = await browser.newPage();
  await page.goto('https://immilane.com', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForTimeout(4000);

  const data = await page.evaluate(() => {
    const body = document.body.innerText;
    console.log('PAGE TEXT:', body.substring(0, 2000));

    const match = (pattern) => {
      const m = body.match(pattern);
      return m ? m[1].trim() : 'N/A';
    };

    // Try multiple patterns for DOL month
      const dolMonth = match(/DOL CURRENTLY PROCESSING[\s\S]{0,100}?([A-Z][a-z]{2,8}\s+'[0-9]{2})/i);

    return {
      dolMonth: dolMonth,
      backlog: match(/TOTAL BACKLOG[\s\S]{0,200}?([\d,]{5,})/i),
      avgDays: match(/AVG PROCESSING DAYS[\s\S]{0,200}?(\d{3,4})/i),
      processed: match(/Processed\s+([\d,]+)/),
      newIntake: match(/New intake\s+\+?([\d,]+)/),
      netChange: match(/Net change\s+([^\n]+)/),
      lastMonth: match(/Last month \(([^)]+)\)/i),
      certifiedAvg: match(/Certified cases avg\s+([\d]+ days)/i),
      rfiAvg: match(/RFI cases avg\s+([\d]+ days)/i),
      deniedAvg: match(/Denied cases avg\s+([\d]+ days)/i),
      trend: match(/90-day trend\s+([^\n]+)/i),
      fetchedAt: new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
    };
  });

  await browser.close();
  return data;
}

function buildEmail(d) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
  + 'body{margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif}'
  + '.wrap{max-width:580px;margin:30px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10)}'
  + '.top{background:#0f172a;padding:30px 28px 24px}'
  + '.top h1{color:#fff;font-size:22px;font-weight:700;margin:0 0 4px}'
  + '.top p{color:#64748b;font-size:12px;margin:0}'
  + '.hero{background:#1e1b4b;padding:28px;text-align:center;border-bottom:3px solid #4f46e5}'
  + '.hero-label{color:#818cf8;font-size:10px;letter-spacing:4px;text-transform:uppercase;margin-bottom:10px}'
  + '.hero-month{color:#fff;font-size:48px;font-weight:900;font-family:Georgia,serif;line-height:1}'
  + '.hero-sub{color:#6366f1;font-size:12px;margin-top:8px}'
  + '.body{padding:24px 28px}'
  + '.card{background:#f8fafc;border-radius:14px;padding:18px 20px;margin-bottom:16px;border:1px solid #e2e8f0}'
  + '.card-title{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;margin-bottom:12px}'
  + '.big{font-size:34px;font-weight:900;color:#f59e0b;font-family:Georgia,serif;line-height:1}'
  + '.big-blue{font-size:34px;font-weight:900;color:#6366f1;font-family:Georgia,serif;line-height:1}'
  + '.sub{font-size:12px;color:#94a3b8;margin:4px 0 12px}'
  + '.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}'
  + '.row:last-child{border-bottom:none}'
  + '.lbl{color:#64748b}.val{font-weight:700;color:#1e293b}'
  + '.green{color:#16a34a}.red{color:#dc2626}'
  + '.tip{background:#fffbeb;border-radius:12px;padding:16px;margin-bottom:20px;border-left:4px solid #f59e0b}'
  + '.tip-title{font-size:12px;font-weight:700;color:#b45309;margin-bottom:4px}'
  + '.tip-body{font-size:12px;color:#92400e;line-height:1.6}'
  + '.footer{background:#f8fafc;padding:18px 28px;text-align:center;border-top:1px solid #e2e8f0}'
  + '.btn{display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px}'
  + '.note{font-size:11px;color:#94a3b8;margin-top:12px}'
  + '</style></head><body><div class="wrap">'
  + '<div class="top"><h1>PERM Weekly Status Report</h1>'
  + '<p>Hi Kishore - auto-fetched live from immilane.com | ' + d.fetchedAt + '</p></div>'
  + '<div class="hero">'
  + '<div class="hero-label">DOL Currently Processing</div>'
  + '<div class="hero-month">' + d.dolMonth + '</div>'
  + '<div class="hero-sub">Cases filed around this date are being adjudicated now</div></div>'
  + '<div class="body">'
  + '<div class="card"><div class="card-title">Backlog Overview</div>'
  + '<div class="big">' + d.backlog + '</div>'
  + '<div class="row"><span class="lbl">Last Month</span><span class="val">' + d.lastMonth + '</span></div>'
  + '<div class="row"><span class="lbl">Processed</span><span class="val green">' + d.processed + '</span></div>'
  + '<div class="row"><span class="lbl">New Intake</span><span class="val red">+' + d.newIntake + '</span></div>'
  + '<div class="row"><span class="lbl">Net Change</span><span class="val green">' + d.netChange + '</span></div></div>'
  + '<div class="card"><div class="card-title">Processing Times</div>'
  + '<div class="big-blue">' + d.avgDays + ' days</div>'
  + '<div class="sub">approx. 15-16 months | 90-day trend: ' + d.trend + '</div>'
  + '<div class="row"><span class="lbl">Certified Cases Avg</span><span class="val">' + d.certifiedAvg + '</span></div>'
  + '<div class="row"><span class="lbl">RFI Cases Avg</span><span class="val">' + d.rfiAvg + '</span></div>'
  + '<div class="row"><span class="lbl">Denied Cases Avg</span><span class="val red">' + d.deniedAvg + '</span></div></div>'
  + '<div class="tip"><div class="tip-title">India H-1B Reminder</div>'
  + '<div class="tip-body">File PERM + I-140 ASAP to lock your priority date. Once I-140 approved, you get 3-year H-1B extensions beyond year 6 regardless of GC backlog.</div></div>'
  + '</div>'
  + '<div class="footer"><a href="https://immilane.com" class="btn">View Full Dashboard</a>'
  + '<div class="note">Auto-sent every Monday | Source: immilane.com | 100% Free via GitHub Actions</div></div>'
  + '</div></body></html>';
}

async function sendEmail(data) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_FROM, pass: EMAIL_PASS }
  });
  await transporter.sendMail({
    from: EMAIL_FROM,
    to: EMAIL_TO,
    subject: 'PERM Weekly Update | DOL: ' + data.dolMonth + ' | Backlog: ' + data.backlog + ' | Avg: ' + data.avgDays + ' days',
    html: buildEmail(data)
  });
  console.log('Email sent!');
}

async function main() {
  console.log('Scraping immilane.com...');
  const data = await scrapeImmilane();
  console.log('Data:', JSON.stringify(data));
  await sendEmail(data);
}

main().catch(console.error);
