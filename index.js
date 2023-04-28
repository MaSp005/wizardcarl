// BOT

const { Client, Events, GatewayIntentBits } = require('discord.js');
const { TOKEN } = require('./config.json');
const Spell = require("./spell");
const spells = require("./spells.json").map(x => new Spell(x));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on("messageCreate", msg => {
  if (msg.author.bot) return;
  let spell = findSpell(msg.content);
  if (!spell) return;
  let response = spell.chooseResponse().replace("%userid", msg.member.user.id);
  msg.channel.send({ content: response });
})

client.login(TOKEN);

findSpell = msg => spells.find(s => s.trigger.test(msg));