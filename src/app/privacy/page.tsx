import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — VTO Virtual Try-On',
  description: 'Privacy Policy for the VTO Virtual Try-On app.',
};

const EFFECTIVE_DATE = 'May 2, 2026';
const CONTACT_EMAIL = 'a.selimfedakar@gmail.com';

export default function PrivacyPolicy() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/" style={styles.backLink}>← Back to VTO</Link>

        <h1 style={styles.h1}>Privacy Policy</h1>
        <p style={styles.meta}>Effective date: {EFFECTIVE_DATE}</p>

        <p style={styles.p}>
          VTO ("Virtual Try-On", "we", "us", or "our") is an AI-powered fashion application that
          lets you virtually try on clothing. This Privacy Policy explains what personal information
          we collect, how we use it, and your rights regarding your data.
        </p>

        <h2 style={styles.h2}>1. Information We Collect</h2>
        <h3 style={styles.h3}>Account information</h3>
        <p style={styles.p}>
          When you create an account we collect your <strong>email address</strong> and the
          password you choose (stored as a secure hash — we never see your plaintext password).
        </p>

        <h3 style={styles.h3}>Profile information (optional)</h3>
        <p style={styles.p}>
          You may optionally provide a <strong>display name</strong>, <strong>height</strong>,{' '}
          <strong>weight</strong>, <strong>gender</strong>, and a <strong>profile photo</strong>.
          This information is used solely to personalise your experience and improve fit analysis.
        </p>

        <h3 style={styles.h3}>Photos and try-on images</h3>
        <p style={styles.p}>
          When you use the virtual try-on feature you upload a <strong>personal photo</strong> and
          a <strong>garment image</strong>. These images are transmitted to our AI processing
          service to generate a try-on result. Generated images are stored in your account so you
          can review and share them later.
        </p>

        <h3 style={styles.h3}>Usage data</h3>
        <p style={styles.p}>
          We may collect standard server-side logs (IP address, device type, request timestamps)
          for security monitoring and debugging purposes. This data is not sold or shared with
          advertisers.
        </p>

        <h2 style={styles.h2}>2. How We Use Your Information</h2>
        <ul style={styles.ul}>
          <li style={styles.li}>To provide and improve the virtual try-on service</li>
          <li style={styles.li}>To authenticate you and keep your account secure</li>
          <li style={styles.li}>To store your try-on history so you can access it later</li>
          <li style={styles.li}>To analyse fit and provide size recommendations (when measurements are provided)</li>
          <li style={styles.li}>To respond to support requests</li>
        </ul>
        <p style={styles.p}>We do not use your data for advertising and we do not sell your data to third parties.</p>

        <h2 style={styles.h2}>3. Third-Party Services</h2>
        <p style={styles.p}>We rely on the following third-party services to operate VTO:</p>
        <ul style={styles.ul}>
          <li style={styles.li}>
            <strong>Supabase</strong> (supabase.com) — authentication, database storage, and file
            storage. Your account data and images are stored on Supabase infrastructure.
          </li>
          <li style={styles.li}>
            <strong>Fashn.ai</strong> (fashn.ai) — AI inference for the virtual try-on model.
            Your uploaded person and garment images are sent to Fashn.ai for processing. Please
            review{' '}
            <a href="https://fashn.ai/privacy" style={styles.a} target="_blank" rel="noreferrer">
              Fashn.ai's Privacy Policy
            </a>{' '}
            for details on how they handle inference data.
          </li>
          <li style={styles.li}>
            <strong>Vercel</strong> (vercel.com) — web hosting for the VTO web application.
          </li>
          <li style={styles.li}>
            <strong>RevenueCat</strong> (revenuecat.com) — in-app purchase management and
            subscription tracking. RevenueCat receives a pseudonymous user identifier and
            purchase receipt data to validate and manage your subscription. Please review{' '}
            <a href="https://www.revenuecat.com/privacy" style={styles.a} target="_blank" rel="noreferrer">
              RevenueCat's Privacy Policy
            </a>{' '}
            for details.
          </li>
        </ul>

        <h2 style={styles.h2}>4. Data Retention</h2>
        <p style={styles.p}>
          We retain your account data for as long as your account is active. Generated try-on
          images are stored until you delete them or delete your account.
        </p>

        <h2 style={styles.h2}>5. Deleting Your Account and Data</h2>
        <p style={styles.p}>
          You can permanently delete your account and all associated data (profile, try-on history,
          and stored images) at any time from the <strong>Profile → Danger Zone → Delete My
          Account</strong> section of the app. Deletion is immediate and irreversible.
        </p>
        <p style={styles.p}>
          To request deletion by email, contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={styles.a}>{CONTACT_EMAIL}</a>.
        </p>

        <h2 style={styles.h2}>6. Children's Privacy</h2>
        <p style={styles.p}>
          VTO is not directed to children under the age of 13. We do not knowingly collect personal
          information from children. If you believe a child has provided us with personal
          information, please contact us and we will delete it promptly.
        </p>

        <h2 style={styles.h2}>7. Security</h2>
        <p style={styles.p}>
          We use industry-standard security practices including HTTPS encryption in transit,
          Supabase Row-Level Security for data isolation, and hashed password storage. No method
          of transmission or storage is 100% secure; you use VTO at your own risk.
        </p>

        <h2 style={styles.h2}>8. Changes to This Policy</h2>
        <p style={styles.p}>
          We may update this Privacy Policy from time to time. When we do, we will update the
          effective date above. Continued use of VTO after changes are posted constitutes your
          acceptance of the revised policy.
        </p>

        <h2 style={styles.h2}>9. Contact</h2>
        <p style={styles.p}>
          If you have questions or requests regarding your personal data, please email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={styles.a}>{CONTACT_EMAIL}</a>.
        </p>
      </div>
    </main>
  );
}

const styles = {
  page: {
    backgroundColor: '#000000',
    minHeight: '100vh',
    color: '#e4e4e7',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,
  container: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '48px 24px 80px',
  } as React.CSSProperties,
  backLink: {
    color: '#71717a',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
    display: 'inline-block',
    marginBottom: 32,
  } as React.CSSProperties,
  h1: {
    fontSize: 32,
    fontWeight: 800,
    color: '#ffffff',
    marginBottom: 8,
  } as React.CSSProperties,
  meta: {
    color: '#52525b',
    fontSize: 14,
    marginBottom: 32,
  } as React.CSSProperties,
  h2: {
    fontSize: 20,
    fontWeight: 700,
    color: '#ffffff',
    marginTop: 36,
    marginBottom: 12,
  } as React.CSSProperties,
  h3: {
    fontSize: 15,
    fontWeight: 600,
    color: '#a1a1aa',
    marginTop: 20,
    marginBottom: 8,
  } as React.CSSProperties,
  p: {
    fontSize: 15,
    lineHeight: 1.7,
    color: '#a1a1aa',
    marginBottom: 12,
  } as React.CSSProperties,
  ul: {
    paddingLeft: 20,
    marginBottom: 12,
  } as React.CSSProperties,
  li: {
    fontSize: 15,
    lineHeight: 1.7,
    color: '#a1a1aa',
    marginBottom: 6,
  } as React.CSSProperties,
  a: {
    color: '#4a90d0',
    textDecoration: 'underline',
  } as React.CSSProperties,
};
