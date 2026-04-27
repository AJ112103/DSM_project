export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  readingTime: string;
  summary: string;
};

export const FEATURED_POST: PostMeta = {
  slug: "wacmr-investigation",
  title: "Predicting the heartbeat of Indian monetary policy",
  date: "April 2026",
  readingTime: "≈ 18 min read",
  summary:
    "Ten years, 545 weeks, 117 features, two monetary-policy regimes, and one overnight rate. What we found when we tried to forecast India's Weighted Average Call Money Rate.",
};

export const OTHER_POSTS: PostMeta[] = [
  {
    slug: "from-signal-to-policy",
    title: "From signal to policy: turning a forecasting model into monetary action",
    date: "April 2026",
    readingTime: "≈ 6 min read",
    summary:
      "What our findings actually mean for how India's overnight rate is steered — three operational levers, the impact each could have, and the tradeoffs that make them hard.",
  },
  {
    slug: "what-we-d-build-next",
    title: "What we'd build next: the work this project leaves on the table",
    date: "April 2026",
    readingTime: "≈ 7 min read",
    summary:
      "Five extensions in priority order — daily data, soft regimes, causal identification, LLM-scale NLP, live infrastructure — and the policy questions each one would actually answer.",
  },
];

export const POSTS: PostMeta[] = [FEATURED_POST, ...OTHER_POSTS];
