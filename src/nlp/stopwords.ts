// Exhaustive list of generic Portuguese HR, job posting, and boilerplate stopwords
export const ptStopwords = new Set([
  // Grammatical words & prepositions
  "a", "à", "ao", "aos", "aquela", "aquelas", "aquele", "aqueles", "aquilo", "as", "às",
  "até", "com", "como", "da", "das", "de", "dela", "delas", "dele", "deles", "depois",
  "do", "dos", "e", "é", "ela", "elas", "ele", "eles", "em", "entre", "era", "eram",
  "éramos", "essa", "essas", "esse", "esses", "esta", "estas", "este", "estes", "estou",
  "eu", "foi", "fomos", "for", "foram", "fosse", "fossem", "fui", "há", "haja", "hajam",
  "isso", "isto", "já", "lhe", "lhes", "mais", "mas", "me", "mesmo", "meu", "meus",
  "minha", "minhas", "muito", "na", "não", "nas", "nem", "no", "nos", "nós", "nossa",
  "nossas", "nosso", "nossos", "num", "numa", "o", "os", "ou", "para", "pela", "pelas",
  "pelo", "pelos", "por", "qual", "quando", "que", "quem", "são", "se", "seja", "sejam",
  "sem", "ser", "será", "serão", "seu", "seus", "só", "sua", "suas", "também", "te",
  "tem", "têm", "temos", "tenha", "tenham", "ter", "teu", "teus", "tinha", "tinham",
  "toda", "todas", "todo", "todos", "tu", "tua", "tuas", "um", "uma", "umas", "uns",
  "você", "vocês", "sobre",

  // Generic HR & Job Posting Stopwords (PROHIBITED from being extracted as tech skills)
  "experiência", "experiencia", "experiências", "experiencias",
  "ciência", "ciencia", "ciências", "ciencias",
  "sólida", "solida", "sólido", "solido", "sólidos", "solidos", "sólidas", "solidas",
  "conhecimento", "conhecimentos",
  "requisito", "requisitos",
  "diferencial", "diferenciais",
  "trabalho", "trabalhar", "trabalhando", "equipe", "equipes", "time", "times",
  "empresa", "empresas",
  "ano", "anos", "mês", "mes", "meses", "dia", "dias", "dia-a-dia", "dia a dia",
  "superior", "completo", "completa", "completos", "completas",
  "atuar", "atuação", "atuacao", "atuando",
  "desenvolvimento", "desenvolver", "desenvolvedor", "desenvolvedora", "desenvolvedores",
  "vaga", "vagas", "busca", "buscamos", "procuramos", "procura",
  "profissional", "profissionais",
  "ferramenta", "ferramentas",
  "prática", "práticas", "pratica", "praticas",
  "matemático", "matematico", "matemática", "matematica",
  "projeto", "projetos",
  "responsabilidade", "responsabilidades",
  "habilidade", "habilidades", "competência", "competências", "competencias",
  "qualificação", "qualificações", "qualificacao", "qualificacoes",
  "atividade", "atividades", "benefício", "benefícios", "beneficio", "beneficios",
  "oportunidade", "oportunidades",
  "nível", "nivel", "pleno", "senior", "sênior", "junior", "júnior", "especialista", "lead",
  "liderança", "lideranca", "área", "area", "áreas", "areas",
  "forma", "forte", "grande", "bom", "boa", "capacidade", "foco", "focado", "focada",
  "vivência", "vivencia", "perfil", "candidato", "candidata", "pessoa", "pessoas",
  "mandatório", "mandatorio", "desejável", "desejavel", "necessário", "necessario",
  "fazer", "estamos", "terá", "gostar", "ter", "ser", "buscar", "trazer", "criar", "construir",
  "informação", "informações", "informacao", "informacoes", "adicional", "adicionais",
  "incluindo", "responsável", "responsavel", "sustentável", "sustentavel", "flexível", "flexivel",
  "dados", "inteligência", "inteligencia", "direta", "pontuais", "específicos", "especificos", "geral",
  "ampla", "segurança", "seguranca", "tempo", "diferentes", "fuso", "fusos", "horários", "horarios",
  "nuvem", "plataforma", "plataformas", "linguagem", "programação", "programacao", "serviço", "serviços", "servico", "servicos",

  // Internal NLP & ATS System terms (PROHIBITED from ever appearing as technical skills)
  "tfidf", "tf-idf", "tf idf", "algoritmo", "algoritmos", "algorithm", "algorithms",
  "parser", "parsers", "parsing", "parse", "score", "scores", "scoring",
  "ats", "audit", "nlp", "matcher", "ranking", "rank", "stemmer", "stemming",
  "token", "tokens", "tokenizer", "vetor", "vector", "cosine", "densidade", "density"
]);

// Exhaustive list of generic English HR, job posting, and boilerplate stopwords
export const enStopwords = new Set([
  // Grammatical words & prepositions
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any",
  "are", "aren't", "as", "at", "be", "because", "been", "before", "being", "below",
  "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't",
  "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for",
  "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having",
  "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him",
  "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in",
  "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most",
  "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only",
  "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
  "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some",
  "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
  "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
  "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
  "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's",
  "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why",
  "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're",
  "you've", "your", "yours", "yourself", "yourselves",

  // Generic HR & Job Posting Stopwords
  "experience", "experiences", "knowledge",
  "requirement", "requirements",
  "differential", "differentials",
  "job", "jobs", "work", "working", "team", "teams", "company", "companies",
  "year", "years", "month", "months", "day", "days",
  "higher", "degree", "bachelor", "bachelors", "master", "masters", "complete", "completed",
  "act", "acting", "development", "develop", "developer", "developers",
  "opening", "openings", "search", "seeking", "looking", "look",
  "professional", "professionals", "tool", "tools", "practice", "practices",
  "science", "math", "mathematical",
  "project", "projects", "responsibility", "responsibilities",
  "skill", "skills", "qualification", "qualifications", "activity", "activities",
  "benefit", "benefits", "opportunity", "opportunities",
  "level", "mid", "senior", "junior", "specialist", "lead", "leadership", "role", "roles",
  "position", "positions", "area", "areas",
  "strong", "good", "capacity", "focus", "focused", "profile", "candidate", "candidates",
  "person", "people", "mandatory", "desirable", "necessary", "solid", "proven", "track", "record",
  "plus", "nice", "to", "have", "hands-on", "proficient", "proficiency", "ability",

  // Internal NLP & ATS System terms
  "tfidf", "tf-idf", "tf idf", "algorithm", "algorithms", "algoritmo", "algoritmos",
  "parser", "parsers", "parsing", "parse", "score", "scores", "scoring",
  "ats", "audit", "nlp", "matcher", "ranking", "rank", "stemmer", "stemming",
  "token", "tokens", "tokenizer", "vector", "vetor", "cosine", "density", "densidade"
]);

export function getStopwords(lang: "pt" | "en"): Set<string> {
  return lang === "pt" ? ptStopwords : enStopwords;
}
