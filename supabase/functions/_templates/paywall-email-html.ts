export function renderPaywallEmail(firstName: string, unsubscribeUrl: string): string {
  const subject = "Your trial is still waiting for you 🕊️";
  const preview =
    "No charge today. No catch. Just 14 days to see if this changes anything.";
  const trialUrl =
    "https://prayerjournal.app/trial?utm_source=email&utm_campaign=paywall_exit";
  const background = "#FAFAF8";
  const body = "#4A5568";
  const gold = "#C4A572";
  const ctaBg = "#1B2A4A";
  const ctaText = "#FFFFFF";
  const fontFamily = "Georgia, 'Times New Roman', serif";

  const name = firstName.trim() || "Friend";
  const safeName = name
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const safeUnsubscribeUrl = unsubscribeUrl
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="background-color:${background};margin:0;padding:24px 12px;font-family:${fontFamily};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preview}</div>
  <div style="max-width:600px;margin:0 auto;background-color:${background};">
    <p style="color:${body};font-size:16px;line-height:26px;margin:0 0 16px;font-family:${fontFamily};">Hi ${safeName},</p>

    <p style="color:${body};font-size:16px;line-height:26px;margin:0 0 16px;font-family:${fontFamily};">
      You made it all the way through setting up your Prayer Journal — and then
      something stopped you at the last step.
    </p>

    <p style="color:${body};font-size:16px;line-height:26px;margin:0 0 16px;font-family:${fontFamily};">
      Maybe it felt like a bigger commitment than expected. Maybe you meant to come
      back to it. Maybe life just got in the way.
    </p>

    <p style="color:${body};font-size:16px;line-height:26px;margin:0 0 16px;font-family:${fontFamily};">
      Whatever it was — your journal is still here, exactly where you left it.
    </p>

    <p style="color:${body};font-size:16px;line-height:26px;margin:0 0 16px;font-family:${fontFamily};">Starting a free trial means:</p>
    <p style="color:${body};font-size:16px;line-height:26px;margin:0 0 8px 8px;font-family:${fontFamily};">
      • 14 days completely free — nothing charged until day 15
    </p>
    <p style="color:${body};font-size:16px;line-height:26px;margin:0 0 8px 8px;font-family:${fontFamily};">
      • Cancel any time before then and you pay absolutely nothing
    </p>
    <p style="color:${body};font-size:16px;line-height:26px;margin:0 0 8px 8px;font-family:${fontFamily};">
      • Everything you set up in onboarding is saved and ready
    </p>
    <p style="color:${body};font-size:16px;line-height:26px;margin:0 0 8px 8px;font-family:${fontFamily};">
      • No pressure from us if you decide it's not for you
    </p>

    <div style="border-left:3px solid ${gold};padding-left:16px;margin:24px 0;">
      <p style="color:${gold};font-size:16px;line-height:26px;font-style:italic;margin:0;font-family:${fontFamily};">
        "Come to me, all you who are weary and burdened, and I will give you rest." —
        Matthew 11:28
      </p>
    </div>

    <p style="color:${body};font-size:16px;line-height:26px;margin:0 0 16px;font-family:${fontFamily};">
      You've already done the harder part. Your first prayer is waiting to be recorded.
    </p>

    <div style="text-align:center;margin:28px 0 32px;">
      <a href="${trialUrl}" style="background-color:${ctaBg};color:${ctaText};border:2px solid ${gold};border-radius:6px;font-size:16px;font-weight:600;text-decoration:none;display:inline-block;max-width:280px;width:100%;padding:14px 20px;text-align:center;font-family:${fontFamily};box-sizing:border-box;">
        Start My Free 14-Day Trial →
      </a>
    </div>

    <p style="color:${body};font-size:16px;line-height:26px;margin:0 0 16px;font-family:${fontFamily};">
      Grace &amp; peace,<br />
      Samuel &amp; the Prayer Journal team
    </p>

    <hr style="border:none;border-top:1px solid #E8E4DC;margin:32px 0 20px;" />

    <p style="color:${body};font-size:14px;line-height:22px;margin:0 0 12px;font-family:${fontFamily};">
      P.S. The annual plan works out to less than £1 a week. But you don't need to think
      about that today — the trial is free.
    </p>

    <p style="color:${body};font-size:14px;line-height:22px;margin:0 0 12px;font-family:${fontFamily};">
      You received this because you started setting up a Prayer Journal account.<br />
      <a href="${safeUnsubscribeUrl}" style="color:${body};text-decoration:underline;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;
}
