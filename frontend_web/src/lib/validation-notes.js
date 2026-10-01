// lib/validation.js — PATCH
// Problema identificado:
//
// 1. schemas.register.name usa z.string().min(2).max(100)
//    → Aceita qualquer string Unicode — portanto JÁ suporta acentos e espaços.
//    → O problema NÃO estava aqui, mas no frontend que usava type="email"
//      e atributos HTML (required, minLength, pattern) que o browser validava
//      ANTES de chamar o backend, bloqueando caracteres especiais.
//
// 2. schemas.register.email usa z.string().email().optional()
//    → Já é opcional no Zod. O problema era o frontend enviar string vazia ""
//      em vez de undefined, fazendo o Zod tentar validar "" como email válido
//      e falhar. Fix: enviar undefined quando vazio (já corrigido no frontend).
//
// 3. schemas.login.username usa z.string().min(3).max(30)
//    → Não tem regex — aceita qualquer string de 3-30 chars no login.
//    → No register, username tem regex /^[a-zA-Z0-9_]+$/ que é correto
//      (username é um identificador, não deve ter acentos/espaços).
//      O frontend agora mostra esta restrição claramente ao utilizador.
//
// RESUMO DO QUE FOI CORRIGIDO:
// ─────────────────────────────
// Frontend register/page.tsx:
//   ✓ Removido type="email" do campo de email (substituído por type="text" + inputMode="email")
//   ✓ Removido required, minLength, pattern de todos os campos
//   ✓ Validação feita manualmente antes do fetch, com mensagens traduzidas
//   ✓ Email enviado como undefined quando vazio (não como string "")
//   ✓ Nome aceita qualquer caractere Unicode (sem restrição HTML)
//   ✓ Mensagens de erro do backend traduzidas para o idioma do utilizador
//   ✓ noValidate no <form> desliga toda validação nativa do browser
//
// O schema Zod do backend NÃO precisa de alterações — já está correto.
// Se quiser tornar a validação do name ainda mais explícita, pode usar:
//
//   name: z.string()
//     .min(2, 'Nome muito curto')
//     .max(100, 'Nome muito longo')
//     .transform(s => s.trim())  // remove espaços extras nas pontas
//
// Mas o comportamento atual já aceita "Maria João da Silva", "José Álvarez",
// "Nguyễn Văn An", etc. — qualquer string Unicode de 2-100 chars.

export const validationNotes = {
  nameSupport:  'Unicode completo — aceita acentos, espaços, caracteres especiais',
  emailOptional:'Deve ser undefined (não "") para o Zod tratar como ausente',
  usernameRule: 'Apenas [a-zA-Z0-9_] — é um identificador, não um nome de exibição',
};
