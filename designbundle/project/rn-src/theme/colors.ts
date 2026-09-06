// xpns Design System — Color tokens
// Usage: const C = useTheme(); C.background, C.income, etc.

export interface ColorScheme {
  background: string;
  surface: string;
  surface2: string;
  surfaceHover: string;
  border: string;
  divider: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  income: string;
  expense: string;
  incomeBg: string;
  expenseBg: string;
  incomeText: string;   // lighter variant for body text on dark bg
  expenseText: string;
  accent: string;
  accentDim: string;
  accentBorder: string;
  accentText: string;   // lighter variant for body text
  tabBarBg: string;
  inputBg: string;
  placeholder: string;
  statusBarStyle: 'light' | 'dark';
}

const dark: ColorScheme = {
  background:   '#0e0f1a',
  surface:      '#161824',
  surface2:     '#1e2033',
  surfaceHover: 'rgba(255,255,255,0.04)',
  border:       'rgba(255,255,255,0.07)',
  divider:      'rgba(255,255,255,0.05)',
  text:         '#e8e9f4',
  textSecondary:'#676985',
  textMuted:    '#3e4060',
  income:       '#52d48a',
  expense:      '#f07272',
  incomeBg:     'rgba(82,212,138,0.12)',
  expenseBg:    'rgba(240,114,114,0.12)',
  incomeText:   '#7de8a8',
  expenseText:  '#f49090',
  accent:       '#9184d9',
  accentDim:    'rgba(145,132,217,0.15)',
  accentBorder: 'rgba(145,132,217,0.30)',
  accentText:   '#b8afee',
  tabBarBg:     'rgba(14,15,26,0.97)',
  inputBg:      '#1e2033',
  placeholder:  '#3e4060',
  statusBarStyle: 'light',
};

const light: ColorScheme = {
  background:   '#f5f6fc',
  surface:      '#ffffff',
  surface2:     '#eef0f8',
  surfaceHover: 'rgba(0,0,0,0.03)',
  border:       'rgba(0,0,0,0.08)',
  divider:      'rgba(0,0,0,0.06)',
  text:         '#1a1b2e',
  textSecondary:'#6b6d88',
  textMuted:    '#b0b2c8',
  income:       '#1fa861',
  expense:      '#d94444',
  incomeBg:     'rgba(31,168,97,0.10)',
  expenseBg:    'rgba(217,68,68,0.10)',
  incomeText:   '#1a9055',
  expenseText:  '#c43030',
  accent:       '#6d5fd4',
  accentDim:    'rgba(109,95,212,0.12)',
  accentBorder: 'rgba(109,95,212,0.30)',
  accentText:   '#5a4fbf',
  tabBarBg:     'rgba(245,246,252,0.97)',
  inputBg:      '#eef0f8',
  placeholder:  '#b0b2c8',
  statusBarStyle: 'dark',
};

export const colors = { dark, light };
