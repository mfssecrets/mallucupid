import { LegalPageLayout } from "../components/LegalPageLayout";

export default function ContactUsPage() {
  return (
    <LegalPageLayout
      title="Contact Us"
      intro="We're here to assist you with account-related queries, payments, refunds, digital content unlocks, technical support, and general inquiries."
    >
      <section>
        <h2 className="text-xl font-semibold text-zinc-900">Business Information</h2>
        <ul className="space-y-2 text-zinc-700">
          <li><strong>Business Name:</strong> MalluCupid</li>
          <li><strong>Email:</strong> support@mallucupid.com / info@mallucupid.com</li>
          <li><strong>Phone:</strong> +91-9581150441</li>
          <li><strong>Registered Address:</strong> 456, Gautam Nagar, JP Nagar 7th Phase, Bengaluru, Karnataka 560078, India</li>
          <li><strong>Grievance Address:</strong> 4, 5 &amp; 6, Kothnur Main Rd, Nayak Layout, JP Nagar 7th Phase, J. P. Nagar, Bengaluru, Karnataka 560076, India</li>
          <li><strong>Business Type:</strong> Creator content platform (free &amp; paid digital media, messaging, payouts)</li>
          <li><strong>Website:</strong> www.mallucupid.com</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">Customer Support</h2>
        <p>
          For assistance regarding your account, payments, refunds, unlocked content, order status, technical issues, or general support, please contact us using the details above. We aim to respond to all genuine inquiries as quickly as possible during our business hours.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">Payments</h2>
        <p>
          All online payments on MalluCupid are securely processed through Razorpay Software Private Limited. If you experience any payment-related issues, duplicate transactions, or failed payments, please contact us before initiating a chargeback with your bank or payment provider so we can investigate and resolve the matter promptly.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">Legal &amp; Compliance / Grievance Officer</h2>
        <p>
          All legal notices, compliance requests, copyright concerns, privacy-related inquiries, and policy questions may be submitted to{" "}
          <strong>support@mallucupid.com</strong> or by post to the grievance address above. We are committed to addressing legitimate requests in accordance with applicable laws and our published policies.
        </p>
      </section>
    </LegalPageLayout>
  );
}
