// ==UserScript==
// @name         Ágora - Ciplex para Internação
// @namespace    https://ciplexsistemas.com/
// @version      1.0.0
// @description  Envia o paciente aberto no Ciplex para a ficha local de tratamento hospitalar.
// @author       Gabriel Coelho
// @match        https://ciplexsistemas.com/sistema/exibir*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @connect      127.0.0.1
// @updateURL    https://raw.githubusercontent.com/gcgvet/Ficha-internamento/main/ciplex-para-internacao.user.js
// @downloadURL  https://raw.githubusercontent.com/gcgvet/Ficha-internamento/main/ciplex-para-internacao.user.js
// ==/UserScript==

(function () {
  "use strict";

  const API_URL = "http://127.0.0.1:8765/api/integracoes/ciplex";
  const BUTTON_CLASS = "agora-enviar-internacao";
  let injectionTimer;

  function scopedElement(scope, id) {
    const matches = [...scope.querySelectorAll(`[id="${id}"]`)];
    return matches.find(element => element.offsetParent !== null) || matches.at(-1) || null;
  }

  function value(scope, id) {
    return scopedElement(scope, id)?.value?.trim() || "";
  }

  function selectedText(scope, id) {
    const select = scopedElement(scope, id);
    return select?.selectedOptions?.[0]?.textContent?.trim() || "";
  }

  function calculateAge(birthDate) {
    const match = birthDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return "";
    const birth = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    const today = new Date();
    if (Number.isNaN(birth.getTime()) || birth > today) return "";

    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    if (today.getDate() < birth.getDate()) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    if (years <= 0) return `${Math.max(months, 0)} meses`;
    return months ? `${years} anos e ${months} meses` : `${years} anos`;
  }

  function brazilianDateValue(text) {
    const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return 0;
    return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
  }

  function latestWeight(animalRoot, animalId) {
    const panel = animalRoot.querySelector(`[id="pesagens-animal-${animalId}"]`);
    if (!panel) return "";
    const entries = [...panel.querySelectorAll("table tbody tr")]
      .map(row => {
        const cells = row.querySelectorAll("td");
        return cells.length >= 3 ? {
          date: brazilianDateValue(cells[1].textContent.trim()),
          weight: cells[2].textContent.trim()
        } : null;
      })
      .filter(entry => entry?.weight);
    entries.sort((first, second) => second.date - first.date);
    return entries[0]?.weight || "";
  }

  function clientScope(animalRoot) {
    let scope = animalRoot.parentElement;
    while (scope && scope !== document.body) {
      if (scope.querySelector('[id="PessoaNome"]')) return scope;
      scope = scope.parentElement;
    }
    return document;
  }

  function tutorPhone(scope) {
    const ddd = value(scope, "PessoaFone0Ddd").replace(/\D/g, "");
    const number = value(scope, "PessoaFone0Numero");
    if (ddd && number) return `(${ddd}) ${number}`;
    return number;
  }

  function extractPatient(animalRoot) {
    const ciplexAnimalId = value(animalRoot, "AnimalIdAnimal");
    const tutorArea = clientScope(animalRoot);
    const age = value(animalRoot, "AnimalIdade")
      || calculateAge(value(animalRoot, "AnimalDtNascimento"));
    const neuteredValue = value(animalRoot, "AnimalCastrado");

    return {
      ciplexAnimalId,
      recordNumber: ciplexAnimalId,
      weight: latestWeight(animalRoot, ciplexAnimalId),
      name: value(animalRoot, "AnimalNome"),
      species: selectedText(animalRoot, "AnimalIdEspecie"),
      breed: selectedText(animalRoot, "AnimalIdRaca"),
      sex: selectedText(animalRoot, "AnimalSexo"),
      age,
      neutered: neuteredValue === "1" || selectedText(animalRoot, "AnimalCastrado").toLowerCase() === "sim",
      tutor: value(tutorArea, "PessoaNome"),
      contact: tutorPhone(tutorArea)
    };
  }

  function sendPatient(patient) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: API_URL,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(patient),
        timeout: 6000,
        onload(response) {
          let result;
          try {
            result = JSON.parse(response.responseText);
          } catch {
            reject(new Error("A aplicação local retornou uma resposta inválida."));
            return;
          }
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(result.erro || "Não foi possível enviar o paciente."));
            return;
          }
          resolve(result);
        },
        ontimeout() {
          reject(new Error("A aplicação local não respondeu a tempo."));
        },
        onerror() {
          const error = new Error("A aplicação local não está aberta.");
          error.localAppUnavailable = true;
          reject(error);
        }
      });
    });
  }

  function openLocalRecord(url) {
    if (typeof GM_openInTab === "function") {
      GM_openInTab(url, { active: true, insert: true, setParent: true });
    } else {
      window.open(url, "_blank", "noopener");
    }
  }

  async function handleImport(button, animalRoot) {
    const originalText = button.textContent;
    const patient = extractPatient(animalRoot);
    if (!patient.ciplexAnimalId || !patient.name) {
      window.alert("Não foi possível identificar o ID e o nome do animal aberto no Ciplex.");
      return;
    }

    button.disabled = true;
    button.textContent = "Enviando...";
    try {
      const result = await sendPatient(patient);
      button.textContent = result.created ? "Ficha criada" : "Abrindo ficha";
      openLocalRecord(result.url);
    } catch (error) {
      if (error.localAppUnavailable) {
        window.alert("Abra o atalho 'Tratamento Hospitalar' na Área de Trabalho e clique novamente em 'Enviar para internação'.");
      } else {
        window.alert(error.message);
      }
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = originalText;
      }, 1500);
    }
  }

  function addButton(animalRoot) {
    const registration = animalRoot.querySelector('[id^="cadastro-animal-"]');
    const anchor = registration?.querySelector("button.salvarFechar");
    if (!anchor || registration.querySelector(`.${BUTTON_CLASS}`)) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn btn-white btn-round btn-minier btn-info ${BUTTON_CLASS}`;
    button.style.marginLeft = "4px";
    button.textContent = "Enviar para internação";
    button.addEventListener("click", () => handleImport(button, animalRoot));
    anchor.insertAdjacentElement("afterend", button);
  }

  function injectButtons() {
    document.querySelectorAll(".tab-pane.animal").forEach(addButton);
  }

  function scheduleInjection() {
    window.clearTimeout(injectionTimer);
    injectionTimer = window.setTimeout(injectButtons, 120);
  }

  const observer = new MutationObserver(scheduleInjection);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", scheduleInjection);
  injectButtons();
})();
