import type { ActionAPIContext } from "astro:actions";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
  db,
  and,
  eq,
  or,
  WouldYouRatherAnswers,
  WouldYouRatherQuestions,
  WouldYouRatherSessions,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

export const server = {
  createQuestion: defineAction({
    input: z.object({
      prompt: z.string().min(1),
      optionA: z.string().min(1),
      optionB: z.string().min(1),
      category: z.string().optional(),
      language: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const now = new Date();
      const [question] = await db
        .insert(WouldYouRatherQuestions)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          prompt: input.prompt,
          optionA: input.optionA,
          optionB: input.optionB,
          category: input.category,
          language: input.language,
          isSystem: false,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return {
        success: true,
        data: { question },
      };
    },
  }),

  updateQuestion: defineAction({
    input: z.object({
      id: z.string(),
      prompt: z.string().min(1).optional(),
      optionA: z.string().min(1).optional(),
      optionB: z.string().min(1).optional(),
      category: z.string().optional(),
      language: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [existing] = await db
        .select()
        .from(WouldYouRatherQuestions)
        .where(
          and(
            eq(WouldYouRatherQuestions.id, input.id),
            eq(WouldYouRatherQuestions.userId, user.id),
          ),
        );

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Question not found.",
        });
      }

      const updates: Partial<typeof WouldYouRatherQuestions.$inferInsert> = {};

      if (input.prompt) updates.prompt = input.prompt;
      if (input.optionA) updates.optionA = input.optionA;
      if (input.optionB) updates.optionB = input.optionB;
      if (input.category !== undefined) updates.category = input.category;
      if (input.language !== undefined) updates.language = input.language;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      if (Object.keys(updates).length === 0) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "No fields provided to update.",
        });
      }

      updates.updatedAt = new Date();

      const [question] = await db
        .update(WouldYouRatherQuestions)
        .set(updates)
        .where(eq(WouldYouRatherQuestions.id, input.id))
        .returning();

      return {
        success: true,
        data: { question },
      };
    },
  }),

  archiveQuestion: defineAction({
    input: z.object({
      id: z.string(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [existing] = await db
        .select()
        .from(WouldYouRatherQuestions)
        .where(
          and(
            eq(WouldYouRatherQuestions.id, input.id),
            eq(WouldYouRatherQuestions.userId, user.id),
          ),
        );

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Question not found.",
        });
      }

      const [question] = await db
        .update(WouldYouRatherQuestions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(WouldYouRatherQuestions.id, input.id))
        .returning();

      return {
        success: true,
        data: { question },
      };
    },
  }),

  listQuestions: defineAction({
    input: z.object({
      category: z.string().optional(),
      language: z.string().optional(),
      includeMine: z.boolean().default(false),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
    }),
    handler: async (input, context) => {
      const filters = [eq(WouldYouRatherQuestions.isActive, true)];

      if (input.category) {
        filters.push(eq(WouldYouRatherQuestions.category, input.category));
      }

      if (input.language) {
        filters.push(eq(WouldYouRatherQuestions.language, input.language));
      }

      let ownershipFilter = eq(WouldYouRatherQuestions.isSystem, true);

      if (input.includeMine) {
        const user = requireUser(context);
        ownershipFilter = or(
          eq(WouldYouRatherQuestions.isSystem, true),
          eq(WouldYouRatherQuestions.userId, user.id),
        );
      }

      const whereClause = and(ownershipFilter, ...filters);
      const offset = (input.page - 1) * input.pageSize;

      const questions = await db
        .select()
        .from(WouldYouRatherQuestions)
        .where(whereClause)
        .limit(input.pageSize)
        .offset(offset);

      return {
        success: true,
        data: {
          items: questions,
          total: questions.length,
        },
      };
    },
  }),

  createSession: defineAction({
    input: z.object({
      sessionName: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const [session] = await db
        .insert(WouldYouRatherSessions)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          sessionName: input.sessionName,
          createdAt: new Date(),
        })
        .returning();

      return {
        success: true,
        data: { session },
      };
    },
  }),

  endSession: defineAction({
    input: z.object({
      sessionId: z.string(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [session] = await db
        .select()
        .from(WouldYouRatherSessions)
        .where(
          and(
            eq(WouldYouRatherSessions.id, input.sessionId),
            eq(WouldYouRatherSessions.userId, user.id),
          ),
        );

      if (!session) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Session not found.",
        });
      }

      const [updatedSession] = await db
        .update(WouldYouRatherSessions)
        .set({ endedAt: new Date() })
        .where(eq(WouldYouRatherSessions.id, input.sessionId))
        .returning();

      return {
        success: true,
        data: { session: updatedSession },
      };
    },
  }),

  recordAnswer: defineAction({
    input: z.object({
      sessionId: z.string().optional(),
      questionId: z.string(),
      chosenOption: z.enum(["A", "B"]),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      if (input.sessionId) {
        const [session] = await db
          .select()
          .from(WouldYouRatherSessions)
          .where(
            and(
              eq(WouldYouRatherSessions.id, input.sessionId),
              eq(WouldYouRatherSessions.userId, user.id),
            ),
          );

        if (!session) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Session not found.",
          });
        }
      }

      const [question] = await db
        .select()
        .from(WouldYouRatherQuestions)
        .where(
          and(
            eq(WouldYouRatherQuestions.id, input.questionId),
            eq(WouldYouRatherQuestions.isActive, true),
            or(
              eq(WouldYouRatherQuestions.isSystem, true),
              eq(WouldYouRatherQuestions.userId, user.id),
            ),
          ),
        );

      if (!question) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Question not found.",
        });
      }

      const [answer] = await db
        .insert(WouldYouRatherAnswers)
        .values({
          id: crypto.randomUUID(),
          sessionId: input.sessionId,
          questionId: input.questionId,
          userId: user.id,
          chosenOption: input.chosenOption,
          createdAt: new Date(),
        })
        .returning();

      return {
        success: true,
        data: { answer },
      };
    },
  }),
};
