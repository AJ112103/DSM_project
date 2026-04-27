import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Prose,
  Section,
  H2,
  Callout,
  Stat,
  StatGrid,
  DashboardLink,
  ScrollSpyTOC,
  ReadingProgressBar,
  DropCap,
  AuthorCard,
  EditorialHeader,
} from "@/components/blog/prose";

export const metadata = {
  title:
    "What we'd build next: the work this project leaves on the table — WACMR Analytics",
  description:
    "Five extensions in priority order — daily data, soft regimes, causal identification, LLM-scale NLP, live infrastructure — and the policy questions each one would actually answer.",
};

const TOC = [
  { id: "deferred", label: "1. What we deliberately deferred" },
  { id: "extensions", label: "2. Five extensions in priority order" },
  { id: "adjacent", label: "3. Adjacent questions" },
  { id: "reveal", label: "4. What this work would reveal" },
  { id: "closing", label: "5. Closing" },
];

export default function WhatWedBuildNextPost() {
  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/blog"
        className="mb-8 inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-300"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to blog
      </Link>

      <ReadingProgressBar />

      <EditorialHeader
        title="What we'd build next"
        subtitle="Five extensions in priority order, three adjacent questions, and the policy insights each one would actually surface."
        date="April 2026"
        readTime="7 min read"
      />

      <AuthorCard
        authors={[{ name: "Arnav and Aamer", role: "Data Science & Management" }]}
      />

      <div className="mt-8 gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
        <article className="min-w-0">
          <nav className="not-prose mx-auto mb-8 max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/40 p-5 lg:hidden">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Table of contents
            </div>
            <ol className="grid grid-cols-1 gap-1 text-sm text-slate-300 sm:grid-cols-2">
              {TOC.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block rounded px-2 py-1 hover:bg-slate-800 hover:text-cyan-300"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <Prose>
            <Section id="deferred">
              <H2 id="deferred">1. What we deliberately deferred</H2>
              <DropCap>
                Every research project is mostly a list of things you did not
                do. Ours is no exception, and the omissions were not
                accidents. We chose a weekly grid because that is the native
                frequency of NDAP&apos;s RBI series. We stopped at two
                regimes because the silhouette curve told us to and we did
                not want to overfit a structural break that the data itself
                was indifferent about.
              </DropCap>
              <p>
                We hand-coded seventy-five policy events because manual
                scoring kept the noise floor low and the methodology
                defensible inside a one-semester course. We worked from a
                static July 2024 snapshot because shipping a live retraining
                pipeline was not in scope. Each of those choices was honest
                at the time. Each one bounds the answer the project can
                produce. This essay is the list of bounds, and what crossing
                them would cost — and reveal.
              </p>

              <StatGrid>
                <Stat value="545 → ~2,700" label="Weekly to daily obs" tone="cyan" />
                <Stat value="2 → ≥ 3" label="Hard to soft regimes" tone="cyan" />
                <Stat value="75 → 10³+" label="Manual to LLM events" tone="cyan" />
                <Stat value="static → live" label="Snapshot to operational" tone="emerald" />
              </StatGrid>
            </Section>

            <Section id="extensions">
              <H2 id="extensions">2. Five extensions in priority order</H2>
              <p>
                <strong>Daily-frequency pipeline.</strong> The weekly grid
                hides almost everything that liquidity desks actually care
                about. Daily NDAP fetches plus daily WACMR clearing prices
                would multiply the sample roughly five-fold and let us
                distinguish settlement-day stress from typical-day clearing.
                Most of the pipeline already runs on daily Yahoo Finance
                data; the lift is in re-doing the alignment layer and
                re-running every model with proper time-series
                cross-validation at the new frequency.
              </p>
              <p>
                <strong>Hidden Markov regimes.</strong> K-Means on PCA gave
                us a clean two-state result, but the segmentation is hard —
                every week is in exactly one regime. A Hidden Markov Model
                with three or four states and soft assignments would let the
                2022 tightening exist as a transient state instead of being
                absorbed into post-COVID accommodation. More usefully, an
                HMM emits a posterior probability of being in each state
                every week, which is exactly the early-warning signal a
                liquidity desk would want.
              </p>
              <p>
                <strong>Causal identification.</strong> Our counterfactual
                simulator is a <em>model-based</em> counterfactual. It tells
                you how the XGBoost forecaster responds to a hypothetical
                Repo shock; it does not tell you what the Indian banking
                system would actually do. Closing that gap means
                high-frequency event studies around MPC announcements —
                looking at bond yields and interbank rates in five-minute
                windows around scheduled releases — and an
                instrumented-decision design that exploits the partial
                unpredictability of MPC voting.
              </p>
              <p>
                <strong>LLM-assisted NLP at scale.</strong> Seventy-five
                hand-coded events is not a small dataset; it is a tiny one.
                The full RBI corpus — bulletins, MPC minutes, governor
                speeches, financial stability reports — contains thousands
                of policy-relevant text events over our window. A consistent
                LLM-based scoring pipeline, validated against our hand-coded
                gold standard, would replace the &quot;news is a
                garnish&quot; caveat with a real test of whether language
                carries marginal predictive content.
              </p>
              <p>
                <strong>Live data and retraining.</strong> The dashboard is
                currently a snapshot. A weekly NDAP refresh job, drift
                detection on the feature distributions, an automated
                retraining cadence, and an alert when the regime-shift
                posterior crosses fifty percent would convert the project
                from research artefact to operational tool. The
                infrastructure work is straightforward; the discipline of
                running it in public for six months is the harder part.
              </p>

              <Callout tone="info" title="Priority is best marginal insight per unit of effort">
                <p>
                  We ordered these by what we expect to learn per week of
                  work, not by ambition. Daily data and HMM regimes are
                  cheap and immediately legible to a policy reader. Causal
                  identification and LLM-scale NLP are where the real
                  research lives — and where the budget required jumps an
                  order of magnitude.
                </p>
              </Callout>
            </Section>

            <Section id="adjacent">
              <H2 id="adjacent">3. Adjacent questions</H2>
              <p>
                Three questions sit one degree away from what we built and
                would each justify a project of their own.{" "}
                <strong>Predict the whole short-rate curve</strong> — MIBOR,
                T-bill yields, market repo, Commercial Paper — jointly
                rather than only the WACMR; the cross-correlations are where
                transmission lives.{" "}
                <strong>Compare across emerging markets</strong> — Brazil,
                Indonesia, Turkey, South Africa — to see whether the
                post-2020 break is an Indian phenomenon or a global one
                driven by central-bank balance-sheet expansion.{" "}
                <strong>Drop to bank-level granularity</strong> — anonymised
                lender and borrower distributions in the call market — to
                see who funds whom, in what stress, and whether the average
                transmission story hides important distributional
                asymmetries.
              </p>
            </Section>

            <Section id="reveal">
              <H2 id="reveal">4. What this work would reveal</H2>
              <p>
                These extensions are not gold-plating; each one cashes out as
                a specific policy insight. A causally identified
                asymmetric-transmission claim would let the MPC defend its
                communication budget on quantitative grounds rather than
                intuition. A real-time HMM regime-shift posterior would give
                liquidity desks an early-warning signal that is currently
                delivered post-hoc, often months late. A measured
                communication elasticity — how many basis points a hawkish
                governor speech moves the spread, conditional on event type
                — would tell us whether forward guidance is doing the work
                the textbook claims it does.
              </p>

              <Callout tone="finding" title="The most interesting question we cannot yet answer">
                <p>
                  Is India&apos;s 2020 regime break a unique consequence of
                  its pandemic-era liquidity stance, or the local
                  manifestation of a global shift in how monetary
                  transmission works? A cross-country panel built on the
                  same pipeline would settle that argument — and the answer
                  changes how confident the RBI should be that the next
                  break, when it comes, will look like the last one.
                </p>
              </Callout>
            </Section>

            <Section id="closing">
              <H2 id="closing">5. Closing</H2>
              <p>
                A research project&apos;s value is not what it solves but
                what it makes possible. The data pipeline, the SQLite layer,
                the API, the dashboard, and the agent are all reusable.
                Future iterations should pick the question first — which
                regime is currently active, what would a 25 basis point cut
                do, why did the spread widen last week — and point the
                existing infrastructure at it. The next brick is the easiest
                one to add.
              </p>

              <DashboardLink
                href="/agent"
                label="Ask the agent your own question"
                blurb="The fastest way to extend any of the above is to point the agent at the data and ask. Custom SQL, plots, and counterfactuals on demand."
              />
            </Section>
          </Prose>
        </article>

        <aside className="hidden lg:sticky lg:top-8 lg:block lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto print:hidden">
          <ScrollSpyTOC items={TOC} />
        </aside>
      </div>
    </div>
  );
}
