// BOT

const { Client, Events, GatewayIntentBits, ActivityType } = require('discord.js');
const vm = require("vm");
const fs = require("fs");
const { convert, convertMany } = require("convert");
const { evaluate } = require("mathjs");
const { TOKEN, PORT } = require('./config.json');
const { unitcorrections, displayunits, timezones } = require("./constants.json");
let CHANNELS = require('./config.json').CHANNELS.map(x => x.split(" ")[0]);
const Spell = require("./spell");

let spellfiles = fs.readdirSync(__dirname).filter(x => x.startsWith("spells-"));
let newest = Math.max(...spellfiles.map(x => new Date(parseInt(x.substring(7).split(".")[0])).getTime()));
const spells = require(`./spells-${newest}.json`).map(x => new Spell(x));
let ans = null;

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
  // check special spells here for simplicity
  if (/^carl (calculate|calc|eval|c|math) /.test(msg.content)) {
    let response = (msg => {
      try {
        let p = msg.slice(5);
        p = p.slice(p.trim().indexOf(" "));
        return p + ' = ' + doMath(p);
      } catch (_) { return "Aint a thing" }})(msg.content);
    return msg.channel.send({ content: response });
  } else if (/^carl (convert|conv|translate|tl?)/.test(msg.content)) {
    let response = (msg => {
      let from = msg.slice(5);
      from = from.slice(from.trim().indexOf(" "));
      let i = from.search(/ to | in /i);
      let to = from.slice(i + 4);
      from = from.slice(0, i);
      return convertStr(from.trim(), to.trim(), msg);
    })(msg.content);
    return msg.channel.send({ content: response });
  }
  let spell = findSpell(msg.content);
  if (!spell) return;
  let response = spell.chooseResponse();
  if (response.startsWith("=>")) {
    response = vm.runInContext(response.slice(2), vm.createContext({
      msg: msg.content, convertStr, doMath
    }));
  }
  msg.channel.send({ content: response.replace("%userid", msg.member.user.id) });
})

client.login(TOKEN);

const ansregex = /that|ans|la(te)?st/gi;
const findSpell = msg => spells.find(s => s.match(msg));
const doMath = p => ans = evaluate(p.replace(ansregex, ans));
const convertStr = (from, to, msg) => {
  console.log({ from, to, msg });
  if (ansregex.test(from)) {
    console.log("using ans:", ans);
    from = ans
  };
  to = (unitcorrections[to] || to).trim();
  if (/^\d+' ?\d+(''|")?$/i.test(from)) { //* FOOT NOTATION
    try {
      return ans = convertMany(from.replace("'", "ft ").replace("''", "").replace('"', "") + "in")
        .to(to) + " " + (displayunits[to] || to);
    } catch (_) {
      return "Don't know that one...";
    }
  } else {
    let index = from.search(/[^.\,\d:]/i);
    let fromunit = from.slice(index).toLowerCase().trim();
    let fromvalue = from.slice(0, index).replace(",", ".");
    if ((fromunit.toUpperCase() in timezones || from.toLowerCase() == "now") && to.toUpperCase() in timezones) { //* TIMEZONES
      let hour, minute;
      let now = from.toLowerCase() == "now";
      try {
        if (now) {
          hour = new Date().getUTCHours();
          minute = new Date().getUTCMinutes();
          fromunit = "UTC";
        } else {
          let split = fromvalue.split(":");
          hour = parseInt(split[0]);
          minute = parseInt(split[1] || "0");
        }
      } catch (_) {
        return "Your Number is a bit off...";
      }
      let offset = timezones[to.toUpperCase()] - timezones[fromunit.toUpperCase()];
      offset += (offset != 0) * (offset > 0 ? 0 : 1);
      hour += offset;
      minute += Math.floor((offset % 1) * 60);
      hour %= 24;
      minute %= 60;
      if (hour < 0) hour += 24;
      if (minute < 0) minute += 60;
      let pm = hour > 12;
      ans = hour + ":" + minute.toString().padStart(2, "0") + to.toUpperCase();
      return `**${hour}:${minute.toString().padStart(2, "0")}** ${to.toUpperCase()} or ` +
        `${hour % 12 || 12}:${minute.toString().padStart(2, "0")} ${pm ? "PM" : "AM"} ${to.toUpperCase()}` +
        (!now ? `, **${Math.trunc(offset)}:${((offset % 1) * 60).toString().padStart(2, "0")}** offset.` : "");
    }
    try {
      if (isNaN(fromvalue)) throw "";
      fromvalue = parseFloat(fromvalue);
    } catch (_) {
      return "Your Number is a bit off...";
    }
    fromunit = unitcorrections[fromunit] || fromunit;
    try { //* CONVERSION
      return ans = convert(fromvalue, fromunit).to(to) + " " + (displayunits[to] || to);
    } catch (_) {
      try { //* BACKUP CONVERTMANY
        return ans = convertMany(from).to(to) + " " + (displayunits[to] || to);
      } catch (_) {
        return "Don't know that one...";
      }
    }
  }
};


// WEBSERVER

const expr = require("express");
const app = expr();

app.set("view engine", "ejs");

app.get("/", (_, res) => {
  res.render("dash", { spells });
});
app.post("/", expr.json(), (req, res) => {
  let { method, spell, response, data } = req.body;
  console.log({ method, spell, response, data });
  if (response) response = parseInt(response.trim());
  if (!method) return res.sendStatus(400);
  const s = spells[parseInt(spell.trim())];
  console.log({ method, spell, response, data, s });
  switch (method) {
    case "create":
      if (!spell || !data) return res.sendStatus(400);
      spells.push(new Spell({
        trigger: spell,
        responses: [data.replaceAll("\\n", "\n")]
      }));
      break;
    case "weight":
      if (!spell || response === "" || !data) return res.sendStatus(400);
      if (response >= s.responses.length) s.responses[response] = {};
      if (!data) s.responses.splice(response, 1);
      else s.responses[response].weight = parseFloat(data);
      break;
    case "spell":
      if (!spell || !data) return res.sendStatus(400);
      s.trigger = new RegExp(data, "i");
      break;
    case "response":
      if (!spell || response === "" || !data) return res.sendStatus(400);
      if (typeof s.responses[response] == "undefined") s.responses[response] = {};
      s.responses[response].text = data.trim().replaceAll("\\n", "\n");
      break;
    case "delete":
      if (!spell) return res.sendStatus(400);
      spells.splice(spell, 1);
      break;
  }
  res.sendStatus(204);
  savespells();
});

app.listen(PORT);

function savespells() {
  fs.writeFileSync(`spells-${Date.now()}.json`, JSON.stringify(spells.map(x => x.toJSON())), "utf8");
}