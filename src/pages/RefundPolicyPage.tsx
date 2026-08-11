import { LegalPageLayout } from "../components/LegalPageLayout";

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout
      title="Refund Policy"
      intro="This Refund Policy explains how refunds, cancellations, and payment disputes are handled for purchases made through MalluCupid."
    >
      <section>
        <h2 className="text-xl font-semibold text-zinc-900">1. Digital Products</h2>
        <p>
          All products available on MalluCupid are digital products delivered electronically. Due to the nature of digital content, purchases are generally final and non-refundable once the product has been successfully delivered, downloaded, or accessed.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">2. Eligible Refunds</h2>
        <p>
          Refund requests may be considered only in exceptional circumstances, including duplicate payments, multiple charges for the same order, successful payment without product delivery due to a verified technical issue, or payment processed because of a confirmed system error. Refund approval is solely at the discretion of MalluCupid after verification.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">3. Non-Refundable Situations</h2>
        <p>
          Refunds will not be provided for change of mind, accidental purchases, failure to read product descriptions, incompatibility with your device or software, dissatisfaction with product features, or failure to use or download a purchased digital product after successful delivery.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">4. Refund Request Process</h2>
        <p>
          To request a refund, please contact our support team within 7 days of the transaction. Include your order ID, payment reference number, registered email address, and a detailed explanation of the issue. Incomplete or unverifiable requests may be declined.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">5. Refund Processing</h2>
        <p>
          If a refund is approved, the amount will be credited to the original payment method used during the purchase. Processing normally takes between 5 and 10 business days, depending on Razorpay, your bank, card issuer, or payment provider.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">6. Payment Gateway</h2>
        <p>
          All online payments are securely processed through Razorpay Software Private Limited. MalluCupid does not store complete debit card, credit card, CVV, UPI PIN, or banking credentials. Payment disputes should first be reported to MalluCupid before initiating a chargeback with your bank or payment provider.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">7. Changes to this Policy</h2>
        <p>
          MalluCupid reserves the right to modify this Refund Policy at any time without prior notice. Updated versions will be published on this page, and continued use of the platform constitutes acceptance of the revised policy.
        </p>
      </section>
    </LegalPageLayout>
  );
}