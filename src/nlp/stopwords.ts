export const ptStopwords = new Set([
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
  "você", "vocês", "sobre", "anos", "ano", "meses", "mes", "dia", "dias", "atuar", "busca",
  "buscamos", "procuramos", "empresa", "vaga", "trabalho", "área", "nossa", "nosso", "fazer",
  "será", "estamos", "terá", "dia-a-dia", "dia a dia", "requisitos", "diferenciais"
]);

export const enStopwords = new Set([
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
  "you've", "your", "yours", "yourself", "yourselves", "years", "year", "role", "team",
  "looking", "seeking", "requirements", "responsibilities", "qualifications", "experience"
]);

export function getStopwords(lang: "pt" | "en"): Set<string> {
  return lang === "pt" ? ptStopwords : enStopwords;
}
