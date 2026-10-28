import styles from './figure-reading-guide.module.css';

/** Reader-facing context written by Meta alongside its whole-paper illustration plan. */
export type FigureReadingGuide = {
  whyHere: string;
  learningGoal: string;
  interaction: string;
  expectedInsight: string;
};

export function FigureReadingGuideView({guide}:{guide:FigureReadingGuide}) {
  return <div className={styles.guide} aria-label="How this figure helps">
    <p className={styles.context}><strong>{guide.learningGoal}</strong>{guide.whyHere!==guide.learningGoal&&<> {guide.whyHere}</>}</p>
    <dl className={styles.prompts}>
      <div><dt>Try</dt><dd>{guide.interaction}</dd></div>
      <div><dt>Notice</dt><dd>{guide.expectedInsight}</dd></div>
    </dl>
  </div>;
}
