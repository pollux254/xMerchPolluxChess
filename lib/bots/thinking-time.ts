export function getBotThinkingTimeSeconds(rank: number): number {
  let baseMin: number;
  let baseMax: number;

  if (rank <= 200) {
    baseMin = 1;
    baseMax = 5;
  } else if (rank <= 400) {
    baseMin = 3;
    baseMax = 10;
  } else if (rank <= 600) {
    baseMin = 5;
    baseMax = 15;
  } else if (rank <= 800) {
    baseMin = 10;
    baseMax = 20;
  } else {
    baseMin = 15;
    baseMax = 30;
  }

  // Add slight randomization (±20%)
  const variance = 0.2;
  const min = baseMin * (1 - variance);
  const max = baseMax * (1 + variance);

  return Math.floor(Math.random() * (max - min + 1)) + Math.floor(min);
}

