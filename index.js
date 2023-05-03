// BOT

const { Client, Events, GatewayIntentBits, ActivityType } = require('discord.js');
const vm = require("vm");
const fs = require("fs");
const { convert, convertMany } = require("convert");
const { TOKEN, PORT } = require('./config.json');
const { unitcorrections, displayunits, timezones } = require("./constants.json");
let CHANNELS = require('./config.json').CHANNELS.map(x => x.split(" ")[0]);
const Spell = require("./spell");

let spellfiles = fs.readdirSync(__dirname).filter(x => x.startsWith("spells-"));
console.log(spellfiles.map(x => x.substring(7).split(".")[0]));
let newest = Math.max(...spellfiles.map(x => new Date(parseInt(x.substring(7).split(".")[0])).getTime()));
console.log(newest);
const spells = require(`./spells-${newest}.json`).map(x => new Spell(x));

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
const convertStr = (from, to) => {
  to = (unitcorrections[to] || to).trim();
  if (/^\d+' ?\d+(''|")?$/i.test(from)) { //* FOOT NOTATION
    try {
      return convertMany(from.replace("'", "ft ").replace("''", "").replace('"', "") + "in")
        .to(to) + " " + (displayunits[to] || to);
    } catch (_) {
      return "Don't know that one...";
    }
  } else {
    let index = from.search(/[^.\,\d:]/i);
    let fromunit = from.slice(index).toLowerCase().trim();
    let fromvalue = from.slice(0, index).replace(",", ".");
    if (fromunit.toUpperCase() in timezones && to.toUpperCase() in timezones) { //* TIMEZONES
      let hour, minute;
      try {
        let split = fromvalue.split(":");
        hour = parseInt(split[0]);
        minute = parseInt(split[1] || "0");
      } catch (_) {
        return "Your Number is a bit off...";
      }
      let offset = timezones[to.toUpperCase()] - timezones[fromunit.toUpperCase()];
      offset += (offset != 0) * (offset > 0 ? -1 : 1);
      hour += offset;
      minute += Math.floor((offset % 1) * 60);
      hour %= 24;
      minute %= 60;
      if (hour < 0) hour += 24;
      if (minute < 0) minute += 60;
      let pm = hour > 12;
      return `**${hour}:${minute.toString().padStart(2, "0")}** ${to.toUpperCase()} or ` +
        `${hour % 12 || 12}:${minute.toString().padStart(2, "0")} ${pm ? "PM" : "AM"} ${to.toUpperCase()}, ` +
        `**${Math.trunc(offset)}:${((offset % 1) * 60).toString().padStart(2, "0")}** offset.`;
    }
    try {
      if (isNaN(fromvalue)) throw "";
      fromvalue = parseFloat(fromvalue);
    } catch (_) {
      return "Your Number is a bit off...";
    }
    fromunit = unitcorrections[fromunit] || fromunit;
    try { //* CONVERSION
      return convert(fromvalue, fromunit).to(to) + " " + (displayunits[to] || to);
    } catch (_) {
      try { //* BACKUP CONVERTMANY
        return convertMany(from).to(to) + " " + (displayunits[to] || to);
      } catch (_) {
        return "Don't know that one...";
      }
    }
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
  // console.log({ method, spell, response, data });
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
  savespells();
});

app.listen(PORT);

function savespells() {
  fs.writeFileSync(`spells-${new Date().getTime()}.json`);
}