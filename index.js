// BOT

const { Client, Events, GatewayIntentBits, ActivityType, REST, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const vm = require("vm");
const fs = require("fs");
const { convert, convertMany } = require("convert");
const { evaluate } = require("mathjs");
const { parse, Equation } = require("algebra.js");
const { CLIENTID, TOKEN, PORT } = require('./config.json');
const { unitcorrections, displayunits, timezones } = require("./constants.json");
const Spell = require("./spell");
const vars = require("./vars.json");
const amogus = require("./amogus").gen;

let spellfiles = fs.readdirSync(__dirname).filter(x => x.startsWith("spells-"));
let newest = Math.max(...spellfiles.map(x => new Date(parseInt(x.substring(7).split(".")[0])).getTime()));
const spells = require(`./spells-${newest}.json`).map(x => new Spell(x));
let ans = null;

let count = -1;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
  ]
});

let vcstartchannel;
let lastamogus = 0;
let guarantee = -1;

client.once(Events.ClientReady, () => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "your spells.", type: ActivityType.Listening }],
    status: 'online',
  });

  vcstartchannel = client.channels.cache.get(vars.vcjoinchannel);

  client.on(Events.VoiceStateUpdate, (old, now) => {
    if (!now.channel) return;
    if (now.channel.members.size == 1 && !old.channel) {
      vcstartchannel.send(vars.vcjoinmsg
        .replace("$username", now.member.displayName)
        .replace("$channelname", now.channel.name)
      );
    }
  });
});

// slash command
const rest = new REST().setToken(TOKEN);
(async () => {
  await rest.put(
    Routes.applicationCommands(CLIENTID),
    {
      body: [
        {
          "name": "admin",
          "description": "Lieutenant Carl admin controls. Don't even try.",
          "default_member_permissions": Number(PermissionFlagsBits.ManageGuildExpressions),
          "options": [
            {
              "type": 1,
              "name": "ping",
              "description": "Check bot's ping"
            },
            {
              "type": 1,
              "name": "var",
              "description": "Set a variable.",
              "options": [
                {
                  "type": 3,
                  "name": "variable",
                  "description": "Variable Name",
                  "choices": Object.keys(vars).map(x => ({
                    "name": x,
                    "value": x
                  })),
                  "required": true
                },
                {
                  "type": 3,
                  "name": "value",
                  "description": "Variable Value",
                  "required": true
                }
              ]
            },
            {
              "type": 1,
              "name": "send",
              "description": "Send a custom message.",
              "options": [
                {
                  "type": 3,
                  "name": "message",
                  "description": "Message to be sent.",
                  "required": true
                }
              ]
            },
            {
              "type": 1,
              "name": "react",
              "description": "Imitates your reactions to a message.",
              "options": [
                {
                  "type": 3,
                  "name": "message",
                  "description": "Message ID",
                  "required": true
                },
                {
                  "type": 3,
                  "name": "reaction",
                  "description": "Emoji",
                  "required": true
                }
              ]
            },
            {
              "type": 1,
              "name": "roll",
              "description": "Guarantees a specific spell index on the next random selection.",
              "options": [
                {
                  "type": 4,
                  "name": "index",
                  "description": "Index",
                  "required": true
                }
              ]
            },
            {
              "type": 1,
              "name": "debug",
              "description": "Debug the spell matching for a given message.",
              "options": [
                {
                  "type": 3,
                  "name": "message",
                  "description": "Message to be checked.",
                  "required": true
                }
              ]
            }
          ]
        }
      ]
    },
  );
})();

