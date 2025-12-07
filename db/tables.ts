/**
 * Would You Rather - this-or-that style questions.
 *
 * Design goals:
 * - Store questions with two (or more) options.
 * - Track simple play sessions and choices (for stats).
 */

import { defineTable, column, NOW } from "astro:db";

export const WouldYouRatherQuestions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text({ optional: true }),          // null for system/global questions

    prompt: column.text(),                            // "Would you rather ..."
    optionA: column.text(),
    optionB: column.text(),
    category: column.text({ optional: true }),        // "funny", "deep", "kids"
    language: column.text({ optional: true }),

    isSystem: column.boolean({ default: false }),
    isActive: column.boolean({ default: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const WouldYouRatherSessions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),

    sessionName: column.text({ optional: true }),     // "Family game night", etc.
    createdAt: column.date({ default: NOW }),
    endedAt: column.date({ optional: true }),
  },
});

export const WouldYouRatherAnswers = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    sessionId: column.text({
      references: () => WouldYouRatherSessions.columns.id,
      optional: true,
    }),
    questionId: column.text({
      references: () => WouldYouRatherQuestions.columns.id,
    }),
    userId: column.text({ optional: true }),          // null if anonymous/local

    chosenOption: column.text({ optional: true }),    // "A" or "B"
    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  WouldYouRatherQuestions,
  WouldYouRatherSessions,
  WouldYouRatherAnswers,
} as const;
