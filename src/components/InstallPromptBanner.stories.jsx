import InstallPromptBanner from './InstallPromptBanner';

const noop = () => {};

export default {
  title: 'Components/InstallPromptBanner',
  component: InstallPromptBanner,
  args: { onInstall: noop, onDismiss: noop },
};

export const Visible = {
  args: { isInstallable: true },
};

export const Hidden = {
  args: { isInstallable: false },
};
