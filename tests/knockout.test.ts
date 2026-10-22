import { describe, expect, it, beforeEach } from "bun:test";
import { createApp } from "../src/api/routes.ts";
import { getDb, resetDbForTesting } from "../src/db/index.ts";
import { masterProfilesTable, jobsTable, knockoutQuestionsTable } from "../src/db/schema.ts";
import { generateKnockoutAnswer } from "../src/services/knockoutAnswerService.ts";

describe("Knockout Questions (Perguntas Eliminatórias) Engine & SQLite CRUD", () => {
  beforeEach(() => {
    resetDbForTesting();
  });

  it("should create, list, update and delete knockout questions via REST API", async () => {
    const app = createApp();
    const db = getDb();

    // Setup master profile & job
    await db.insert(masterProfilesTable).values({
      id: "master-test",
      fullName: "Rodrigo Silva",
      headline: "Senior Software Engineer (Node.js & TypeScript)",
      email: "rodrigo@example.com",
      summary: "Senior Software Engineer com 8 anos de experiência em microsserviços escaláveis, Node.js e TypeScript.",
      skills: JSON.stringify(["Node.js", "TypeScript", "PostgreSQL", "Docker", "AWS"]),
      experiences: JSON.stringify([
        {
          company: "Fintech Core",
          role: "Senior Backend Engineer",
          startDate: "2021",
          endDate: "Atual",
          description: "Arquitetei microsserviços em Node.js e TypeScript com redução de latência em 40% e atendimento a 500k+ usuários."
        }
      ]),
      education: JSON.stringify([
        { institution: "USP", degree: "Bacharelado em Ciência da Computação", startDate: "2015", endDate: "2019" }
      ]),
      certifications: JSON.stringify(["AWS Solutions Architect"]),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await db.insert(jobsTable).values({
      id: "job-knockout-1",
      title: "Senior Node.js Developer",
      company: "Acme Cloud",
      status: "SAVED",
      language: "pt",
      rawDescription: "Buscamos desenvolvedor Node.js e TypeScript para arquitetura de microsserviços.",
      topKeywords: JSON.stringify([
        { term: "node.js", count: 4, tfidf: 3.5, stem: "node.js" },
        { term: "typescript", count: 3, tfidf: 2.8, stem: "typescript" },
        { term: "microsserviços", count: 2, tfidf: 2.1, stem: "microsserviç" }
      ]),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // 1. Create Question
    const createRes = await app.request("/api/jobs/job-knockout-1/knockout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionText: "Qual a sua experiência com desenvolvimento de microsserviços em Node.js e TypeScript?"
      })
    });
    expect(createRes.status).toBe(201);
    const createdData = await createRes.json();
    expect(createdData.success).toBe(true);
    expect(createdData.question.questionText).toBe("Qual a sua experiência com desenvolvimento de microsserviços em Node.js e TypeScript?");
    expect(createdData.question.status).toBe("Pendente");
    const qid = createdData.question.id;

    // 2. List Questions
    const listRes = await app.request("/api/jobs/job-knockout-1/knockout");
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.questions.length).toBe(1);
    expect(listData.questions[0].id).toBe(qid);

    // 3. Generate Intelligent AI Answer
    const genRes = await app.request(`/api/jobs/job-knockout-1/knockout/${qid}/generate`, {
      method: "POST"
    });
    expect(genRes.status).toBe(200);
    const genData = await genRes.json();
    expect(genData.success).toBe(true);
    expect(genData.question.aiSuggestedAnswer).toBeDefined();
    expect(genData.question.aiSuggestedAnswer.length).toBeGreaterThan(50);
    // Should ground response in candidate's experience and metrics
    expect(genData.question.aiSuggestedAnswer).toContain("Node.js");
    expect(genData.question.candidateAnswer).toBe(genData.question.aiSuggestedAnswer);

    // 4. Update Answer & Status (Aprovada)
    const updateRes = await app.request(`/api/jobs/job-knockout-1/knockout/${qid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateAnswer: "Resposta revisada com sucesso.",
        status: "Aprovada"
      })
    });
    expect(updateRes.status).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.question.candidateAnswer).toBe("Resposta revisada com sucesso.");
    expect(updateData.question.status).toBe("Aprovada");

    // 5. Delete Question
    const deleteRes = await app.request(`/api/jobs/job-knockout-1/knockout/${qid}`, {
      method: "DELETE"
    });
    expect(deleteRes.status).toBe(200);

    const reList = await app.request("/api/jobs/job-knockout-1/knockout");
    const reListData = await reList.json();
    expect(reListData.questions.length).toBe(0);
  });

  it("should generate specialized STAR answers across multiple knockout question intents", async () => {
    const profile = {
      fullName: "Rodrigo Silva",
      headline: "Tech Lead & Senior Software Engineer",
      email: "rodrigo@example.com",
      location: "São Paulo, SP",
      summary: "Engenheiro de Software com foco em sistemas distribuídos de alta disponibilidade.",
      skills: ["TypeScript", "Node.js", "Docker", "PostgreSQL", "AWS"],
      experiences: [
        {
          company: "Chamleo",
          role: "Senior Backend Engineer",
          startDate: "2021",
          endDate: "Atual",
          description: "Liderança técnica na arquitetura de microsserviços, reduzindo custos em 35% com Docker e AWS."
        }
      ],
      education: [
        { institution: "USP", degree: "Ciência da Computação", startDate: "2014", endDate: "2018" }
      ]
    };

    const job = {
      title: "Senior Backend Engineer",
      company: "Nubank",
      language: "pt",
      topKeywords: [{ term: "node.js" }, { term: "typescript" }, { term: "aws" }]
    };

    // Notice Period Intent
    const ansNotice = await generateKnockoutAnswer({
      questionText: "Qual a sua disponibilidade para início e aviso prévio?",
      job,
      profile
    });
    expect(ansNotice.toLowerCase()).toContain("disponibilidade");
    expect(ansNotice).toContain("Nubank");

    // Compensation Intent
    const ansSalary = await generateKnockoutAnswer({
      questionText: "Qual a sua pretensão salarial para esta vaga?",
      job,
      profile
    });
    expect(ansSalary.toLowerCase()).toContain("pretensão salarial");

    // Work Model Intent
    const ansRemote = await generateKnockoutAnswer({
      questionText: "Você possui disponibilidade para o modelo híbrido ou remoto em São Paulo?",
      job,
      profile
    });
    expect(ansRemote).toContain("São Paulo");
    expect(ansRemote).toContain("Nubank");

    // Technical STAR Intent
    const ansTech = await generateKnockoutAnswer({
      questionText: "Conte um desafio técnico complexo onde você aplicou microsserviços.",
      job,
      profile
    });
    expect(ansTech).toContain("Chamleo");
    expect(ansTech).toContain("35%");
  });
});
