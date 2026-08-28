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

  const classes = [];
  const mermaidImage = {
    alt: "",
    classList: { add: (className) => classes.push(className) },
    naturalWidth: 640,
    parentElement: {
      parentElement: {
        querySelector: () => ({ innerText: "Gegevensstroom" }),
      },
    },
    style: "width: 0",
    width: 0,
  };
  processors[2](null, {
    querySelectorAll: () => [mermaidImage],
  });
  assert.equal(mermaidImage.alt, "Gegevensstroom");
  assert.equal(mermaidImage.style, null);
  assert.deepEqual(classes, ["mermaid"]);
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
