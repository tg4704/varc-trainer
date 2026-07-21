import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import PageMeta from "../components/PageMeta.jsx";

const FAQS = [
  {
    q: "What actually is Graspr?",
    a: "A practice tool for CAT Verbal Ability & Reading Comprehension. Drills gives you one short paragraph and one question at a time, focused on the trap-recognition skill that separates 90th from 99th percentile. Coach gives you full CAT-style passages and grades how you read the argument, not just which option you picked.",
  },
  {
    q: "How is this different from just doing RC sets from a book?",
    a: "A book tells you right or wrong. Graspr's AI reads the reasoning you write down before it tells you the answer, and explains exactly where your logic went wrong: which trap you fell for, and why the correct option is defensible even though it doesn't feel as strong.",
  },
  {
    q: "Is the AI feedback reliable, or could it be wrong?",
    a: "The correct answer is never decided by AI. It's fixed in our question data ahead of time. The AI's only job is to evaluate the quality of your written reasoning against that known answer. Like any AI, it can occasionally misjudge a nuanced explanation; if a grade looks off, most feedback cards have a Retry, and you can flag a question directly from Drills if you think the answer key itself is wrong.",
  },
  {
    q: "Is Graspr free?",
    a: "Yes. The Skimmer tier is free and includes a daily allowance of AI-graded Drills and Coach passages, no card required. Paid tiers raise those daily limits and unlock stronger AI models for feedback. See the Pricing page for exact numbers.",
  },
  {
    q: "Do paid plans auto-renew?",
    a: "It depends on the plan you pick. A monthly plan is a recurring subscription billed once a month via Razorpay autopay, and it renews automatically until you cancel from My Plan. The Till CAT pass is a one-time payment that unlocks your tier until the CAT exam date and then simply expires, with nothing to cancel. Full details are on the Refund & Cancellation page.",
  },
  {
    q: "What happens to my data if I stop using Graspr?",
    a: "It stays in your account until you decide otherwise. You can export everything we hold on you as a JSON file, or permanently delete your account, both from your account menu. See the Privacy Policy for the full breakdown of what's collected and your rights over it.",
  },
  {
    q: "Can I use Graspr on my phone?",
    a: "Yes, the whole app is responsive and works in a mobile browser, with no app install needed.",
  },
  {
    q: "I found a question with a wrong or ambiguous answer key. What do I do?",
    a: "Use the flag (🚩) button next to any question during a Drills session, then pick a reason and it goes straight into our review queue.",
  },
  {
    q: "How do I get in touch?",
    a: "Email privacy@graspr.in for anything: billing, a bug, feedback, or just to say hi.",
  },
];

function FAQItem({ q, a }) {
  return (
    <details className="group glass overflow-hidden rounded-[14px]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold text-foreground">
        {q}
        <Icon
          name="chevD"
          size={16}
          className="flex-none transition-transform duration-200 group-open:rotate-180"
          style={{ color: "var(--teal)" }}
        />
      </summary>
      <p className="px-5 pb-4 text-[14px] leading-relaxed muted">{a}</p>
    </details>
  );
}

export default function FAQ() {
  return (
    <div className="mx-auto max-w-[720px] px-7 py-16">
      <PageMeta title="FAQ · Graspr" description="Common questions about Graspr's Drills, Coach, pricing, and data." />
      <h1 className="display text-[34px] leading-tight">Frequently asked questions</h1>
      <p className="mt-2 text-[14.5px] muted">
        Can't find what you're looking for? Email{" "}
        <a href="mailto:privacy@graspr.in" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>privacy@graspr.in</a>.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {FAQS.map((item) => (
          <FAQItem key={item.q} q={item.q} a={item.a} />
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/pricing" className="btn btn-glass fx-ring">Pricing</Link>
        <Link to="/privacy" className="btn btn-glass fx-ring">Privacy Policy</Link>
        <Link to="/refunds" className="btn btn-glass fx-ring">Refunds</Link>
      </div>
    </div>
  );
}
