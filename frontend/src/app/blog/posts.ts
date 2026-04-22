export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  readingTime: string;
  summary: string;
};

export const POSTS: PostMeta[] = [
  {
    slug: "wacmr-investigation",
    title: "Predicting the heartbeat of Indian monetary policy",
    date: "April 2026",
    readingTime: "≈ 18 min read",
    summary:
      "Ten years, 545 weeks, 119 features, two monetary-policy regimes, and one overnight rate. What we found when we tried to forecast India's Weighted Average Call Money Rate.",
  },
];
