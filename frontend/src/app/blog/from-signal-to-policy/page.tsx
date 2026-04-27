import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Prose,
  Section,
  H2,
  Callout,
  Stat,
  StatGrid,
  CounterfactualEmbed,
  DashboardLink,
  ScrollSpyTOC,
  ReadingProgressBar,
  DropCap,
  AuthorCard,
  EditorialHeader,
} from "@/components/blog/prose";

export const metadata = {
  title:
    "From signal to policy: turning a forecasting model into monetary action — WACMR Analytics",
  description:
    "What our findings actually mean for how India's overnight rate is steered — three operational levers, the impact each could have, and the tradeoffs that make them hard.",
};

const TOC = [
  { id: "why", label: "1. Why a forecast is not yet a policy" },
  { id: "how-it-works", label: "2. How the system works today" },
  { id: "findings", label: "3. What our findings expose" },
  { id: "levers", label: "4. Three operational levers" },
  { id: "tradeoffs", label: "5. Impact and tradeoffs" },
  { id: "in-practice", label: "6. What changes in practice" },
];

export default function FromSignalToPolicyPost() {
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
        title="From signal to policy"
        subtitle="What our findings actually mean for how India's overnight rate is steered — three operational levers, the impact each could have, and the tradeoffs that make them hard."
        date="April 2026"
        readTime="6 min read"
      />

      <AuthorCard
        authors={[{ name: "Arnav", role: "Data Science & Management" }]}
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
            <Section id="why">
              <H2 id="why">1. Why a forecast is not yet a policy</H2>
              <DropCap>
                A model that predicts a number is a model. A model that changes
                how someone makes a decision is a tool. Most of the work this
                project showcased — the regimes, the SHAP attributions, the
                walk-forward residuals — sits cleanly on the model side of that
                line.
              </DropCap>
              <p>
                This essay argues for the other side. Forecasting India&apos;s
                overnight rate accurately is interesting; using what we learned
                about that rate to change how it is steered is the actual point.
                We were doing this for a Data Science &amp; Management course,
                and the management half of that brief means asking a simple
                question: if the findings are real, who acts on them, and how?
              </p>

              <StatGrid>
                <Stat value="70.9%" label="Directional accuracy" tone="emerald" />
                <Stat value="545" label="Weekly observations" tone="cyan" />
                <Stat value="2" label="Regimes detected" tone="cyan" />
                <Stat value="~10 bps" label="Walk-forward RMSE" tone="emerald" />
              </StatGrid>
            </Section>

            <Section id="how-it-works">
              <H2 id="how-it-works">2. How the system works today</H2>
              <p>
                The Reserve Bank of India sets a policy stance and publishes a
                repo rate. Every business day, scheduled banks meet their
                reserve obligations by lending each other money overnight; the
                rate at which those trades clear, weighted by volume, is the
                WACMR. The two numbers are tied together by arbitrage — banks
                will not pay more than the corridor ceiling (MSF) or accept
                less than the floor (reverse repo) unless their liquidity needs
                force them to.
              </p>
              <p>
                The gap between WACMR and the Repo Rate is therefore a clean,
                daily verdict on whether RBI&apos;s stance is actually
                transmitting into the banking system. Today, almost every
                dashboard, treasury report, and news ticker we surveyed
                publishes WACMR as a level. The spread — the only quantity
                that distinguishes a stance that is biting from one that is
                announced — is buried.
              </p>
            </Section>

            <Section id="findings">
              <H2 id="findings">3. What our findings expose</H2>
              <p>
                Three findings translate directly into policy facts.{" "}
                <strong>First, the rate corridor dominates:</strong> roughly
                90% of our model&apos;s predictive signal comes from last
                week&apos;s WACMR, the Repo Rate, the MSF, and the spread
                itself. Equity and forex features do not appear in the top
                fifteen. Transmission is structural, not narrative.
              </p>
              <p>
                <strong>Second, March 2020 was a regime break, and it
                  outlasted the pandemic.</strong> K-Means did not know about
                COVID; it found the break in the feature geometry. The 2022–24
                re-tightening did not return the system to its pre-2020 state.
                <strong> Third, the model&apos;s response function is
                  asymmetric</strong> — predicted cuts transmit faster than
                predicted hikes of equal magnitude. This is a learned pattern
                from the data, not an assumption.
              </p>

              <Callout tone="finding" title="Three policy facts, not three model artefacts">
                <p>
                  Each finding above survives translation out of the model.
                  The corridor result is a structural claim about arbitrage.
                  The regime break is a claim about the system, not the
                  series. The asymmetric response is a constraint on what the
                  central bank can hope to achieve with communication.
                </p>
              </Callout>
            </Section>

            <Section id="levers">
              <H2 id="levers">4. Three operational levers</H2>
              <p>
                <strong>Publish the WACMR–Repo spread as a headline
                  statistic.</strong> Our SHAP analysis is unambiguous: the
                spread is a top-five predictor of next week&apos;s WACMR; the
                level alone hides regime-conditional behaviour. Surfacing the
                spread on the RBI&apos;s weekly statistical supplement, and
                including it in major financial news cards alongside Repo and
                CPI, would change what bank treasurers and policy analysts
                watch. The cost of implementation is roughly zero; the data
                already exists.
              </p>
              <p>
                <strong>Adopt regime-aware briefings inside the policy
                  desk.</strong> The post-2020 regime is not just a level shift
                — variances, spread distributions, and feature importances
                all changed. Internal MPC documents and RBI bulletin
                commentary should explicitly state which regime is currently
                active, and which historical comparisons are valid. A 2018
                transmission analogue is not a useful guide to a 2024
                decision.
              </p>
              <p>
                <strong>Spend the communication budget
                  asymmetrically.</strong> Our counterfactual response curve
                shows hikes transmitting more sluggishly than cuts. If the
                goal of MPC communication is to anchor expectations, the
                marginal speech, footnote, and press conference is worth more
                around tightening cycles than around easing ones. This is the
                opposite of how communication usually scales — easing cycles
                are politically harder to explain, so they get more airtime
                — and it is the kind of recommendation that only falls out
                of looking at the data.
              </p>

              <CounterfactualEmbed caption="Asymmetric response: the predicted WACMR move per basis point of Repo shock is steeper for cuts than for hikes. The shaded band is the 90% residual confidence interval." />

              <DashboardLink
                href="/simulate"
                label="Run the asymmetric-response simulator"
                blurb="Drag the Repo-rate slider, watch the predicted WACMR move, and inspect per-feature attribution."
              />
            </Section>

            <Section id="tradeoffs">
              <H2 id="tradeoffs">5. Impact and tradeoffs</H2>
              <p>
                Three real tradeoffs sit behind these recommendations.
                Publishing the spread risks <em>reflexivity</em> — once a
                number is watched, it is also tradeable, and a positive
                spread can become self-reinforcing if liquidity desks treat it
                as a panic signal. Regime-aware language is harder to teach
                than a Phillips-curve story; the public communications team
                would have to argue every quarter why the active regime is
                what it is, and they would not always win. And our model is
                descriptive, not causal: the response function it learned is
                a fingerprint of the past ten years, not a guarantee of the
                next one.
              </p>

              <Callout tone="warn" title="Honest research lands on a tradeoff">
                <p>
                  None of these tradeoffs invalidate the recommendations; they
                  just mean each recommendation is a starting point for
                  argument, not the end of one. A policy lever that has no
                  cost is usually a lever that has not been examined
                  carefully enough.
                </p>
              </Callout>

              <DashboardLink
                href="/forecast"
                label="Walk-forward predictions and SHAP attribution"
                blurb="The empirical basis for every claim in this essay — actual vs predicted, residuals, and feature importance."
              />
            </Section>

            <Section id="in-practice">
              <H2 id="in-practice">6. What changes in practice</H2>
              <p>
                A bank treasurer watches the spread, not just the level. A
                Ministry of Finance policy desk asks which regime its
                assumptions are anchored to. The MPC communications team
                allocates more drafting effort to tightening announcements
                than easing ones. A market analyst writes the spread into the
                lede of every weekly column. None of these are revolutionary
                acts. Each is one reading habit, replaced.
              </p>
              <p className="text-slate-500">
                Research-to-policy is a long pipeline. This is one brick in
                it.
              </p>
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
