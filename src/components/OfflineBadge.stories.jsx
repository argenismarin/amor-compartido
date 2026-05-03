import OfflineBadge from './OfflineBadge';

export default {
  title: 'Components/OfflineBadge',
  component: OfflineBadge,
};

export const Offline = {
  args: { isOnline: false, pendingCount: 0 },
};

export const OfflineWithPending = {
  args: { isOnline: false, pendingCount: 3 },
};

export const Syncing = {
  args: { isOnline: true, pendingCount: 5 },
};

export const Hidden = {
  args: { isOnline: true, pendingCount: 0 },
};
