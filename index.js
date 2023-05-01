// BOT

const { Client, Events, GatewayIntentBits, ActivityType } = require('discord.js');
const vm = require("vm");
const { convert } = require("convert");
const { TOKEN, PORT, CHANNELS } = require('./config.json');
const Spell = require("./spell");
const spells = require("./spells.json").map(x => new Spell(x));

CHANNELS.forEach(c => c = c.split(" ")[0]);

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
  let response = spell.chooseResponse();
  if (response.startsWith("=>")) {
    response = vm.runInContext(response.slice(2), vm.createContext({ msg: msg.content, convertStr }));
  }
  msg.channel.send({ content: response.replace("%userid", msg.member.user.id) });
})

client.login(TOKEN);

const findSpell = msg => spells.find(s => s.match(msg));
const unitcorrections = {
  f: "F",
  c: "C",
  d: "days",
  "°": "deg",
  sqmm: "square millimeters",
  sqcm: "square centimeters",
  sqdm: "square decimeters",
  sqm: "square meters",
  sqkm: "square kilometers",
  sqin: "square inches",
  sqft: "square feet",
  sqmi: "square miles",
  sqyd: "square yards"
}
const displayunits = {
  F: " °F",
  C: " °C",
  "square millimeters": "mm²",
  "square centimeters": "cm²",
  "square decimeters": "dm²",
  "square meters": "m²",
  "square kilometers": "km²",
  "square inches": "in²",
  "square feet": "ft²",
  "square miles": "mi²",
  "square yards": "yd²",
  "cubic millimeters": "mm³",
  "cubic centimeters": "cm³",
  "cubic decimeters": "dm³",
  "cubic meters": "m³",
  "cubic kilometers": "km³",
  "cubic inches": "in³",
  "cubic feet": "ft³",
  "cubic miles": "mi³",
  "cubic yards": "yd³",
  "rad": "",
  "deg": "°"
};
const convertStr = (from, to) => {
  let index = from.search(/[^.\,\d]/i);
  try {
    let fromvalue = parseFloat(from.slice(0, index).replace(",", "."));
    let fromunit = from.slice(index).toLowerCase().trim();
    fromunit = unitcorrections[fromunit] || fromunit;
    to = unitcorrections[to] || to;
    try {
      return convert(fromvalue, fromunit).to(to) + " " + (displayunits[to] || to);
    } catch (_) {
      return "Don't know that one..."
    }
  } catch (_) {
    return "Your Number is a bit off..."
  }
};


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