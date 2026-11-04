import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadSerif } from '@remotion/google-fonts/InstrumentSerif';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Paperplay's own palette, so the film and the product read as one thing.
export const C = {
  paper: '#fffdf8',
  ink: '#172f2d',
  soft: '#52635e',
  olive: '#17685b',
  deep: '#0e4b41',
  lime: '#d7edb2',
  bright: '#9cc45a',
  line: '#d9e0d8',
  chrome: '#f2f1ea',
};

export const sans = loadInter('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] }).fontFamily;
export const serif = loadSerif('normal', { weights: ['400'], subsets: ['latin'] }).fontFamily;
export const serifItalic = loadSerif('italic', { weights: ['400'], subsets: ['latin'] }).fontFamily;

export const seconds = (value: number) => Math.round(value * FPS);
