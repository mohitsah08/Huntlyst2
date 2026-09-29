/**
 * Stagnation Detection & Automatic Query Mutation Engine
 * 
 * Prevents the system from repeatedly returning the same limited results:
 * 1. Detects stagnation: when consecutive searches produce 0 new results or >80% duplicates
 * 2. Triggers automatic strategy rotation (switches across the 8 discovery strategies)
 * 3. Mutates query parameters (sub-industries, synonyms, geography angles)
 * 4. Advances pagination / cursor
 * 5. Evaluates stop conditions (target count satisfied, max iteration budget)
 */

export interface StagnationEvaluation {
  isStagnant: boolean;
  consecutiveStagnantCount: number;
  duplicateRatio: number;
  mutationAction?: 'rotate_strategy' | 'advance_page' | 'mutate_keywords' | 'stop_condition_met';
  reason?: string;
  nextStrategyIndex?: number;
  newPage?: number;
  suggestedMutationKeyword?: string;
}

export class StagnationDetector {
  private static readonly STAGNATION_THRESHOLD = 2; // 2 consecutive redundant rounds
  private static readonly DUPLICATE_RATIO_ALARM = 0.8; // 80% duplicates
  private static readonly MAX_SEARCH_ITERATIONS = 12;

  /**
   * Evaluates the outcome of a search round for stagnation.
   */
  public static evaluate(
    totalDiscovered: number,
    newCandidates: number,
    consecutiveStagnantCount: number,
    currentStrategyIndex: number,
    currentPage: number,
    totalQualifiedSoFar: number,
    targetCount: number,
    iterationCount: number
  ): StagnationEvaluation {
    // 1. Check Stop Condition: Target Satisfied
    if (totalQualifiedSoFar >= targetCount) {
      return {
        isStagnant: false,
        consecutiveStagnantCount: 0,
        duplicateRatio: 0,
        mutationAction: 'stop_condition_met',
        reason: `Target of ${targetCount} qualified leads satisfied.`,
      };
    }

    // 2. Check Stop Condition: Max Iterations Reached
    if (iterationCount >= this.MAX_SEARCH_ITERATIONS) {
      return {
        isStagnant: true,
        consecutiveStagnantCount,
        duplicateRatio: 1,
        mutationAction: 'stop_condition_met',
        reason: `Maximum iteration limit (${this.MAX_SEARCH_ITERATIONS}) reached.`,
      };
    }

    const duplicates = Math.max(0, totalDiscovered - newCandidates);
    const duplicateRatio = totalDiscovered > 0 ? duplicates / totalDiscovered : 1.0;

    // Detect if this round produced no new leads or high duplicate ratio
    const isRoundRedundant = newCandidates === 0 || duplicateRatio >= this.DUPLICATE_RATIO_ALARM;

    const nextStagnantCount = isRoundRedundant ? consecutiveStagnantCount + 1 : 0;

    if (nextStagnantCount >= this.STAGNATION_THRESHOLD) {
      // Rotate to next strategy and advance page
      const nextStrategy = (currentStrategyIndex % 8) + 1;
      const newPage = currentPage + 1;

      return {
        isStagnant: true,
        consecutiveStagnantCount: nextStagnantCount,
        duplicateRatio,
        mutationAction: 'rotate_strategy',
        reason: `Stagnation detected: ${nextStagnantCount} consecutive rounds returned repeating results (${(duplicateRatio * 100).toFixed(0)}% duplicates). Mutating strategy.`,
        nextStrategyIndex: nextStrategy,
        newPage,
      };
    }

    return {
      isStagnant: false,
      consecutiveStagnantCount: nextStagnantCount,
      duplicateRatio,
      newPage: currentPage,
    };
  }
}
