// Action tier classification for Super Admin operations
// Tier 1: SAFE - Instant, no confirmation
// Tier 2: RISKY - Requires confirmation + justification
// Tier 3: DANGEROUS - Delayed execution, re-auth, cancelable

export type ActionTier = 'tier1' | 'tier2' | 'tier3';

export interface ActionConfig {
  tier: ActionTier;
  label: string;
  description: string;
  requiresJustification: boolean;
  requiresReauth: boolean;
  delayMinutes: number;
  affectsUsers: boolean;
  isReversible: boolean;
  warningMessage?: string;
}

// Action type to tier mapping
export const ACTION_CONFIGS: Record<string, ActionConfig> = {
  // TIER 1 - SAFE (Instant)
  'edit_content_text': {
    tier: 'tier1',
    label: 'Edit Content Text',
    description: 'Edit non-critical text content',
    requiresJustification: false,
    requiresReauth: false,
    delayMinutes: 0,
    affectsUsers: false,
    isReversible: true,
  },
  'edit_announcement': {
    tier: 'tier1',
    label: 'Edit Announcement',
    description: 'Update announcement banner',
    requiresJustification: false,
    requiresReauth: false,
    delayMinutes: 0,
    affectsUsers: false,
    isReversible: true,
  },
  'view_data': {
    tier: 'tier1',
    label: 'View Data',
    description: 'Read-only data access',
    requiresJustification: false,
    requiresReauth: false,
    delayMinutes: 0,
    affectsUsers: false,
    isReversible: true,
  },
  
  // TIER 2 - RISKY (Confirmed)
  'change_fee': {
    tier: 'tier2',
    label: 'Change Registration Fee',
    description: 'Modify the registration fee amount',
    requiresJustification: true,
    requiresReauth: false,
    delayMinutes: 0,
    affectsUsers: true,
    isReversible: true,
    warningMessage: 'This will affect all future payments.',
  },
  'toggle_feature': {
    tier: 'tier2',
    label: 'Toggle Feature',
    description: 'Enable or disable a system feature',
    requiresJustification: true,
    requiresReauth: false,
    delayMinutes: 0,
    affectsUsers: true,
    isReversible: true,
    warningMessage: 'This may prevent users from accessing certain features.',
  },
  'change_role': {
    tier: 'tier2',
    label: 'Change User Role',
    description: 'Modify user permissions',
    requiresJustification: true,
    requiresReauth: false,
    delayMinutes: 0,
    affectsUsers: true,
    isReversible: true,
    warningMessage: 'This affects what the user can access.',
  },
  'add_skill': {
    tier: 'tier2',
    label: 'Add Skill',
    description: 'Add a new skill option',
    requiresJustification: true,
    requiresReauth: false,
    delayMinutes: 0,
    affectsUsers: false,
    isReversible: true,
  },
  'edit_skill': {
    tier: 'tier2',
    label: 'Edit Skill',
    description: 'Modify skill details',
    requiresJustification: true,
    requiresReauth: false,
    delayMinutes: 0,
    affectsUsers: true,
    isReversible: true,
  },
  'deactivate_skill': {
    tier: 'tier2',
    label: 'Deactivate Skill',
    description: 'Hide skill from selection',
    requiresJustification: true,
    requiresReauth: false,
    delayMinutes: 0,
    affectsUsers: true,
    isReversible: true,
    warningMessage: 'Students will no longer be able to select this skill.',
  },
  
  // TIER 3 - DANGEROUS (Delayed & Guarded)
  'system_freeze': {
    tier: 'tier3',
    label: 'Freeze System',
    description: 'Disable all system operations',
    requiresJustification: true,
    requiresReauth: true,
    delayMinutes: 5,
    affectsUsers: true,
    isReversible: true,
    warningMessage: 'This will prevent ALL users from performing any actions!',
  },
  'maintenance_mode': {
    tier: 'tier3',
    label: 'Enable Maintenance Mode',
    description: 'Put system in read-only mode',
    requiresJustification: true,
    requiresReauth: true,
    delayMinutes: 5,
    affectsUsers: true,
    isReversible: true,
    warningMessage: 'Users will only be able to view, not modify data.',
  },
  'payment_override': {
    tier: 'tier3',
    label: 'Override Payment Status',
    description: 'Manually change payment status',
    requiresJustification: true,
    requiresReauth: true,
    delayMinutes: 5,
    affectsUsers: true,
    isReversible: false,
    warningMessage: 'This bypasses payment verification. Use with extreme caution.',
  },
  'force_status_change': {
    tier: 'tier3',
    label: 'Force Application Status',
    description: 'Manually override application status',
    requiresJustification: true,
    requiresReauth: true,
    delayMinutes: 5,
    affectsUsers: true,
    isReversible: true,
    warningMessage: 'This bypasses the normal workflow.',
  },
  'bulk_operation': {
    tier: 'tier3',
    label: 'Bulk Operation',
    description: 'Perform action on multiple records',
    requiresJustification: true,
    requiresReauth: true,
    delayMinutes: 10,
    affectsUsers: true,
    isReversible: false,
    warningMessage: 'Bulk operations are difficult to reverse.',
  },
  'regenerate_id': {
    tier: 'tier3',
    label: 'Regenerate ID Card',
    description: 'Create new ID card version',
    requiresJustification: true,
    requiresReauth: true,
    delayMinutes: 5,
    affectsUsers: true,
    isReversible: false,
    warningMessage: 'This invalidates the previous ID card.',
  },
  'delete_user': {
    tier: 'tier3',
    label: 'Delete User',
    description: 'Permanently remove user account',
    requiresJustification: true,
    requiresReauth: true,
    delayMinutes: 10,
    affectsUsers: true,
    isReversible: false,
    warningMessage: 'This action CANNOT be undone!',
  },
  'ban_user': {
    tier: 'tier3',
    label: 'Ban User',
    description: 'Permanently ban user from system',
    requiresJustification: true,
    requiresReauth: true,
    delayMinutes: 5,
    affectsUsers: true,
    isReversible: true,
    warningMessage: 'User will lose all access immediately.',
  },
  'reset_application': {
    tier: 'tier3',
    label: 'Reset Application',
    description: 'Delete all application data for user',
    requiresJustification: true,
    requiresReauth: true,
    delayMinutes: 5,
    affectsUsers: true,
    isReversible: false,
    warningMessage: 'This will delete forms, ID cards, and reset status.',
  },
  'disable_payments': {
    tier: 'tier3',
    label: 'Disable All Payments',
    description: 'Stop all payment processing',
    requiresJustification: true,
    requiresReauth: true,
    delayMinutes: 5,
    affectsUsers: true,
    isReversible: true,
    warningMessage: 'No payments can be processed while disabled.',
  },
};

export const getActionConfig = (actionType: string): ActionConfig => {
  return ACTION_CONFIGS[actionType] || {
    tier: 'tier2',
    label: actionType,
    description: 'Unknown action',
    requiresJustification: true,
    requiresReauth: false,
    delayMinutes: 0,
    affectsUsers: false,
    isReversible: true,
  };
};

export const getTierColor = (tier: ActionTier): string => {
  switch (tier) {
    case 'tier1': return 'text-green-500 bg-green-500/10 border-green-500/20';
    case 'tier2': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    case 'tier3': return 'text-red-500 bg-red-500/10 border-red-500/20';
  }
};

export const getTierLabel = (tier: ActionTier): string => {
  switch (tier) {
    case 'tier1': return 'SAFE';
    case 'tier2': return 'RISKY';
    case 'tier3': return 'DANGEROUS';
  }
};
