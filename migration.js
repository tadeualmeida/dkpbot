// migration.js

require('dotenv').config();
const mongoose = require('mongoose');
const Dkp = require('./schema/Dkp');
const RoleConfig = require('./schema/RoleConfig');
const ChannelConfig = require('./schema/ChannelConfig');
const DkpParameter = require('./schema/DkParameter');
const DkpMinimum = require('./schema/DkpMinimum');
const EventTimer = require('./schema/EventTimer');
const GuildBank = require('./schema/GuildBank');
const GuildConfig = require('./schema/GuildConfig');

// Configuração da conexão com o MongoDB
const mongoURI = process.env.MONGODB_URI;

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'Erro na conexão com o MongoDB:'));
db.once('open', async function () {
  console.log('Conectado ao MongoDB com sucesso!');

  try {
    // Obter todos os guildIds únicos dos esquemas antigos
    const guildIds = await Dkp.distinct('guildId');

    for (const guildId of guildIds) {
      // Inicializar uma nova configuração da guilda
      const newGuildConfig = {
        guildId,
        guildName: '',
        eventTimer: 10,
        minimumPoints: 0,
        dkpParameters: [],
        roles: [],
        channels: [],
        totalDkp: 0,
        crows: 0
      };

      // Migrar GuildName
      const guildConfig = await GuildConfig.findOne({ guildId });
      if (guildConfig) {
        newGuildConfig.guildName = guildConfig.guildName;
      }

      // Migrar DkpParameters
      const dkpParameters = await DkpParameter.find({ guildId });
      newGuildConfig.dkpParameters = dkpParameters.map(param => ({
        name: param.name,
        points: param.points
      }));

      // Migrar Roles
      const roles = await RoleConfig.find({ guildId });
      newGuildConfig.roles = roles.map(role => ({
        commandGroup: role.commandGroup,
        roleId: role.roleId
      }));

      // Migrar Channels
      const channelConfig = await ChannelConfig.findOne({ guildId });
      if (channelConfig) {
        newGuildConfig.channels = channelConfig.channels;
      }

      // Migrar MinimumPoints
      const dkpMinimum = await DkpMinimum.findOne({ guildId });
      if (dkpMinimum) {
        newGuildConfig.minimumPoints = dkpMinimum.minimumPoints;
      }

      // Migrar EventTimer
      const eventTimer = await EventTimer.findOne({ guildId });
      if (eventTimer) {
        newGuildConfig.eventTimer = eventTimer.EventTimer;
      }

      // Migrar Crows
      const guildBank = await GuildBank.findOne({ guildId });
      if (guildBank) {
        newGuildConfig.crows = guildBank.crows;
      }

      // Calcular e Migrar TotalDkp
      const totalDkpAgg = await Dkp.aggregate([
        { $match: { guildId } },
        { $group: { _id: null, total: { $sum: "$points" } } }
      ]);

      newGuildConfig.totalDkp = totalDkpAgg.length > 0 ? totalDkpAgg[0].total : 0;

      // Salvar a nova configuração da guilda
      await GuildConfig.findOneAndUpdate(
        { guildId },
        newGuildConfig,
        { upsert: true }
      );

      console.log(`Migração concluída para a guilda ${guildId}`);
    }

    console.log('Migração concluída para todas as guildas!');
  } catch (error) {
    console.error('Erro durante a migração:', error);
  } finally {
    mongoose.connection.close();
  }
});
