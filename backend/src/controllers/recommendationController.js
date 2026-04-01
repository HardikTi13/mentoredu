import { prisma } from "../lib/prisma.js";

/**
 * Recommendation Engine
 * 
 * Uses a hybrid scoring approach:
 * 1. Tag-based Jaccard similarity (40% weight)
 * 2. Call-type specific rules (30% weight)
 * 3. Description keyword matching (30% weight)
 * 
 * No external API needed — pure algorithmic matching.
 */

// Call-type specific preferred tags
const CALL_TYPE_TAGS = {
  RESUME_REVAMP: ["big-tech", "senior-developer", "system-design", "tech"],
  JOB_MARKET_GUIDANCE: ["good-communication", "career-coaching", "public-company"],
  MOCK_INTERVIEW: ["mock-interviews", "same-domain"],
};

// Extract keywords from text
function extractKeywords(text) {
  if (!text) return [];
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "must", "to", "of",
    "in", "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "during", "before", "after", "above", "below", "between", "and", "but",
    "or", "nor", "not", "so", "yet", "both", "either", "neither", "each",
    "every", "all", "any", "few", "more", "most", "other", "some", "such",
    "no", "only", "own", "same", "than", "too", "very", "just", "also",
    "who", "which", "what", "that", "this", "these", "those", "it", "its",
    "i", "me", "my", "he", "him", "his", "she", "her", "we", "us", "our",
    "they", "them", "their", "you", "your", "looking", "needs", "wants",
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

// Jaccard similarity between two arrays
function jaccardSimilarity(a, b) {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a.map((t) => t.toLowerCase()));
  const setB = new Set(b.map((t) => t.toLowerCase()));
  const intersection = [...setA].filter((x) => setB.has(x));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}

// Keyword overlap score
function keywordOverlap(textA, textB) {
  const kwA = extractKeywords(textA);
  const kwB = extractKeywords(textB);
  if (kwA.length === 0 || kwB.length === 0) return 0;
  const setA = new Set(kwA);
  const setB = new Set(kwB);
  const intersection = [...setA].filter((x) => setB.has(x));
  return intersection.length / Math.max(setA.size, setB.size);
}

// Call-type bonus score
function callTypeScore(mentorTags, callType, userTags) {
  const preferredTags = CALL_TYPE_TAGS[callType] || [];
  const mentorTagsLower = mentorTags.map((t) => t.toLowerCase());

  let score = 0;
  let maxPossible = preferredTags.length;

  for (const tag of preferredTags) {
    if (mentorTagsLower.includes(tag)) {
      score += 1;
    }
  }

  // For mock interviews, bonus for domain overlap with user
  if (callType === "MOCK_INTERVIEW" && userTags.length > 0) {
    const domainTags = userTags.filter((t) =>
      ["tech", "non-tech", "frontend", "backend", "data-science", "system-design"].includes(t.toLowerCase())
    );
    const mentorDomainMatch = domainTags.filter((t) =>
      mentorTagsLower.includes(t.toLowerCase())
    );
    if (domainTags.length > 0) {
      score += (mentorDomainMatch.length / domainTags.length) * 2;
      maxPossible += 2;
    }
  }

  return maxPossible > 0 ? score / maxPossible : 0;
}

export async function getRecommendations(req, res, next) {
  try {
    const { userId } = req.params;
    const { callType } = req.query;

    if (!callType || !["RESUME_REVAMP", "JOB_MARKET_GUIDANCE", "MOCK_INTERVIEW"].includes(callType)) {
      return res.status(400).json({ error: "Valid callType required: RESUME_REVAMP, JOB_MARKET_GUIDANCE, MOCK_INTERVIEW" });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, tags: true, description: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Get all mentors
    const mentors = await prisma.user.findMany({
      where: { role: "MENTOR" },
      select: { id: true, name: true, email: true, tags: true, description: true },
    });

    // Score each mentor
    const scored = mentors.map((mentor) => {
      const tagScore = jaccardSimilarity(user.tags, mentor.tags);
      const ctScore = callTypeScore(mentor.tags, callType, user.tags);
      const descScore = keywordOverlap(user.description, mentor.description);

      // Weighted final score
      const totalScore = tagScore * 0.3 + ctScore * 0.4 + descScore * 0.3;

      // Generate explanation
      const matchedTags = user.tags.filter((t) =>
        mentor.tags.map((mt) => mt.toLowerCase()).includes(t.toLowerCase())
      );

      let reasons = [];
      if (matchedTags.length > 0) reasons.push(`Matching tags: ${matchedTags.join(", ")}`);
      if (ctScore > 0.5) reasons.push(`Strong match for ${callType.replace(/_/g, " ").toLowerCase()}`);
      if (descScore > 0.2) reasons.push("Profile description aligns well");

      return {
        mentor: { id: mentor.id, name: mentor.name, email: mentor.email, tags: mentor.tags, description: mentor.description },
        score: Math.round(totalScore * 100),
        breakdown: {
          tagMatch: Math.round(tagScore * 100),
          callTypeMatch: Math.round(ctScore * 100),
          descriptionMatch: Math.round(descScore * 100),
        },
        matchedTags,
        reasons: reasons.length > 0 ? reasons : ["General match based on profile analysis"],
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    res.json({
      userId: user.id,
      userName: user.name,
      callType,
      recommendations: scored,
    });
  } catch (e) {
    next(e);
  }
}
