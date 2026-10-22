import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const masterProfilesTable = sqliteTable("master_profiles", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  headline: text("headline").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  location: text("location"),
  linkedin: text("linkedin"),
  github: text("github"),
  portfolio: text("portfolio"),
  summary: text("summary").notNull(),
  skills: text("skills").notNull(), // JSON string array
  experiences: text("experiences").notNull(), // JSON string array of Experience objects
  education: text("education").notNull(), // JSON string array of Education objects
  certifications: text("certifications").notNull(), // JSON string array
  rawText: text("raw_text"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export const jobsTable = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  jobUrl: text("job_url"),
  status: text("status").notNull(), // 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED'
  language: text("language").notNull().default("pt"), // 'pt' | 'en'
  rawDescription: text("raw_description").notNull(),
  topKeywords: text("top_keywords").notNull(), // JSON array of keyword objects
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export const tailoredResumesTable = sqliteTable("tailored_resumes", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  tailoredTitle: text("tailored_title").notNull(),
  tailoredSummary: text("tailored_summary").notNull(),
  tailoredSkills: text("tailored_skills").notNull(), // JSON string array
  tailoredExperiences: text("tailored_experiences").notNull(), // JSON string array
  tailoredEducation: text("tailored_education").notNull(), // JSON string array
  scoreBefore: real("score_before").notNull(),
  scoreAfter: real("score_after").notNull(),
  keywordsAchieved: text("keywords_achieved").notNull(), // JSON array
  keywordsMissing: text("keywords_missing").notNull(), // JSON array
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export const knockoutQuestionsTable = sqliteTable("knockout_questions", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  candidateAnswer: text("candidate_answer"),
  aiSuggestedAnswer: text("ai_suggested_answer"),
  status: text("status").notNull().default("Pendente"), // 'Pendente' | 'Aprovada'
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export type MasterProfile = typeof masterProfilesTable.$inferSelect;
export type InsertMasterProfile = typeof masterProfilesTable.$inferInsert;
export type Job = typeof jobsTable.$inferSelect;
export type InsertJob = typeof jobsTable.$inferInsert;
export type TailoredResume = typeof tailoredResumesTable.$inferSelect;
export type InsertTailoredResume = typeof tailoredResumesTable.$inferInsert;
export type KnockoutQuestion = typeof knockoutQuestionsTable.$inferSelect;
export type InsertKnockoutQuestion = typeof knockoutQuestionsTable.$inferInsert;
