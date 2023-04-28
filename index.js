// BOT

const { Client, Events, GatewayIntentBits, ActivityType } = require('discord.js');
const { TOKEN, PORT, CHANNELS } = require('./config.json');
const Spell = require("./spell");
const spells = require("./spells.json").map(x => new Spell(x));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: `to your spells.`, type: ActivityType.Listening }],
    status: 'online',
  });
});

client.on("messageCreate", msg => {
  if (msg.author.bot) return;
  if (!CHANNELS.includes(msg.channel.id)) return;
  let spell = findSpell(msg.content);
  if (!spell) return;
  let response = spell.chooseResponse().replace("%userid", msg.member.user.id);
  msg.channel.send({ content: response });
})

client.login(TOKEN);

findSpell = msg => spells.find(s => s.trigger.test(msg));


// WEBSERVER

const expr = require("express");
const app = expr();

app.set("view engine", "ejs");;

app.get("/", (req, res) => {
  res.render("dash", { spells });
});

app.listen(PORT);