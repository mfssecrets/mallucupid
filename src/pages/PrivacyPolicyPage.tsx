import { LegalPageLayout } from "../components/LegalPageLayout";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      intro="This Privacy Policy explains how MalluCupid collects, uses, stores, and protects your personal information when you access or use our platform."
    >
      <section>
        <h2 className="text-xl font-semibold text-zinc-900">1. Information We Collect</h2>
        <p>
          We may collect personal information including your name, email address, phone number, billing information, payment references, account details, IP address, browser information, device information, usage data, and communications with our support team. Payment information is securely processed through Razorpay, and we do not store your complete debit card, credit card, CVV, UPI PIN, or banking credentials.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">2. How We Use Your Information</h2>
        <p>
          We use your information to create and manage your account, process payments, deliver digital products, provide customer support, improve our services, maintain platform security, detect fraud, comply with legal obligations, communicate important updates, and enhance your overall user experience.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">3. Sharing of Information</h2>
        <p>
          We do not sell your personal information. Your information may be shared only with trusted third-party service providers such as Razorpay for payment processing, cloud hosting providers, email delivery services, analytics providers, and government or law enforcement authorities where required by applicable law.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">4. Data Security</h2>
        <p>
          We implement reasonable administrative, technical, and organizational security measures to protect your personal information against unauthorized access, disclosure, alteration, or destruction. While we strive to protect your data, no method of internet transmission or electronic storage is completely secure.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">5. Cookies</h2>
        <p>
          MalluCupid may use cookies and similar technologies to remember your preferences, improve website functionality, analyze traffic, enhance security, and provide a better browsing experience. You may disable cookies through your browser settings, although certain features of the platform may not function correctly.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">6. Your Rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal information, subject to applicable legal and operational requirements. You may also update your account information directly through your profile settings where available.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">7. Data Retention</h2>
        <p>
          We retain personal information only for as long as necessary to provide our services, comply with legal obligations, resolve disputes, enforce our agreements, and maintain legitimate business records.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">8. Changes to this Privacy Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Any changes will be published on this page with a revised "Last Updated" date. Continued use of the platform after such updates constitutes your acceptance of the revised Privacy Policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">9. Contact Information</h2>
        <p>
          If you have any questions regarding this Privacy Policy or your personal information, please contact us at <strong>support@mallucupid.com</strong> or <strong>+91-9581150441</strong>. Our registered business address is <strong>456, Gautam Nagar, JP Nagar 7th Phase, Bengaluru, Karnataka 560078, India</strong>.
        </p>
      </section>
    </LegalPageLayout>
  );
}