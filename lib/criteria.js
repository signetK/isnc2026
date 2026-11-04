// Criteria for Evaluation (Research Category). Keys and maximums must match CRITERIA in public/index.html.
// s1 = Research Structure (40), s2 = Significance of Research Results (30), s3 = Presentation (30). Total 100.
export const EVALUATORS = 3;
export const CRITERIA = [
  { k: '1a', max: 10, sec: 's1' }, // Coherence of rationale, objectives, framework & methodology
  { k: '1b', max: 10, sec: 's1' }, // Attainment of objectives
  { k: '1c', max: 10, sec: 's1' }, // Presentation of results
  { k: '1d', max: 10, sec: 's1' }, // Appropriateness and soundness of analysis
  { k: '2a', max: 10, sec: 's2' }, // Contribution to new knowledge / S&T advancement; originality
  { k: '2b', max: 10, sec: 's2' }, // Relevance to regional development priorities
  { k: '2c', max: 10, sec: 's2' }, // Applicability and significance of outputs
  { k: '3a', max: 15, sec: 's3' }, // Clarity, style and creativeness of presentation
  { k: '3b', max: 15, sec: 's3' }, // Appropriateness of replies to inquiries
];
