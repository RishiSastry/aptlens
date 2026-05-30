import { z } from "zod";

export const userPreferencesSchema = z.object({
  budgetMaxMonthly: z.number().positive().optional(),
  moveInBy: z.string().optional(),
  bedrooms: z.array(z.string()).optional(),
  pet: z.object({
    hasPet: z.boolean(),
    type: z.enum(["dog", "cat"]).optional(),
    weightLb: z.number().positive().optional(),
  }),
  parking: z.enum(["required", "nice_to_have", "not_needed"]),
  worksFromHome: z.boolean(),
  priorities: z.object({
    cost: z.number().min(0).max(10),
    petFit: z.number().min(0).max(10),
    wfhFit: z.number().min(0).max(10),
    parking: z.number().min(0).max(10),
    storage: z.number().min(0).max(10),
    evidenceCompleteness: z.number().min(0).max(10),
  }),
});

export const analyzeRequestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(8),
  preferences: userPreferencesSchema,
});
