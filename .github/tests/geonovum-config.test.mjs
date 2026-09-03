import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const classicConfigUrl = new URL("../../respec/config/geonovum-config.js", import.meta.url);
const moduleConfigUrl = new URL("../../respec/config/geonovum-config.mjs", import.meta.url);

test("classic config owns the generic Mermaid and Geonovum postprocessors", async () => {
  const mermaidProcessor = () => {};
  const context = vm.createContext({
    window: {
      respecMermaid: {
        createFigures: mermaidProcessor,
      },
    },
  });

  vm.runInContext(await readFile(classicConfigUrl, "utf8"), context);

  const processors = vm.runInContext("organisationConfig.postProcess", context);
  assert.equal(processors.length, 3);
  assert.equal(processors[0], mermaidProcessor);

  const issueLink = { textContent: "All issues" };
  processors[1](null, {
    documentElement: { lang: "nl" },
    querySelector: () => issueLink,
  });
  assert.equal(issueLink.textContent, "Alle issues");
});

test("Mermaid postprocessor handles direct and nested data SVG images", async () => {
  const context = vm.createContext({
    window: {
      respecMermaid: {
        createFigures: () => {},
      },
    },
  });

  vm.runInContext(await readFile(classicConfigUrl, "utf8"), context);
  const processors = vm.runInContext("organisationConfig.postProcess", context);

  const directClasses = [];
  const directCaption = {
    querySelector: (selector) =>
      selector === ".fig-title"
        ? { textContent: "  Directe gegevensstroom  " }
        : null,
    textContent: "Figuur 1 Directe gegevensstroom",
  };
  const directImage = {
    alt: "",
    classList: { add: (className) => directClasses.push(className) },
    closest: (selector) =>
      selector === "figure"
        ? { querySelector: () => directCaption }
        : null,
    naturalWidth: 640,
    style: "width: 0",
    width: 0,
  };

  const nestedClasses = [];
  const nestedCaption = {
    querySelector: () => null,
    textContent: "  Geneste gegevensstroom  ",
  };
  const nestedImage = {
    alt: "",
    classList: { add: (className) => nestedClasses.push(className) },
    closest: (selector) =>
      selector === "figure"
        ? { querySelector: () => nestedCaption }
        : null,
    naturalWidth: 0,
    style: "width: 0",
    width: 0,
  };

  processors[2](null, {
    querySelectorAll: (selector) =>
      selector === 'figure img[src^="data:image/svg+xml"]'
        ? [directImage, nestedImage]
        : [],
  });

  assert.equal(directImage.alt, "Directe gegevensstroom");
  assert.equal(directImage.style, null);
  assert.deepEqual(directClasses, ["mermaid"]);

  assert.equal(nestedImage.alt, "Geneste gegevensstroom");
  assert.equal(typeof nestedImage.onload, "function");
  nestedImage.onload({ target: nestedImage });
  assert.equal(nestedImage.style, null);
  assert.deepEqual(nestedClasses, ["mermaid"]);
});

test("module config preserves organisation postprocessors when local processors exist", async () => {
  const mermaidProcessor = () => {};
  const localProcessor = () => {};
  const context = vm.createContext({
    console,
    document: { title: "" },
    window: {
      respecMermaid: {
        createFigures: mermaidProcessor,
      },
    },
  });

  const source = await readFile(moduleConfigUrl, "utf8");
  const configurationModule = new vm.SourceTextModule(source, {
    context,
    importModuleDynamically: async () => {
      const respecModule = new vm.SyntheticModule([], () => {}, { context });
      await respecModule.link(() => {});
      await respecModule.evaluate();
      return respecModule;
    },
  });

  await configurationModule.link(() => {});
  await configurationModule.evaluate();
  configurationModule.namespace.loadRespecWithConfiguration({
    localBiblio: {},
    postProcess: [localProcessor],
    title: "Test document",
  });

  const processors = vm.runInContext("globalThis.respecConfig.postProcess", context);
  assert.equal(processors.length, 4);
  assert.equal(processors[0], mermaidProcessor);
  assert.equal(processors[3], localProcessor);
});