client.on(Events.MessageCreate, msg => {
  if (msg.author.bot) {
    if (msg.channelId != "1012256902421426277") return;
    if (msg.author.id != "432610292342587392") return;
    if (!msg.content.endsWith("Congratulations, you won an uncommon nothing.")) return;
    msg.channel.send("https://tenor.com/view/gamblecore-stickman-casino-gamble-gif-7118676210396292522")
    return;
  }
  if (!vars.spellchannels.includes(msg.channel.id)) return;
  if (count >= 0 && /^\d+$/.test(msg.content)) {
    let c = parseInt(msg.content);
    if (c == count + 1) count++;
    else {
      count = -1;
      return msg.channel.send({ content: `<@${msg.author.id}> blew it. start over with \`carl count\`.` });
    }
  }
  // check special spells here for simplicity
  if (/^carl count$/.test(msg.content)) {
    count = 1;
    return msg.channel.send({ content: `1` });
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
  } else if (/^carl (calculate|calc|eval|c|math) /.test(msg.content)) {
    let response = (msg => {
      try {
        let p = msg.slice(5);
        p = p.slice(p.trim().indexOf(" "));
        return p.replace(ansregex, ans) + ' = ' + doMath(p);
      } catch (_) { return "Aint a thing" }
    })(msg.content);
    return msg.channel.send({ content: response });
  } else if (/^carl solve .+/.test(msg.content)) {
    let eq;
    try {
      let left_expr = parse(msg.content.slice(11).split("=")[0].trim());
      let right_expr = parse(msg.content.slice(11).split("=")[1].trim());
      eq = new Equation(left_expr, right_expr);
    } catch {
      msg.channel.send("Something went wrong when interpreting your equation... Please check your formatting.\n! Decimal numbers with a . not a ,");
      return;
    }
    try {
      let answer = eq.solveFor("x");
      console.log(answer);
      let str = eq.toString() + " <=> ";
      if (typeof answer == "undefined" || answer == null) str = "This seems to be an equation I cannot solve, here's the door :) :door: [WolframAlpha](<https://www.wolframalpha.com/>)";
      else if (answer.length == 0) str = "↯ No solution found.";
      else if (Array.isArray(answer)) str += answer.map(x => `x = **${x.toString()}**`).join(" ∨ ");
      else str += "x = " + answer.toString();
      msg.channel.send(str);
    } catch (e) {
      console.log(e);
      msg.channel.send("You were either using another variable instead of x, in which case please change the name of it, or you were going beyond linear equations, at which point just go to [WolframAlpha](<https://www.wolframalpha.com/>)...")
    }
    return;
  } else if (/^carl choose .+/.test(msg.content)) {
    msg.channel.send(msg.content.slice(12).split(",")[Math.floor(Math.random() * msg.content.slice(12).split(",").length)].trim())
    return;
  } else if (/^carl amogus$/.test(msg.content)) {
    if (Date.now() - lastamogus < vars.amogustimeout) return msg.react("🥵");
    lastamogus = Date.now();
    msg.channel.sendTyping();
    amogus().then(fn => {
      msg.channel.send({
        files: [{
          attachment: fn,
          name: 'file.png',
          description: 'carl'
        }]
      }).catch(console.error);
    }, () => msg.react("🥴"));
    return;
  }
  let spell = findSpell(msg.content);
  if (!spell) return;
  let response = spell.chooseResponse(guarantee);
  guarantee = -1;
  if (response.startsWith("=>")) {
    response = vm.runInContext(response.slice(2), vm.createContext({
      msg: msg.content.replace(/[^a-z0-9- ]/ig, ""), convertStr, doMath
    }));
  }
  if (!response) return;
  msg.channel.send({ content: response.replace("%userid", msg.member.user.id) });
});

