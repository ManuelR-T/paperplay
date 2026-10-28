import { reportScientificCorpus } from '../lib/evaluation/scientific-corpus';
// Pure local conformance report. No source download or inference.
process.stdout.write(JSON.stringify(reportScientificCorpus(),null,2)+'\n');
