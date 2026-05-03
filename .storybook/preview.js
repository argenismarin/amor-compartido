// Importa los estilos globales reales de la app para que las stories
// se vean identicas a produccion. Esto es CRITICO: si splitteamos
// globals.css en el futuro (ver TOC en globals.css), Storybook + visual
// regression deteccta cualquier cambio de cascade.
import '../src/app/globals.css';

/** @type {import('@storybook/react').Preview} */
const preview = {
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#FFFFFF' },
        { name: 'dark', value: '#1a1a1a' },
        { name: 'pink', value: '#FCE4EC' },
        { name: 'burgundy', value: '#F3E5E7' },
      ],
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  decorators: [
    (Story, context) => {
      // Aplicar data-user al wrapper (theme picker per usuario)
      const userTheme = context.globals.userTheme || 'jenifer';
      return (
        <div data-user={userTheme} style={{ padding: 20, maxWidth: 500, margin: '0 auto' }}>
          <Story />
        </div>
      );
    },
  ],
  globalTypes: {
    userTheme: {
      name: 'Theme (per-user)',
      description: 'Pink (Jenifer) vs Burgundy (Argenis)',
      defaultValue: 'jenifer',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'jenifer', title: '💕 Jenifer (pink)' },
          { value: 'argenis', title: '🍷 Argenis (burgundy)' },
        ],
      },
    },
  },
};

export default preview;
