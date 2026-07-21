# Revisão de segurança

- Todas as tabelas novas são account-scoped e têm RLS.
- Leitura exige associação à conta; escrita é diferenciada entre admin e agent.
- Credenciais de ferramentas não ficam em `allowed_tools`; devem referenciar cofres/configuração segura.
- Outputs devem conter resumos e evidências, não dados clínicos integrais.
- Aprovação humana é obrigatória por padrão para ações externas.
- A migration é aditiva e não altera dados existentes.
