// app/constants/milestonesConfig.ts

export type MilestoneKey =
  | "seed_planted"
  | "first_sprout"
  | "taking_root"
  | "standing_firm"
  | "first_blooms"
  | "bearing_fruit"
  | "tree_of_life";

export type MilestoneConfig = {
  key: MilestoneKey;
  name: string;
  requiredStreak: number;
  verseReference: string;
  verseText: string;
  description: string; // shown only when unlocked
};

// All milestone info (ordered)
export const MILESTONES: MilestoneConfig[] = [
  {
    key: "seed_planted",
    name: "Seed Planted",
    requiredStreak: 1,
    verseReference: "Mark 4:31-32",
    verseText:
      "It is like a mustard seed, which is the smallest of all seeds on earth; but when it is planted, it grows and becomes the largest of all plants and puts out large branches, so that the birds of the air can make nests in its shade.",
    description: "Day one of meeting with God. You've planted a seed.",
  },
  {
    key: "first_sprout",
    name: "First Sprout",
    requiredStreak: 7,
    verseReference: "Mark 4:26-27",
    verseText:
      "This is what the kingdom of God is like. A man scatters seed on the ground. Night and day, whether he sleeps or gets up, the seed sprouts and grows, though he does not know how.",
    description:
      "One week of meeting with God. Night and day, God is at work in ways you can’t yet see.",
  },
  {
    key: "taking_root",
    name: "Taking Root",
    requiredStreak: 21,
    verseReference: "Colossians 2:6-7",
    verseText:
      "So then, just as you received Christ Jesus as Lord, continue to live your lives in him, rooted and built up in him, strengthened in the faith as you were taught, and overflowing with thankfulness.",
    description:
      "21 days of faithfulness. You're not just consistent — you're being rooted and built up in Christ.",
  },
  {
    key: "standing_firm",
    name: "Standing Firm",
    requiredStreak: 40,
    verseReference: "James 5:15-16",
    verseText:
      "And the prayer offered in faith will make the sick person well; the Lord will raise them up. If they have sinned, they will be forgiven. Therefore confess your sins to each other and pray for each other so that you may be healed. The prayer of a righteous person is powerful and effective.",
    description: "40 days of prayer. You're standing firm — not because you're perfect, but because you're faithful.",
  },
  {
    key: "first_blooms",
    name: "First Blooms",
    requiredStreak: 90,
    verseReference: "Hosea 14:5–6",
    verseText:
      "I will be like the dew to Israel; he will blossom like a lily. Like a cedar of Lebanon he will send down his roots; his young shoots will grow. His splendor will be like an olive tree, his fragrance like a cedar of Lebanon.",
    description:
      "90 days of returning to God. Growth is taking shape — quietly and gently sustained by grace rather than effort.",
  },
  {
    key: "bearing_fruit",
    name: "Bearing Fruit",
    requiredStreak: 180,
    verseReference: "John 15:4-5",
    verseText:
      "Remain in me, as I also remain in you. No branch can bear fruit by itself; it must remain in the vine. Neither can you bear fruit unless you remain in me. I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit; apart from me you can do nothing.",
    description:
      "180 days of abiding in Christ. You're bearing fruit — not by striving, but by remaining connected to the Vine.",
  },
  {
    key: "tree_of_life",
    name: "Tree of Life",
    requiredStreak: 365,
    verseReference: "Jeremiah 17:7-8",
    verseText:
      "But blessed is the one who trusts in the Lord, whose confidence is in him. They will be like a tree planted by the water that sends out its roots by the stream. It does not fear when heat comes; its leaves are always green. It has no worries in a year of drought and never fails to bear fruit.",
    description:
      "A full year of meeting with God. You are deeply rooted, continually fruitful and unshaken by drought.",
  },
];
export default MILESTONES;