client.on(Events.InteractionCreate, int => {
  if (!int.isCommand()) return;
  if (int.user.id != "439490179968008194") return int.reply({
    content: "You're stepping into unsafe territory... [Unauthorized]",
    ephemeral: true
  });
  switch (int.options.getSubcommand()) {
    case "ping":
      let ts = Date.now();
      int.reply({ content: ":ping_pong: Pong!" }).then(() => {
        int.editReply({ content: ":ping_pong: Pong! " + (Date.now() - ts) + "ms" });
      })
      break;
    case "var":
      let name = int.options.getString("variable");
      let value = int.options.getString("value");
      if (!name || !value || !(name in vars)) return int.reply({
        content: "You're confusing me... [Bad parameters: not defined or invalid]",
        ephemeral: true
      });
      switch (name) {
        case "vcjoinchannel":
          let ch = client.channels.cache.get(value);
          if (ch) {
            vcstartchannel = ch;
            vars.vcstartchannel = value;
            fs.writeFileSync("./vars.json", JSON.stringify(vars), "utf8");
            int.reply({
              content: "Success!",
              ephemeral: true
            });
          } else {
            if (!value.includes("$channelname")) int.reply({
              content: "That won't work out... [Channel not existent]",
              ephemeral: true
            });
          }
          break;
        case "vcjoinmsg":
          if (!value.includes("$channelname")) int.reply({
            content: "You're confusing me... [Bad parameters: need to include $channelname]",
            ephemeral: true
          });
          else if (!value.includes("$username")) int.reply({
            content: "You're confusing me... [Bad parameters: need to include $username]",
            ephemeral: true
          });
          else {
            vars.vcjoinmsg = value;
            fs.writeFileSync("./vars.json", JSON.stringify(vars), "utf8");
            int.reply({
              content: "Success!",
              ephemeral: true
            });
          }
          break;
        case "spellchannels":
          if (value == "list") {
            int.reply({
              embeds: [
                new EmbedBuilder().setTitle("I'm active and listening in:")
                  .setDescription(vars.spellchannels.map(x => `<#${x}>`).join("\n"))
                  .setTimestamp(Date.now())
              ],
              ephemeral: true
            });
          } else if (value.startsWith("+")) {
            vars.spellchannels.push(value.slice(1));
            fs.writeFileSync("./vars.json", JSON.stringify(vars), "utf8");
            int.reply({
              content: `Added <#${value.slice(1)}>!`,
              ephemeral: true
            });
          } else if (value.startsWith("-")) {
            let idx = vars.spellchannels.indexOf(value.slice(1));
            if (idx > -1) vars.spellchannels.splice(idx, 1);
            fs.writeFileSync("./vars.json", JSON.stringify(vars), "utf8");
            int.reply({
              content: `Removed <#${value.slice(1)}>!`,
              ephemeral: true
            });
          } else int.reply({
            content: "You're confusing me... [Bad parameters: need to start with + or -]",
            ephemeral: true
          });
          break;
        case "amogustimeout":
          amogustimeout = Math.abs(parseInt(value));
          int.reply({
            content: "Success!",
            ephemeral: true
          });
        default: int.reply({
          content: "You're confusing me... [Bad parameters]",
          ephemeral: true
        });
      }
      break;
    case "send":
      int.channel.send(int.options.getString("message").replaceAll("\\n", "\n"));
      int.reply({
        content: "Sent.",
        ephemeral: true
      })
      break;
    case "roll":
      guarantee = int.options.getInteger("index");
      int.reply({
        content: "Will do boss o7",
        ephemeral: true
      })
      break;
    case "react":
      let msg = int.channel.messages.cache.get(int.options.getString("message"));
      if (!msg) return int.reply({
        content: "Message id not found.",
        ephemeral: true
      });
      try {
        msg.react(int.options.getString("reaction"));
        int.reply({
          content: "Done.",
          ephemeral: true
        }).then(msg => setTimeout(() => msg.delete(), 1000));
      } catch {
        int.reply({
          content: "Emoji invalid.",
          ephemeral: true
        });
      }
      break;
    case "debug":
      let spell = findSpell(int.options.getString("message"));
      int.reply({
        content: spell ? JSON.stringify(spell) : "No spell matched.",
        ephemeral: true
      });
      break;
    default: int.reply({
      content: "You're confusing me... [Bad parameters]",
      ephemeral: true
    });
  };
});

client.on(Events.MessageReactionAdd, ev => {
  if (ev.message.editable && ev.emoji.name == "❌") ev.message.delete();
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
      if (!spell || response === "") return res.sendStatus(400);
      if (typeof s.responses[response] == "undefined") s.responses[response] = {};
      if (!data) s.responses.splice(response, 1);
      else s.responses[response].text = data.trim().replaceAll("\\n", "\n");
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