/**
 * Navigation state for a learning quiz. Answers become immutable after the
 * learner checks them, but questions may be revisited in any order.
 */
export function moduleQuizNavigation(questions = [], currentIndex = 0) {
  const total = questions.length;
  const checkedCount = questions.reduce((count, question) => count + (question?.checked ? 1 : 0), 0);
  const firstUnansweredIndex = questions.findIndex((question) => !question?.checked);
  const index = total ? Math.max(0, Math.min(total - 1, currentIndex)) : 0;
  const isLast = total > 0 && index === total - 1;
  const allChecked = total > 0 && checkedCount === total;
  const nextIndex = index < total - 1
    ? index + 1
    : firstUnansweredIndex >= 0 ? firstUnansweredIndex : null;

  return { total, checkedCount, firstUnansweredIndex, allChecked, isLast, nextIndex };
}
