import { createTheme } from '@mantine/core';

// Thème « Vert-ardoise » : accent unique sarcelle, police Inter, rayons 8/12/16.
// Appliqué globalement (voir main.tsx et App.tsx). Palettes brand/accent/navy conservées.
export const theme = createTheme({
  primaryColor: 'sarcelle',
  primaryShade: 7,

  colors: {
    // Sarcelle (jetons --tk-accent-*)
    sarcelle: [
      '#f0fdfa', '#ccfbf1', '#6ee7c8', '#5eead4', '#5eead4',
      '#14b8a6', '#0d9488', '#0f766e', '#134e4a', '#134e4a',
    ],
    // Indigo (couleur de marque)
    brand: [
      '#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8',
      '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81',
    ],
    // Violet (accent)
    accent: [
      '#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa',
      '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95',
    ],
    // Navy conservé pour les en-têtes sombres
    navy: [
      '#eef3f9', '#d0deef', '#b0c7e4', '#90b0d9', '#7099ce',
      '#4f82c3', '#3669a9', '#295080', '#1b365d', '#12233c',
    ],
  },

  fontFamily: "'Inter', 'Segoe UI', Roboto, system-ui, sans-serif",
  headings: { fontFamily: "'Inter', 'Segoe UI', Roboto, system-ui, sans-serif", fontWeight: '700' },

  radius: { sm: '8px', md: '12px', lg: '16px' },
  defaultRadius: 'md',

  shadows: {
    xs: '0 1px 2px rgba(16,24,40,0.05)',
    sm: '0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04)',
    md: '0 4px 12px rgba(16,24,40,0.08)',
    lg: '0 12px 28px rgba(16,24,40,0.10)',
  },

  components: {
    Button: {
      defaultProps: { radius: 'md' },
      styles: { root: { fontWeight: 600 } },
    },
    ActionIcon: { defaultProps: { radius: 'md' } },
    Card: {
      defaultProps: { radius: 'lg' },
    },
    Badge: {
      defaultProps: { radius: 'sm' },
      styles: { root: { textTransform: 'none', fontWeight: 600, letterSpacing: 'normal' } },
    },
    Modal: {
      defaultProps: { radius: 'lg', overlayProps: { blur: 0 } },
      styles: { content: { borderRadius: '16px' }, overlay: { backdropFilter: 'none' } },
    },
    TextInput: { defaultProps: { radius: 'md' } },
    NumberInput: { defaultProps: { radius: 'md' } },
    Select: { defaultProps: { radius: 'md' } },
    MultiSelect: { defaultProps: { radius: 'md' } },
    PasswordInput: { defaultProps: { radius: 'md' } },
    Textarea: { defaultProps: { radius: 'md' } },
    Pagination: { defaultProps: { radius: 'md' } },
    Title: { styles: { root: { fontWeight: 700 } } },
    Alert: { defaultProps: { radius: 'md' } },
    Tooltip: { defaultProps: { radius: 'sm' } },
  },
});

export default theme;
