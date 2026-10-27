'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ImportController, INITIAL_IMPORT_STATE } from './import-controller';
import { createImportStorage } from './import-storage';

export function useImportController() {
  const [controller] = useState(() => new ImportController({
    storage: createImportStorage(),
    extractPdf: async (file, options) => {
      const { extractPdf } = await import('./import/pdf');
      return extractPdf(file, { ...options, name: file.name });
    },
    importArxiv: async (input, options) => {
      const { importArxiv } = await import('./import/arxiv-client');
      return importArxiv(input, options);
    },
  }));
  const [loaded, setLoaded] = useState(false);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => INITIAL_IMPORT_STATE);
  useEffect(() => {
    controller.activate();
    let active = true;
    void controller.refresh().finally(() => { if (active) setLoaded(true); });
    return () => { active = false; controller.dispose(); };
  }, [controller]);
  return {
    ...state,
    loaded,
    current: state.records.find(record => record.id === state.currentId) ?? null,
    select: controller.select,
    importPdf: controller.importPdf,
    importArxiv: controller.importArxiv,
    cancel: controller.cancel,
    resume: controller.resume,
    analyze: controller.analyze,
    remove: controller.remove,
    refresh: controller.refresh,
  };
}
