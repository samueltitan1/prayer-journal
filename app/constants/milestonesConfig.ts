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
    description: "1 day of meeting with God. You're planting seeds.",
  },
  {
    key: "first_sprout",
    name: "First Sprout",
    requiredStreak: 7,
    verseReference: "Mark 4:27",
    verseText:
      "Night and day, whether he sleeps or gets up, the seed sprouts and grows.",
    description:
      "7 days! The seed is sprouting. You're forming a rhythm of meeting with God.",
  },
  {
    key: "taking_root",
    name: "Taking Root",
    requiredStreak: 21,
    verseReference: "Psalm 1:3",
    verseText:
      "That person is like a tree planted by streams of water, which yields its fruit in season.",
    description:
      "21 days of faithfulness. You're not just consistent — you're growing deeper.",
  },
  {
    key: "standing_firm",
    name: "Standing Firm",
    requiredStreak: 40,
    verseReference: "Ephesians 6:13",
    verseText:
      "Put on the full armor of God, so that when the day of evil comes, you may be able to stand your ground.",
    description: "40 days strong. You're standing firm in the storms of life.",
  },
  {
    key: "first_blooms",
    name: "First Blooms",
    requiredStreak: 90,
    verseReference: "Song of Songs 2:12",
    verseText:
      "Flowers appear on the earth; the season of singing has come.",
    description:
      "90 days! Beauty is emerging. Your faithfulness is bearing witness.",
  },
  {
    key: "bearing_fruit",
    name: "Bearing Fruit",
    requiredStreak: 180,
    verseReference: "Galatians 5:22",
    verseText:
      "But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness.",
    description:
      "180 days! You're not just growing — you're bearing fruit that lasts.",
  },
  {
    key: "tree_of_life",
    name: "Tree of Life",
    requiredStreak: 365,
    verseReference: "Revelation 22:2",
    verseText:
      "On each side of the river stood the tree of life, bearing twelve crops of fruit.",
    description:
      "A full year of meeting with God. You're a tree of life, bringing healing to others.",
  },
];
export default MILESTONES;