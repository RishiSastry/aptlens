import { z } from "zod";

export const userPreferencesSchema = z.object({
  budgetMaxMonthly: z.number().positive().optional(),
  moveInBy: z.string().optional(),
  bedrooms: z.array(z.string()).optional(),
  bathrooms: z.array(z.string()).optional(),
  apartmentTypes: z
    .array(z.enum(["studio", "1b", "2b", "3b", "condo", "townhouse"]))
    .optional(),
  lifestylePreferences: z
    .object({
      worksFromHome: z.boolean(),
      hostGuestsOften: z.boolean(),
    })
    .optional(),
  spacePreferences: z
    .object({
      largerBedroom: z.boolean(),
      largerBathroom: z.boolean(),
      largerKitchen: z.boolean(),
      largerLivingRoom: z.boolean(),
      moreStorage: z.boolean(),
      betterWfhLayout: z.boolean(),
      outdoorSpace: z.boolean(),
      preferredOrientation: z.string().optional(),
    })
    .optional(),
  amenityPreferences: z
    .object({
      grill: z.boolean(),
      pool: z.boolean(),
      gym: z.boolean(),
      coworking: z.boolean(),
      packageRoom: z.boolean(),
      dogWash: z.boolean(),
      evCharging: z.boolean(),
    })
    .optional(),
  pet: z.object({
    hasPet: z.boolean(),
    type: z.enum(["dog", "cat"]).optional(),
    count: z.number().int().positive().optional(),
    breed: z.string().optional(),
    weightLb: z.number().positive().optional(),
  }),
  parking: z.enum(["required", "nice_to_have", "not_needed"]),
  parkingPreference: z.enum(["covered", "outdoor", "either"]).optional(),
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
