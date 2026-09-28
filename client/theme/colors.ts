// Design system — color tokens (dark + light)
// Source: Claude Design handoff, "Mobile app design project/handoff/01 Foundations.dc.html" (Nocturne redesign).

export interface ColorScheme {
  background: string;
  surface: string;
  surface2: string;
  border: string;
  divider: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  income: string;
  expense: string;
  incomeBg: string;
  expenseBg: string;
  expenseText: string;
  warning: string;
  warningBg: string;
  accent: string;
  accentDim: string;
  accentBorder: string;
  accentText: string;
  onAccent: string;
  skeleton: string;
  uncategorized: string;
  scrim: string;
  tabBarBg: string;
  inputBg: string;
  inputBgSheet: string;
  placeholder: string;
  statusBarStyle: 'light' | 'dark';
  // Distinct hues for per-category chart slices/legend — kept separate from
  // income/expense/accent so a chart color is never confused with those
  // meanings elsewhere in the UI. Uncategorized always uses `uncategorized`,
  // never a ramp hue.
  chartPalette: string[];
}

const dark: ColorScheme = {
  background: '#161826',
  surface: '#232532',
  surface2: '#1f2130',
  border: '#3f424d',
  divider: 'rgba(233,233,237,0.14)',
  text: '#e9e9ed',
  textSecondary: '#9397ab',
  textMuted: '#75798c',
  income: '#7cbf8e',
  incomeBg: 'rgba(124,191,142,0.13)',
  expense: '#e0786e',
  expenseBg: 'rgba(224,120,110,0.13)',
  expenseText: '#e0786e',
  warning: '#d8a657',
  warningBg: 'rgba(216,166,87,0.13)',
  accent: '#9184d9',
  accentDim: '#2b2741',
  accentBorder: 'rgba(145,132,217,0.55)',
  accentText: '#d2cefd',
  onAccent: '#161826',
  skeleton: '#2c2e3c',
  uncategorized: '#4a4d5a',
  scrim: 'rgba(10,11,18,0.72)',
  tabBarBg: '#161826',
  inputBg: '#232532',
  inputBgSheet: '#161826',
  placeholder: '#75798c',
  statusBarStyle: 'light',
  chartPalette: ['#968ae0', '#d2cefd', '#75798c', '#5d5294', '#b2b6ca'],
};

const light: ColorScheme = {
  background: '#eef0f9',
  surface: '#f7f8fe',
  surface2: '#e4e7f5',
  border: '#dcdfee',
  divider: 'rgba(31,33,48,0.12)',
  text: '#1f2130',
  textSecondary: '#595d6c',
  textMuted: '#75798c',
  income: '#3b7650',
  incomeBg: 'rgba(59,118,80,0.10)',
  expense: '#b4453d',
  expenseBg: 'rgba(180,69,61,0.09)',
  expenseText: '#b4453d',
  warning: '#8f6219',
  warningBg: 'rgba(143,98,25,0.10)',
  accent: '#5d5294',
  accentDim: '#e7e5fe',
  accentBorder: 'rgba(93,82,148,0.5)',
  accentText: '#423a6a',
  onAccent: '#eef0f9',
  skeleton: '#e1e4f1',
  uncategorized: '#c3c7d9',
  scrim: 'rgba(31,33,48,0.45)',
  tabBarBg: '#eef0f9',
  inputBg: '#f7f8fe',
  inputBgSheet: '#eef0f9',
  placeholder: '#75798c',
  statusBarStyle: 'dark',
  // Design doc only specifies --c1 (#968ae0) and --uncat (#c3c7d9) for light
  // mode; --c2..--c5 derived from the dark ramp (lightness raised, saturation
  // reduced to sit legibly on #eef0f9/#f7f8fe) to keep rank-based hue meaning
  // consistent across themes.
  chartPalette: ['#968ae0', '#c3bef0', '#8b8fa3', '#7b71ad', '#c7cadb'],
};

export const colors = { dark, light };

export const currency = { symbol: '৳', locale: 'en-IN' };
