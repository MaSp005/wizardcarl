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

app.get("/", (_, res) => {
  res.render("dash", { spells });
});
app.post("/", expr.json(), (req, res) => {
  let { method, spell, response, data } = req.body;
  console.log({ method, spell, response, data });
  if (typeof spell != "undefined") spell = parseInt(spell.trim());
  if (typeof response != "undefined") response = parseInt(response.trim());
  if (!method) return res.sendStatus(400);
  const s = spells[spell];
  switch (method) {
    case "create":
      if (typeof spell == "undefined" || typeof response == "undefined") return res.sendStatus(400);
      spells.push(new Spell({
        trigger: spell,
        responses: [response]
      }));
      break;
    case "weight":
      if (typeof spell == "undefined" || typeof response == "undefined" || typeof data == "undefined") return res.sendStatus(400);
      if (response >= s.responses.length) s.responses[response] = {};
      if (!data) s.responses.splice(response, 1);
      else s.responses[response].weight = parseFloat(data);
      break;
    case "spell":
      if (typeof spell == "undefined" || typeof data == "undefined") return res.sendStatus(400);
      s.trigger = new RegExp(data, "i");
      break;
    case "response":
      if (typeof spell == "undefined" || typeof response == "undefined" || typeof data == "undefined") return res.sendStatus(400);
      if (typeof s.responses[response] == "undefined") s.responses[response] = {};
      s.responses[response].text = data.trim();
      break;
    case "delete":
      if (typeof spell == "undefined") return res.sendStatus(400);
      spells.splice(spell, 1);
      break;
  }
  res.sendStatus(204);
});

app.listen(PORT);