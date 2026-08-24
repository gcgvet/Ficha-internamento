# Ágora - Ciplex para Internação

Userscript do Tampermonkey que adiciona o botão **Enviar para internação** ao cadastro de um animal aberto no Ciplex.

## Publicação no GitHub

1. Edite `ciplex-para-internacao.user.js`.
2. Aumente `@version` (`1.0.0` para `1.0.1`, por exemplo).
3. Publique a alteração na branch `main`.

O Tampermonkey consulta `@updateURL` periodicamente e instala a nova versão quando o número de `@version` aumenta.

## Instalação

Abra no Chrome a URL Raw do arquivo no GitHub:

```text
https://raw.githubusercontent.com/gcgvet/Ficha-internamento/main/ciplex-para-internacao.user.js
```

O Tampermonkey exibirá a tela de instalação. Confirme em **Instalar**.

## Funcionamento

- O sistema local deve ter sido aberto pelo atalho `Tratamento Hospitalar`.
- Pacientes novos são criados com os dados cadastrais do Ciplex.
- Se o ID do Ciplex já estiver entre os internados ativos, a ficha existente é aberta sem sobrescrever seus dados.
- A pasta local não é referenciada pelo userscript; a comunicação é feita por `http://127.0.0.1:8765`.
