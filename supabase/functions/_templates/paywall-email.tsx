import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "https://esm.sh/@react-email/components@0.0.31?deps=react@18.3.1";
import * as React from "https://esm.sh/react@18.3.1";
import { normalizePaywallFirstName } from "../_shared/normalizePaywallFirstName.ts";

export const PAYWALL_EMAIL_SUBJECT = "Your trial is still waiting for you 🕊️";
export const PAYWALL_EMAIL_PREVIEW =
  "No charge today. No catch. Just 14 days to see if this changes anything.";

const TRIAL_URL =
  "https://prayerjournal.app/trial?utm_source=email&utm_campaign=paywall_exit";

const colors = {
  background: "#FAFAF8",
  body: "#4A5568",
  gold: "#C4A572",
  ctaBg: "#1B2A4A",
  ctaText: "#FFFFFF",
};

export type PaywallEmailProps = {
  /** Raw full_name from auth.users.raw_user_meta_data, or pre-normalized first name */
  fullName?: string | null;
  firstName?: string;
  unsubscribeUrl: string;
};

export function resolvePaywallFirstName(props: PaywallEmailProps): string {
  if (props.firstName?.trim()) return props.firstName.trim();
  return normalizePaywallFirstName(props.fullName);
}

export function PaywallEmail(props: PaywallEmailProps) {
  const firstName = resolvePaywallFirstName(props);
  const { unsubscribeUrl } = props;

  return (
    <Html lang="en">
      <Head />
      <Preview>{PAYWALL_EMAIL_PREVIEW}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.paragraph}>Hi {firstName},</Text>

          <Text style={styles.paragraph}>
            You made it all the way through setting up your Prayer Journal — and then
            something stopped you at the last step.
          </Text>

          <Text style={styles.paragraph}>
            Maybe it felt like a bigger commitment than expected. Maybe you meant to come
            back to it. Maybe life just got in the way.
          </Text>

          <Text style={styles.paragraph}>
            Whatever it was — your journal is still here, exactly where you left it.
          </Text>

          <Text style={styles.paragraph}>Starting a free trial means:</Text>
          <Text style={styles.bullet}>
            • 14 days completely free — nothing charged until day 15
          </Text>
          <Text style={styles.bullet}>
            • Cancel any time before then and you pay absolutely nothing
          </Text>
          <Text style={styles.bullet}>
            • Everything you set up in onboarding is saved and ready
          </Text>
          <Text style={styles.bullet}>
            • No pressure from us if you decide it's not for you
          </Text>

          <Section style={styles.scriptureBlock}>
            <Text style={styles.scriptureText}>
              "Come to me, all you who are weary and burdened, and I will give you rest." —
              Matthew 11:28
            </Text>
          </Section>

          <Text style={styles.paragraph}>
            You've already done the harder part. Your first prayer is waiting to be recorded.
          </Text>

          <Section style={styles.ctaSection}>
            <Button href={TRIAL_URL} style={styles.ctaButton}>
              Start My Free 14-Day Trial →
            </Button>
          </Section>

          <Text style={styles.paragraph}>
            Grace & peace,
            <br />
            Samuel & the Prayer Journal team
          </Text>

          <Hr style={styles.hr} />

          <Text style={styles.footer}>
            P.S. The annual plan works out to less than £1 a week. But you don't need to think
            about that today — the trial is free.
          </Text>

          <Text style={styles.footer}>
            You received this because you started setting up a Prayer Journal account.
            <br />
            <Link href={unsubscribeUrl} style={styles.unsubscribeLink}>
              Unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PaywallEmail;

const fontFamily = "Georgia, 'Times New Roman', serif";

const styles = {
  body: {
    backgroundColor: colors.background,
    margin: "0",
    padding: "24px 12px",
    fontFamily,
  },
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: colors.background,
  },
  paragraph: {
    color: colors.body,
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 16px",
    fontFamily,
  },
  bullet: {
    color: colors.body,
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 8px 8px",
    fontFamily,
  },
  scriptureBlock: {
    borderLeft: `3px solid ${colors.gold}`,
    paddingLeft: "16px",
    margin: "24px 0",
  },
  scriptureText: {
    color: colors.gold,
    fontSize: "16px",
    lineHeight: "26px",
    fontStyle: "italic" as const,
    margin: "0",
    fontFamily,
  },
  ctaSection: {
    textAlign: "center" as const,
    margin: "28px 0 32px",
  },
  ctaButton: {
    backgroundColor: colors.ctaBg,
    color: colors.ctaText,
    border: `2px solid ${colors.gold}`,
    borderRadius: "6px",
    fontSize: "16px",
    fontWeight: "600",
    textDecoration: "none",
    display: "inline-block",
    maxWidth: "280px",
    width: "100%",
    padding: "14px 20px",
    textAlign: "center" as const,
    fontFamily,
    boxSizing: "border-box" as const,
  },
  hr: {
    borderColor: "#E8E4DC",
    margin: "32px 0 20px",
  },
  footer: {
    color: colors.body,
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 12px",
    fontFamily,
  },
  unsubscribeLink: {
    color: colors.body,
    textDecoration: "underline",
  },
};
