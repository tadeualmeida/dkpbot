// utils/permissions.js
const { PermissionsBitField } = require('discord.js');
const { getGamesFromCache } = require('../utils/cacheManagement');

// Define which commands belong to which group
const commandGroups = {
  users: [
    'bank',
    'dkp',
    'rank',
    'join',
    'help'
  ],
  moderators: [
    'event',
    'showhelp',
    'reminder'
  ],
  administrators: [
    'dkpadd',
    'dkpremopve',
    'addcrow',
    'removecrow',
    'reset',
    'rankreport',
    'config'
  ]
};

// Build the “effective” command list per group, inheriting lower tiers
const allCommands = {
  users: [...commandGroups.users],
  moderators: [...commandGroups.users, ...commandGroups.moderators],
  administrators: [...commandGroups.users, ...commandGroups.moderators, ...commandGroups.administrators]
};

// Map our “group” names to the schema keys in GuildConfig.games[].roles
const roleKeyMap = {
  users: 'user',
  moderators: 'mod',
  administrators: 'admin'
};

// Given a member and a list of role IDs, return true if they have any of them
function memberHasAnyRole(member, roleIds) {
  return roleIds.some(id => member.roles.cache.has(id));
}

/**
 * Check whether `interaction.member` may run `commandName`.
 * Administrators bypass all checks. Otherwise we:
 *  1. Find which “group” the command lives in (users|moderators|administrators)
 *  2. For that group, collect _all_ roles they should inherit
 *  3. Verify the member has at least one of those roles in the current game or globally
 */
async function checkRolePermission(interaction, commandName) {
  // 1) Discord‐level admin always allowed
  if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return true;
  }

  // 2) Figure out which group this command lives in
  const entry = Object.entries(allCommands).find(([, cmds]) => cmds.includes(commandName));
  if (!entry) {
    await interaction.reply({ content: 'Unknown command or permissions not configured.', ephemeral: true });
    return false;
  }
  const [group] = entry; // 'users' | 'moderators' | 'administrators'

  // 3) Determine which “role buckets” we should check against
  //    e.g. group='moderators' → ['mod','admin']
  const buckets = {
    users: ['user'],
    moderators: ['mod', 'user'],
    administrators: ['admin', 'mod', 'user']
  }[group];

  // 4) Pull the game key (if any) or treat as “global”
  const rawGame = interaction.options.getString('game') || interaction.options.getString('key');
  const gameKey = rawGame?.toLowerCase() || null;

  // 5) Load your games array
  const gamesArr = await getGamesFromCache(interaction.guildId);

  // 6) Collect all valid role IDs
  let validRoles = [];
  if (gameKey) {
    const gameCfg = gamesArr.find(g => g.key === gameKey);
    if (gameCfg) {
      for (const bucket of buckets) {
        validRoles.push(...(gameCfg.roles[bucket] || []));
      }
    }
  } else {
    // no game specified: pull from every game
    for (const game of gamesArr) {
      for (const bucket of buckets) {
        validRoles.push(...(game.roles[bucket] || []));
      }
    }
  }

  // 7) Finally check the member’s roles
  if (!memberHasAnyRole(interaction.member, validRoles)) {
    await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    return false;
  }

  return true;
}

module.exports = { checkRolePermission };
